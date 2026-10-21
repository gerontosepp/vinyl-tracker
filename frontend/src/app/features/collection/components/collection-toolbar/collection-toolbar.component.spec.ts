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
    const select = (): HTMLSelectElement | null =>
      fixture.nativeElement.querySelector('[data-testid="storage-filter"]');
    const badge = (): HTMLElement | null => fixture.nativeElement.querySelector('[data-testid="storage-filter-badge"]');

    it('is hidden without shelves', () => {
      expect(select()).toBeNull();
    });

    it('offers every shelf, its compartments and the records without space', () => {
      fixture.componentRef.setInput('storageShelves', shelves);
      fixture.detectChanges();

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

  it('should have hidden md:flex on selectPage button for responsive mobile hiding', () => {
    const selectPageBtn = fixture.nativeElement
      .querySelector('button svg[lucideSquare], button svg[lucideCheckSquare]')
      ?.closest('button');
    expect(selectPageBtn).toBeTruthy();
    expect(selectPageBtn?.classList.contains('hidden')).toBe(true);
    expect(selectPageBtn?.classList.contains('md:flex')).toBe(true);
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
    const buttons = fixture.nativeElement.querySelectorAll('div[aria-label="Kategorie Filter"] button');
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

    const buttons = fixture.nativeElement.querySelectorAll('div[aria-label="Kategorie Filter"] button');
    const vinylBtn = buttons[1];
    expect(vinylBtn.textContent).toContain('603');
  });

  it('should toggle genre dropdown when genre button is clicked', () => {
    expect(component.isGenreDropdownOpen()).toBe(false);
    component.toggleGenreDropdown();
    expect(component.isGenreDropdownOpen()).toBe(true);
    component.closeGenreDropdown();
    expect(component.isGenreDropdownOpen()).toBe(false);
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

    const clearBtn = fixture.nativeElement.querySelector('button[title="Auswahl aufheben"], button[title="Clear Selection"]');
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
      fixture.nativeElement.querySelector('button[title="Auswahl aufheben"], button[title="Clear Selection"]')
    ).toBeNull();
  });

  it('should toggle and close notPlayed popover', () => {
    expect(component.isNotPlayedPopoverOpen()).toBe(false);
    component.toggleNotPlayedPopover();
    expect(component.isNotPlayedPopoverOpen()).toBe(true);
    component.closeNotPlayedPopover();
    expect(component.isNotPlayedPopoverOpen()).toBe(false);
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

  it('should emit clearNotPlayedFilters on onClearNotPlayed', () => {
    vi.spyOn(component.clearNotPlayedFilters, 'emit').mockReturnValue(undefined);
    component.onClearNotPlayed();
    expect(component.clearNotPlayedFilters.emit).toHaveBeenCalled();
  });
  describe('collapsible filters (phone)', () => {
    const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const toggle = (): HTMLButtonElement => el().querySelector('[data-testid="filters-toggle"]')!;
    const categoryBlock = (): HTMLElement => el().querySelector('[role="group"]')!;

    afterEach(() => localStorage.removeItem('collection.filtersOpen'));

    it('starts collapsed, keeps static classes and expands on toggle', () => {
      const block = categoryBlock();
      expect(component.filtersOpen()).toBe(false);
      expect(block.classList.contains('max-md:hidden')).toBe(true);
      expect(block.classList.contains('inline-flex')).toBe(true);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');

      toggle().click();
      fixture.detectChanges();

      expect(block.classList.contains('max-md:hidden')).toBe(false);
      expect(block.classList.contains('inline-flex')).toBe(true);
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(localStorage.getItem('collection.filtersOpen')).toBe('true');
    });

    it('remembers the expanded state', () => {
      localStorage.setItem('collection.filtersOpen', 'true');
      const again = TestBed.createComponent(CollectionToolbarComponent);
      expect(again.componentInstance.filtersOpen()).toBe(true);
    });

    it('counts the active filters on the toggle', () => {
      expect(el().querySelector('[data-testid="filters-count"]')).toBeNull();

      fixture.componentRef.setInput('category', 'vinyl');
      fixture.componentRef.setInput('selectedGenres', ['Jazz', 'Rock']);
      fixture.componentRef.setInput('years', '1970-1972');
      fixture.componentRef.setInput('storageFilter', '3');
      fixture.componentRef.setInput('showPlayedOnly', true);
      fixture.componentRef.setInput('notPlayedSince', '2026-01-01');
      fixture.detectChanges();

      expect(component.activeFilterCount()).toBe(7);
      expect(el().querySelector('[data-testid="filters-count"]')?.textContent?.trim()).toBe('7');
    });

    it('shows a compact pager only while collapsed with several pages', () => {
      const pager = (): HTMLElement | null => el().querySelector('[data-testid="compact-pager"]');
      expect(pager()).toBeNull();

      fixture.componentRef.setInput('page', 2);
      fixture.componentRef.setInput('totalPages', 13);
      fixture.detectChanges();
      expect(pager()?.textContent).toContain('2/13');

      const pages: string[] = [];
      component.prevPage.subscribe(() => pages.push('prev'));
      component.nextPage.subscribe(() => pages.push('next'));
      const [prev, next] = Array.from(pager()!.querySelectorAll('button'));
      prev.click();
      next.click();
      expect(pages).toEqual(['prev', 'next']);

      toggle().click();
      fixture.detectChanges();
      expect(pager()).toBeNull();
    });
  });
});

