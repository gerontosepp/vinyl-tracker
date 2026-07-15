import { TestBed, ComponentFixture } from '@angular/core/testing';
import { StatisticWidgetComponent } from './statistic-widget.component';

describe('StatisticWidgetComponent', () => {
  let component: StatisticWidgetComponent;
  let fixture: ComponentFixture<StatisticWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticWidgetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatisticWidgetComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('title', 'My Stat');
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render title and subtitle', () => {
    fixture.componentRef.setInput('title', 'Test Title');
    fixture.componentRef.setInput('subtitle', 'Test Subtitle');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Title');
    expect(compiled.textContent).toContain('Test Subtitle');
  });

  it('should render loading spinner when loading is true', () => {
    fixture.componentRef.setInput('title', 'Test Title');
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.animate-spin')).toBeTruthy();
  });

  it('should render error message', () => {
    fixture.componentRef.setInput('title', 'Test Title');
    fixture.componentRef.setInput('error', 'Something went wrong');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Something went wrong');
  });
});
