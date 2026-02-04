import { describe, it, expect, beforeEach } from "vitest";
import { registerDocumentSectionTools } from "./document-sections.js";
import { makeMockClient, makeMockServer } from "../test-helpers.js";

type ToolHandler = (params: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

describe("registerDocumentSectionTools", () => {
  let mockServer: ReturnType<typeof makeMockServer>;
  let mockClient: ReturnType<typeof makeMockClient>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mockServer = makeMockServer();
    mockClient = makeMockClient();
    registerDocumentSectionTools(mockServer as never, mockClient as never);

    handlers = {};
    for (const call of mockServer.registerTool.mock.calls) {
      handlers[call[0] as string] = call[2] as ToolHandler;
    }
  });

  it("registers exactly 5 tools", () => {
    expect(mockServer.registerTool).toHaveBeenCalledTimes(5);
    expect(handlers).toHaveProperty("itglue_list_document_sections");
    expect(handlers).toHaveProperty("itglue_get_document_section");
    expect(handlers).toHaveProperty("itglue_create_document_section");
    expect(handlers).toHaveProperty("itglue_update_document_section");
    expect(handlers).toHaveProperty("itglue_delete_document_section");
  });

  describe("itglue_list_document_sections", () => {
    const handler = () => handlers["itglue_list_document_sections"];

    it("uses correct path for listing", async () => {
      mockClient.getMany.mockResolvedValue({
        data: [],
        total_count: 0,
        page_number: 1,
        page_size: 50,
        has_more: false,
        next_page: null,
      });

      await handler()({
        document_id: 42,
        page_number: 1,
        page_size: 50,
        response_format: "markdown",
      });

      expect(mockClient.getMany).toHaveBeenCalledWith(
        "/documents/42/relationships/sections",
        expect.any(Object)
      );
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
        document_id: 42,
        page_number: 1,
        page_size: 50,
        response_format: "markdown",
      });

      expect(result.content[0].text).toContain("No sections found");
    });

    it("returns JSON format", async () => {
      mockClient.getMany.mockResolvedValue({
        data: [{ id: "1", resource_type: "Document::Text" }],
        total_count: 1,
        page_number: 1,
        page_size: 50,
        has_more: false,
        next_page: null,
      });

      const result = await handler()({
        document_id: 42,
        page_number: 1,
        page_size: 50,
        response_format: "json",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data).toHaveLength(1);
    });

    it("returns isError on failure", async () => {
      mockClient.getMany.mockRejectedValue(new Error("Not found"));

      const result = await handler()({
        document_id: 999,
        page_number: 1,
        page_size: 50,
        response_format: "markdown",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("itglue_get_document_section", () => {
    const handler = () => handlers["itglue_get_document_section"];

    it("uses correct path with both IDs", async () => {
      mockClient.getOne.mockResolvedValue({
        id: "10",
        document_id: 42,
        resource_type: "Document::Text",
        sort: 0,
        content: "<p>Hello</p>",
        updated_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_id: 10,
        response_format: "markdown",
      });

      expect(mockClient.getOne).toHaveBeenCalledWith(
        "/documents/42/relationships/sections/10"
      );
    });

    it("returns markdown with content", async () => {
      mockClient.getOne.mockResolvedValue({
        id: "10",
        document_id: 42,
        resource_type: "Document::Text",
        sort: 0,
        content: "<p>Hello world</p>",
        updated_at: "2024-06-01",
      });

      const result = await handler()({
        document_id: 42,
        section_id: 10,
        response_format: "markdown",
      });

      const text = result.content[0].text;
      expect(text).toContain("Text Section");
      expect(text).toContain("Hello world");
      expect(text).not.toContain("<p>");
    });

    it("returns JSON format", async () => {
      mockClient.getOne.mockResolvedValue({
        id: "10",
        resource_type: "Document::Text",
      });

      const result = await handler()({
        document_id: 42,
        section_id: 10,
        response_format: "json",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe("10");
    });
  });

  describe("itglue_create_document_section", () => {
    const handler = () => handlers["itglue_create_document_section"];

    it("maps section_type 'Text' to attribute resource_type 'Document::Text'", async () => {
      mockClient.post.mockResolvedValue({
        id: "99",
        resource_type: "Document::Text",
        sort: 0,
        created_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_type: "Text",
        content: "<p>Hello</p>",
        response_format: "markdown",
      });

      const body = mockClient.post.mock.calls[0][1];
      expect(body.data.attributes["resource-type"]).toBe("Document::Text");
    });

    it("maps section_type 'Heading' correctly", async () => {
      mockClient.post.mockResolvedValue({
        id: "99",
        resource_type: "Document::Heading",
        sort: 0,
        created_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_type: "Heading",
        response_format: "markdown",
      });

      const body = mockClient.post.mock.calls[0][1];
      expect(body.data.attributes["resource-type"]).toBe("Document::Heading");
    });

    it("uses 'sort' not 'position' in attributes", async () => {
      mockClient.post.mockResolvedValue({
        id: "99",
        resource_type: "Document::Text",
        sort: 5,
        created_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_type: "Text",
        sort: 5,
        response_format: "markdown",
      });

      const body = mockClient.post.mock.calls[0][1];
      expect(body.data.attributes).toHaveProperty("sort", 5);
      expect(body.data.attributes).not.toHaveProperty("position");
    });

    it("uses correct path via /documents/{id}/relationships/sections", async () => {
      mockClient.post.mockResolvedValue({
        id: "99",
        resource_type: "Document::Text",
        sort: 0,
        created_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_type: "Text",
        response_format: "markdown",
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        "/documents/42/relationships/sections",
        expect.any(Object)
      );
    });

    it("includes content when provided", async () => {
      mockClient.post.mockResolvedValue({
        id: "99",
        resource_type: "Document::Text",
        sort: 0,
        created_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_type: "Text",
        content: "<p>My content</p>",
        response_format: "markdown",
      });

      const body = mockClient.post.mock.calls[0][1];
      expect(body.data.attributes).toHaveProperty("content", "<p>My content</p>");
    });

    it("returns isError on failure", async () => {
      mockClient.post.mockRejectedValue(new Error("Failed"));

      const result = await handler()({
        document_id: 42,
        section_type: "Text",
        response_format: "markdown",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("itglue_update_document_section", () => {
    const handler = () => handlers["itglue_update_document_section"];

    it("only includes provided fields", async () => {
      mockClient.patch.mockResolvedValue({
        id: "10",
        resource_type: "Document::Text",
        sort: 0,
        content: "<p>Updated</p>",
        updated_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_id: 10,
        content: "<p>Updated</p>",
        response_format: "markdown",
      });

      const body = mockClient.patch.mock.calls[0][1];
      expect(body.data.attributes).toHaveProperty("content", "<p>Updated</p>");
      expect(body.data.attributes).not.toHaveProperty("sort");
    });

    it("does not include section_type in body", async () => {
      mockClient.patch.mockResolvedValue({
        id: "10",
        resource_type: "Document::Text",
        sort: 3,
        updated_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_id: 10,
        sort: 3,
        response_format: "markdown",
      });

      const body = mockClient.patch.mock.calls[0][1];
      expect(body.data.attributes).not.toHaveProperty("resource-type");
      expect(body.data.attributes).not.toHaveProperty("section-type");
    });

    it("uses correct path with both IDs", async () => {
      mockClient.patch.mockResolvedValue({
        id: "10",
        resource_type: "Document::Text",
        sort: 0,
        updated_at: "2024-06-01",
      });

      await handler()({
        document_id: 42,
        section_id: 10,
        content: "<p>Test</p>",
        response_format: "markdown",
      });

      expect(mockClient.patch).toHaveBeenCalledWith(
        "/documents/42/relationships/sections/10",
        expect.any(Object)
      );
    });
  });

  describe("itglue_delete_document_section", () => {
    const handler = () => handlers["itglue_delete_document_section"];

    it("uses correct path with both IDs", async () => {
      mockClient.delete.mockResolvedValue(undefined);

      await handler()({ document_id: 42, section_id: 10 });

      expect(mockClient.delete).toHaveBeenCalledWith(
        "/documents/42/relationships/sections/10"
      );
    });

    it("returns success message", async () => {
      mockClient.delete.mockResolvedValue(undefined);

      const result = await handler()({ document_id: 42, section_id: 10 });

      expect(result.content[0].text).toContain("Successfully deleted section 10");
    });

    it("returns isError on failure", async () => {
      mockClient.delete.mockRejectedValue(new Error("Not found"));

      const result = await handler()({ document_id: 42, section_id: 999 });

      expect(result.isError).toBe(true);
    });
  });
});
