import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService label photos', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads the photo as raw JPEG body', () => {
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });
    let result: unknown;
    service.uploadLabelPhoto(photo).subscribe((r) => (result = r));

    const req = http.expectOne('/api/label-photos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(photo);
    expect(req.request.headers.get('Content-Type')).toBe('image/jpeg');
    req.flush({ id: 1, pendingCount: 4 });
    expect(result).toEqual({ id: 1, pendingCount: 4 });
  });

  it('falls back to image/jpeg for blobs without type', () => {
    service.uploadLabelPhoto(new Blob(['x'])).subscribe();
    const req = http.expectOne('/api/label-photos');
    expect(req.request.headers.get('Content-Type')).toBe('image/jpeg');
    req.flush({ id: 2, pendingCount: 1 });
  });

  it('lists label photos with optional status and limit', () => {
    service.getLabelPhotos('pending', 1).subscribe();
    const filtered = http.expectOne((r) => r.url === '/api/label-photos');
    expect(filtered.request.params.get('status')).toBe('pending');
    expect(filtered.request.params.get('limit')).toBe('1');
    filtered.flush({ photos: [], pendingCount: 0 });

    service.getLabelPhotos().subscribe();
    const all = http.expectOne((r) => r.url === '/api/label-photos');
    expect(all.request.params.keys()).toEqual([]);
    all.flush({ photos: [], pendingCount: 0 });
  });

  it('sets and resets the custom sort string of a record', () => {
    service.updateRecordSortKey(42, 'Paul, Les').subscribe();
    const set = http.expectOne('/api/records/42/sort-key');
    expect(set.request.method).toBe('PATCH');
    expect(set.request.body).toEqual({ sort_key: 'Paul, Les' });
    set.flush({});

    service.updateRecordSortKey(42, null).subscribe();
    const reset = http.expectOne('/api/records/42/sort-key');
    expect(reset.request.body).toEqual({ sort_key: null });
    reset.flush({});
  });

  it('deletes label photos one by one or by status', () => {
    expect(service.labelPhotoImageUrl(7)).toBe('/api/label-photos/7/image');

    service.deleteLabelPhoto(7).subscribe();
    const single = http.expectOne('/api/label-photos/7');
    expect(single.request.method).toBe('DELETE');
    single.flush(null);

    service.deleteLabelPhotos('pending').subscribe();
    const pending = http.expectOne((r) => r.url === '/api/label-photos');
    expect(pending.request.method).toBe('DELETE');
    expect(pending.request.params.get('status')).toBe('pending');
    pending.flush({ deleted: 3, pendingCount: 0 });

    service.deleteLabelPhotos().subscribe();
    const everything = http.expectOne((r) => r.url === '/api/label-photos');
    expect(everything.request.params.keys()).toEqual([]);
    everything.flush({ deleted: 1, pendingCount: 0 });
  });
});
