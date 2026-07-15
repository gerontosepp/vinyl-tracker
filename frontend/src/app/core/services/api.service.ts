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
  QrCodeItem,
  SyncResult
} from '../types';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  scanBarcode(barcode: string, username: string): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.baseUrl}/scan`, { barcode });
  }

  deleteScan(id: number, username: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/scan/${id}`);
  }

  resetAllListens(username: string): Observable<ResetResult> {
    return this.http.delete<ResetResult>(`${this.baseUrl}/scan/all`);
  }

  getRecentListens(
    username: string,
    startDate?: string,
    endDate?: string
  ): Observable<ListenEvent[]> {
    let params = new HttpParams().set('t', Date.now().toString());
    if (startDate) params = params.set('from', startDate);
    if (endDate) params = params.set('to', endDate);
    return this.http.get<ListenEvent[]>(`${this.baseUrl}/analytics/recent`, { params });
  }

  getTopRecords(
    username: string,
    startDate?: string,
    endDate?: string
  ): Observable<AnalyticsTopRecord[]> {
    let params = new HttpParams().set('t', Date.now().toString());
    if (startDate) params = params.set('from', startDate);
    if (endDate) params = params.set('to', endDate);
    return this.http.get<AnalyticsTopRecord[]>(`${this.baseUrl}/analytics/top`, { params });
  }

  getCollectionValue(): Observable<CollectionValueResponse> {
    const params = new HttpParams().set('t', Date.now().toString());
    return this.http.get<CollectionValueResponse>(`${this.baseUrl}/analytics/collection/value`, { params });
  }

  getGenreBreakdown(): Observable<GenreBreakdownItem[]> {
    const params = new HttpParams().set('t', Date.now().toString());
    return this.http.get<GenreBreakdownItem[]>(`${this.baseUrl}/analytics/collection/genres`, { params });
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
    username: string,
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
    username: string,
    page: number = 1,
    perPage: number = 50,
    minPlays: number = 0,
    sort: string = 'artist',
    sortOrder: string = 'asc',
    search?: string
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
    return this.http.get<CollectionResponse>(`${this.baseUrl}/collection`, { params });
  }

  forceSyncCollection(username: string): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.baseUrl}/collection/sync`, {});
  }

  downloadQrCodes(username: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/collection/qr-codes/all`, { responseType: 'blob' });
  }

  downloadQrCodesSelected(items: QrCodeItem[]): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/collection/qr-codes/selected`, { items }, { responseType: 'blob' });
  }

  getUser(username: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/me`);
  }

  getProxiedImageUrl(originalUrl: string): string {
    if (!originalUrl || !originalUrl.includes('i.discogs.com')) {
      return originalUrl;
    }
    return `${this.baseUrl}/proxy/image?url=${encodeURIComponent(originalUrl)}`;
  }
}
