import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ResponseFormat } from "../constants.js";

export const PaginationSchema = {
  page_number: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for pagination (starts at 1)"),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Results per page (1-${MAX_PAGE_SIZE}, default ${DEFAULT_PAGE_SIZE})`),
};

export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe(
    "Output format: 'markdown' for human-readable or 'json' for structured data"
  );

export const SortSchema = z
  .string()
  .optional()
  .describe(
    "Sort field. Prefix with - for descending (e.g. 'name', '-updated_at')"
  );
