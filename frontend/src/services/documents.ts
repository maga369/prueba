import { api } from "./api";
import { Document, DocumentDetail, DocumentStatus, Entity } from "../types/api";

export const documentsApi = {
  upload: async (file: File): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<Document>("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  list: async (params?: {
    status?: DocumentStatus;
    assigned_only?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<{ items: Document[]; total: number; page: number; page_size: number }> => {
    const response = await api.get<{ items: Document[]; total: number; page: number; page_size: number }>("/documents", { params });
    return response.data;
  },

  get: async (id: string): Promise<DocumentDetail> => {
    const response = await api.get<DocumentDetail>(`/documents/${id}`);
    return response.data;
  },

  submitReview: async (id: string): Promise<Document> => {
    const response = await api.post<Document>(`/documents/${id}/submit-review`);
    return response.data;
  },

  approve: async (id: string): Promise<Document> => {
    const response = await api.post<Document>(`/documents/${id}/approve`);
    return response.data;
  },

  reject: async (id: string, reason: string): Promise<Document> => {
    const response = await api.post<Document>(`/documents/${id}/reject`, null, {
      params: { reason },
    });
    return response.data;
  },

  export: async (id: string, format: "pdf" | "txt" = "pdf"): Promise<Blob> => {
    const response = await api.get(`/documents/${id}/export`, {
      params: { format },
      responseType: "blob",
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },
};

export const entitiesApi = {
  getByDocument: async (docId: string): Promise<Entity[]> => {
    const response = await api.get<Entity[]>(`/entities/document/${docId}`);
    return response.data;
  },

  update: async (entityId: string, update: { action_taken: string; replacement_text?: string; reviewer_id?: string }): Promise<Entity> => {
    const response = await api.patch<Entity>(`/entities/${entityId}`, update);
    return response.data;
  },
};
