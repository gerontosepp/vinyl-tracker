import axios from 'axios';
import type { ScanResult, ListenEvent, User, AnalyticsTopRecord } from '../types';

const API_Base = '/api';

export const api = axios.create({
  baseURL: API_Base,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const scanBarcode = async (barcode: string, username: string): Promise<ScanResult> => {
  const response = await api.post<ScanResult>(`/scan?username=${username}`, { barcode });
  return response.data;
};

export const deleteScan = async (id: number, username: string): Promise<void> => {
  await api.delete(`/scan/${id}?username=${username}`);
};

export const getRecentListens = async (username: string, startDate?: string, endDate?: string): Promise<ListenEvent[]> => {
  let url = `/analytics/recent?username=${username}`;
  if (startDate) url += `&from=${startDate}`;
  if (endDate) url += `&to=${endDate}`;
  const response = await api.get<ListenEvent[]>(url);
  return response.data;
};

export const getTopRecords = async (username: string, startDate?: string, endDate?: string): Promise<AnalyticsTopRecord[]> => {
  let url = `/analytics/top?username=${username}`;
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
  username: string,
  token: string,
  discogsUsername: string,
  password: string
): Promise<User> => {
  const response = await api.put(`/users/${username}/discogs`, {
    token,
    discogsUsername,
    password,
  });
  return response.data;
};

export const getCollection = async (
  username: string,
  page: number = 1,
  perPage: number = 50
): Promise<import('../types').CollectionResponse> => {
  const response = await api.get<import('../types').CollectionResponse>(
    `/collection?username=${username}&page=${page}&per_page=${perPage}`
  );
  return response.data;
};

export const downloadQrCodes = async (username: string): Promise<Blob> => {
  const response = await api.get(`/collection/qr-codes/all?username=${username}`, {
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

// Deprecated or repurposed helpers if needed
export const getUser = async (username: string): Promise<User> => {
  const response = await api.get<User>(`/users/${username}`);
  return response.data;
};
