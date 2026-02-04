import { describe, it, expect, beforeEach } from "vitest";
import { registerOrganizationTools } from "./organizations.js";
import { makeMockClient, makeMockServer } from "../test-helpers.js";
import type { ITGlueOrganization, PaginatedResult } from "../types.js";

type ToolHandler = (params: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

describe("registerOrganizationTools", () => {
  let mockServer: ReturnType<typeof makeMockServer>;
  let mockClient: ReturnType<typeof makeMockClient>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mockServer = makeMockServer();
    mockClient = makeMockClient();
    registerOrganizationTools(mockServer as never, mockClient as never);

    handlers = {};
    for (const call of mockServer.registerTool.mock.calls) {
      handlers[call[0] as string] = call[2] as ToolHandler;
    }
  });

  it("registers exactly 2 tools", () => {
    expect(mockServer.registerTool).toHaveBeenCalledTimes(2);
    expect(handlers).toHaveProperty("itglue_list_organizations");
    expect(handlers).toHaveProperty("itglue_get_organization");
  });

  describe("itglue_list_organizations", () => {
    const handler = () => handlers["itglue_list_organizations"];

    it("calls getMany with correct path and params", async () => {
      mockClient.getMany.mockResolvedValue({
        data: [],
        total_count: 0,
        page_number: 1,
        page_size: 50,
        has_more: false,
        next_page: null,
      } satisfies PaginatedResult<ITGlueOrganization>);

      await handler()({
        filter_name: "Acme",
        page_number: 1,
        page_size: 50,
        response_format: "markdown",
      });

      expect(mockClient.getMany).toHaveBeenCalledWith("/organizations", {
        "page[number]": 1,
        "page[size]": 50,
        "filter[name]": "Acme",
      });
    });

    it("returns empty results message", async () => {
      mockClient.getMany.mockResolvedValue({
        data: [],
        total_count: 0,
        page_number: 1,
        page_size: 50,
        has_more: false,
        next_page: null,
      });

      const result = await handler()({
        page_number: 1,
        page_size: 50,
        response_format: "markdown",
      });

      expect(result.content[0].text).toContain("No organizations found");
    });

    it("returns markdown format with org details", async () => {
      mockClient.getMany.mockResolvedValue({
        data: [
          {
            id: "1",
            type: "organizations",
            name: "Acme Corp",
            description: "Test org",
            organization_type_name: "Customer",
            organization_status_name: "Active",
            short_name: "acme",
            updated_at: "2024-06-01T00:00:00.000Z",
          },
        ],
        total_count: 1,
        page_number: 1,
        page_size: 50,
        has_more: false,
        next_page: null,
      });

      const result = await handler()({
        page_number: 1,
        page_size: 50,
        response_format: "markdown",
      });

      const text = result.content[0].text;
      expect(text).toContain("# Organizations (1 total)");
      expect(text).toContain("## Acme Corp (ID: 1)");
      expect(text).toContain("**Type**: Customer");
      expect(text).toContain("**Status**: Active");
    });

    it("returns JSON format", async () => {
      mockClient.getMany.mockResolvedValue({
        data: [{ id: "1", name: "Acme" }],
        total_count: 1,
        page_number: 1,
        page_size: 50,
        has_more: false,
        next_page: null,
      });

      const result = await handler()({
        page_number: 1,
        page_size: 50,
        response_format: "json",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data).toHaveLength(1);
    });

    it("includes pagination info when has_more is true", async () => {
      mockClient.getMany.mockResolvedValue({
        data: [{ id: "1", name: "Acme", updated_at: "2024-01-01" }],
        total_count: 100,
        page_number: 1,
        page_size: 50,
        has_more: true,
        next_page: 2,
      });

      const result = await handler()({
        page_number: 1,
        page_size: 50,
        response_format: "markdown",
      });

      expect(result.content[0].text).toContain("page_number: 2");
    });

    it("returns isError on failure", async () => {
      mockClient.getMany.mockRejectedValue(new Error("Network error"));

      const result = await handler()({
        page_number: 1,
        page_size: 50,
        response_format: "markdown",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error");
    });
  });

  describe("itglue_get_organization", () => {
    const handler = () => handlers["itglue_get_organization"];

    it("calls getOne with correct path", async () => {
      mockClient.getOne.mockResolvedValue({
        id: "42",
        type: "organizations",
        name: "Acme",
        description: null,
        short_name: null,
        organization_type_name: null,
        organization_status_name: null,
        primary: false,
        alert: null,
        quick_notes: null,
        created_at: "2024-01-01",
        updated_at: "2024-06-01",
      });

      await handler()({ organization_id: 42, response_format: "markdown" });

      expect(mockClient.getOne).toHaveBeenCalledWith("/organizations/42");
    });

    it("returns markdown with all fields", async () => {
      mockClient.getOne.mockResolvedValue({
        id: "42",
        type: "organizations",
        name: "Acme Corp",
        description: "A great company",
        short_name: "acme",
        organization_type_name: "Customer",
        organization_status_name: "Active",
        primary: true,
        alert: "Important alert",
        quick_notes: "Some notes",
        created_at: "2024-01-01",
        updated_at: "2024-06-01",
      });

      const result = await handler()({
        organization_id: 42,
        response_format: "markdown",
      });

      const text = result.content[0].text;
      expect(text).toContain("# Acme Corp");
      expect(text).toContain("**ID**: 42");
      expect(text).toContain("**Description**: A great company");
      expect(text).toContain("**Short Name**: acme");
      expect(text).toContain("**Type**: Customer");
      expect(text).toContain("**Status**: Active");
      expect(text).toContain("**Primary**: Yes");
      expect(text).toContain("**Alert**: Important alert");
      expect(text).toContain("**Quick Notes**: Some notes");
    });

    it("returns JSON format", async () => {
      const org = { id: "42", name: "Acme" };
      mockClient.getOne.mockResolvedValue(org);

      const result = await handler()({
        organization_id: 42,
        response_format: "json",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe("42");
    });

    it("returns isError on failure", async () => {
      mockClient.getOne.mockRejectedValue(new Error("Not found"));

      const result = await handler()({
        organization_id: 999,
        response_format: "markdown",
      });

      expect(result.isError).toBe(true);
    });
  });
});
