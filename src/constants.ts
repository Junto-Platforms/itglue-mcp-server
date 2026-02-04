export const BASE_URLS: Record<string, string> = {
  us: "https://api.itglue.com",
  eu: "https://api.eu.itglue.com",
  au: "https://api.au.itglue.com",
};

export const DEFAULT_BASE_URL = BASE_URLS.us;

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 1000;

export const CHARACTER_LIMIT = 25_000;

export const SECTION_TYPES = ["Text", "Heading", "Gallery", "Step"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}
