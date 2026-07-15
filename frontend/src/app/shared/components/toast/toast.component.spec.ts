import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { ToastService } from '../../../core/services/toast.service';

describe('ToastComponent', () => {
  let component: ToastComponent;
  let fixture: ComponentFixture<ToastComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastComponent],
      providers: [ToastService]
    }).compileComponents();

    fixture = TestBed.createComponent(ToastComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display toasts and trigger removal', () => {
    toastService.showToast('Test Message', 'success');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Message');

    const closeBtn = compiled.querySelector('button');
    expect(closeBtn).toBeTruthy();
    
    spyOn(toastService, 'removeToast');
    closeBtn?.click();
    expect(toastService.removeToast).toHaveBeenCalled();
  });

  it('should return correct color classes', () => {
    expect(component.getColorClass('success')).toContain('border-green-100');
    expect(component.getColorClass('error')).toContain('border-red-100');
    expect(component.getColorClass('info')).toContain('border-blue-100');
    expect(component.getColorClass('warning')).toContain('border-amber-100');
    expect(component.getColorClass('unknown')).toContain('border-blue-100');
  });
});
