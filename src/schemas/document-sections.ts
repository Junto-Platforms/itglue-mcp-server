import { z } from "zod";
import { PaginationSchema, ResponseFormatSchema } from "./common.js";
import { SECTION_TYPES } from "../constants.js";

const SectionTypeEnum = z.enum(SECTION_TYPES);

const DocumentIdField = z
  .number()
  .int()
  .positive()
  .describe("The parent document ID");

const SectionIdField = z
  .number()
  .int()
  .positive()
  .describe("The document section ID");

export const ListDocumentSectionsSchema = z
  .object({
    document_id: DocumentIdField.describe(
      "The parent document ID to list sections for"
    ),
    ...PaginationSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

export type ListDocumentSectionsInput = z.infer<typeof ListDocumentSectionsSchema>;

export const GetDocumentSectionSchema = z
  .object({
    document_id: DocumentIdField,
    section_id: SectionIdField.describe("The document section ID to retrieve"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type GetDocumentSectionInput = z.infer<typeof GetDocumentSectionSchema>;

export const CreateDocumentSectionSchema = z
  .object({
    document_id: DocumentIdField.describe(
      "Parent document ID to add the section to"
    ),
    section_type: SectionTypeEnum.describe(
      "Section type: Text, Heading, Gallery, or Step"
    ),
    content: z
      .string()
      .optional()
      .describe("HTML content for Text and Step sections, or plain text for Heading sections"),
    level: z
      .number()
      .int()
      .min(1)
      .max(6)
      .optional()
      .describe("Heading level 1-6. REQUIRED for Heading sections."),
    duration: z
      .number()
      .optional()
      .describe("Duration in minutes. Only used for Step sections."),
    reset_count: z
      .boolean()
      .optional()
      .describe("Whether to reset the step count. Only used for Step sections."),
    sort: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Sort order/position within the document (0-indexed)"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type CreateDocumentSectionInput = z.infer<typeof CreateDocumentSectionSchema>;

export const UpdateDocumentSectionSchema = z
  .object({
    document_id: DocumentIdField,
    section_id: SectionIdField.describe("The section ID to update"),
    content: z
      .string()
      .optional()
      .describe("New HTML content for the section"),
    level: z
      .number()
      .int()
      .min(1)
      .max(6)
      .optional()
      .describe("New heading level 1-6 (Heading sections only)"),
    duration: z
      .number()
      .optional()
      .describe("Duration in minutes (Step sections only)"),
    reset_count: z
      .boolean()
      .optional()
      .describe("Whether to reset the step count (Step sections only)"),
    sort: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("New sort order/position within the document"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type UpdateDocumentSectionInput = z.infer<typeof UpdateDocumentSectionSchema>;

export const DeleteDocumentSectionSchema = z
  .object({
    document_id: DocumentIdField,
    section_id: SectionIdField.describe("The section ID to delete"),
  })
  .strict();

export type DeleteDocumentSectionInput = z.infer<typeof DeleteDocumentSectionSchema>;
