import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { PrintDialogComponent } from './print-dialog.component';
import { ApiService } from '../../../core/services/api.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { PrintFilter } from '../../../core/types';

describe('PrintDialogComponent', () => {
  let fixture: ComponentFixture<PrintDialogComponent>;
  let component: PrintDialogComponent;
  let mockApiService: { print: ReturnType<typeof vi.fn>; getCollection: ReturnType<typeof vi.fn> };
  let mockToastService: { showToast: ReturnType<typeof vi.fn> };
  let closedSpy: ReturnType<typeof vi.fn<() => void>>;
  const language = signal<'de' | 'en'>('de');

  const filter: PrintFilter = { sort: 'artist', sort_order: 'asc', genres: 'Jazz' };

  const cdPage = (items: number) => of({ releases: [], pagination: { page: 1, pages: 1, per_page: 1, items } });

  async function setup(
    inputs: {
      selectedIds?: number[];
      filter?: PrintFilter | null;
      selectedCdIds?: number[];
      cdCount?: Observable<unknown>;
    } = {}
  ): Promise<void> {
    mockApiService = {
      print: vi.fn().mockReturnValue(of(new Blob(['%PDF'], { type: 'application/pdf' }))),
      getCollection: vi.fn().mockReturnValue(inputs.cdCount ?? cdPage(0)),
    };
    mockToastService = { showToast: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PrintDialogComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
        {
          provide: LanguageService,
          useValue: { language, translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrintDialogComponent);
    component = fixture.componentInstance;
    if (inputs.selectedIds) fixture.componentRef.setInput('selectedIds', inputs.selectedIds);
    if (inputs.filter !== undefined) fixture.componentRef.setInput('filter', inputs.filter);
    if (inputs.selectedCdIds !== undefined) fixture.componentRef.setInput('selectedCdIds', inputs.selectedCdIds);
    closedSpy = vi.fn<() => void>();
    component.closed.subscribe(closedSpy);
    fixture.detectChanges();

    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => { });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });
  }

  const query = (testId: string): HTMLInputElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  afterEach(() => {
    language.set('de');
    vi.restoreAllMocks();
  });

  it('offers selection, filter and whole collection and defaults to the selection', async () => {
    await setup({ selectedIds: [1, 2, 3], filter });

    expect(component.scopes()).toEqual(['ids', 'filter', 'all']);
    expect(component.scope()).toBe('ids');
    expect(query('scope-ids')?.checked).toBe(true);
    expect(component.buildRequest()).toEqual({
      template: 'avery-3474',
      scope: { type: 'ids', discogs_ids: [1, 2, 3] },
      options: { language: 'de' },
    });
  });

  it('defaults to the current filters without a selection', async () => {
    await setup({ filter });

    expect(component.scopes()).toEqual(['filter', 'all']);
    expect(component.buildRequest().scope).toEqual({ type: 'filter', filter });
  });

  it('offers only the whole collection without selection and filter', async () => {
    await setup();

    expect(component.scopes()).toEqual(['all']);
    expect(component.buildRequest().scope).toEqual({ type: 'all' });
  });

  it('switches scope and template via the radio buttons', async () => {
    await setup({ selectedIds: [7], filter });
    language.set('en');

    query('scope-all')!.dispatchEvent(new Event('change'));
    query('template-scan-list')!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.buildRequest()).toEqual({
      template: 'scan-list',
      scope: { type: 'all' },
      options: { language: 'en' },
    });
    // The start label only applies to labels
    expect(query('start-position')).toBeNull();
  });

  it('offers the inventory list and counts CDs with the storage filter', async () => {
    const shelfFilter: PrintFilter = { sort: 'artist', sort_order: 'asc', storage_unit: '3', compartment: 2 };
    await setup({ filter: shelfFilter, cdCount: cdPage(0) });

    expect(component.templates).toContain('inventory');
    expect(mockApiService.getCollection).toHaveBeenCalledWith(
      1, 1, 0, 'artist', 'asc', undefined, 'cd', undefined, undefined, undefined, undefined,
      { storage_unit: '3', compartment: 2 }
    );

    query('template-inventory')!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.buildRequest()).toEqual({
      template: 'inventory',
      scope: { type: 'filter', filter: shelfFilter },
      options: { language: 'de' },
    });
  });

  it('sends the start label for partially used sheets and validates it', async () => {
    await setup({ selectedIds: [1] });
    const input = query('start-position')!;

    input.value = '5';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.buildRequest().options.start_position).toBe(5);
    expect(query('print-submit')?.disabled).toBe(false);

    for (const invalid of ['0', '25', '2.5', '']) {
      input.value = invalid;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(component.startPositionValid()).toBe(false);
      expect(query('print-submit')?.disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('print.invalidStart');
    }

    // An invalid start label does not block other templates
    component.template.set('qr-cards');
    fixture.detectChanges();
    expect(component.canSubmit()).toBe(true);
    expect(component.buildRequest().options.start_position).toBeUndefined();
  });

  it('downloads the PDF, reports success and closes', async () => {
    await setup({ selectedIds: [9] });

    query('print-submit')!.click();
    await fixture.whenStable();

    expect(mockApiService.print).toHaveBeenCalledWith(component.buildRequest());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(mockToastService.showToast).toHaveBeenCalledWith('print.success', 'success');
    expect(closedSpy).toHaveBeenCalled();
    expect(component.isPrinting()).toBe(false);
  });

  it('keeps the dialog open and shows the server error on failure', async () => {
    await setup({ selectedIds: [1] });
    mockApiService.print.mockReturnValue(throwError(() => new Error('The selected scope contains no records')));

    await component.submit();

    expect(mockToastService.showToast).toHaveBeenCalledWith('The selected scope contains no records', 'error');
    expect(closedSpy).not.toHaveBeenCalled();
    expect(component.isPrinting()).toBe(false);
  });

  it('closes on cancel and backdrop click but not while printing', async () => {
    await setup();

    component.isPrinting.set(true);
    component.close();
    expect(closedSpy).not.toHaveBeenCalled();

    component.isPrinting.set(false);
    fixture.nativeElement.querySelector('[data-testid="print-dialog"]').click();
    expect(closedSpy).not.toHaveBeenCalled();

    fixture.nativeElement.firstElementChild.click();
    expect(closedSpy).toHaveBeenCalledTimes(1);
  });

  describe('CDs in label scopes', () => {
    const vinylFilter: PrintFilter = { sort: 'artist', sort_order: 'asc', category: 'vinyl' };
    const choose = (testId: 'cd-skip' | 'cd-confirm') => {
      query(testId)!.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };

    it('counts the CDs of the whole collection and skips them by default', async () => {
      await setup({ cdCount: cdPage(80) });

      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1, 1, 0, undefined, undefined, undefined, 'cd', undefined, undefined, undefined, undefined,
        { storage_unit: undefined, compartment: undefined }
      );
      expect(component.cdCount()).toBe(80);
      expect(query('cd-warning')?.textContent).toContain('print.cdWarning.all');
      expect(query('cd-skip')?.checked).toBe(true);
      expect(query('print-submit')?.disabled).toBe(false);
      // Whole collection without CDs = filter on vinyl
      expect(component.buildRequest().scope).toEqual({ type: 'filter', filter: { category: 'vinyl' } });

      choose('cd-confirm');
      expect(component.buildRequest().scope).toEqual({ type: 'all' });
    });

    it('needs no decision when the filtered list contains no CDs', async () => {
      // e.g. category "all" but searching for an artist with vinyl only
      await setup({ filter: { ...filter, search: 'Pink Floyd', genres: 'Rock,Pop' }, cdCount: cdPage(0) });

      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1, 1, 0, 'artist', 'asc', 'Pink Floyd', 'cd', ['Rock', 'Pop'], undefined, undefined, undefined,
        { storage_unit: undefined, compartment: undefined }
      );
      expect(component.needsCdConfirmation()).toBe(false);
      expect(query('cd-warning')).toBeNull();
      expect(component.buildRequest().scope).toEqual({
        type: 'filter',
        filter: { ...filter, search: 'Pink Floyd', genres: 'Rock,Pop' },
      });
    });

    it('limits a filtered list with CDs to vinyl unless CDs are included', async () => {
      await setup({ filter, cdCount: cdPage(2) });

      expect(query('cd-warning')?.textContent).toContain('print.cdWarning.filter');
      expect(component.buildRequest().scope).toEqual({ type: 'filter', filter: { ...filter, category: 'vinyl' } });

      choose('cd-confirm');
      expect(component.buildRequest().scope).toEqual({ type: 'filter', filter });
    });

    it('requires including the CDs when the filter shows CDs only', async () => {
      await setup({ filter: { ...filter, category: 'cd' }, cdCount: cdPage(5) });

      expect(query('cd-skip')).toBeNull();
      expect(query('print-submit')?.disabled).toBe(true);
      await component.submit();
      expect(mockApiService.print).not.toHaveBeenCalled();

      choose('cd-confirm');
      expect(query('print-submit')?.disabled).toBe(false);
    });

    it('does not count when filtered to vinyl', async () => {
      await setup({ filter: vinylFilter });
      expect(mockApiService.getCollection).not.toHaveBeenCalled();
      expect(component.needsCdConfirmation()).toBe(false);
      expect(query('print-submit')?.disabled).toBe(false);
    });

    it('waits for the count before labels can be printed', async () => {
      const pending = new Subject<unknown>();
      await setup({ cdCount: pending });

      expect(component.cdCheckPending()).toBe(true);
      expect(query('print-submit')?.disabled).toBe(true);

      pending.next({ releases: [], pagination: { page: 1, pages: 1, per_page: 1, items: 0 } });
      fixture.detectChanges();
      expect(component.cdCheckPending()).toBe(false);
      expect(query('print-submit')?.disabled).toBe(false);
    });

    it('offers to skip CDs if they cannot be counted', async () => {
      await setup({ cdCount: throwError(() => new Error('offline')) });

      expect(component.needsCdConfirmation()).toBe(true);
      expect(query('cd-warning')?.textContent).toContain('print.cdWarning.unknown');
      expect(query('cd-warning')?.textContent).toContain('print.cdSkipUnknown');
      expect(component.buildRequest().scope).toEqual({ type: 'filter', filter: { category: 'vinyl' } });
    });

    it('removes the selected CDs unless they are included', async () => {
      await setup({ selectedIds: [1, 2, 3], selectedCdIds: [2], filter: vinylFilter });

      expect(component.cdCount()).toBe(1);
      expect(query('cd-warning')?.textContent).toContain('print.cdWarning.ids');
      expect(mockApiService.getCollection).not.toHaveBeenCalled();
      expect(component.buildRequest().scope).toEqual({ type: 'ids', discogs_ids: [1, 3] });

      choose('cd-confirm');
      expect(component.buildRequest().scope).toEqual({ type: 'ids', discogs_ids: [1, 2, 3] });

      // Switching to the vinyl-only filter needs no decision
      query('scope-filter')!.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(component.needsCdConfirmation()).toBe(false);
    });

    it('requires including the CDs when only CDs are selected', async () => {
      await setup({ selectedIds: [4, 5], selectedCdIds: [4, 5] });

      expect(query('cd-skip')).toBeNull();
      expect(query('print-submit')?.disabled).toBe(true);

      choose('cd-confirm');
      expect(component.buildRequest().scope).toEqual({ type: 'ids', discogs_ids: [4, 5] });
    });

    it('needs no decision or count for lists and cards', async () => {
      await setup({ selectedIds: [1, 2], selectedCdIds: [2] });
      for (const template of ['scan-list', 'qr-cards'] as const) {
        component.template.set(template);
        fixture.detectChanges();
        expect(component.needsCdConfirmation()).toBe(false);
        expect(query('cd-warning')).toBeNull();
        // Lists print CDs as well
        expect(component.buildRequest().scope).toEqual({ type: 'ids', discogs_ids: [1, 2] });
      }
      expect(mockApiService.getCollection).not.toHaveBeenCalled();
    });
  });
});
