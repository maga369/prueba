import { api } from './api'
import { AuditLogList, AuditLog } from '../types/api'

export const auditApi = {
  getByDocument: async (docId: string, params?: {
    page?: number
    page_size?: number
    action?: string
  }): Promise<AuditLogList> => {
    const response = await api.get<AuditLogList>(`/audit/document/${docId}`, { params })
    return response.data
  },

  getByUser: async (userId: string, params?: {
    page?: number
    page_size?: number
    start_date?: string
    end_date?: string
  }): Promise<AuditLogList> => {
    const response = await api.get<AuditLogList>(`/audit/user/${userId}`, { params })
    return response.data
  },

  getSummary: async (params?: {
    start_date?: string
    end_date?: string
  }): Promise<{
    by_action: Record<string, number>
    documents_approved: number
    total_events: number
  }> => {
    const response = await api.get('/audit/stats/summary', { params })
    return response.data
  },
}
