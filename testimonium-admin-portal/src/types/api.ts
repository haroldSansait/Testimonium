// ─── API Types ─────────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

export interface ApiResponseEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BackendPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

