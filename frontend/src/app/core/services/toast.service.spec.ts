import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show toast and add it to signal', () => {
    expect(service.toasts().length).toBe(0);
    service.showToast('Test Message', 'success');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Test Message');
    expect(service.toasts()[0].type).toBe('success');
  });

  it('should remove toast by id', () => {
    service.showToast('Test Message');
    const toastId = service.toasts()[0].id;
    service.removeToast(toastId);
    expect(service.toasts().length).toBe(0);
  });

  it('should auto-remove toast after 5 seconds', fakeAsync(() => {
    service.showToast('Test Message');
    expect(service.toasts().length).toBe(1);
    tick(5000);
    expect(service.toasts().length).toBe(0);
  }));
});
