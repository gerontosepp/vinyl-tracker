import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionToolbarComponent } from './collection-toolbar.component';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CollectionToolbarComponent', () => {
  let component: CollectionToolbarComponent;
  let fixture: ComponentFixture<CollectionToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionToolbarComponent, TranslatePipe],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('storage filter', () => {
    const shelves = [
      { id: 3, name: 'Kallax-1', compartments: 2 },
      { id: 5, name: 'CD-1', compartments: 1 },
    ];
    const openPopover = (): void => {
      (fixture.nativeElement.querySelector('[data-testid="filters-toggle"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    const select = (): HTMLSelectElement | null =>
      fixture.nativeElement.querySelector('[data-testid="storage-filter"]');
    const badge = (): HTMLElement | null => fixture.nativeElement.querySelector('[data-testid="storage-filter-badge"]');

    it('is hidden without shelves', () => {
      openPopover();
      expect(select()).toBeNull();
    });

    it('offers every shelf, its compartments and the records without space', () => {
      fixture.componentRef.setInput('storageShelves', shelves);
      fixture.detectChanges();
      openPopover();

      const values = Array.from(select()!.options).map((o) => o.value);
      expect(values).toEqual(['', '3', '3:1', '3:2', '5', '5:1', 'unplaced']);

      const emitted: string[] = [];
      component.storageFilterChange.subscribe((v) => emitted.push(v));
      select()!.value = '3:2';
      select()!.dispatchEvent(new Event('change'));
      expect(emitted).toEqual(['3:2']);
    });

    it('shows the active filter as badge that clears it', () => {
      fixture.componentRef.setInput('storageShelves', shelves);
      fixture.componentRef.setInput('storageFilter', '3:2');
      fixture.detectChanges();
      expect(component.storageFilterLabel()).toMatch(/^Kallax-1 · (Fach|Compartment) 2$/);
      expect(badge()?.textContent).toContain('Kallax-1');

      const emitted: string[] = [];
      component.storageFilterChange.subscribe((v) => emitted.push(v));
      badge()!.querySelector('button')!.click();
      expect(emitted).toEqual(['']);
    });

    it('labels whole shelves, unknown shelves and records without space', () => {
      fixture.componentRef.setInput('storageShelves', shelves);
      fixture.componentRef.setInput('storageFilter', '5');
      expect(component.storageFilterLabel()).toBe('CD-1');
      fixture.componentRef.setInput('storageFilter', '9');
      expect(component.storageFilterLabel()).toBe('9');
      fixture.componentRef.setInput('storageFilter', 'unplaced');
      expect(component.storageFilterLabel()).toMatch(/Ohne Platz|No space/);
      fixture.componentRef.setInput('storageFilter', '');
      expect(component.storageFilterLabel()).toBe('');
    });
  });

  it('should emit searchChange on onSearchInput', () => {
    vi.spyOn(component.searchChange, 'emit').mockReturnValue(undefined);
    component.onSearchInput('Beatles');
    expect(component.searchChange.emit).toHaveBeenCalledWith('Beatles');
  });

  it('should emit sortChange on onSortSelect', () => {
    vi.spyOn(component.sortChange, 'emit').mockReturnValue(undefined);
    component.onSortSelect('year');
    expect(component.sortChange.emit).toHaveBeenCalledWith('year');
  });

  it('should emit perPageChange on onPerPageSelect', () => {
    vi.spyOn(component.perPageChange, 'emit').mockReturnValue(undefined);
    component.onPerPageSelect('40');
    expect(component.perPageChange.emit).toHaveBeenCalledWith(40);
  });

  it('should have hidden md:flex on the print container for responsive mobile hiding', () => {
    fixture.componentRef.setInput('selectedCount', 5);
    fixture.detectChanges();

    const printBtn = fixture.nativeElement.querySelector('[data-testid="print-button"]');
    expect(printBtn).toBeTruthy();
    const container = printBtn.parentElement;
    expect(container?.classList.contains('hidden')).toBe(true);
    expect(container?.classList.contains('md:flex')).toBe(true);
  });

  it('should emit categoryChange when category buttons are clicked', () => {
    vi.spyOn(component.categoryChange, 'emit').mockReturnValue(undefined);
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="category-filter"] button');
    expect(buttons.length).toBe(3);

    buttons[1].click();
    expect(component.categoryChange.emit).toHaveBeenCalledWith('vinyl');

    buttons[2].click();
    expect(component.categoryChange.emit).toHaveBeenCalledWith('cd');

    buttons[0].click();
    expect(component.categoryChange.emit).toHaveBeenCalledWith('all');
  });

  it('should display filtered count badge on the active category button', () => {
    fixture.componentRef.setInput('category', 'vinyl');
    fixture.componentRef.setInput('totalItems', 603);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="category-filter"] button');
    const vinylBtn = buttons[1];
    expect(vinylBtn.textContent).toContain('603');
  });

  it('lists genres inside the filter popover', () => {
    fixture.componentRef.setInput('availableGenres', [
      { name: 'Jazz', value: 12 },
      { name: 'Rock', value: 40 },
    ]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="filters-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('[data-testid="filter-popover"]') as HTMLElement;
    expect(popover.textContent).toContain('Jazz');
    expect(popover.textContent).toContain('Rock');

    component.genreSearchTerm.set('jaz');
    fixture.detectChanges();
    expect(popover.textContent).toContain('Jazz');
    expect(popover.textContent).not.toContain('Rock');
  });

  it('should emit genresChange when a genre is toggled', () => {
    vi.spyOn(component.genresChange, 'emit').mockReturnValue(undefined);
    fixture.componentRef.setInput('selectedGenres', ['Rock']);
    component.toggleGenre('Jazz');
    expect(component.genresChange.emit).toHaveBeenCalledWith(['Rock', 'Jazz']);

    component.toggleGenre('Rock');
    expect(component.genresChange.emit).toHaveBeenCalledWith([]);
  });

  it('should emit empty array on clearGenres', () => {
    vi.spyOn(component.genresChange, 'emit').mockReturnValue(undefined);
    component.clearGenres();
    expect(component.genresChange.emit).toHaveBeenCalledWith([]);
  });

  it('should emit yearsChange on year input and clearYears', () => {
    vi.spyOn(component.yearsChange, 'emit').mockReturnValue(undefined);
    component.onYearsInput('1970-1972, 1975');
    expect(component.yearsChange.emit).toHaveBeenCalledWith('1970-1972, 1975');

    component.clearYears();
    expect(component.yearsChange.emit).toHaveBeenCalledWith('');
  });

  it('should emit clearSelection when clear selection button is clicked', () => {
    vi.spyOn(component.clearSelection, 'emit').mockReturnValue(undefined);
    fixture.componentRef.setInput('selectedCount', 3);
    fixture.detectChanges();

    const clearBtn = fixture.nativeElement.querySelector('[data-testid="clear-selection"]');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    expect(component.clearSelection.emit).toHaveBeenCalled();
  });

  it('should emit printRequested when the print button is clicked', () => {
    vi.spyOn(component.printRequested, 'emit').mockReturnValue(undefined);
    fixture.componentRef.setInput('selectedCount', 3);
    fixture.detectChanges();

    const printBtn = fixture.nativeElement.querySelector('[data-testid="print-button"]');
    expect(printBtn.textContent).toMatch(/\(3\)/);
    printBtn.click();
    expect(component.printRequested.emit).toHaveBeenCalled();
  });

  it('should offer printing without a selection but no clear-selection button', () => {
    fixture.componentRef.setInput('selectedCount', 0);
    fixture.detectChanges();

    const printBtn = fixture.nativeElement.querySelector('[data-testid="print-button"]');
    expect(printBtn).toBeTruthy();
    expect(printBtn.textContent).not.toMatch(/\(\d+\)/);
    expect(
      fixture.nativeElement.querySelector('[data-testid="clear-selection"]')
    ).toBeNull();
  });

  it('should toggle and close the filter popover', () => {
    expect(component.isFilterPopoverOpen()).toBe(false);
    component.toggleFilterPopover();
    expect(component.isFilterPopoverOpen()).toBe(true);
    component.closeFilterPopover();
    expect(component.isFilterPopoverOpen()).toBe(false);
  });

  it('should emit notPlayedSinceChange on onNotPlayedSinceSelect', () => {
    vi.spyOn(component.notPlayedSinceChange, 'emit').mockReturnValue(undefined);
    component.onNotPlayedSinceSelect('2025-06-01');
    expect(component.notPlayedSinceChange.emit).toHaveBeenCalledWith('2025-06-01');
  });

  it('should emit toggleUnplayedOnly on onToggleUnplayedOnly', () => {
    vi.spyOn(component.toggleUnplayedOnly, 'emit').mockReturnValue(undefined);
    component.onToggleUnplayedOnly();
    expect(component.toggleUnplayedOnly.emit).toHaveBeenCalled();
  });

  it('should clear all play status filters', () => {
    const played = vi.fn();
    const notPlayed = vi.fn();
    component.toggleShowPlayedOnly.subscribe(played);
    component.clearNotPlayedFilters.subscribe(notPlayed);

    fixture.componentRef.setInput('showPlayedOnly', true);
    fixture.componentRef.setInput('unplayedOnly', true);
    component.clearPlayStatusFilters();
    expect(played).toHaveBeenCalled();
    expect(notPlayed).toHaveBeenCalled();

    played.mockClear();
    notPlayed.mockClear();
    fixture.componentRef.setInput('showPlayedOnly', false);
    fixture.componentRef.setInput('unplayedOnly', false);
    fixture.componentRef.setInput('notPlayedSince', '');
    component.clearPlayStatusFilters();
    expect(played).not.toHaveBeenCalled();
    expect(notPlayed).not.toHaveBeenCalled();
  });

  it('resets only the popover filters, not search or category', () => {
    const emitted: string[] = [];
    component.genresChange.subscribe((v) => emitted.push('genres:' + v.join(',')));
    component.yearsChange.subscribe((v) => emitted.push('years:' + v));
    component.sourceChange.subscribe((v) => emitted.push('source:' + v));
    component.storageFilterChange.subscribe((v) => emitted.push('storage:' + v));
    const played = vi.fn();
    component.toggleShowPlayedOnly.subscribe(played);

    fixture.componentRef.setInput('search', 'Beatles');
    fixture.componentRef.setInput('category', 'vinyl');
    fixture.componentRef.setInput('selectedGenres', ['Jazz']);
    fixture.componentRef.setInput('years', '1970-1972');
    fixture.componentRef.setInput('source', 'manual');
    fixture.componentRef.setInput('storageFilter', '3');
    fixture.componentRef.setInput('showPlayedOnly', true);
    component.resetFilters();

    expect(emitted).toEqual(['genres:', 'years:', 'source:', 'storage:']);
    expect(played).toHaveBeenCalled();
  });

  it('labels the visible page range', () => {
    fixture.componentRef.setInput('page', 2);
    fixture.componentRef.setInput('perPage', 50);
    fixture.componentRef.setInput('totalItems', 661);
    expect(component.rangeLabel()).toMatch(/^51–100 (von|of) 661$/);

    fixture.componentRef.setInput('page', 14);
    expect(component.rangeLabel()).toMatch(/^651–661 (von|of) 661$/);

    fixture.componentRef.setInput('totalItems', 0);
    expect(component.rangeLabel()).toBe('');
  });
  describe('filter popover', () => {
    const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const toggle = (): HTMLButtonElement => el().querySelector('[data-testid="filters-toggle"]')!;
    const popover = (): HTMLElement | null => el().querySelector('[data-testid="filter-popover"]');
    const open = (): void => {
      toggle().click();
      fixture.detectChanges();
    };

    it('keeps the filters out of the bar and shows them in a popover', () => {
      expect(popover()).toBeNull();
      expect(el().querySelector('[data-testid="storage-filter"]')).toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');

      open();
      expect(popover()).not.toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(popover()!.querySelector('#toolbar-years')).not.toBeNull();

      toggle().click();
      fixture.detectChanges();
      expect(popover()).toBeNull();
    });

    it('closes on a click outside of the popover', () => {
      open();
      expect(popover()).not.toBeNull();

      document.body.click();
      fixture.detectChanges();
      expect(popover()).toBeNull();
    });

    it('closes on Escape', () => {
      open();
      expect(popover()).not.toBeNull();

      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(popover()).toBeNull();
    });

    it('counts the popover filters on the toggle, ignoring category and search', () => {
      expect(el().querySelector('[data-testid="filters-count"]')).toBeNull();

      fixture.componentRef.setInput('category', 'vinyl');
      fixture.componentRef.setInput('search', 'Beatles');
      fixture.detectChanges();
      expect(component.activeFilterCount()).toBe(0);

      fixture.componentRef.setInput('selectedGenres', ['Jazz', 'Rock']);
      fixture.componentRef.setInput('years', '1970-1972');
      fixture.componentRef.setInput('storageFilter', '3');
      fixture.componentRef.setInput('source', 'manual');
      fixture.componentRef.setInput('showPlayedOnly', true);
      fixture.componentRef.setInput('notPlayedSince', '2026-01-01');
      fixture.detectChanges();

      expect(component.activeFilterCount()).toBe(7);
      expect(el().querySelector('[data-testid="filters-count"]')?.textContent?.trim()).toBe('7');
    });

    it('shows the pager with range and per-page size', () => {
      fixture.componentRef.setInput('page', 2);
      fixture.componentRef.setInput('perPage', 50);
      fixture.componentRef.setInput('totalPages', 14);
      fixture.componentRef.setInput('totalItems', 661);
      fixture.detectChanges();

      expect(el().textContent).toMatch(/51–100 (von|of) 661/);
      expect(el().textContent).toContain('2 / 14');

      const pages: string[] = [];
      component.prevPage.subscribe(() => pages.push('prev'));
      component.nextPage.subscribe(() => pages.push('next'));
      const pager = el().querySelector('[data-testid="pager"]')!;
      const [prev, next] = Array.from(pager.querySelectorAll('button'));
      prev.click();
      next.click();
      expect(pages).toEqual(['prev', 'next']);
    });
  });

  describe('manual records', () => {
    const q = (testId: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

    it('emits the source filter and shows it as removable badge', () => {
      const emitted: string[] = [];
      component.sourceChange.subscribe((v) => emitted.push(v));
      (q('filters-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      const select = q('source-filter') as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'discogs', 'manual']);
      select.value = 'manual';
      select.dispatchEvent(new Event('change'));
      expect(emitted).toEqual(['manual']);

      fixture.componentRef.setInput('source', 'manual');
      fixture.detectChanges();
      expect(component.activeFilterCount()).toBe(1);
      q('source-filter-badge')!.querySelector('button')!.click();
      expect(emitted).toEqual(['manual', '']);
    });

    it('requests the manual record form', () => {
      const requested = vi.fn();
      component.addManual.subscribe(requested);
      (q('add-manual-record') as HTMLButtonElement).click();
      expect(requested).toHaveBeenCalled();
    });
  });
});

