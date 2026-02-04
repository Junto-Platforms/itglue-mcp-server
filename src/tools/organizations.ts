import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ITGlueClient } from "../services/itglue-client.js";
import {
  buildFilterParams,
  buildPaginationParams,
  handleApiError,
  paginationFooter,
  truncateIfNeeded,
} from "../services/itglue-client.js";
import { ResponseFormat } from "../constants.js";
import type { ITGlueOrganization } from "../types.js";
import {
  ListOrganizationsSchema,
  GetOrganizationSchema,
  type ListOrganizationsInput,
  type GetOrganizationInput,
} from "../schemas/organizations.js";

export function registerOrganizationTools(
  server: McpServer,
  client: ITGlueClient
): void {
  server.registerTool(
    "itglue_list_organizations",
    {
      title: "List ITGlue Organizations",
      description: `Search and list organizations in ITGlue. Use this to find organization IDs needed for document operations.

Supports filtering by name, ID, type, and status. Results are paginated.

Args:
  - filter_name (string, optional): Filter by organization name (partial match)
  - filter_id (number, optional): Filter by specific organization ID
  - filter_organization_type_id (number, optional): Filter by organization type
  - filter_organization_status_id (number, optional): Filter by status
  - sort (string, optional): Sort field (e.g. "name", "-updated_at")
  - page_number (number, default 1): Page number
  - page_size (number, default 50, max 1000): Results per page
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  List of organizations with id, name, description, type, status, and timestamps.

Examples:
  - "Find the Acme Corp organization" -> { filter_name: "Acme" }
  - "List all organizations sorted by name" -> { sort: "name" }

Error Handling:
  - Returns "Error: Authentication failed..." if API key is invalid
  - Returns "Error: Rate limit exceeded..." if too many requests`,
      inputSchema: ListOrganizationsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListOrganizationsInput) => {
      try {
        const queryParams: Record<string, string | number> = {
          ...buildPaginationParams(params.page_number, params.page_size),
          ...buildFilterParams({
            name: params.filter_name,
            id: params.filter_id,
            organization_type_id: params.filter_organization_type_id,
            organization_status_id: params.filter_organization_status_id,
          }),
        };
        if (params.sort) queryParams.sort = params.sort;

        const result = await client.getMany<ITGlueOrganization>(
          "/organizations",
          queryParams
        );

        if (result.data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No organizations found matching the specified filters.",
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
          `# Organizations (${result.total_count} total)`,
          "",
        ];
        for (const org of result.data) {
          lines.push(`## ${org.name} (ID: ${org.id})`);
          if (org.description) lines.push(`${org.description}`);
          if (org.organization_type_name)
            lines.push(`- **Type**: ${org.organization_type_name}`);
          if (org.organization_status_name)
            lines.push(`- **Status**: ${org.organization_status_name}`);
          if (org.short_name) lines.push(`- **Short Name**: ${org.short_name}`);
          lines.push(`- **Updated**: ${org.updated_at}`);
          lines.push("");
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
    "itglue_get_organization",
    {
      title: "Get ITGlue Organization",
      description: `Get detailed information about a specific ITGlue organization by its ID.

Returns the organization's name, description, type, status, short name, alerts, quick notes, and timestamps.

Args:
  - organization_id (number, required): The organization ID
  - response_format ("markdown"|"json", default "markdown"): Output format

Returns:
  Full organization details including all metadata fields.

Examples:
  - "Get details for organization 12345" -> { organization_id: 12345 }

Error Handling:
  - Returns "Error: Resource not found..." if the organization ID doesn't exist`,
      inputSchema: GetOrganizationSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetOrganizationInput) => {
      try {
        const org = await client.getOne<ITGlueOrganization>(
          `/organizations/${params.organization_id}`
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(org, null, 2),
              },
            ],
          };
        }

        const lines: string[] = [
          `# ${org.name}`,
          "",
          `**ID**: ${org.id}`,
        ];
        if (org.description) lines.push(`**Description**: ${org.description}`);
        if (org.short_name) lines.push(`**Short Name**: ${org.short_name}`);
        if (org.organization_type_name)
          lines.push(`**Type**: ${org.organization_type_name}`);
        if (org.organization_status_name)
          lines.push(`**Status**: ${org.organization_status_name}`);
        if (org.primary) lines.push(`**Primary**: Yes`);
        if (org.alert) lines.push(`\n> **Alert**: ${org.alert}`);
        if (org.quick_notes)
          lines.push(`\n**Quick Notes**: ${org.quick_notes}`);
        lines.push("");
        lines.push(`- **Created**: ${org.created_at}`);
        lines.push(`- **Updated**: ${org.updated_at}`);

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
}
