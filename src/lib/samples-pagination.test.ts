import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAMPLE_PAGE_SIZE,
  getSamplePagination,
  getSingleQueryValue,
  parseSamplePage,
  parseSamplePageSize
} from "./samples-pagination";

describe("getSingleQueryValue", () => {
  it("takes the first value from repeated query params", () => {
    expect(getSingleQueryValue(["20", "50"])).toBe("20");
  });
});

describe("parseSamplePageSize", () => {
  it("accepts supported page sizes only", () => {
    expect(parseSamplePageSize("10")).toBe(10);
    expect(parseSamplePageSize("50")).toBe(50);
  });

  it("falls back to the default page size for unsupported values", () => {
    expect(parseSamplePageSize("15")).toBe(DEFAULT_SAMPLE_PAGE_SIZE);
    expect(parseSamplePageSize("0")).toBe(DEFAULT_SAMPLE_PAGE_SIZE);
    expect(parseSamplePageSize(undefined)).toBe(DEFAULT_SAMPLE_PAGE_SIZE);
  });
});

describe("parseSamplePage", () => {
  it("returns the first page for invalid values", () => {
    expect(parseSamplePage(undefined)).toBe(1);
    expect(parseSamplePage("0")).toBe(1);
    expect(parseSamplePage("-1")).toBe(1);
    expect(parseSamplePage("abc")).toBe(1);
  });

  it("accepts positive integers", () => {
    expect(parseSamplePage("3")).toBe(3);
  });
});

describe("getSamplePagination", () => {
  it("uses defaults on the first page", () => {
    expect(getSamplePagination(37, undefined, undefined)).toEqual({
      page: 1,
      pageSize: 10,
      totalCount: 37,
      totalPages: 4,
      offset: 0,
      startItem: 1,
      endItem: 10,
      hasPreviousPage: false,
      hasNextPage: true
    });
  });

  it("clamps a requested page beyond the last page", () => {
    expect(getSamplePagination(37, "9", "20")).toEqual({
      page: 2,
      pageSize: 20,
      totalCount: 37,
      totalPages: 2,
      offset: 20,
      startItem: 21,
      endItem: 37,
      hasPreviousPage: true,
      hasNextPage: false
    });
  });

  it("returns a stable empty state when there are no samples", () => {
    expect(getSamplePagination(0, "5", "50")).toEqual({
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 1,
      offset: 0,
      startItem: 0,
      endItem: 0,
      hasPreviousPage: false,
      hasNextPage: false
    });
  });
});
