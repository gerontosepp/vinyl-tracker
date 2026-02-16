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

export const getRecentListens = async (username: string): Promise<ListenEvent[]> => {
    const response = await api.get<ListenEvent[]>(`/analytics/recent?username=${username}`);
    return response.data;
};

export const getTopRecords = async (username: string): Promise<any[]> => {
    // Backend returns List<Map.Entry<String, Long>> which serializes to [{"key": "Title", "value": 5}, ...] 
    // or generic object depending on Jackson config. 
    // Let's type it as any[] for now and handle mapping in component.
    const response = await api.get<any[]>(`/analytics/top?username=${username}`);
    return response.data;
};

export const createUser = async (username: string, discogsToken: string, discogsUsername: string): Promise<User> => {
    const response = await api.post<User>('/users', { username, discogsToken, discogsUsername });
    return response.data;
};

export const getUser = async (username: string): Promise<User> => {
    const response = await api.get<User>(`/users/${username}`);
    return response.data;
}
