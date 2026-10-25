import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResourceRef, httpResource } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ScanResult,
  ListenEvent,
  User,
  AnalyticsTopRecord,
  AnalyticsTopArtist,
  ResetResult,
  CollectionResponse,
  CollectionValueResponse,
  GenreBreakdownItem,
  SyncResult,
  DiscogsCandidate,
  ManualRecordCreated,
  ManualRecordRequest,
  TakeoverRequest,
  TakeoverResult,
  RecordDetailDto,
  RecordSource,
  RoonStatus,
  RoonZone,
  RoonSettings,
  RoonPlayRequest,
  RestoreResult,
  PrintRequest,
  StorageType,
  StorageTypeRequest,
  StorageTypesResult,
  StorageUnit,
  StorageUnitsResult,
  StorageMedia,
  StorageLayout,
  StorageSequence,
  RedistributePreview,
  LabelPhotoStatus,
  LabelPhotosResult,
  LabelPhotoUploadResult,
  LabelPhotoDeleteResult,
  LabelPhoto,
  OpenRouterSettings,
} from '../types';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  scanBarcode(barcode: string): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.baseUrl}/scan`, { barcode });
  }

  /** Stores a label photo (JPEG) in the inbox for identification via MCP. */
  uploadLabelPhoto(image: Blob): Observable<LabelPhotoUploadResult> {
    return this.http.post<LabelPhotoUploadResult>(`${this.baseUrl}/label-photos`, image, {
      headers: { 'Content-Type': image.type || 'image/jpeg' },
    });
  }

  /**
   * Label photos as a signal-based resource; call it in an injection context (e.g. a component
   * field initializer). Mutations go through {@link deleteLabelPhoto} / {@link uploadLabelPhoto}.
   */
  labelPhotosResource(status?: LabelPhotoStatus, limit?: number): HttpResourceRef<LabelPhotosResult | undefined> {
    const params: Record<string, string | number> = {};
    if (status) params['status'] = status;
    if (limit) params['limit'] = limit;
    return httpResource<LabelPhotosResult>(() => ({ url: `${this.baseUrl}/label-photos`, params }));
  }

  /** URL of a label photo; the session cookie authorizes the image request. */
  labelPhotoImageUrl(id: number): string {
    return `${this.baseUrl}/label-photos/${id}/image`;
  }

  /** Queues a photo (again) for the automatic identification via OpenRouter. */
  identifyLabelPhoto(id: number): Observable<LabelPhoto> {
    return this.http.post<LabelPhoto>(`${this.baseUrl}/label-photos/${id}/identify`, {});
  }

  /** Completes a label photo, e.g. `identified` with the confirmed Discogs release. */
  resolveLabelPhoto(id: number, status: LabelPhotoStatus, discogsId?: number): Observable<LabelPhoto> {
    return this.http.patch<LabelPhoto>(`${this.baseUrl}/label-photos/${id}`, { status, discogsId: discogsId ?? null });
  }

  /** OpenRouter settings as a resource; call it in an injection context. */
  openRouterSettingsResource(): HttpResourceRef<OpenRouterSettings | undefined> {
    return httpResource<OpenRouterSettings>(() => `${this.baseUrl}/users/me/openrouter`);
  }

  /** `apiKey`: omit to keep, `''` to remove. `model`: `''` resets to the default. */
  updateOpenRouterSettings(settings: { apiKey?: string; model?: string }): Observable<OpenRouterSettings> {
    return this.http.put<OpenRouterSettings>(`${this.baseUrl}/users/me/openrouter`, settings);
  }

  deleteLabelPhoto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/label-photos/${id}`);
  }

  /** Deletes all label photos, or only those with the given status. */
  deleteLabelPhotos(status?: LabelPhotoStatus): Observable<LabelPhotoDeleteResult> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.delete<LabelPhotoDeleteResult>(`${this.baseUrl}/label-photos`, { params });
  }

  deleteScan(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/scan/${id}`);
  }

  resetAllListens(): Observable<ResetResult> {
    return this.http.delete<ResetResult>(`${this.baseUrl}/scan/all`);
  }

  getRecentListens(
    startDate?: string,
    endDate?: string
  ): Observable<ListenEvent[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('from', startDate);
    if (endDate) params = params.set('to', endDate);
    return this.http.get<ListenEvent[]>(`${this.baseUrl}/analytics/recent`, { params });
  }

  getTopRecords(
    startDate?: string,
    endDate?: string
  ): Observable<AnalyticsTopRecord[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('from', startDate);
    if (endDate) params = params.set('to', endDate);
    return this.http.get<AnalyticsTopRecord[]>(`${this.baseUrl}/analytics/top`, { params });
  }
  getTopArtists(
    startDate?: string,
    endDate?: string
  ): Observable<AnalyticsTopArtist[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('from', startDate);
    if (endDate) params = params.set('to', endDate);
    return this.http.get<AnalyticsTopArtist[]>(`${this.baseUrl}/analytics/top-artists`, { params });
  }

  getCollectionValue(): Observable<CollectionValueResponse> {
    return this.http.get<CollectionValueResponse>(`${this.baseUrl}/analytics/collection/value`);
  }

  getRecordDetails(id: number): Observable<RecordDetailDto> {
    return this.http.get<RecordDetailDto>(`${this.baseUrl}/records/${id}`);
  }

  updateRecordCondition(
    id: number,
    conditions: { media_condition?: string; sleeve_condition?: string }
  ): Observable<RecordDetailDto> {
    return this.http.patch<RecordDetailDto>(`${this.baseUrl}/records/${id}/condition`, conditions);
  }

  /** Sets the custom sort string of a record; `null` resets it to the automatic artist key. */
  updateRecordSortKey(id: number, sortKey: string | null): Observable<RecordDetailDto> {
    return this.http.patch<RecordDetailDto>(`${this.baseUrl}/records/${id}/sort-key`, { sort_key: sortKey });
  }

  createManualRecord(request: ManualRecordRequest): Observable<ManualRecordCreated> {
    return this.http.post<ManualRecordCreated>(`${this.baseUrl}/records/manual`, request);
  }

  updateManualRecord(id: number, request: ManualRecordRequest): Observable<RecordDetailDto> {
    return this.http.put<RecordDetailDto>(`${this.baseUrl}/records/${id}/manual`, request);
  }

  /** Uploads the cover of a manual record (JPEG, downscaled by the caller). */
  uploadRecordCover(id: number, image: Blob): Observable<RecordDetailDto> {
    return this.http.put<RecordDetailDto>(`${this.baseUrl}/records/${id}/cover`, image, {
      headers: { 'Content-Type': image.type || 'image/jpeg' },
    });
  }

  /** Searches Discogs for the release of a manual record; changes nothing. */
  getDiscogsCandidates(id: number): Observable<DiscogsCandidate[]> {
    return this.http.get<DiscogsCandidate[]>(`${this.baseUrl}/records/${id}/discogs-candidates`);
  }

  /** Turns a manual record into a Discogs record after the user confirmed a candidate. */
  takeOverManualRecord(id: number, request: TakeoverRequest): Observable<TakeoverResult> {
    return this.http.post<TakeoverResult>(`${this.baseUrl}/records/${id}/takeover`, request);
  }

  logRecordListen(id: number): Observable<RecordDetailDto> {
    return this.http.post<RecordDetailDto>(`${this.baseUrl}/records/${id}/listen`, {});
  }

  getGenreBreakdown(): Observable<GenreBreakdownItem[]> {
    return this.http.get<GenreBreakdownItem[]>(`${this.baseUrl}/analytics/collection/genres`);
  }

  loginUser(username: string, password: string): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users/login`, { username, password });
  }

  registerUser(username: string, password: string): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users/register`, { username, password });
  }

  resetPassword(username: string, newPassword: string, discogsToken: string): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users/reset-password`, { username, newPassword, discogsToken });
  }

  logoutUser(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/users/logout`, {});
  }

  updateDiscogsSettings(
    token: string,
    discogsUsername: string,
    password?: string
  ): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/me/discogs`, {
      token,
      discogsUsername,
      password,
    });
  }

  getCollection(
    page: number = 1,
    perPage: number = 50,
    minPlays: number = 0,
    sort: string = 'artist',
    sortOrder: string = 'asc',
    search?: string,
    category?: 'all' | 'vinyl' | 'cd' | string,
    genres?: string[],
    years?: string,
    notPlayedSince?: string,
    unplayedOnly?: boolean,
    filters: { storage_unit?: string; compartment?: number; source?: RecordSource } = {}
  ): Observable<CollectionResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString())
      .set('sort', sort)
      .set('sort_order', sortOrder);
    if (minPlays > 0) {
      params = params.set('min_plays', minPlays.toString());
    }
    if (search) {
      params = params.set('search', search);
    }
    if (category && category !== 'all') {
      params = params.set('category', category);
    }
    if (genres && genres.length > 0) {
      genres.forEach((g) => {
        params = params.append('genres', g);
      });
    }
    if (years && years.trim()) {
      params = params.set('years', years.trim());
    }
    if (notPlayedSince && notPlayedSince.trim()) {
      params = params.set('not_played_since', notPlayedSince.trim());
    }
    if (unplayedOnly) {
      params = params.set('unplayed_only', 'true');
    }
    if (filters.storage_unit) {
      params = params.set('storage_unit', filters.storage_unit);
    }
    if (filters.compartment) {
      params = params.set('compartment', filters.compartment.toString());
    }
    if (filters.source) {
      params = params.set('source', filters.source);
    }
    return this.http.get<CollectionResponse>(`${this.baseUrl}/collection`, { params });
  }

  forceSyncCollection(): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.baseUrl}/collection/sync`, {});
  }

  addReleaseToCollection(releaseId: number): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.baseUrl}/collection/releases/${releaseId}`, {});
  }

  removeReleaseFromCollection(releaseId: number, instanceId?: number): Observable<void> {
    let params = new HttpParams();
    if (instanceId) {
      params = params.set('instanceId', instanceId.toString());
    }
    return this.http.delete<void>(`${this.baseUrl}/collection/releases/${releaseId}`, { params });
  }

  print(request: PrintRequest): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/print`, request, { responseType: 'blob' });
  }

  exportCollection(
    format: 'csv' | 'json' | 'pdf',
    filters?: {
      search?: string;
      category?: string;
      genres?: string[];
      years?: string;
      notPlayedSince?: string;
      unplayedOnly?: boolean;
      sort?: string;
      sortOrder?: string;
    }
  ): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    if (filters) {
      if (filters.search) {
        params = params.set('search', filters.search);
      }
      if (filters.category && filters.category !== 'all') {
        params = params.set('category', filters.category);
      }
      if (filters.genres && filters.genres.length > 0) {
        filters.genres.forEach((g) => {
          params = params.append('genres', g);
        });
      }
      if (filters.years && filters.years.trim()) {
        params = params.set('years', filters.years.trim());
      }
      if (filters.notPlayedSince && filters.notPlayedSince.trim()) {
        params = params.set('not_played_since', filters.notPlayedSince.trim());
      }
      if (filters.unplayedOnly) {
        params = params.set('unplayed_only', 'true');
      }
      if (filters.sort) {
        params = params.set('sort', filters.sort);
      }
      if (filters.sortOrder) {
        params = params.set('sort_order', filters.sortOrder);
      }
    }
    return this.http.get(`${this.baseUrl}/collection/export`, { params, responseType: 'blob' });
  }

  restoreCollection(backup: unknown): Observable<RestoreResult> {
    return this.http.post<RestoreResult>(`${this.baseUrl}/collection/restore`, backup);
  }

  getStorageTypes(): Observable<StorageType[]> {
    return this.http.get<StorageType[]>(`${this.baseUrl}/storage/types`);
  }

  createStorageType(request: StorageTypeRequest): Observable<StorageTypesResult> {
    return this.http.post<StorageTypesResult>(`${this.baseUrl}/storage/types`, request);
  }

  updateStorageType(id: number, request: StorageTypeRequest): Observable<StorageTypesResult> {
    return this.http.put<StorageTypesResult>(`${this.baseUrl}/storage/types/${id}`, request);
  }

  deleteStorageType(id: number): Observable<StorageTypesResult> {
    return this.http.delete<StorageTypesResult>(`${this.baseUrl}/storage/types/${id}`);
  }

  getStorageUnits(): Observable<StorageUnit[]> {
    return this.http.get<StorageUnit[]>(`${this.baseUrl}/storage/units`);
  }

  createStorageUnit(name: string, typeId: number): Observable<StorageUnitsResult> {
    return this.http.post<StorageUnitsResult>(`${this.baseUrl}/storage/units`, { name, typeId });
  }

  updateStorageUnit(id: number, name: string, typeId: number): Observable<StorageUnitsResult> {
    return this.http.put<StorageUnitsResult>(`${this.baseUrl}/storage/units/${id}`, { name, typeId });
  }

  deleteStorageUnit(id: number): Observable<StorageUnitsResult> {
    return this.http.delete<StorageUnitsResult>(`${this.baseUrl}/storage/units/${id}`);
  }

  reorderStorageUnits(media: StorageMedia, unitIds: number[]): Observable<StorageUnitsResult> {
    return this.http.put<StorageUnitsResult>(`${this.baseUrl}/storage/units/order`, { media, unitIds });
  }

  getStorageLayout(): Observable<StorageLayout> {
    return this.http.get<StorageLayout>(`${this.baseUrl}/storage/layout`);
  }

  previewRedistribution(media: StorageMedia): Observable<RedistributePreview> {
    const params = new HttpParams().set('media', media);
    return this.http.get<RedistributePreview>(`${this.baseUrl}/storage/redistribute/preview`, { params });
  }

  redistribute(media: StorageMedia): Observable<StorageLayout> {
    return this.http.post<StorageLayout>(`${this.baseUrl}/storage/redistribute`, { media });
  }

  /** Emits `null` (HTTP 204) when no shelf exists for the record's medium. */
  getStorageSequence(media: StorageMedia): Observable<StorageSequence> {
    return this.http.get<StorageSequence>(`${this.baseUrl}/storage/sequence`, { params: { media } });
  }

  getUser(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/me`);
  }

  getProxiedImageUrl(originalUrl: string): string {
    if (!originalUrl || !originalUrl.includes('i.discogs.com')) {
      return originalUrl;
    }
    return `${this.baseUrl}/proxy/image?url=${encodeURIComponent(originalUrl)}`;
  }

  getRoonStatus(): Observable<RoonStatus> {
    return this.http.get<RoonStatus>(`${this.baseUrl}/roon/status`);
  }

  getRoonZones(): Observable<RoonZone[]> {
    return this.http.get<RoonZone[]>(`${this.baseUrl}/roon/zones`);
  }

  updateRoonSettings(settings: RoonSettings): Observable<RoonStatus> {
    return this.http.post<RoonStatus>(`${this.baseUrl}/roon/settings`, settings);
  }

  playOnRoon(request: RoonPlayRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.baseUrl}/roon/play`, request);
  }
}
