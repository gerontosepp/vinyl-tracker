import axios from 'axios';
import type { ScanResult, ListenEvent, User, AnalyticsTopRecord } from '../types';

const API_Base = '/api';

export const api = axios.create({
  baseURL: API_Base,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to store start time and add JWT token
api.interceptors.request.use(
  (config: import('axios').InternalAxiosRequestConfig & { metadata?: { startTime: number } }) => {
    config.metadata = { startTime: Date.now() };
    const token = localStorage.getItem('vinyl_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercept responses to log duration and status
api.interceptors.response.use(
  (response) => {
    const config = response.config as import('axios').InternalAxiosRequestConfig & {
      metadata?: { startTime: number };
    };
    const duration = config.metadata ? Date.now() - config.metadata.startTime : 0;

    // Only log Info in development if preferred, or log everywhere:
    console.info(
      `[API Info] ${config.method?.toUpperCase()} ${config.url} - Status: ${response.status} - Time: ${duration}ms`
    );
    return response;
  },
  (error) => {
    const config = error.config as
      | (import('axios').InternalAxiosRequestConfig & { metadata?: { startTime: number } })
      | undefined;
    const duration = config?.metadata ? Date.now() - config.metadata.startTime : 0;
    const status = error.response ? error.response.status : 'Network/Unknown Error';
    const method = config?.method?.toUpperCase() || 'UNKNOWN';
    const url = config?.url || 'UNKNOWN URL';

    console.error(
      `[API Error] ${method} ${url} - Status: ${status} - Time: ${duration}ms - Error: ${error.message}`
    );
    return Promise.reject(error);
  }
);

export const scanBarcode = async (barcode: string, _username: string): Promise<ScanResult> => {
  const response = await api.post<ScanResult>(`/scan`, { barcode });
  return response.data;
};

export const deleteScan = async (id: number, _username: string): Promise<void> => {
  await api.delete(`/scan/${id}`);
};

export const getRecentListens = async (
  _username: string,
  startDate?: string,
  endDate?: string
): Promise<ListenEvent[]> => {
  // Add a dummy query param to easily append the others
  let url = `/analytics/recent?t=${Date.now()}`;
  if (startDate) url += `&from=${startDate}`;
  if (endDate) url += `&to=${endDate}`;
  const response = await api.get<ListenEvent[]>(url);
  return response.data;
};

export const getTopRecords = async (
  _username: string,
  startDate?: string,
  endDate?: string
): Promise<AnalyticsTopRecord[]> => {
  let url = `/analytics/top?t=${Date.now()}`;
  if (startDate) url += `&from=${startDate}`;
  if (endDate) url += `&to=${endDate}`;
  const response = await api.get<AnalyticsTopRecord[]>(url);
  return response.data;
};

export const loginUser = async (username: string, password: string): Promise<User> => {
  const response = await api.post('/users/login', { username, password });
  return response.data;
};

export const registerUser = async (username: string, password: string): Promise<User> => {
  const response = await api.post('/users/register', { username, password });
  return response.data;
};

export const resetPassword = async (
  username: string,
  newPassword: string,
  discogsToken: string
): Promise<User> => {
  const response = await api.post('/users/reset-password', { username, newPassword, discogsToken });
  return response.data;
};

export const updateDiscogsSettings = async (
  _username: string,
  token: string,
  discogsUsername: string,
  password: string
): Promise<User> => {
  const response = await api.put(`/users/me/discogs`, {
    token, // discogs token
    discogsUsername,
    password, // not verified on backend anymore but kept for payload
  });
  return response.data;
};

export const getCollection = async (
  _username: string,
  page: number = 1,
  perPage: number = 50,
  minPlays: number = 0,
  sort: string = 'artist',
  sortOrder: string = 'asc'
): Promise<import('../types').CollectionResponse> => {
  let url = `/collection?page=${page}&per_page=${perPage}&sort=${sort}&sort_order=${sortOrder}`;
  if (minPlays > 0) {
    url += `&min_plays=${minPlays}`;
  }
  const response = await api.get<import('../types').CollectionResponse>(url);
  return response.data;
};

export const forceSyncCollection = async (_username: string): Promise<import('../types').SyncResult> => {
  const response = await api.post<import('../types').SyncResult>(`/collection/sync`);
  return response.data;
};

export const downloadQrCodes = async (_username: string): Promise<Blob> => {
  const response = await api.get(`/collection/qr-codes/all`, {
    responseType: 'blob',
  });
  return response.data;
};

export const downloadQrCodesSelected = async (
  items: import('../types').QrCodeItem[]
): Promise<Blob> => {
  const response = await api.post(
    '/collection/qr-codes/selected',
    { items },
    { responseType: 'blob' }
  );
  return response.data;
};

export const getUser = async (_username: string): Promise<User> => {
  const response = await api.get<User>(`/users/me`);
  return response.data;
};

// Helper for proxying image requests to avoid CORS
export const getProxiedImageUrl = (originalUrl: string): string => {
  if (!originalUrl || !originalUrl.includes('i.discogs.com')) {
    return originalUrl;
  }
  return `${API_Base}/proxy/image?url=${encodeURIComponent(originalUrl)}`;
};
