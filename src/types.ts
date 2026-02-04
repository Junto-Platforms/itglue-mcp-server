export interface JsonApiResourceObject {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<
    string,
    {
      data:
        | { id: string; type: string }
        | Array<{ id: string; type: string }>
        | null;
    }
  >;
}

export interface JsonApiMeta {
  "current-page"?: number;
  "next-page"?: number | null;
  "prev-page"?: number | null;
  "total-pages"?: number;
  "total-count"?: number;
}

export interface JsonApiResponse {
  data: JsonApiResourceObject | JsonApiResourceObject[];
  included?: JsonApiResourceObject[];
  meta?: JsonApiMeta;
}

export interface JsonApiRequestBody {
  data:
    | {
        type: string;
        attributes: Record<string, unknown>;
        id?: string;
      }
    | Array<{
        type: string;
        attributes: Record<string, unknown>;
        id?: string;
      }>;
}

export interface JsonApiError {
  status: string;
  title: string;
  detail?: string;
  source?: { pointer?: string; parameter?: string };
}

export interface JsonApiErrorResponse {
  errors: JsonApiError[];
}

export interface ITGlueOrganization {
  [key: string]: unknown;
  id: string;
  type: string;
  name: string;
  description: string | null;
  organization_type_id: number | null;
  organization_type_name: string | null;
  organization_status_id: number | null;
  organization_status_name: string | null;
  short_name: string | null;
  primary: boolean;
  quick_notes: string | null;
  alert: string | null;
  created_at: string;
  updated_at: string;
}

export interface ITGlueDocument {
  [key: string]: unknown;
  id: string;
  type: string;
  name: string;
  organization_id: number | null;
  organization_name: string | null;
  resource_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ITGlueDocumentSection {
  [key: string]: unknown;
  id: string;
  type: string;
  document_id: number | null;
  resource_id: number | null;
  resource_type: string | null;
  content: string | null;
  rendered_content: string | null;
  sort: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total_count: number;
  page_number: number;
  page_size: number;
  has_more: boolean;
  next_page: number | null;
}

export interface ITGlueClientConfig {
  apiKey: string;
  baseUrl: string;
}
