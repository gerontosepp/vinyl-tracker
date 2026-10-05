import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormatBadgeComponent } from './format-badge.component';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';

describe('FormatBadgeComponent', () => {
  let component: FormatBadgeComponent;
  let fixture: ComponentFixture<FormatBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormatBadgeComponent, TranslatePipe],
    }).compileComponents();

    fixture = TestBed.createComponent(FormatBadgeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to lp format and standard size', () => {
    expect(component.format()).toBe('lp');
    expect(component.compact()).toBe(false);
  });
});
