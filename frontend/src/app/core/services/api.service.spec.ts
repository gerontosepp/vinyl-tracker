import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
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

  it('loads label photos as a resource with optional status and limit', async () => {
    const filtered = TestBed.runInInjectionContext(() => service.labelPhotosResource('pending', 1));
    TestBed.tick();
    const req = http.expectOne((r) => r.url === '/api/label-photos');
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.get('limit')).toBe('1');
    req.flush({ photos: [], pendingCount: 3 });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(filtered.value()).toEqual({ photos: [], pendingCount: 3 });

    TestBed.runInInjectionContext(() => service.labelPhotosResource());
    TestBed.tick();
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

  it('queues, resolves and configures the automatic label identification', () => {
    service.identifyLabelPhoto(4).subscribe();
    const identify = http.expectOne('/api/label-photos/4/identify');
    expect(identify.request.method).toBe('POST');
    identify.flush({});

    service.resolveLabelPhoto(4, 'identified', 1622788).subscribe();
    const resolve = http.expectOne('/api/label-photos/4');
    expect(resolve.request.method).toBe('PATCH');
    expect(resolve.request.body).toEqual({ status: 'identified', discogsId: 1622788 });
    resolve.flush({});

    service.updateOpenRouterSettings({ apiKey: '' }).subscribe();
    const settings = http.expectOne('/api/users/me/openrouter');
    expect(settings.request.method).toBe('PUT');
    expect(settings.request.body).toEqual({ apiKey: '' });
    settings.flush({});
  });
});
