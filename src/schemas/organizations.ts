import { z } from "zod";
import { PaginationSchema, ResponseFormatSchema, SortSchema } from "./common.js";

export const ListOrganizationsSchema = z
  .object({
    filter_name: z
      .string()
      .optional()
      .describe("Filter by organization name (partial match)"),
    filter_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Filter by specific organization ID"),
    filter_organization_type_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Filter by organization type ID"),
    filter_organization_status_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Filter by organization status ID"),
    sort: SortSchema,
    ...PaginationSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();

export type ListOrganizationsInput = z.infer<typeof ListOrganizationsSchema>;

export const GetOrganizationSchema = z
  .object({
    organization_id: z
      .number()
      .int()
      .positive()
      .describe("The organization ID to retrieve"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type GetOrganizationInput = z.infer<typeof GetOrganizationSchema>;
