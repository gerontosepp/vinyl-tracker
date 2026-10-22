import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { of, throwError } from 'rxjs';
import { LabelInboxComponent } from './label-inbox.component';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { LabelPhoto } from '../../core/types';

const photo = (id: number): LabelPhoto => ({
  id,
  status: 'pending',
  discogsId: null,
  createdAt: `2026-10-22T15:0${id}:00Z`,
  processedAt: null,
});

describe('LabelInboxComponent', () => {
  let fixture: ComponentFixture<LabelInboxComponent>;
  let component: LabelInboxComponent;
  let api: MockedObject<ApiService>;
  let toast: MockedObject<ToastService>;

  beforeAll(() => registerLocaleData(localeDe));

  async function setup(photos: LabelPhoto[] = [photo(1), photo(2)]): Promise<void> {
    api = {
      getLabelPhotos: vi.fn().mockReturnValue(of({ photos, pendingCount: photos.length })),
      labelPhotoImageUrl: vi.fn((id: number) => `/api/label-photos/${id}/image`),
      deleteLabelPhoto: vi.fn().mockReturnValue(of(undefined)),
      deleteLabelPhotos: vi.fn().mockReturnValue(of({ deleted: photos.length, pendingCount: 0 })),
    } as unknown as MockedObject<ApiService>;
    toast = { showToast: vi.fn() } as unknown as MockedObject<ToastService>;

    TestBed.configureTestingModule({
      imports: [LabelInboxComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    });
    // The layout (navigation, menus) is not part of this test
    TestBed.overrideComponent(LabelInboxComponent, {
      remove: { imports: [LayoutComponent] },
      add: { schemas: [NO_ERRORS_SCHEMA] },
    });
    await TestBed.compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');

    fixture = TestBed.createComponent(LabelInboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const all = (testId: string) => el().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`);
  const one = (testId: string) => el().querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  it('shows the pending photos with their images', async () => {
    await setup();
    expect(api.getLabelPhotos).toHaveBeenCalledWith('pending', 100);
    expect(all('label-inbox-photo').length).toBe(2);
    expect(one('label-inbox-count-text')?.textContent).toContain('2 offene Fotos');
    const img = el().querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/label-photos/1/image');
    expect(img.alt).toContain('Label-Foto vom');
  });

  it('shows an empty state', async () => {
    await setup([]);
    expect(one('label-inbox-empty')?.textContent).toContain('Die Label-Inbox ist leer.');
    expect(one('label-inbox-delete-all')).toBeNull();
  });

  it('deletes a single photo', async () => {
    await setup();
    all('label-inbox-delete')[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.deleteLabelPhoto).toHaveBeenCalledWith(1);
    expect(all('label-inbox-photo').length).toBe(1);
    expect(component.pendingCount()).toBe(1);
    expect(toast.showToast).toHaveBeenCalledWith('Foto gelöscht.', 'success');
  });

  it('deletes all photos after confirmation', async () => {
    await setup();
    one('label-inbox-delete-all')!.click();
    fixture.detectChanges();
    expect(one('label-inbox-confirm')?.textContent).toContain('Wirklich alle 2 offenen Fotos löschen?');
    expect(api.deleteLabelPhotos).not.toHaveBeenCalled();

    one('label-inbox-confirm-delete-all')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.deleteLabelPhotos).toHaveBeenCalledWith('pending');
    expect(one('label-inbox-empty')).not.toBeNull();
    expect(one('label-inbox-confirm')).toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith('2 Fotos gelöscht.', 'success');
  });

  it('reports load and delete errors', async () => {
    await setup();
    api.deleteLabelPhoto.mockReturnValue(throwError(() => ({})));
    await component.deletePhoto(photo(1));
    expect(component.photos().length).toBe(2);
    expect(toast.showToast).toHaveBeenLastCalledWith('Löschen fehlgeschlagen.', 'error');

    api.deleteLabelPhotos.mockReturnValue(throwError(() => ({})));
    component.confirmDeleteAll.set(true);
    await component.deleteAll();
    expect(component.photos().length).toBe(2);
    expect(component.confirmDeleteAll()).toBe(false);

    api.getLabelPhotos.mockReturnValue(throwError(() => ({})));
    await component.load();
    expect(component.loading()).toBe(false);
    expect(toast.showToast).toHaveBeenLastCalledWith('Die Label-Inbox konnte nicht geladen werden.', 'error');
  });
});
