import { auth } from "../firebaseConfig";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

export class ApiError extends Error {
  statusCode: number;
  errors: any[];

  constructor(message: string, statusCode: number, errors: any[] = []) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
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
    throw new ApiError(
      responseData.message || "An error occurred during the API request.",
      response.status,
      responseData.errors || []
    );
  }

  return responseData.data !== undefined ? responseData.data : (responseData as T);
}

export const client = {
  get: <T>(endpoint: string, params?: Record<string, any>) =>
    request<T>(endpoint, { method: "GET", params }),
    
  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
    
  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
    
  patch: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
    
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: "DELETE" }),
};
