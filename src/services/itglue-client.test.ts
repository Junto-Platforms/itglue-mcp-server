import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";
import {
  deserializeResource,
  serializeRequest,
  serializeDeleteBody,
  buildFilterParams,
  buildPaginationParams,
  handleApiError,
  stripHtml,
  truncateIfNeeded,
  paginationFooter,
  ITGlueClient,
} from "./itglue-client.js";
import { CHARACTER_LIMIT } from "../constants.js";
import {
  makeResource,
  makeOrganizationResource,
  makeResponse,
} from "../test-helpers.js";

// ─── deserializeResource ─────────────────────────────────────────

describe("deserializeResource", () => {
  it("flattens id, type, and attributes", () => {
    const resource = makeResource({
      id: "42",
      type: "organizations",
      attributes: { name: "Acme" },
    });
    const result = deserializeResource(resource);
    expect(result).toEqual({ id: "42", type: "organizations", name: "Acme" });
  });

  it("converts kebab-case keys to snake_case", () => {
    const resource = makeResource({
      attributes: { "organization-type-name": "Customer", "short-name": "acme" },
    });
    const result = deserializeResource(resource);
    expect(result).toHaveProperty("organization_type_name", "Customer");
    expect(result).toHaveProperty("short_name", "acme");
  });

  it("handles empty attributes", () => {
    const resource = makeResource({ attributes: {} });
    const result = deserializeResource(resource);
    expect(result).toEqual({ id: "1", type: "test-resources" });
  });
});

// ─── serializeRequest ────────────────────────────────────────────

describe("serializeRequest", () => {
  it("wraps attributes into JSON:API body", () => {
    const result = serializeRequest("documents", { name: "Test" });
    expect(result).toEqual({
      data: { type: "documents", attributes: { name: "Test" } },
    });
  });

  it("converts snake_case to kebab-case", () => {
    const result = serializeRequest("documents", {
      organization_id: 1,
      resource_type: "Document::Text",
    });
    expect(result.data).toEqual({
      type: "documents",
      attributes: { "organization-id": 1, "resource-type": "Document::Text" },
    });
  });

  it("filters out undefined values", () => {
    const result = serializeRequest("documents", {
      name: "Test",
      description: undefined,
    });
    expect(result.data).toEqual({
      type: "documents",
      attributes: { name: "Test" },
    });
  });

  it("includes id when provided", () => {
    const result = serializeRequest("documents", { name: "Test" }, "42");
    expect(result.data).toEqual({
      type: "documents",
      attributes: { name: "Test" },
      id: "42",
    });
  });

  it("omits id when not provided", () => {
    const result = serializeRequest("documents", { name: "Test" });
    expect(result.data).not.toHaveProperty("id");
  });
});

// ─── serializeDeleteBody ─────────────────────────────────────────

describe("serializeDeleteBody", () => {
  it("wraps a single id", () => {
    const result = serializeDeleteBody("documents", [1]);
    expect(result).toEqual({
      data: [{ type: "documents", attributes: { id: 1 } }],
    });
  });

  it("wraps multiple ids", () => {
    const result = serializeDeleteBody("documents", [1, 2, 3]);
    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toEqual({ type: "documents", attributes: { id: 1 } });
    expect(result.data[2]).toEqual({ type: "documents", attributes: { id: 3 } });
  });
});

// ─── buildFilterParams ───────────────────────────────────────────

describe("buildFilterParams", () => {
  it("converts to filter[kebab-key] format", () => {
    const result = buildFilterParams({ name: "Acme", organization_type_id: 1 });
    expect(result).toEqual({
      "filter[name]": "Acme",
      "filter[organization-type-id]": 1,
    });
  });

  it("skips undefined values", () => {
    const result = buildFilterParams({ name: "Acme", id: undefined });
    expect(result).toEqual({ "filter[name]": "Acme" });
    expect(Object.keys(result)).toHaveLength(1);
  });

  it("returns empty object for empty input", () => {
    const result = buildFilterParams({});
    expect(result).toEqual({});
  });
});

// ─── buildPaginationParams ───────────────────────────────────────

describe("buildPaginationParams", () => {
  it("returns page[number] and page[size]", () => {
    const result = buildPaginationParams(2, 50);
    expect(result).toEqual({ "page[number]": 2, "page[size]": 50 });
  });
});

// ─── handleApiError ──────────────────────────────────────────────

describe("handleApiError", () => {
  function makeAxiosError(
    status: number,
    data?: unknown,
    code?: string
  ): AxiosError {
    const error = new AxiosError("Request failed", code);
    if (status > 0) {
      error.response = {
        status,
        data,
        headers: {},
        statusText: "",
        config: {} as never,
      };
    }
    return error;
  }

  it("handles 400 bad request", () => {
    const result = handleApiError(makeAxiosError(400));
    expect(result).toContain("Bad request");
  });

  it("handles 401 authentication failed", () => {
    const result = handleApiError(makeAxiosError(401));
    expect(result).toContain("Authentication failed");
  });

  it("handles 403 permission denied", () => {
    const result = handleApiError(makeAxiosError(403));
    expect(result).toContain("Permission denied");
  });

  it("handles 404 not found", () => {
    const result = handleApiError(makeAxiosError(404));
    expect(result).toContain("not found");
  });

  it("handles 415 unsupported media type", () => {
    const result = handleApiError(makeAxiosError(415));
    expect(result).toContain("Unsupported media type");
  });

  it("handles 422 validation failed", () => {
    const result = handleApiError(makeAxiosError(422));
    expect(result).toContain("Validation failed");
  });

  it("handles 429 rate limit", () => {
    const result = handleApiError(makeAxiosError(429));
    expect(result).toContain("Rate limit exceeded");
  });

  it("handles 5xx server errors", () => {
    const result = handleApiError(makeAxiosError(500));
    expect(result).toContain("server error");
    expect(result).toContain("500");
  });

  it("handles unknown status codes", () => {
    const result = handleApiError(makeAxiosError(418));
    expect(result).toContain("status 418");
  });

  it("extracts JSON:API error detail", () => {
    const data = { errors: [{ detail: "Name is too short" }] };
    const result = handleApiError(makeAxiosError(422, data));
    expect(result).toContain("Name is too short");
  });

  it("extracts JSON:API error title as fallback", () => {
    const data = { errors: [{ title: "Invalid attribute" }] };
    const result = handleApiError(makeAxiosError(400, data));
    expect(result).toContain("Invalid attribute");
  });

  it("handles ECONNABORTED", () => {
    const error = new AxiosError("timeout", "ECONNABORTED");
    const result = handleApiError(error);
    expect(result).toContain("timed out");
  });

  it("handles ECONNREFUSED", () => {
    const error = new AxiosError("refused", "ECONNREFUSED");
    const result = handleApiError(error);
    expect(result).toContain("Could not connect");
  });

  it("handles non-AxiosError", () => {
    const result = handleApiError(new Error("something broke"));
    expect(result).toContain("something broke");
  });

  it("handles non-Error values", () => {
    const result = handleApiError("string error");
    expect(result).toContain("string error");
  });
});

// ─── stripHtml ───────────────────────────────────────────────────

describe("stripHtml", () => {
  it("converts <br> to newline", () => {
    expect(stripHtml("line1<br>line2")).toBe("line1\nline2");
    expect(stripHtml("line1<br/>line2")).toBe("line1\nline2");
    expect(stripHtml("line1<br />line2")).toBe("line1\nline2");
  });

  it("converts </p> to double newline", () => {
    expect(stripHtml("<p>para1</p><p>para2</p>").trim()).toBe("para1\n\npara2");
  });

  it("converts <li> to bullet points", () => {
    expect(stripHtml("<li>item1</li><li>item2</li>")).toBe("- item1\n- item2");
  });

  it("converts headings to markdown", () => {
    expect(stripHtml("<h1>Title</h1>")).toBe("# Title");
    expect(stripHtml("<h2>Subtitle</h2>")).toBe("## Subtitle");
    expect(stripHtml("<h3>Section</h3>")).toBe("### Section");
  });

  it("decodes &amp; entity", () => {
    expect(stripHtml("A &amp; B")).toBe("A & B");
  });

  it("decodes &#39; entity", () => {
    expect(stripHtml("it&#39;s")).toBe("it's");
  });

  it("decodes hex entities (&#xNN)", () => {
    expect(stripHtml("&#x41;")).toBe("A");
  });

  it("decodes decimal entities (&#NNN)", () => {
    expect(stripHtml("&#65;")).toBe("A");
  });

  it("collapses excessive newlines", () => {
    expect(stripHtml("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims surrounding whitespace", () => {
    expect(stripHtml("  <p>hello</p>  ")).toBe("hello");
  });

  it("removes unrecognized tags", () => {
    expect(stripHtml("<div><span>text</span></div>")).toBe("text");
  });
});

// ─── truncateIfNeeded ────────────────────────────────────────────

describe("truncateIfNeeded", () => {
  it("returns text unchanged when under limit", () => {
    const text = "short text";
    expect(truncateIfNeeded(text)).toBe(text);
  });

  it("truncates and adds footer when over limit", () => {
    const text = "a".repeat(CHARACTER_LIMIT + 100);
    const result = truncateIfNeeded(text);
    expect(result.length).toBeGreaterThan(CHARACTER_LIMIT);
    expect(result).toContain("[Response truncated");
    expect(result).toContain("Use filters or pagination");
  });

  it("uses custom hint when provided", () => {
    const text = "a".repeat(CHARACTER_LIMIT + 100);
    const result = truncateIfNeeded(text, "Try a different query.");
    expect(result).toContain("Try a different query.");
  });
});

// ─── paginationFooter ────────────────────────────────────────────

describe("paginationFooter", () => {
  it("includes page info", () => {
    const result = paginationFooter(100, 1, true);
    expect(result).toContain("Page 1");
    expect(result).toContain("100 total results");
  });

  it("shows 'more results' when hasMore is true", () => {
    const result = paginationFooter(100, 1, true);
    expect(result).toContain("page_number: 2");
  });

  it("omits next page hint when hasMore is false", () => {
    const result = paginationFooter(10, 1, false);
    expect(result).not.toContain("page_number:");
  });
});

// ─── ITGlueClient ────────────────────────────────────────────────

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return {
    ...actual,
    default: { ...actual.default, create: vi.fn(() => mockInstance) },
  };
});

import axios from "axios";

function getMockHttp() {
  return (axios.create as ReturnType<typeof vi.fn>).mock.results[0]
    ?.value as Record<string, ReturnType<typeof vi.fn>>;
}

describe("ITGlueClient", () => {
  let client: ITGlueClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ITGlueClient({ apiKey: "test-key", baseUrl: "https://api.itglue.com" });
  });

  describe("getOne", () => {
    it("deserializes a single resource", async () => {
      const resource = makeOrganizationResource();
      getMockHttp().get.mockResolvedValue(makeResponse(resource));

      const result = await client.getOne("/organizations/1");
      expect(result).toHaveProperty("id", "1");
      expect(result).toHaveProperty("name", "Acme Corp");
      expect(getMockHttp().get).toHaveBeenCalledWith("/organizations/1", {
        params: undefined,
      });
    });

    it("throws when response is an array", async () => {
      getMockHttp().get.mockResolvedValue(
        makeResponse([makeOrganizationResource()])
      );
      await expect(client.getOne("/organizations/1")).rejects.toThrow(
        "Expected single resource but received array"
      );
    });
  });

  describe("getMany", () => {
    it("returns paginated result with meta parsing", async () => {
      const resources = [
        makeOrganizationResource(),
        makeOrganizationResource({ name: "Beta Inc" }),
      ];
      getMockHttp().get.mockResolvedValue(
        makeResponse(resources, {
          "total-count": 50,
          "current-page": 1,
          "next-page": 2,
        })
      );

      const result = await client.getMany("/organizations", {
        "page[size]": 25,
      });
      expect(result.data).toHaveLength(2);
      expect(result.total_count).toBe(50);
      expect(result.page_number).toBe(1);
      expect(result.page_size).toBe(25);
      expect(result.has_more).toBe(true);
      expect(result.next_page).toBe(2);
    });

    it("has_more is false when next-page is null", async () => {
      getMockHttp().get.mockResolvedValue(
        makeResponse([makeOrganizationResource()], {
          "total-count": 1,
          "current-page": 1,
          "next-page": null,
        })
      );

      const result = await client.getMany("/organizations");
      expect(result.has_more).toBe(false);
      expect(result.next_page).toBeNull();
    });

    it("wraps single resource in array", async () => {
      getMockHttp().get.mockResolvedValue(
        makeResponse(makeOrganizationResource())
      );

      const result = await client.getMany("/organizations");
      expect(result.data).toHaveLength(1);
    });
  });

  describe("post", () => {
    it("handles single resource response", async () => {
      const resource = makeOrganizationResource({ name: "New Org" });
      getMockHttp().post.mockResolvedValue(makeResponse(resource));

      const body = serializeRequest("organizations", { name: "New Org" });
      const result = await client.post("/organizations", body);
      expect(result).toHaveProperty("name", "New Org");
    });

    it("handles array response (takes first)", async () => {
      const resource = makeOrganizationResource({ name: "Created" });
      getMockHttp().post.mockResolvedValue(makeResponse([resource]));

      const body = serializeRequest("organizations", { name: "Created" });
      const result = await client.post("/organizations", body);
      expect(result).toHaveProperty("name", "Created");
    });

    it("throws on empty array response", async () => {
      getMockHttp().post.mockResolvedValue(makeResponse([]));

      const body = serializeRequest("organizations", { name: "Test" });
      await expect(client.post("/organizations", body)).rejects.toThrow(
        "empty array"
      );
    });
  });

  describe("patch", () => {
    it("handles single resource response", async () => {
      const resource = makeOrganizationResource({ name: "Updated" });
      getMockHttp().patch.mockResolvedValue(makeResponse(resource));

      const body = serializeRequest("organizations", { name: "Updated" }, "1");
      const result = await client.patch("/organizations/1", body);
      expect(result).toHaveProperty("name", "Updated");
    });

    it("handles array response (takes first)", async () => {
      const resource = makeOrganizationResource({ name: "Updated" });
      getMockHttp().patch.mockResolvedValue(makeResponse([resource]));

      const body = serializeRequest("organizations", { name: "Updated" }, "1");
      const result = await client.patch("/organizations/1", body);
      expect(result).toHaveProperty("name", "Updated");
    });

    it("throws on empty array response", async () => {
      getMockHttp().patch.mockResolvedValue(makeResponse([]));

      const body = serializeRequest("organizations", { name: "Test" }, "1");
      await expect(client.patch("/organizations/1", body)).rejects.toThrow(
        "empty array"
      );
    });
  });

  describe("delete", () => {
    it("calls delete with body in data option", async () => {
      getMockHttp().delete.mockResolvedValue({});

      const body = serializeDeleteBody("documents", [1, 2]);
      await client.delete("/documents", body);

      expect(getMockHttp().delete).toHaveBeenCalledWith("/documents", {
        data: body,
      });
    });
  });

  describe("postAction", () => {
    it("returns null when no data in response", async () => {
      getMockHttp().post.mockResolvedValue({ data: null });

      const result = await client.postAction("/some/action");
      expect(result).toBeNull();
    });

    it("returns null when data.data is missing", async () => {
      getMockHttp().post.mockResolvedValue({ data: {} });

      const result = await client.postAction("/some/action");
      expect(result).toBeNull();
    });

    it("deserializes single resource when present", async () => {
      const resource = makeOrganizationResource();
      getMockHttp().post.mockResolvedValue(makeResponse(resource));

      const result = await client.postAction("/some/action");
      expect(result).toHaveProperty("name", "Acme Corp");
    });

    it("deserializes first element of array", async () => {
      const resource = makeOrganizationResource();
      getMockHttp().post.mockResolvedValue(makeResponse([resource]));

      const result = await client.postAction("/some/action");
      expect(result).toHaveProperty("name", "Acme Corp");
    });

    it("returns null for empty array", async () => {
      getMockHttp().post.mockResolvedValue(makeResponse([]));

      const result = await client.postAction("/some/action");
      expect(result).toBeNull();
    });
  });

  describe("patchAction", () => {
    it("returns null when no data in response", async () => {
      getMockHttp().patch.mockResolvedValue({ data: null });

      const result = await client.patchAction("/some/action");
      expect(result).toBeNull();
    });

    it("deserializes single resource when present", async () => {
      const resource = makeOrganizationResource();
      getMockHttp().patch.mockResolvedValue(makeResponse(resource));

      const result = await client.patchAction("/some/action");
      expect(result).toHaveProperty("name", "Acme Corp");
    });

    it("returns null for empty array", async () => {
      getMockHttp().patch.mockResolvedValue(makeResponse([]));

      const result = await client.patchAction("/some/action");
      expect(result).toBeNull();
    });
  });
});
