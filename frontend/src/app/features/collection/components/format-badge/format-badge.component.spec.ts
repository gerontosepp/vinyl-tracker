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

  it('should render double_cd badge with overlapping cyan CD icons in desktop mode', () => {
    fixture.componentRef.setInput('format', 'double_cd');
    fixture.componentRef.setInput('compact', false);
    fixture.detectChanges();

    const icons = fixture.nativeElement.querySelectorAll('svg[lucidediscalbum]');
    expect(icons.length).toBe(2);

    const container = fixture.nativeElement.querySelector('div[title]');
    expect(container).toBeTruthy();
    expect(container.classList.contains('bg-cyan-50')).toBeTrue();
  });

  it('should render double_cd compact badge with 2CD label on mobile', () => {
    fixture.componentRef.setInput('format', 'double_cd');
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    const label = fixture.nativeElement.textContent;
    expect(label).toContain('2CD');
  });

  it('should render double_lp badge with overlapping vinyl icons in desktop mode', () => {
    fixture.componentRef.setInput('format', 'double_lp');
    fixture.componentRef.setInput('compact', false);
    fixture.detectChanges();

    const icons = fixture.nativeElement.querySelectorAll('svg[lucidedisc]');
    expect(icons.length).toBe(2);
  });
});
