import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getRecentListens, scanBarcode, loginUser, registerUser, getUser, logoutUser } from './api';

// Mock axios
const { mockPost, mockGet, mockDelete, mockPut, interceptorCallbacks } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockDelete: vi.fn(),
  mockPut: vi.fn(),
  interceptorCallbacks: {
    req: [] as any[],
    res: [] as any[],
  },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
      get: mockGet,
      delete: mockDelete,
      put: mockPut,
      interceptors: {
        request: {
          use: (s: any, e: any) => interceptorCallbacks.req.push({ s, e }),
        },
        response: {
          use: (s: any, e: any) => interceptorCallbacks.res.push({ s, e }),
        },
      },
    })),
    post: mockPost,
    get: mockGet,
    delete: mockDelete,
    put: mockPut,
  },
}));

describe('API Service', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loginUser should make a POST request to /users/login', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockPost.mockResolvedValue({ data: mockUser });

    const result = await loginUser('testuser', 'password123');

    expect(mockPost).toHaveBeenCalledWith('/users/login', {
      username: 'testuser',
      password: 'password123',
    });
    expect(result).toEqual(mockUser);
  });

  it('registerUser should make a POST request to /users/register', async () => {
    const mockUser = { id: 1, username: 'newuser' };
    mockPost.mockResolvedValue({ data: mockUser });

    const result = await registerUser('newuser', 'password123');

    expect(mockPost).toHaveBeenCalledWith('/users/register', {
      username: 'newuser',
      password: 'password123',
    });
    expect(result).toEqual(mockUser);
  });

  it('getUser should make a GET request to /users/me', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockGet.mockResolvedValue({ data: mockUser });

    const result = await getUser('testuser');

    expect(mockGet).toHaveBeenCalledWith('/users/me');
    expect(result).toEqual(mockUser);
  });

  it('getRecentListens should make a GET request to /analytics/recent', async () => {
    const mockListens = [{ id: 1, record: { title: 'Test Album' } }];
    mockGet.mockResolvedValue({ data: mockListens });

    const result = await getRecentListens('testuser');

    // Using expect.stringContaining as there's a timestamp query parameter now
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/analytics/recent?t='));
    expect(result).toEqual(mockListens);
  });

  it('scanBarcode should make a POST request to /scan', async () => {
    const mockResult = { success: true, message: 'Scanned' };
    mockPost.mockResolvedValue({ data: mockResult });

    const result = await scanBarcode('12345', 'testuser');

    expect(mockPost).toHaveBeenCalledWith('/scan', { barcode: '12345' });
    expect(result).toEqual(mockResult);
  });

  it('deleteScan should make a DELETE request to /scan/:id', async () => {
    mockDelete.mockResolvedValue({});
    const { deleteScan } = await import('./api');
    await deleteScan(123, 'testuser');
    expect(mockDelete).toHaveBeenCalledWith('/scan/123');
  });

  it('resetPassword should make a POST request to /users/reset-password', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockPost.mockResolvedValue({ data: mockUser });
    const { resetPassword } = await import('./api');

    const result = await resetPassword('testuser', 'newpass', 'token123');

    expect(mockPost).toHaveBeenCalledWith('/users/reset-password', {
      username: 'testuser',
      newPassword: 'newpass',
      discogsToken: 'token123',
    });
    expect(result).toEqual(mockUser);
  });

  it('updateDiscogsSettings should make a PUT request to /users/me/discogs', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockPut.mockResolvedValue({ data: mockUser });
    const { updateDiscogsSettings } = await import('./api');

    const result = await updateDiscogsSettings('testuser', 'token123', 'discogsUser', 'pass123');

    expect(mockPut).toHaveBeenCalledWith('/users/me/discogs', {
      token: 'token123',
      discogsUsername: 'discogsUser',
      password: 'pass123',
    });
    expect(result).toEqual(mockUser);
  });

  it('logoutUser should make a POST request to /users/logout', async () => {
    mockPost.mockResolvedValue({});

    await logoutUser();

    expect(mockPost).toHaveBeenCalledWith('/users/logout');
  });
  it('getCollection should make a GET request to /collection', async () => {
    const mockResponse = { releases: [] };
    mockGet.mockResolvedValue({ data: mockResponse });
    const { getCollection } = await import('./api');

    const result = await getCollection('testuser', 1, 50, 0);

    expect(mockGet).toHaveBeenCalledWith(
      '/collection?page=1&per_page=50&sort=artist&sort_order=asc'
    );
    expect(result).toEqual(mockResponse);
  });

  it('getCollection should include min_plays param when > 0', async () => {
    mockGet.mockResolvedValue({ data: {} });
    const { getCollection } = await import('./api');
    await getCollection('testuser', 1, 50, 5);
    expect(mockGet).toHaveBeenCalledWith(
      '/collection?page=1&per_page=50&sort=artist&sort_order=asc&min_plays=5'
    );
  });

  it('downloadQrCodes should make a GET request to /collection/qr-codes/all with responseType blob', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    mockGet.mockResolvedValue({ data: mockBlob });
    const { downloadQrCodes } = await import('./api');

    const result = await downloadQrCodes('testuser');

    expect(mockGet).toHaveBeenCalledWith('/collection/qr-codes/all', {
      responseType: 'blob',
    });
    expect(result).toEqual(mockBlob);
  });

  it('downloadQrCodesSelected should make a POST request with selected items', async () => {
    const mockItems = [{ id: 1, title: 'Album' }];
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    mockPost.mockResolvedValue({ data: mockBlob });
    const { downloadQrCodesSelected } = await import('./api');

    // @ts-expect-error: Mock items mismatch with actual strict typing
    const result = await downloadQrCodesSelected(mockItems);

    expect(mockPost).toHaveBeenCalledWith(
      '/collection/qr-codes/selected',
      { items: mockItems },
      { responseType: 'blob' }
    );
    expect(result).toEqual(mockBlob);
  });

  it('should add request metadata via interceptor without authorization header', async () => {
    // Get the request interceptor
    const reqInterceptor = interceptorCallbacks.req[0].s;

    // Execute interceptor
    const config = { headers: {} as any };
    const newConfig = reqInterceptor(config);

    expect(newConfig.headers.Authorization).toBeUndefined();
    expect(newConfig.metadata.startTime).toBeDefined();

    // Test request interceptor error callback
    const reqErrorInterceptor = interceptorCallbacks.req[0].e;
    const error = new Error('Request error');
    await expect(reqErrorInterceptor(error)).rejects.toThrow('Request error');
  });

  it('should log response time via response interceptor', async () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // Get the response interceptor
    const resInterceptor = interceptorCallbacks.res[0].s;

    const response = {
      status: 200,
      config: {
        method: 'get',
        url: '/test',
        metadata: { startTime: Date.now() - 100 },
      },
    };

    const result = resInterceptor(response);

    expect(result).toBe(response);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API Info] GET /test - Status: 200 - Time:')
    );

    consoleInfoSpy.mockRestore();
  });

  it('should log error time and status via response interceptor error callback', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Get the response error interceptor
    const resErrorInterceptor = interceptorCallbacks.res[0].e;

    const errorWithResponse = {
      message: 'Server Error',
      response: { status: 500 },
      config: {
        method: 'post',
        url: '/test-error',
        metadata: { startTime: Date.now() - 50 },
      },
    };

    await expect(resErrorInterceptor(errorWithResponse)).rejects.toBe(errorWithResponse);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[API Error] POST /test-error - Status: 500 - Time:')
    );

    // Test with missing config/response
    const plainError = { message: 'Network error' };
    await expect(resErrorInterceptor(plainError)).rejects.toBe(plainError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[API Error] UNKNOWN UNKNOWN URL - Status: Network/Unknown Error - Time: 0ms'
      )
    );

    consoleErrorSpy.mockRestore();
  });
});
