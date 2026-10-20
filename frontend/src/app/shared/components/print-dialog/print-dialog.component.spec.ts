import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PrintDialogComponent } from './print-dialog.component';
import { ApiService } from '../../../core/services/api.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { PrintFilter } from '../../../core/types';

describe('PrintDialogComponent', () => {
  let fixture: ComponentFixture<PrintDialogComponent>;
  let component: PrintDialogComponent;
  let mockApiService: { print: ReturnType<typeof vi.fn> };
  let mockToastService: { showToast: ReturnType<typeof vi.fn> };
  let closedSpy: ReturnType<typeof vi.fn<() => void>>;
  const language = signal<'de' | 'en'>('de');

  const filter: PrintFilter = { sort: 'artist', sort_order: 'asc', genres: 'Jazz' };

  async function setup(
    inputs: { selectedIds?: number[]; filter?: PrintFilter | null; selectionHasCds?: boolean } = {}
  ): Promise<void> {
    mockApiService = { print: vi.fn().mockReturnValue(of(new Blob(['%PDF'], { type: 'application/pdf' }))) };
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
    if (inputs.selectionHasCds !== undefined) fixture.componentRef.setInput('selectionHasCds', inputs.selectionHasCds);
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

  describe('CD confirmation for labels', () => {
    const vinylFilter: PrintFilter = { sort: 'artist', sort_order: 'asc', category: 'vinyl' };

    it('requires confirmation for the whole collection', async () => {
      await setup();

      expect(component.needsCdConfirmation()).toBe(true);
      expect(query('cd-warning')?.textContent).toContain('print.cdWarning.all');
      expect(query('print-submit')?.disabled).toBe(true);

      query('cd-confirm')!.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(query('print-submit')?.disabled).toBe(false);
    });

    it('requires confirmation for filters not limited to vinyl', async () => {
      await setup({ filter });
      expect(component.needsCdConfirmation()).toBe(true);
      expect(query('cd-warning')?.textContent).toContain('print.cdWarning.filter');
    });

    it('needs no confirmation when filtered to vinyl', async () => {
      await setup({ filter: vinylFilter });
      expect(component.needsCdConfirmation()).toBe(false);
      expect(query('cd-warning')).toBeNull();
      expect(query('print-submit')?.disabled).toBe(false);
    });

    it('depends on CDs in the selection', async () => {
      await setup({ selectedIds: [1, 2], selectionHasCds: false, filter: vinylFilter });
      expect(component.needsCdConfirmation()).toBe(false);

      fixture.componentRef.setInput('selectionHasCds', true);
      fixture.detectChanges();
      expect(component.needsCdConfirmation()).toBe(true);
      expect(query('cd-warning')?.textContent).toContain('print.cdWarning.ids');

      // Switching to the vinyl-only filter needs no confirmation
      query('scope-filter')!.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(component.needsCdConfirmation()).toBe(false);
    });

    it('needs no confirmation for lists and cards', async () => {
      await setup();
      for (const template of ['scan-list', 'qr-cards'] as const) {
        component.template.set(template);
        fixture.detectChanges();
        expect(component.needsCdConfirmation()).toBe(false);
        expect(query('cd-warning')).toBeNull();
        expect(component.canSubmit()).toBe(true);
      }
    });

    it('does not submit unconfirmed labels', async () => {
      await setup();

      await component.submit();

      expect(mockApiService.print).not.toHaveBeenCalled();
    });
  });
});
