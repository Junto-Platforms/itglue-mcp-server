import { describe, it, expect } from "vitest";
import {
  ListDocumentsSchema,
  GetDocumentSchema,
  CreateDocumentSchema,
  UpdateDocumentSchema,
  PublishDocumentSchema,
  DeleteDocumentsSchema,
} from "./documents.js";

describe("ListDocumentsSchema", () => {
  it("requires organization_id", () => {
    expect(() => ListDocumentsSchema.parse({})).toThrow();
  });

  it("parses valid input with defaults", () => {
    const result = ListDocumentsSchema.parse({ organization_id: 100 });
    expect(result.organization_id).toBe(100);
    expect(result.page_number).toBe(1);
    expect(result.page_size).toBe(50);
    expect(result.response_format).toBe("markdown");
  });

  it("accepts filters", () => {
    const result = ListDocumentsSchema.parse({
      organization_id: 100,
      filter_name: "runbook",
      filter_id: 5,
      sort: "-updated_at",
    });
    expect(result.filter_name).toBe("runbook");
    expect(result.filter_id).toBe(5);
  });
});

describe("GetDocumentSchema", () => {
  it("requires document_id", () => {
    expect(() => GetDocumentSchema.parse({})).toThrow();
  });

  it("parses valid input", () => {
    const result = GetDocumentSchema.parse({ document_id: 42 });
    expect(result.document_id).toBe(42);
  });
});

describe("CreateDocumentSchema", () => {
  it("requires organization_id and name", () => {
    expect(() => CreateDocumentSchema.parse({})).toThrow();
    expect(() => CreateDocumentSchema.parse({ organization_id: 1 })).toThrow();
    expect(() => CreateDocumentSchema.parse({ name: "Test" })).toThrow();
  });

  it("parses valid input", () => {
    const result = CreateDocumentSchema.parse({
      organization_id: 1,
      name: "My Doc",
    });
    expect(result.organization_id).toBe(1);
    expect(result.name).toBe("My Doc");
  });

  it("rejects empty name", () => {
    expect(() =>
      CreateDocumentSchema.parse({ organization_id: 1, name: "" })
    ).toThrow();
  });
});

describe("UpdateDocumentSchema", () => {
  it("requires document_id", () => {
    expect(() => UpdateDocumentSchema.parse({})).toThrow();
  });

  it("accepts optional name", () => {
    const result = UpdateDocumentSchema.parse({ document_id: 1 });
    expect(result.name).toBeUndefined();
  });

  it("parses with name", () => {
    const result = UpdateDocumentSchema.parse({
      document_id: 1,
      name: "Renamed",
    });
    expect(result.name).toBe("Renamed");
  });
});

describe("PublishDocumentSchema", () => {
  it("requires document_id", () => {
    expect(() => PublishDocumentSchema.parse({})).toThrow();
  });

  it("parses valid input", () => {
    const result = PublishDocumentSchema.parse({ document_id: 42 });
    expect(result.document_id).toBe(42);
  });
});

describe("DeleteDocumentsSchema", () => {
  it("requires non-empty array", () => {
    expect(() => DeleteDocumentsSchema.parse({})).toThrow();
    expect(() => DeleteDocumentsSchema.parse({ document_ids: [] })).toThrow();
  });

  it("parses valid array", () => {
    const result = DeleteDocumentsSchema.parse({ document_ids: [1, 2, 3] });
    expect(result.document_ids).toEqual([1, 2, 3]);
  });

  it("rejects non-positive ids", () => {
    expect(() =>
      DeleteDocumentsSchema.parse({ document_ids: [0] })
    ).toThrow();
    expect(() =>
      DeleteDocumentsSchema.parse({ document_ids: [-1] })
    ).toThrow();
  });
});
