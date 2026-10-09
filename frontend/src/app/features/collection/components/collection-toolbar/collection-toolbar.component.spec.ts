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
    spyOn(component.searchChange, 'emit');
    component.onSearchInput('Beatles');
    expect(component.searchChange.emit).toHaveBeenCalledWith('Beatles');
  });

  it('should emit sortChange on onSortSelect', () => {
    spyOn(component.sortChange, 'emit');
    component.onSortSelect('year');
    expect(component.sortChange.emit).toHaveBeenCalledWith('year');
  });

  it('should emit perPageChange on onPerPageSelect', () => {
    spyOn(component.perPageChange, 'emit');
    component.onPerPageSelect('40');
    expect(component.perPageChange.emit).toHaveBeenCalledWith(40);
  });

  it('should have hidden md:flex on selectPage button for responsive mobile hiding', () => {
    const selectPageBtn = fixture.nativeElement
      .querySelector('button svg[lucidesquare], button svg[lucidechecksquare]')
      ?.closest('button');
    expect(selectPageBtn).toBeTruthy();
    expect(selectPageBtn?.classList.contains('hidden')).toBeTrue();
    expect(selectPageBtn?.classList.contains('md:flex')).toBeTrue();
  });

  it('should have hidden md:flex on downloadSelected container for responsive mobile hiding', () => {
    fixture.componentRef.setInput('selectedCount', 5);
    fixture.detectChanges();

    const downloadBtn = fixture.nativeElement.querySelector('button svg[lucidedownload]')?.closest('button');
    expect(downloadBtn).toBeTruthy();
    const container = downloadBtn.parentElement;
    expect(container?.classList.contains('hidden')).toBeTrue();
    expect(container?.classList.contains('md:flex')).toBeTrue();
  });

  it('should emit categoryChange when category buttons are clicked', () => {
    spyOn(component.categoryChange, 'emit');
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
    expect(component.isGenreDropdownOpen()).toBeFalse();
    component.toggleGenreDropdown();
    expect(component.isGenreDropdownOpen()).toBeTrue();
    component.closeGenreDropdown();
    expect(component.isGenreDropdownOpen()).toBeFalse();
  });

  it('should emit genresChange when a genre is toggled', () => {
    spyOn(component.genresChange, 'emit');
    fixture.componentRef.setInput('selectedGenres', ['Rock']);
    component.toggleGenre('Jazz');
    expect(component.genresChange.emit).toHaveBeenCalledWith(['Rock', 'Jazz']);

    component.toggleGenre('Rock');
    expect(component.genresChange.emit).toHaveBeenCalledWith([]);
  });

  it('should emit empty array on clearGenres', () => {
    spyOn(component.genresChange, 'emit');
    component.clearGenres();
    expect(component.genresChange.emit).toHaveBeenCalledWith([]);
  });

  it('should emit yearsChange on year input and clearYears', () => {
    spyOn(component.yearsChange, 'emit');
    component.onYearsInput('1970-1972, 1975');
    expect(component.yearsChange.emit).toHaveBeenCalledWith('1970-1972, 1975');

    component.clearYears();
    expect(component.yearsChange.emit).toHaveBeenCalledWith('');
  });
});
