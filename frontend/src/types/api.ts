export interface UserInfo {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  preferred_username: string;
}

export type UserRole = "admin" | "transcriptor" | "aprobador";

export interface Document {
  id: string;
  original_filename: string;
  status: DocumentStatus;
  version: number;
  page_count: number;
  assigned_to?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  assignee_name?: string;
  assignee_email?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetail extends Document {
  original_path: string;
  redacted_path?: string;
  plain_text_path?: string;
  current_rule_set_version?: number;
  ocr_text?: string;
  entities: Entity[];
  pages: Page[];
  body?: string;
  createElement?: never;
}

export interface Page {
  id: string;
  page_num: number;
  ocr_text?: string;
  ocr_confidence?: number;
  image_width?: number;
  image_height?: number;
  source?: string;
}

export type DocumentStatus =
  | "UPLOADED"
  | "OCR_PROCESSING"
  | "OCR_DONE"
  | "PII_DETECTING"
  | "PII_DONE"
  | "IN_REVIEW"
  | "READY_FOR_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "EXPORTED"
  | "FAILED";

export interface Entity {
  id: string;
  document_id: string;
  page_id?: string;
  entity_type: string;
  start_char: number;
  end_char: number;
  bbox: number[];
  confidence: number;
  page_num: number;
  rule_id?: string;
  action_taken: EntityAction;
  reviewer_id?: string;
  reviewed_at?: string;
  original_text?: string;
  replacement_text?: string;
  created_at: string;
}

export type EntityAction = "REMOVE" | "GENERALIZE" | "PSEUDONYMIZE" | "KEEP" | "MANUAL_EDIT";

export interface EntityUpdate {
  action_taken: EntityAction;
  replacement_text?: string;
  reviewer_id?: string;
}

export interface EntityStats {
  total: number;
  by_type: Record<string, number>;
  by_action: Record<string, number>;
  pending_review: number;
  reviewed: number;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  entity_type: string;
  pattern_regex?: string;
  action: EntityAction;
  config: Record<string, any>;
  is_active: boolean;
  version: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface RuleCreate {
  name: string;
  description?: string;
  entity_type: string;
  pattern_regex?: string;
  action: EntityAction;
  config?: Record<string, any>;
}

export interface RuleUpdate {
  name?: string;
  description?: string;
  pattern_regex?: string;
  action?: EntityAction;
  config?: Record<string, any>;
  is_active?: boolean;
}

export interface RuleListItem {
  id: string;
  name: string;
  entity_type: string;
  action: EntityAction;
  is_active: boolean;
  version: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  document_id?: string;
  user_id?: string;
  action: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditLogList {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UploadResponse {
  id: string;
  original_filename: string;
  status: DocumentStatus;
  version: number;
  page_count: number;
  created_at: string;
  updated_at: string;
}
