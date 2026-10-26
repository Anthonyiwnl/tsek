export interface ApplicationRecord {
  id: string;
  document_type_id: string;
  document_type_name: string;
  purpose: string;
  status: "draft" | "submitted";
  created_at: string;
  updated_at: string;
}

export interface DocumentType {
  id: string;
  name: string;
  description: string | null;
}

export interface ApplicationChanges {
  document_type_id?: string;
  purpose?: string;
}

export class ApplicationsApiError extends Error {
  status: number;
  code?: string;
}

export function createApplicationsApi(options: {
  baseUrl?: string;
  getHeaders: () => Promise<Record<string, string>>;
  fetchImpl?: typeof fetch;
}): {
  list(): Promise<ApplicationRecord[]>;
  get(id: string): Promise<ApplicationRecord>;
  catalogue(): Promise<DocumentType[]>;
  create(application: {
    document_type_id: string;
    purpose: string;
  }): Promise<ApplicationRecord>;
  update(id: string, changes: ApplicationChanges): Promise<ApplicationRecord>;
  remove(id: string): Promise<void>;
};
