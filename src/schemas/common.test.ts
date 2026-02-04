import { describe, it, expect } from "vitest";
import { z } from "zod";
import { PaginationSchema, ResponseFormatSchema, SortSchema } from "./common.js";

describe("PaginationSchema", () => {
  const schema = z.object({ ...PaginationSchema });

  it("applies defaults when no input given", () => {
    const result = schema.parse({});
    expect(result.page_number).toBe(1);
    expect(result.page_size).toBe(50);
  });

  it("accepts valid values", () => {
    const result = schema.parse({ page_number: 5, page_size: 100 });
    expect(result.page_number).toBe(5);
    expect(result.page_size).toBe(100);
  });

  it("rejects page_number less than 1", () => {
    expect(() => schema.parse({ page_number: 0 })).toThrow();
    expect(() => schema.parse({ page_number: -1 })).toThrow();
  });

  it("rejects page_size greater than 1000", () => {
    expect(() => schema.parse({ page_size: 1001 })).toThrow();
  });

  it("rejects page_size less than 1", () => {
    expect(() => schema.parse({ page_size: 0 })).toThrow();
  });
});

describe("ResponseFormatSchema", () => {
  it("defaults to 'markdown'", () => {
    const result = ResponseFormatSchema.parse(undefined);
    expect(result).toBe("markdown");
  });

  it("accepts 'json'", () => {
    const result = ResponseFormatSchema.parse("json");
    expect(result).toBe("json");
  });

  it("accepts 'markdown'", () => {
    const result = ResponseFormatSchema.parse("markdown");
    expect(result).toBe("markdown");
  });

  it("rejects invalid values", () => {
    expect(() => ResponseFormatSchema.parse("xml")).toThrow();
    expect(() => ResponseFormatSchema.parse("html")).toThrow();
  });
});

describe("SortSchema", () => {
  it("accepts a string", () => {
    const result = SortSchema.parse("name");
    expect(result).toBe("name");
  });

  it("accepts undefined", () => {
    const result = SortSchema.parse(undefined);
    expect(result).toBeUndefined();
  });
});
