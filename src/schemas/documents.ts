import { z } from "zod";
import { PaginationSchema, ResponseFormatSchema, SortSchema } from "./common.js";

export const ListDocumentsSchema = z
  .object({
    organization_id: z
      .number()
      .int()
      .positive()
      .describe(
        "Organization ID to list documents for (required)"
      ),
    filter_name: z
      .string()
      .optional()
      .describe("Filter by document name (partial match)"),
    filter_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Filter by specific document ID"),
    sort: SortSchema,
    ...PaginationSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

export type ListDocumentsInput = z.infer<typeof ListDocumentsSchema>;

export const GetDocumentSchema = z
  .object({
    document_id: z
      .number()
      .int()
      .positive()
      .describe("The document ID to retrieve"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type GetDocumentInput = z.infer<typeof GetDocumentSchema>;

export const CreateDocumentSchema = z
  .object({
    organization_id: z
      .number()
      .int()
      .positive()
      .describe("Organization to associate the document with"),
    name: z
      .string()
      .min(1, "Document name is required")
      .describe("Document name/title"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

export const UpdateDocumentSchema = z
  .object({
    document_id: z
      .number()
      .int()
      .positive()
      .describe("The document ID to update"),
    name: z
      .string()
      .min(1)
      .optional()
      .describe("New document name"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

export const PublishDocumentSchema = z
  .object({
    document_id: z
      .number()
      .int()
      .positive()
      .describe("The document ID to publish"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type PublishDocumentInput = z.infer<typeof PublishDocumentSchema>;

export const DeleteDocumentsSchema = z
  .object({
    document_ids: z
      .array(z.number().int().positive())
      .min(1, "At least one document ID is required")
      .describe("Array of document IDs to delete"),
  })
  .strict();

export type DeleteDocumentsInput = z.infer<typeof DeleteDocumentsSchema>;
