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
});
