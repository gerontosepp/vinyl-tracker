import { TestBed } from '@angular/core/testing';
import { ScannerService } from './scanner.service';

describe('ScannerService', () => {
  let service: ScannerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScannerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should toggle showScanner state', () => {
    expect(service.showScanner()).toBeFalse();
    service.openScanner();
    expect(service.showScanner()).toBeTrue();
    service.closeScanner();
    expect(service.showScanner()).toBeFalse();
  });

  it('should toggleScanner correctly', () => {
    expect(service.showScanner()).toBeFalse();
    service.toggleScanner();
    expect(service.showScanner()).toBeTrue();
    service.toggleScanner();
    expect(service.showScanner()).toBeFalse();
  });
});
