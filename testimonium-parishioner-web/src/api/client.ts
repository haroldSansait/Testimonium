import { auth } from "../firebaseConfig";
import { SessionService } from "../services/SessionService";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export class ApiError extends Error {
  statusCode: number;
  errors: any[];
  code?: string;

  constructor(message: string, statusCode: number, errors: any[] = [], code?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);

  // Query parameters mapping
  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });
  }

  // Headers configuration
  const headers = new Headers(options.headers || {});

  // Firebase token injection
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch (err) {
      console.warn("[API Client] Failed to retrieve Firebase ID token:", err);
    }
  }

  // Set default content type to JSON unless it's FormData (which needs browser-generated boundaries)
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers,
  });

  let responseData: any = {};
  const isOk = response.ok || response.status === 304;

  if (response.status !== 204 && response.status !== 304) {
    try {
      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = { message: await response.text() };
      }
    } catch (err) {
      console.warn("[API Client] Failed to parse response body:", err);
    }
  }

  if (!isOk) {
    if (response.status === 401) {
      // Trigger clean idempotent logout on 401 unauth response
      SessionService.logout('expired');
    }

    throw new ApiError(
      responseData.message || "Your session has expired for security reasons. Please sign in again.",
      response.status,
      responseData.errors || [],
      typeof responseData.code === "string" ? responseData.code : undefined
    );
  }

  return responseData.data !== undefined ? responseData.data : (responseData as T);
}

export const client = {
  get: <T>(endpoint: string, params?: Record<string, any>, options?: RequestOptions) =>
    request<T>(endpoint, { method: "GET", params, ...options }),
    
  post: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
    
  put: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
    
  patch: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
    
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: "DELETE", ...options }),
};
