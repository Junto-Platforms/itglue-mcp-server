import { vi } from "vitest";
import type { JsonApiResourceObject } from "./types.js";

export function makeResource(
  overrides: Partial<JsonApiResourceObject> & { attributes?: Record<string, unknown> } = {}
): JsonApiResourceObject {
  return {
    id: overrides.id ?? "1",
    type: overrides.type ?? "test-resources",
    attributes: overrides.attributes ?? {},
  };
}

export function makeOrganizationResource(
  overrides: Record<string, unknown> = {}
): JsonApiResourceObject {
  return makeResource({
    type: "organizations",
    attributes: {
      name: "Acme Corp",
      description: "A test organization",
      "organization-type-id": 1,
      "organization-type-name": "Customer",
      "organization-status-id": 1,
      "organization-status-name": "Active",
      "short-name": "acme",
      primary: false,
      "quick-notes": null,
      alert: null,
      "created-at": "2024-01-01T00:00:00.000Z",
      "updated-at": "2024-06-01T00:00:00.000Z",
      ...overrides,
    },
  });
}

export function makeDocumentResource(
  overrides: Record<string, unknown> = {}
): JsonApiResourceObject {
  return makeResource({
    type: "documents",
    attributes: {
      name: "Test Document",
      "organization-id": 100,
      "organization-name": "Acme Corp",
      "resource-url": "https://app.itglue.com/docs/1",
      published: true,
      "created-at": "2024-01-01T00:00:00.000Z",
      "updated-at": "2024-06-01T00:00:00.000Z",
      ...overrides,
    },
  });
}

export function makeSectionResource(
  overrides: Record<string, unknown> = {}
): JsonApiResourceObject {
  return makeResource({
    type: "document-sections",
    attributes: {
      "document-id": 1,
      "resource-id": 10,
      "resource-type": "Document::Text",
      content: "<p>Hello world</p>",
      "rendered-content": "<p>Hello world</p>",
      sort: 0,
      "created-at": "2024-01-01T00:00:00.000Z",
      "updated-at": "2024-06-01T00:00:00.000Z",
      ...overrides,
    },
  });
}

export function makeResponse(
  data: JsonApiResourceObject | JsonApiResourceObject[],
  meta?: Record<string, unknown>
) {
  return {
    data: {
      data,
      meta,
    },
  };
}

export function makeMockClient() {
  return {
    getOne: vi.fn(),
    getMany: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postAction: vi.fn(),
    patchAction: vi.fn(),
  };
}

export function makeMockServer() {
  return {
    registerTool: vi.fn(),
  };
}
