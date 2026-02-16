import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getRecentListens, scanBarcode, createUser, getUser } from './api';

// Mock axios directly
vi.mock('axios', () => {
    const mockPost = vi.fn();
    const mockGet = vi.fn();
    return {
        default: {
            create: vi.fn(() => ({
                post: mockPost,
                get: mockGet,
                interceptors: {
                    request: { use: vi.fn() },
                    response: { use: vi.fn() }
                }
            })),
            post: mockPost, // Fallback if used directly
            get: mockGet    // Fallback if used directly
        }
    };
});

describe('API Service', () => {
    let mockApi: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Get the mock instance created by axios.create()
        mockApi = (axios.create as any)();
    });

    it('createUser should make a POST request to /users', async () => {
        const mockUser = { id: 1, username: 'testuser' };
        mockApi.post.mockResolvedValue({ data: mockUser });

        const result = await createUser('testuser', 'token', 'discogsUser');

        expect(mockApi.post).toHaveBeenCalledWith('/users', {
            username: 'testuser',
            discogsToken: 'token',
            discogsUsername: 'discogsUser'
        });
        expect(result).toEqual(mockUser);
    });

    it('getUser should make a GET request to /users/:username', async () => {
        const mockUser = { id: 1, username: 'testuser' };
        mockApi.get.mockResolvedValue({ data: mockUser });

        const result = await getUser('testuser');

        expect(mockApi.get).toHaveBeenCalledWith('/users/testuser');
        expect(result).toEqual(mockUser);
    });

    it('getRecentListens should make a GET request to /analytics/recent', async () => {
        const mockListens = [{ id: 1, record: { title: 'Test Album' } }];
        mockApi.get.mockResolvedValue({ data: mockListens });

        const result = await getRecentListens('testuser');

        expect(mockApi.get).toHaveBeenCalledWith('/analytics/recent?username=testuser');
        expect(result).toEqual(mockListens);
    });

    it('scanBarcode should make a POST request to /scan', async () => {
        const mockResult = { success: true, message: 'Scanned' };
        mockApi.post.mockResolvedValue({ data: mockResult });

        const result = await scanBarcode('12345', 'testuser');

        expect(mockApi.post).toHaveBeenCalledWith('/scan?username=testuser', { barcode: '12345' });
        expect(result).toEqual(mockResult);
    });
});
