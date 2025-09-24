import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ApiClient } from '../api-client';

// Mock axios
vi.mock('axios');

describe('ApiClient', () => {
  let apiClient: ApiClient;
  const mockAxios = vi.mocked(axios);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock axios.create
    const mockInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
    };
    
    mockAxios.create.mockReturnValue(mockInstance as any);
  });

  it('creates axios instance with correct config', () => {
    apiClient = new ApiClient({
      baseURL: 'https://api.test.com',
      timeout: 5000,
    });
    
    expect(mockAxios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.test.com',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('sets up request and response interceptors', () => {
    apiClient = new ApiClient({
      baseURL: 'https://api.test.com',
      timeout: 5000,
    });
    
    const mockInstance = mockAxios.create.mock.results[0].value;
    
    expect(mockInstance.interceptors.request.use).toHaveBeenCalled();
    expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
  });

  it('sets and gets Turnstile token', () => {
    apiClient = new ApiClient({
      baseURL: 'https://api.test.com',
      timeout: 5000,
    });
    
    expect(apiClient.getTurnstileToken()).toBeNull();
    
    apiClient.setTurnstileToken('test-token');
    expect(apiClient.getTurnstileToken()).toBe('test-token');
    
    apiClient.setTurnstileToken(null);
    expect(apiClient.getTurnstileToken()).toBeNull();
  });

  it('adds Turnstile token to request headers', () => {
    apiClient = new ApiClient({
      baseURL: 'https://api.test.com',
      timeout: 5000,
    });
    
    const mockInstance = mockAxios.create.mock.results[0].value;
    const requestInterceptor = mockInstance.interceptors.request.use.mock.calls[0][0];
    
    apiClient.setTurnstileToken('test-token');
    
    const config = { headers: {} };
    const result = requestInterceptor(config);
    
    expect(result.headers['X-Turnstile-Token']).toBe('test-token');
  });

  it('does not add token header when no token is set', () => {
    apiClient = new ApiClient({
      baseURL: 'https://api.test.com',
      timeout: 5000,
    });
    
    const mockInstance = mockAxios.create.mock.results[0].value;
    const requestInterceptor = mockInstance.interceptors.request.use.mock.calls[0][0];
    
    const config = { headers: {} };
    const result = requestInterceptor(config);
    
    expect(result.headers['X-Turnstile-Token']).toBeUndefined();
  });

  it('handles response errors gracefully', () => {
    apiClient = new ApiClient({
      baseURL: 'https://api.test.com',
      timeout: 5000,
    });
    
    const mockInstance = mockAxios.create.mock.results[0].value;
    const responseErrorHandler = mockInstance.interceptors.response.use.mock.calls[0][1];
    
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const error = {
      response: {
        status: 401,
        data: {
          message: 'Turnstile verification failed',
        },
      },
    };
    
    expect(() => responseErrorHandler(error)).toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Turnstile verification failed, token may need refresh');
    
    consoleSpy.mockRestore();
  });
});