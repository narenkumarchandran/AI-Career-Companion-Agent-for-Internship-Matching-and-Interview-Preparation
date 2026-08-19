import { apiClient } from "./client";
import type { TokenPair, User } from "../types";

export const authApi = {
  register: (full_name: string, email: string, password: string) =>
    apiClient.post<User>("/auth/register", { full_name, email, password }),

  login: (email: string, password: string) =>
    apiClient.post<TokenPair>("/auth/login", { email, password }),

  logout: (refresh_token: string) =>
    apiClient.post("/auth/logout", { refresh_token }),

  me: () => apiClient.get<User>("/auth/me"),

  forgotPassword: (email: string) =>
    apiClient.post("/auth/forgot-password", { email }),

  resetPassword: (reset_token: string, new_password: string) =>
    apiClient.post("/auth/reset-password", { reset_token, new_password }),

  changePassword: (current_password: string, new_password: string) =>
    apiClient.post("/auth/change-password", { current_password, new_password }),
};
