import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ITGlueClient } from "../services/itglue-client.js";
import {
  buildPaginationParams,
  handleApiError,
  paginationFooter,
  sectionTypeLabel,
  serializeRequest,
  stripHtml,
  truncateIfNeeded,
} from "../services/itglue-client.js";
import { ResponseFormat } from "../constants.js";
import type { ITGlueDocumentSection } from "../types.js";
import {
  ListDocumentSectionsSchema,
  GetDocumentSectionSchema,
  CreateDocumentSectionSchema,
  UpdateDocumentSectionSchema,
  DeleteDocumentSectionSchema,
  type ListDocumentSectionsInput,
  type GetDocumentSectionInput,
  type CreateDocumentSectionInput,
  type UpdateDocumentSectionInput,
  type DeleteDocumentSectionInput,
} from "../schemas/document-sections.js";

function sectionsPath(documentId: number, sectionId?: number): string {
  const base = `/documents/${documentId}/relationships/sections`;
  return sectionId ? `${base}/${sectionId}` : base;
}

function formatSectionMarkdown(section: ITGlueDocumentSection): string {
  const typeLabel = sectionTypeLabel(section.resource_type);
  const lines: string[] = [
    `### ${typeLabel} Section (ID: ${section.id}, Position: ${section.sort ?? "—"})`,
  ];
  if (section.level != null) lines.push(`**Level**: ${section.level}`);
  if (section.content) {
    lines.push(stripHtml(section.content));
  } else {
    lines.push("*No content*");
  }
  if (section.duration != null)
    lines.push(`- **Duration**: ${section.duration} min`);
  lines.push(`- **Updated**: ${section.updated_at}`);
  lines.push("");
  return lines.join("\n");
}

export function registerDocumentSectionTools(
  server: McpServer,
  client: ITGlueClient
): void {
  server.registerTool(
    "itglue_list_document_sections",
    {
      title: "List ITGlue Document Sections",
      description: `List all sections belonging to a specific document.

Returns section metadata including type, position, content preview, and timestamps. Sections are returned in position order.

Args:
  - document_id (number, required): The parent document ID
  - page_number (number, default 1): Page number
  - page_size (number, default 50, max 1000): Results per page
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  Paginated list of sections with id, type, position, content, and timestamps.

Examples:
  - "Show sections of document 456" -> { document_id: 456 }

Error Handling:
  - Returns "Error: Resource not found..." if the document doesn't exist`,
      inputSchema: ListDocumentSectionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListDocumentSectionsInput) => {
      try {
        const queryParams = buildPaginationParams(
          params.page_number,
          params.page_size
        );

        const result = await client.getMany<ITGlueDocumentSection>(
          sectionsPath(params.document_id),
          queryParams
        );

        if (result.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No sections found in this document.",
              },
            ],
          };
        }

        if (params.response_format === ResponseFormat.JSON) {
          const text = JSON.stringify(result, null, 2);
          return {
            content: [{ type: "text" as const, text: truncateIfNeeded(text) }],
          };
        }

        const lines: string[] = [
          `# Document Sections (${result.total_count} total)`,
          "",
        ];
        for (const section of result.data) {
          lines.push(formatSectionMarkdown(section));
        }
        lines.push(
          paginationFooter(
            result.total_count,
            result.page_number,
            result.has_more
          )
        );

        const text = truncateIfNeeded(
          lines.join("\n"),
          "Use itglue_get_document_section to retrieve individual sections in full."
        );
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "itglue_get_document_section",
    {
      title: "Get ITGlue Document Section",
      description: `Get a specific document section by its ID with full content.

Returns the section's type, position, raw HTML content, rendered content (with image URLs), and timestamps. Use this to retrieve the full content of a section that may have been truncated in itglue_get_document.

Args:
  - document_id (number, required): The parent document ID
  - section_id (number, required): The section ID
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  Full section details including content (HTML), rendered_content, type, position.

Examples:
  - "Get section 789 from document 456" -> { document_id: 456, section_id: 789 }
  - "Get raw HTML for section 789" -> { document_id: 456, section_id: 789, response_format: "json" }

Error Handling:
  - Returns "Error: Resource not found..." if the document or section ID doesn't exist`,
      inputSchema: GetDocumentSectionSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetDocumentSectionInput) => {
      try {
        const section = await client.getOne<ITGlueDocumentSection>(
          sectionsPath(params.document_id, params.section_id)
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(section, null, 2),
              },
            ],
          };
        }

        const typeLabel = sectionTypeLabel(section.resource_type);
        const lines: string[] = [
          `# ${typeLabel} Section (ID: ${section.id})`,
          "",
          `**Document ID**: ${section.document_id ?? "—"}`,
          `**Position**: ${section.sort ?? "—"}`,
        ];
        if (section.level != null) lines.push(`**Level**: ${section.level}`);
        if (section.duration != null)
          lines.push(`**Duration**: ${section.duration} min`);
        lines.push(`**Updated**: ${section.updated_at}`, "");

        if (section.content) {
          lines.push("## Content", "", stripHtml(section.content), "");
        } else {
          lines.push("*No content*", "");
        }

        const text = truncateIfNeeded(lines.join("\n"));
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "itglue_create_document_section",
    {
      title: "Create ITGlue Document Section",
      description: `Add a new section to an existing document.

Section types and their attributes:
  - Text: content (HTML body)
  - Heading: content (heading text), level (1-6, REQUIRED)
  - Gallery: no additional attributes
  - Step: content (HTML body), duration (minutes, optional), reset_count (boolean, optional)

Note: rendered_content is READ-ONLY and auto-generated. Do not include it.

Args:
  - document_id (number, required): Parent document ID
  - section_type ("Text"|"Heading"|"Gallery"|"Step", required): The type of section
  - content (string, optional): HTML content for Text/Step sections, or plain heading text for Heading sections
  - level (number 1-6, optional): Heading level. REQUIRED for Heading sections.
  - duration (number, optional): Duration in minutes. Step sections only.
  - reset_count (boolean, optional): Reset step count. Step sections only.
  - sort (number, optional): Sort order/position within the document (0-indexed)
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  The newly created section with its assigned ID.

Examples:
  - "Add a heading to document 456" -> { document_id: 456, section_type: "Heading", content: "Overview", level: 2 }
  - "Add body text" -> { document_id: 456, section_type: "Text", content: "<p>Server details...</p>" }
  - "Add a step" -> { document_id: 456, section_type: "Step", content: "<p>Install the app.</p>", duration: 5 }

Error Handling:
  - Returns "Error: Validation failed..." if required fields are missing (e.g., level for Heading sections)
  - Returns "Error: Resource not found..." if the document doesn't exist`,
      inputSchema: CreateDocumentSectionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: CreateDocumentSectionInput) => {
      try {
        const attributes: Record<string, unknown> = {
          resource_type: `Document::${params.section_type}`,
        };
        if (params.content !== undefined) attributes.content = params.content;
        if (params.level !== undefined) attributes.level = params.level;
        if (params.duration !== undefined) attributes.duration = params.duration;
        if (params.reset_count !== undefined)
          attributes.reset_count = params.reset_count;
        if (params.sort !== undefined) attributes.sort = params.sort;

        const body = serializeRequest("document-sections", attributes);

        const section = await client.post<ITGlueDocumentSection>(
          sectionsPath(params.document_id),
          body
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(section, null, 2),
              },
            ],
          };
        }

        const lines = [
          `# Section Created`,
          "",
          `**ID**: ${section.id}`,
          `**Type**: ${sectionTypeLabel(section.resource_type)}`,
          `**Document ID**: ${params.document_id}`,
          `**Position**: ${section.sort ?? "—"}`,
          `**Created**: ${section.created_at}`,
        ];
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "itglue_update_document_section",
    {
      title: "Update ITGlue Document Section",
      description: `Update an existing document section's content or sort order.

Content should be provided as HTML. Only specified fields are updated; omitted fields remain unchanged. The section type (resource_type) cannot be changed after creation. rendered_content is READ-ONLY and auto-generated — do not include it.

Args:
  - document_id (number, required): The parent document ID
  - section_id (number, required): The section ID to update
  - content (string, optional): New HTML content (or heading text for Heading sections)
  - level (number 1-6, optional): New heading level (Heading sections only)
  - duration (number, optional): Duration in minutes (Step sections only)
  - reset_count (boolean, optional): Reset step count (Step sections only)
  - sort (number, optional): New sort order/position within the document
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  The updated section with current content and metadata.

Examples:
  - "Update content of section 789 in document 456" -> { document_id: 456, section_id: 789, content: "<p>New content</p>" }
  - "Move section to position 0" -> { document_id: 456, section_id: 789, sort: 0 }

Error Handling:
  - Returns "Error: Resource not found..." if the section doesn't exist`,
      inputSchema: UpdateDocumentSectionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: UpdateDocumentSectionInput) => {
      try {
        const attributes: Record<string, unknown> = {};
        if (params.content !== undefined) attributes.content = params.content;
        if (params.level !== undefined) attributes.level = params.level;
        if (params.duration !== undefined) attributes.duration = params.duration;
        if (params.reset_count !== undefined)
          attributes.reset_count = params.reset_count;
        if (params.sort !== undefined) attributes.sort = params.sort;

        const body = serializeRequest(
          "document-sections",
          attributes,
          String(params.section_id)
        );

        const section = await client.patch<ITGlueDocumentSection>(
          sectionsPath(params.document_id, params.section_id),
          body
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(section, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Section updated successfully.\n\n${formatSectionMarkdown(section)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "itglue_delete_document_section",
    {
      title: "Delete ITGlue Document Section",
      description: `Permanently delete a document section by its ID. This action CANNOT be undone.

The section and all its content will be permanently removed from the parent document.

Args:
  - document_id (number, required): The parent document ID
  - section_id (number, required): The section ID to delete

Returns:
  Confirmation of successful deletion.

Examples:
  - "Delete section 789 from document 456" -> { document_id: 456, section_id: 789 }

Error Handling:
  - Returns "Error: Resource not found..." if the section doesn't exist`,
      inputSchema: DeleteDocumentSectionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DeleteDocumentSectionInput) => {
      try {
        await client.delete(
          sectionsPath(params.document_id, params.section_id)
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully deleted section ${params.section_id}.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );
}
