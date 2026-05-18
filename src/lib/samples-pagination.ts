export const SAMPLE_PAGE_SIZES = [10, 20, 30, 40, 50] as const;
export const DEFAULT_SAMPLE_PAGE_SIZE = SAMPLE_PAGE_SIZES[0];

type QueryParam = string | string[] | undefined;

export type SamplePaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  offset: number;
  startItem: number;
  endItem: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export function getSingleQueryValue(value: QueryParam) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSamplePageSize(value: QueryParam) {
  const parsed = Number.parseInt(getSingleQueryValue(value) ?? "", 10);

  if (SAMPLE_PAGE_SIZES.includes(parsed as (typeof SAMPLE_PAGE_SIZES)[number])) {
    return parsed;
  }

  return DEFAULT_SAMPLE_PAGE_SIZE;
}

export function parseSamplePage(value: QueryParam) {
  const parsed = Number.parseInt(getSingleQueryValue(value) ?? "", 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export function getSamplePagination(
  totalCount: number,
  page: QueryParam,
  pageSize: QueryParam
): SamplePaginationState {
  const normalizedPageSize = parseSamplePageSize(pageSize);
  const requestedPage = parseSamplePage(page);
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedPageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * normalizedPageSize;
  const startItem = totalCount === 0 ? 0 : offset + 1;
  const endItem = totalCount === 0 ? 0 : Math.min(offset + normalizedPageSize, totalCount);

  return {
    page: currentPage,
    pageSize: normalizedPageSize,
    totalCount,
    totalPages,
    offset,
    startItem,
    endItem,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages
  };
}
