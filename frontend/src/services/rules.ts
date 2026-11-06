import { api } from "./api";
import { Rule, RuleCreate, RuleUpdate, RuleListItem } from "../types/api";

export const rulesApi = {
  list: async (params?: {
    entity_type?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
    search?: string;
  }): Promise<{ items: RuleListItem[]; total: number; page: number; page_size: number }> => {
    const response = await api.get<{ items: RuleListItem[]; total: number; page: number; page_size: number }>("/rules", { params });
    return response.data;
  },

  get: async (id: string): Promise<Rule> => {
    const response = await api.get<Rule>(`/rules/${id}`);
    return response.data;
  },

  create: async (rule: RuleCreate): Promise<Rule> => {
    const response = await api.post<Rule>("/rules", rule);
    return response.data;
  },

  update: async (id: string, update: RuleUpdate): Promise<Rule> => {
    const response = await api.patch<Rule>(`/rules/${id}`, update);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/rules/${id}`);
  },
};
