import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor for Auth
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("yato_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor for 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        const isLoginRequest = error.config?.url?.includes("/auth/login");
        const isRevealRequest = error.config?.url?.includes("/reveal");
        const isVerifyRequest = error.config?.url?.includes("/verify-password");
        const isLoginPage = window.location.pathname === "/login";
        
        if (!isLoginRequest && !isRevealRequest && !isVerifyRequest && !isLoginPage) {
          localStorage.removeItem("yato_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export function getFileDownloadUrl(fileId: string): string {
  if (typeof window === "undefined") return `/api/storage/download/${fileId}`;
  const token = localStorage.getItem("yato_token");
  return `/api/storage/download/${fileId}${token ? `?token=${token}` : ""}`;
}
