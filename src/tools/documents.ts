import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ITGlueClient } from "../services/itglue-client.js";
import {
  buildFilterParams,
  buildPaginationParams,
  handleApiError,
  paginationFooter,
  sectionTypeLabel,
  serializeDeleteBody,
  stripHtml,
  truncateIfNeeded,
  serializeRequest,
} from "../services/itglue-client.js";
import { ResponseFormat } from "../constants.js";
import type { ITGlueDocument, ITGlueDocumentSection } from "../types.js";
import {
  ListDocumentsSchema,
  GetDocumentSchema,
  CreateDocumentSchema,
  UpdateDocumentSchema,
  PublishDocumentSchema,
  DeleteDocumentsSchema,
  type ListDocumentsInput,
  type GetDocumentInput,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type PublishDocumentInput,
  type DeleteDocumentsInput,
} from "../schemas/documents.js";

function formatDocumentMarkdown(doc: ITGlueDocument): string {
  const lines: string[] = [`## ${doc.name} (ID: ${doc.id})`];
  if (doc.organization_name)
    lines.push(`- **Organization**: ${doc.organization_name}`);
  lines.push(`- **Published**: ${doc.published ? "Yes" : "No"}`);
  lines.push(`- **Updated**: ${doc.updated_at}`);
  if (doc.resource_url) lines.push(`- **URL**: ${doc.resource_url}`);
  lines.push("");
  return lines.join("\n");
}

export function registerDocumentTools(
  server: McpServer,
  client: ITGlueClient
): void {
  server.registerTool(
    "itglue_list_documents",
    {
      title: "List ITGlue Documents",
      description: `List and search documents within a specific organization.

Returns document metadata including name, organization, published status, and timestamps. Does NOT return document content — use itglue_get_document for full content. Use itglue_list_organizations first if you need to find the organization ID.

Args:
  - organization_id (number, required): Organization ID to list documents for
  - filter_name (string, optional): Filter by document name (partial match)
  - filter_id (number, optional): Filter by specific document ID
  - sort (string, optional): Sort field (e.g. "name", "-updated_at")
  - page_number (number, default 1): Page number
  - page_size (number, default 50, max 1000): Results per page
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  Paginated list of documents with id, name, organization, published status, and timestamps.

Examples:
  - "Find network docs in org 123" -> { organization_id: 123, filter_name: "network" }
  - "List all documents for org 123" -> { organization_id: 123 }
  - "Show recent documents" -> { organization_id: 123, sort: "-updated_at" }

Error Handling:
  - Returns "Error: Authentication failed..." if API key is invalid
  - Returns "Error: Rate limit exceeded..." if too many requests`,
      inputSchema: ListDocumentsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListDocumentsInput) => {
      try {
        const queryParams: Record<string, string | number> = {
          ...buildPaginationParams(params.page_number, params.page_size),
          ...buildFilterParams({
            name: params.filter_name,
            id: params.filter_id,
          }),
        };
        if (params.sort) queryParams.sort = params.sort;

        const path = `/organizations/${params.organization_id}/relationships/documents`;

        const result = await client.getMany<ITGlueDocument>(path, queryParams);

        if (result.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No documents found matching the specified filters.",
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
          `# Documents (${result.total_count} total)`,
          "",
        ];
        for (const doc of result.data) {
          lines.push(formatDocumentMarkdown(doc));
        }
        lines.push(
          paginationFooter(
            result.total_count,
            result.page_number,
            result.has_more
          )
        );

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
    "itglue_get_document",
    {
      title: "Get ITGlue Document",
      description: `Get a specific document by ID, including all embedded sections with their content.

Returns the full document structure with metadata and all sections (headings, text, steps, galleries). Section content is HTML. For markdown output, HTML is converted to plain text.

If the document has many sections, content may be truncated. Use itglue_get_document_section to retrieve individual sections in full.

Args:
  - document_id (number, required): The document ID
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  Document metadata plus all sections with their content, type, and position.

Examples:
  - "Show me document 456" -> { document_id: 456 }
  - "Get raw data for document 789" -> { document_id: 789, response_format: "json" }

Error Handling:
  - Returns "Error: Resource not found..." if the document ID doesn't exist`,
      inputSchema: GetDocumentSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetDocumentInput) => {
      try {
        const doc = await client.getOne<ITGlueDocument>(
          `/documents/${params.document_id}`
        );

        const sections = await client.getMany<ITGlueDocumentSection>(
          `/documents/${params.document_id}/relationships/sections`,
          { "page[size]": 1000 }
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = { ...doc, sections: sections.data };
          const text = JSON.stringify(output, null, 2);
          return {
            content: [{ type: "text" as const, text: truncateIfNeeded(text) }],
          };
        }

        const lines: string[] = [
          `# ${doc.name}`,
          "",
          `**ID**: ${doc.id}`,
        ];
        if (doc.organization_name)
          lines.push(`**Organization**: ${doc.organization_name}`);
        lines.push(`**Published**: ${doc.published ? "Yes" : "No"}`);
        lines.push(`**Updated**: ${doc.updated_at}`);
        if (doc.resource_url) lines.push(`**URL**: ${doc.resource_url}`);
        lines.push("");

        if (sections.data.length === 0) {
          lines.push("*No sections in this document.*");
        } else {
          lines.push(`## Sections (${sections.data.length})`, "");
          for (const section of sections.data) {
            const typeLabel = sectionTypeLabel(section.resource_type);
            lines.push(
              `### ${typeLabel} Section (ID: ${section.id}, Position: ${section.sort ?? "—"})`
            );
            if (section.content) {
              const plainText = stripHtml(section.content);
              lines.push(plainText);
            } else {
              lines.push("*No content*");
            }
            lines.push("");
          }
        }

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
    "itglue_create_document",
    {
      title: "Create ITGlue Document",
      description: `Create a new document in ITGlue, associated with an organization.

The document is created as a draft. Use itglue_publish_document to publish it. Use itglue_create_document_section to add content sections after creation.

Args:
  - organization_id (number, required): Organization to associate the document with
  - name (string, required): Document name/title
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  The newly created document with its assigned ID and metadata.

Examples:
  - "Create a new runbook for org 123" -> { organization_id: 123, name: "Server Maintenance Runbook" }

Error Handling:
  - Returns "Error: Validation failed..." if required fields are missing
  - Returns "Error: Resource not found..." if the organization doesn't exist`,
      inputSchema: CreateDocumentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: CreateDocumentInput) => {
      try {
        const body = serializeRequest("documents", {
          organization_id: params.organization_id,
          name: params.name,
        });

        const doc = await client.post<ITGlueDocument>("/documents", body);

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(doc, null, 2),
              },
            ],
          };
        }

        const lines = [
          `# Document Created`,
          "",
          `**ID**: ${doc.id}`,
          `**Name**: ${doc.name}`,
          `**Published**: No (draft)`,
          `**Created**: ${doc.created_at}`,
          "",
          "Next steps:",
          "- Use `itglue_create_document_section` to add content",
          "- Use `itglue_publish_document` to publish when ready",
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
    "itglue_update_document",
    {
      title: "Update ITGlue Document",
      description: `Update an existing document's metadata (name).

Does NOT modify document section content — use itglue_update_document_section for content changes.

Args:
  - document_id (number, required): The document ID to update
  - name (string, optional): New document name
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  The updated document with current metadata.

Examples:
  - "Rename document 456 to 'Updated Runbook'" -> { document_id: 456, name: "Updated Runbook" }

Error Handling:
  - Returns "Error: Resource not found..." if the document doesn't exist
  - Returns "Error: Validation failed..." if the document is externally synced`,
      inputSchema: UpdateDocumentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: UpdateDocumentInput) => {
      try {
        const attributes: Record<string, unknown> = {};
        if (params.name !== undefined) attributes.name = params.name;

        const body = serializeRequest(
          "documents",
          attributes,
          String(params.document_id)
        );

        const doc = await client.patch<ITGlueDocument>(
          `/documents/${params.document_id}`,
          body
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(doc, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Document updated successfully.\n\n${formatDocumentMarkdown(doc)}`,
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
    "itglue_publish_document",
    {
      title: "Publish ITGlue Document",
      description: `Publish a draft document, making it visible to all users with appropriate access.

Args:
  - document_id (number, required): The document ID to publish
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  Confirmation of successful publication.

Examples:
  - "Publish document 456" -> { document_id: 456 }

Error Handling:
  - Returns "Error: Resource not found..." if the document doesn't exist`,
      inputSchema: PublishDocumentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: PublishDocumentInput) => {
      try {
        await client.patchAction(
          `/documents/${params.document_id}/publish`
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    document_id: params.document_id,
                    message: "Document published successfully",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Document ${params.document_id} published successfully.`,
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
    "itglue_delete_documents",
    {
      title: "Delete ITGlue Documents",
      description: `Permanently delete one or more documents by their IDs. This action CANNOT be undone.

All sections and content within the deleted documents will also be permanently removed.

Args:
  - document_ids (number[], required): Array of document IDs to delete (minimum 1)

Returns:
  Confirmation of deletion with the list of deleted IDs.

Examples:
  - "Delete document 456" -> { document_ids: [456] }
  - "Delete documents 100, 200, 300" -> { document_ids: [100, 200, 300] }

Error Handling:
  - Returns "Error: Resource not found..." if any document ID doesn't exist`,
      inputSchema: DeleteDocumentsSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DeleteDocumentsInput) => {
      try {
        const body = serializeDeleteBody("documents", params.document_ids);

        await client.delete("/documents", body);

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully deleted ${params.document_ids.length} document(s): ${params.document_ids.join(", ")}`,
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
