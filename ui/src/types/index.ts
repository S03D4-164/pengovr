export interface Task {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt?: string;
  webpageId?: string;
  error?: string;
  options?: {
    userAgent?: string | null;
    referrer?: string | null;
  };
}

export interface TaskResult {
  _id: string;
  taskId: string;
  url: string;
  title: string;
  screenshot?: string | null;
  request?: any;
  response?: {
    status: number;
    statusText: string;
    headers?: any;
    url: string;
    loadTime: number;
    timestamp: string;
  };
  content?: string;
  scrapedAt?: string;
  createdAt?: string;
}

export interface TaskDetailResponse extends Task {
  results?: TaskResult[];
}

export interface TaskProgressResponse {
  taskId: string;
  url: string;
  status: string;
  webpageId?: string;
  progress: {
    percentage: number;
    message: string;
    resultCount: number;
    hasResults: boolean;
    createdAt: string;
    updatedAt?: string;
  };
  error?: string;
}

export interface ResultListResponse {
  results: TaskResult[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
