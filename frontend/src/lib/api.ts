import axios from "axios";

// Helper to get the base URL without trailing slash
export const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_URL || "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

// Axios instance for JSON APIs
export const api = axios.create({
  baseURL: getBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("google_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper for Fetch (needed for streaming)
export const getApiUrl = (endpoint: string): string => {
  const base = getBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

export const authedFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = localStorage.getItem("google_token");
  const devBypass = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(devBypass ? { "x-dev-user-id": "local-dev-user" } : {}),
  };

  const url = getApiUrl(endpoint);
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
      // Check if it's a usage limit error (should not trigger logout)
      let isUsageError = false;
      let errorMessage = "Unauthorized";

      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data?.error && typeof data.error === 'string') {
          if (data.error.includes("limit reached")) {
            isUsageError = true;
          }
          errorMessage = data.error;
        }
      } catch (e) {
        // Ignore JSON parse errors for auth/other errors
      }

      if (isUsageError) {
        throw new Error(errorMessage);
      }

      window.dispatchEvent(new Event("auth:logout"));
      throw new Error(errorMessage);
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};
