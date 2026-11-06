import { api } from "./api";
import { UserInfo } from "../types/api";

export const usersApi = {
  getMe: async (): Promise<UserInfo> => {
    const response = await api.get<UserInfo>("/users/me");
    return response.data;
  },

  list: async (params?: {
    role?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<{ items: UserInfo[]; total: number; page: number; page_size: number }> => {
    const response = await api.get<{ items: UserInfo[]; total: number; page: number; page_size: number }>("/users", { params });
    return response.data;
  },

  get: async (id: string): Promise<UserInfo> => {
    const response = await api.get<UserInfo>(`/users/${id}`);
    return response.data;
  },

  create: async (data: Partial<UserInfo> & { password: string }): Promise<UserInfo> => {
    const response = await api.post<UserInfo>("/users", data);
    return response.data;
  },

  update: async (id: string, data: Partial<UserInfo>): Promise<UserInfo> => {
    const response = await api.patch<UserInfo>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
