import { describe, it, expect } from "vitest";
import { ListOrganizationsSchema, GetOrganizationSchema } from "./organizations.js";

describe("ListOrganizationsSchema", () => {
  it("applies defaults for minimal input", () => {
    const result = ListOrganizationsSchema.parse({});
    expect(result.page_number).toBe(1);
    expect(result.page_size).toBe(50);
    expect(result.response_format).toBe("markdown");
  });

  it("accepts all filter fields", () => {
    const input = {
      filter_name: "Acme",
      filter_id: 42,
      filter_organization_type_id: 1,
      filter_organization_status_id: 2,
      sort: "-name",
      page_number: 2,
      page_size: 100,
      response_format: "json" as const,
    };
    const result = ListOrganizationsSchema.parse(input);
    expect(result.filter_name).toBe("Acme");
    expect(result.filter_id).toBe(42);
    expect(result.filter_organization_type_id).toBe(1);
    expect(result.filter_organization_status_id).toBe(2);
    expect(result.sort).toBe("-name");
  });

  it("rejects extra fields (strict mode)", () => {
    expect(() =>
      ListOrganizationsSchema.parse({ unknown_field: "bad" })
    ).toThrow();
  });
});

describe("GetOrganizationSchema", () => {
  it("requires organization_id", () => {
    expect(() => GetOrganizationSchema.parse({})).toThrow();
  });

  it("parses valid input", () => {
    const result = GetOrganizationSchema.parse({ organization_id: 42 });
    expect(result.organization_id).toBe(42);
    expect(result.response_format).toBe("markdown");
  });

  it("rejects negative organization_id", () => {
    expect(() =>
      GetOrganizationSchema.parse({ organization_id: -1 })
    ).toThrow();
  });

  it("rejects zero organization_id", () => {
    expect(() =>
      GetOrganizationSchema.parse({ organization_id: 0 })
    ).toThrow();
  });
});
