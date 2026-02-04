import { describe, it, expect } from "vitest";
import {
  ListDocumentSectionsSchema,
  GetDocumentSectionSchema,
  CreateDocumentSectionSchema,
  UpdateDocumentSectionSchema,
  DeleteDocumentSectionSchema,
} from "./document-sections.js";

describe("ListDocumentSectionsSchema", () => {
  it("requires document_id", () => {
    expect(() => ListDocumentSectionsSchema.parse({})).toThrow();
  });

  it("parses valid input with defaults", () => {
    const result = ListDocumentSectionsSchema.parse({ document_id: 1 });
    expect(result.document_id).toBe(1);
    expect(result.page_number).toBe(1);
    expect(result.page_size).toBe(50);
  });
});

describe("GetDocumentSectionSchema", () => {
  it("requires document_id and section_id", () => {
    expect(() => GetDocumentSectionSchema.parse({})).toThrow();
    expect(() =>
      GetDocumentSectionSchema.parse({ document_id: 1 })
    ).toThrow();
    expect(() =>
      GetDocumentSectionSchema.parse({ section_id: 1 })
    ).toThrow();
  });

  it("parses valid input", () => {
    const result = GetDocumentSectionSchema.parse({
      document_id: 1,
      section_id: 2,
    });
    expect(result.document_id).toBe(1);
    expect(result.section_id).toBe(2);
  });
});

describe("CreateDocumentSectionSchema", () => {
  it("requires document_id and section_type", () => {
    expect(() => CreateDocumentSectionSchema.parse({})).toThrow();
    expect(() =>
      CreateDocumentSectionSchema.parse({ document_id: 1 })
    ).toThrow();
  });

  it("accepts valid section_type values", () => {
    for (const type of ["Text", "Heading", "Gallery", "Step"]) {
      const result = CreateDocumentSectionSchema.parse({
        document_id: 1,
        section_type: type,
      });
      expect(result.section_type).toBe(type);
    }
  });

  it("rejects invalid section_type", () => {
    expect(() =>
      CreateDocumentSectionSchema.parse({
        document_id: 1,
        section_type: "Invalid",
      })
    ).toThrow();
  });

  it("accepts optional content and sort", () => {
    const result = CreateDocumentSectionSchema.parse({
      document_id: 1,
      section_type: "Text",
      content: "<p>Hello</p>",
      sort: 0,
    });
    expect(result.content).toBe("<p>Hello</p>");
    expect(result.sort).toBe(0);
  });

  it("content and sort are optional", () => {
    const result = CreateDocumentSectionSchema.parse({
      document_id: 1,
      section_type: "Text",
    });
    expect(result.content).toBeUndefined();
    expect(result.sort).toBeUndefined();
  });
});

describe("UpdateDocumentSectionSchema", () => {
  it("requires document_id and section_id", () => {
    expect(() => UpdateDocumentSectionSchema.parse({})).toThrow();
    expect(() =>
      UpdateDocumentSectionSchema.parse({ document_id: 1 })
    ).toThrow();
  });

  it("parses with optional content and sort", () => {
    const result = UpdateDocumentSectionSchema.parse({
      document_id: 1,
      section_id: 2,
      content: "<p>Updated</p>",
      sort: 3,
    });
    expect(result.content).toBe("<p>Updated</p>");
    expect(result.sort).toBe(3);
  });

  it("content and sort are optional", () => {
    const result = UpdateDocumentSectionSchema.parse({
      document_id: 1,
      section_id: 2,
    });
    expect(result.content).toBeUndefined();
    expect(result.sort).toBeUndefined();
  });
});

describe("DeleteDocumentSectionSchema", () => {
  it("requires both document_id and section_id", () => {
    expect(() => DeleteDocumentSectionSchema.parse({})).toThrow();
    expect(() =>
      DeleteDocumentSectionSchema.parse({ document_id: 1 })
    ).toThrow();
    expect(() =>
      DeleteDocumentSectionSchema.parse({ section_id: 1 })
    ).toThrow();
  });

  it("parses valid input", () => {
    const result = DeleteDocumentSectionSchema.parse({
      document_id: 1,
      section_id: 2,
    });
    expect(result.document_id).toBe(1);
    expect(result.section_id).toBe(2);
  });

  it("rejects extra fields (strict mode)", () => {
    expect(() =>
      DeleteDocumentSectionSchema.parse({
        document_id: 1,
        section_id: 2,
        extra: "bad",
      })
    ).toThrow();
  });
});
