const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text() as unknown as T;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params)}`
      : endpoint;
    return this.request<T>(url);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

const api = new ApiClient(API_BASE_URL);

export const taskApi = {
  createTask: (url: string, options?: any) =>
    api.post<{
      message: string;
      webpageId: string;
    }>('/tasks', {
      url,
      options,
    }),
};

export const responseApi = {
  getResponses: (
    page = 1,
    limit = 10,
    search = '',
    startDate = '',
    endDate = '',
    urlRegex = '',
    textRegex = '',
    ipRegex = '',
    yaraRegex = '',
    payloadId = '',
    yaraRuleId = '',
  ) =>
    api.get<any>('/responses', {
      page: page.toString(),
      limit: limit.toString(),
      search,
      startDate,
      endDate,
      urlRegex,
      textRegex,
      ipRegex,
      yaraRegex,
      payloadId,
      yaraRuleId,
    }),
  getResponse: (id: string) => api.get<any>(`/responses/${id}`),
  deleteResponse: (id: string) => api.delete(`/responses/${id}`),
  getScreenshotUrl: (id: string) =>
    `${API_BASE_URL}/responses/${id}/screenshot`,
};

export const payloadApi = {
  getPayloads: (page = 1, limit = 10, search = '') =>
    api.get<any>('/payloads', {
      page: page.toString(),
      limit: limit.toString(),
      search,
    }),
  getPayload: (id: string) => api.get(`/payloads/${id}`),
};

export const webpageApi = {
  getWebpages: (
    page = 1,
    limit = 10,
    search = '',
    startDate = '',
    endDate = '',
    payloadId = '',
    yaraRuleId = '',
  ) =>
    api.get('/webpages', {
      page: page.toString(),
      limit: limit.toString(),
      search,
      startDate,
      endDate,
      payloadId,
      yaraRuleId,
    }),
  getWebpage: (id: string) => api.get(`/webpages/${id}`),
  getHarFile: (id: string) => api.get(`/webpages/${id}/harfile`),
};

export const websiteApi = {
  getWebsites: (
    page = 1,
    limit = 10,
    search = '',
    startDate = '',
    endDate = '',
    onlyTracking = false,
  ) =>
    api.get('/websites', {
      page: page.toString(),
      limit: limit.toString(),
      search,
      startDate,
      endDate,
      onlyTracking: onlyTracking.toString(),
    }),
  getWebsite: (id: string) => api.get(`/websites/${id}`),
  getWebsiteByUrl: (url: string) => api.get(`/websites/by-url/${url}`),
};

export const screenshotApi = {
  getScreenshots: (
    page = 1,
    limit = 10,
    search = '',
    startDate = '',
    endDate = '',
  ) =>
    api.get<any>('/screenshots', {
      page: (page || 1).toString(),
      limit: (limit || 10).toString(),
      search: search || '',
      startDate: startDate || '',
      endDate: endDate || '',
    }),
  getScreenshot: (id: string) => api.get(`/screenshots/${id}`),
};

export const yaraApi = {
  getYaraRules: (page?: number, limit?: number, search?: string) =>
    api.get<{
      results: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/yaras', {
      page: (page || 1).toString(),
      limit: (limit || 10).toString(),
      search: search || '',
    }),
  getYaraRule: (id: string) => api.get(`/yaras/${id}`),
  createYaraRule: (
    name: string,
    rule: string,
    actions?: string,
    valid?: boolean,
  ) => api.post('/yaras', { name, rule, actions, valid }),
  updateYaraRule: (
    id: string,
    name: string,
    rule: string,
    actions?: string,
    valid?: boolean,
  ) => api.put(`/yaras/${id}`, { name, rule, actions, valid }),
  deleteYaraRule: (id: string) => api.delete(`/yaras/${id}`),
};

export const healthApi = {
  check: () => api.get('/health'),
};

export type AiProvider = 'gemini' | 'bedrock';

export const aiExplainApi = {
  explain: (webpageId: string, content: string, ai: AiProvider) =>
    api.post<{ message: string; taskId: string }>('/ai/explain', {
      webpageId,
      content,
      ai,
    }),
  explainContent: (content: string, ai: AiProvider) =>
    api.post<{ message: string; taskId: string }>('/ai/explain-content', {
      content,
      ai,
    }),
  getResult: (taskId: string) =>
    api.get<{
      status: string;
      explanation?: string;
      error?: string;
      message?: string;
    }>(`/ai/result/${taskId}`),
};

export const userAgentApi = {
  getUserAgents: (page?: number, limit?: number) =>
    api.get<{
      results: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/user-agents', {
      page: (page || 1).toString(),
      limit: (limit || 10).toString(),
    }),
  getAllUserAgents: () => api.get<{ results: any[] }>('/user-agents/all'),
  getUserAgent: (id: string) => api.get(`/user-agents/${id}`),
  createUserAgent: (name: string, userAgent: string) =>
    api.post('/user-agents', { name, userAgent }),
  updateUserAgent: (id: string, name: string, userAgent: string) =>
    api.put(`/user-agents/${id}`, { name, userAgent }),
  deleteUserAgent: (id: string) => api.delete(`/user-agents/${id}`),
};
