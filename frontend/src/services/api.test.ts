import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getRecentListens, scanBarcode, loginUser, registerUser, getUser } from './api';

// Mock axios directly
vi.mock('axios', () => {
  const mockPost = vi.fn();
  const mockGet = vi.fn();
  return {
    default: {
      create: vi.fn(() => ({
        post: mockPost,
        get: mockGet,
        put: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      })),
      post: mockPost, // Fallback if used directly
      get: mockGet, // Fallback if used directly
    },
  };
});

describe('API Service', () => {
  let mockApi: { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the mock instance created by axios.create()
    mockApi = (
      axios.create as unknown as () => {
        post: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
      }
    )();
  });

  it('loginUser should make a POST request to /users/login', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockApi.post.mockResolvedValue({ data: mockUser });

    const result = await loginUser('testuser', 'password123');

    expect(mockApi.post).toHaveBeenCalledWith('/users/login', {
      username: 'testuser',
      password: 'password123',
    });
    expect(result).toEqual(mockUser);
  });

  it('registerUser should make a POST request to /users/register', async () => {
    const mockUser = { id: 1, username: 'newuser' };
    mockApi.post.mockResolvedValue({ data: mockUser });

    const result = await registerUser('newuser', 'password123');

    expect(mockApi.post).toHaveBeenCalledWith('/users/register', {
      username: 'newuser',
      password: 'password123',
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
