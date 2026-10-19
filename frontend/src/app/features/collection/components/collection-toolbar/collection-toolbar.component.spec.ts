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

  it('should have hidden md:flex on downloadSelected container for responsive mobile hiding', () => {
    fixture.componentRef.setInput('selectedCount', 5);
    fixture.detectChanges();

    const downloadBtn = fixture.nativeElement.querySelector('button svg[lucideDownload]')?.closest('button');
    expect(downloadBtn).toBeTruthy();
    const container = downloadBtn.parentElement;
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

  it('should emit downloadSelected when download button is clicked', () => {
    vi.spyOn(component.downloadSelected, 'emit').mockReturnValue(undefined);
    fixture.componentRef.setInput('selectedCount', 3);
    fixture.detectChanges();

    const downloadBtn = fixture.nativeElement.querySelector('button svg[lucideDownload]')?.closest('button');
    expect(downloadBtn).toBeTruthy();
    downloadBtn.click();
    expect(component.downloadSelected.emit).toHaveBeenCalled();
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
});

