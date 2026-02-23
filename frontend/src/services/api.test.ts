import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getRecentListens, scanBarcode, loginUser, registerUser, getUser } from './api';

// Mock axios
const { mockPost, mockGet, mockDelete, mockPut } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockDelete: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost,
      get: mockGet,
      delete: mockDelete,
      put: mockPut,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
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

  it('getUser should make a GET request to /users/:username', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockGet.mockResolvedValue({ data: mockUser });

    const result = await getUser('testuser');

    expect(mockGet).toHaveBeenCalledWith('/users/testuser');
    expect(result).toEqual(mockUser);
  });

  it('getRecentListens should make a GET request to /analytics/recent', async () => {
    const mockListens = [{ id: 1, record: { title: 'Test Album' } }];
    mockGet.mockResolvedValue({ data: mockListens });

    const result = await getRecentListens('testuser');

    expect(mockGet).toHaveBeenCalledWith('/analytics/recent?username=testuser');
    expect(result).toEqual(mockListens);
  });

  it('scanBarcode should make a POST request to /scan', async () => {
    const mockResult = { success: true, message: 'Scanned' };
    mockPost.mockResolvedValue({ data: mockResult });

    const result = await scanBarcode('12345', 'testuser');

    expect(mockPost).toHaveBeenCalledWith('/scan?username=testuser', { barcode: '12345' });
    expect(result).toEqual(mockResult);
  });

  it('deleteScan should make a DELETE request to /scan/:id', async () => {
    mockDelete.mockResolvedValue({});
    const { deleteScan } = await import('./api');
    await deleteScan(123, 'testuser');
    expect(mockDelete).toHaveBeenCalledWith('/scan/123?username=testuser');
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

  it('updateDiscogsSettings should make a PUT request to /users/:username/discogs', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockPut.mockResolvedValue({ data: mockUser });
    const { updateDiscogsSettings } = await import('./api');

    const result = await updateDiscogsSettings('testuser', 'token123', 'discogsUser', 'pass123');

    expect(mockPut).toHaveBeenCalledWith('/users/testuser/discogs', {
      token: 'token123',
      discogsUsername: 'discogsUser',
      password: 'pass123',
    });
    expect(result).toEqual(mockUser);
  });
  it('getCollection should make a GET request to /collection', async () => {
    const mockResponse = { releases: [] };
    mockGet.mockResolvedValue({ data: mockResponse });
    const { getCollection } = await import('./api');

    const result = await getCollection('testuser', 1, 50, 0);

    expect(mockGet).toHaveBeenCalledWith(
      '/collection?username=testuser&page=1&per_page=50&sort=artist&sort_order=asc'
    );
    expect(result).toEqual(mockResponse);
  });

  it('getCollection should include min_plays param when > 0', async () => {
    mockGet.mockResolvedValue({ data: {} });
    const { getCollection } = await import('./api');
    await getCollection('testuser', 1, 50, 5);
    expect(mockGet).toHaveBeenCalledWith(
      '/collection?username=testuser&page=1&per_page=50&sort=artist&sort_order=asc&min_plays=5'
    );
  });

  it('downloadQrCodes should make a GET request to /collection/qr-codes/all with responseType blob', async () => {
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    mockGet.mockResolvedValue({ data: mockBlob });
    const { downloadQrCodes } = await import('./api');

    const result = await downloadQrCodes('testuser');

    expect(mockGet).toHaveBeenCalledWith('/collection/qr-codes/all?username=testuser', {
      responseType: 'blob',
    });
    expect(result).toEqual(mockBlob);
  });

  it('downloadQrCodesSelected should make a POST request with selected items', async () => {
    const mockItems = [{ id: 1, title: 'Album' }];
    const mockBlob = new Blob(['pdf'], { type: 'application/pdf' });
    mockPost.mockResolvedValue({ data: mockBlob });
    const { downloadQrCodesSelected } = await import('./api');

    // @ts-ignore
    const result = await downloadQrCodesSelected(mockItems);

    expect(mockPost).toHaveBeenCalledWith(
      '/collection/qr-codes/selected',
      { items: mockItems },
      { responseType: 'blob' }
    );
    expect(result).toEqual(mockBlob);
  });
});
