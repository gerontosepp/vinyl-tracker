import axios from 'axios';
import type { ScanResult, ListenEvent, User } from '../types';

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

export const getRecentListens = async (username: string): Promise<ListenEvent[]> => {
  const response = await api.get<ListenEvent[]>(`/analytics/recent?username=${username}`);
  return response.data;
};

export const getTopRecords = async (username: string): Promise<Record<string, unknown>[]> => {
  // Backend returns List<Map.Entry<String, Long>> which serializes to [{"key": "Title", "value": 5}, ...]
  // or generic object depending on Jackson config.
  // Let's type it as Record<string, unknown>[] for now and handle mapping in component.
  const response = await api.get<Record<string, unknown>[]>(`/analytics/top?username=${username}`);
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

// Deprecated or repurposed helpers if needed
export const getUser = async (username: string): Promise<User> => {
  const response = await api.get<User>(`/users/${username}`);
  return response.data;
};
