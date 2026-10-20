import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ScanResult,
  ListenEvent,
  User,
  AnalyticsTopRecord,
  ResetResult,
  CollectionResponse,
  CollectionValueResponse,
  GenreBreakdownItem,
  SyncResult,
  RecordDetailDto,
  RoonStatus,
  RoonZone,
  RoonSettings,
  RoonPlayRequest,
  PriceRefreshResult,
  RestoreResult,
  PrintRequest,
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

  logRecordListen(id: number): Observable<RecordDetailDto> {
    return this.http.post<RecordDetailDto>(`${this.baseUrl}/records/${id}/listen`, {});
  }

  refreshPrices(onlyMissing: boolean = true): Observable<PriceRefreshResult> {
    const params = new HttpParams().set('onlyMissing', onlyMissing.toString());
    return this.http.post<PriceRefreshResult>(`${this.baseUrl}/collection/prices/refresh`, {}, { params });
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
    unplayedOnly?: boolean
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
