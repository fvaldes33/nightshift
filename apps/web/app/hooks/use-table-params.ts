import type { PaginationState, SortingState, Updater } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;

interface UseTableParamsOptions<TFilterKeys extends readonly string[]> {
  defaultLimit?: number;
  defaultSortBy?: string;
  defaultSortDir?: "asc" | "desc";
  filterKeys?: TFilterKeys;
}

type Filters<TFilterKeys extends readonly string[]> = {
  [K in TFilterKeys[number]]?: string;
};

export function useTableParams<const TFilterKeys extends readonly string[] = readonly []>(
  options: UseTableParamsOptions<TFilterKeys> = {},
) {
  const {
    defaultLimit = DEFAULT_LIMIT,
    defaultSortBy,
    defaultSortDir = "asc",
    filterKeys = [] as unknown as TFilterKeys,
  } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  // Read state from URL
  const page = Number(searchParams.get("page")) || DEFAULT_PAGE;
  const limit = Number(searchParams.get("limit")) || defaultLimit;
  const search = searchParams.get("q") ?? "";
  const sortBy = searchParams.get("sortBy") ?? defaultSortBy;
  const sortDir = (searchParams.get("sortDir") as "asc" | "desc") || defaultSortDir;

  // TanStack Table uses 0-indexed pageIndex
  const pagination: PaginationState = useMemo(
    () => ({ pageIndex: page - 1, pageSize: limit }),
    [page, limit],
  );

  // TanStack Table sorting format
  const sorting: SortingState = useMemo(
    () => (sortBy ? [{ id: sortBy, desc: sortDir === "desc" }] : []),
    [sortBy, sortDir],
  );

  // Domain-specific filters from URL
  const filters = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    for (const key of filterKeys) {
      result[key] = searchParams.get(key) ?? undefined;
    }
    return result as Filters<TFilterKeys>;
  }, [filterKeys, searchParams]);

  // Helper to update URL params, omitting defaults
  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined || value === "") {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          // Clean defaults
          if (next.get("page") === String(DEFAULT_PAGE)) next.delete("page");
          if (next.get("limit") === String(defaultLimit)) next.delete("limit");
          if (next.get("sortBy") === defaultSortBy) next.delete("sortBy");
          if (next.get("sortDir") === defaultSortDir) next.delete("sortDir");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaultLimit, defaultSortBy, defaultSortDir],
  );

  const onPaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      updateParams({
        page: String(next.pageIndex + 1),
        limit: String(next.pageSize),
      });
    },
    [pagination, updateParams],
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const sort = next[0];
      updateParams({
        sortBy: sort?.id,
        sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
      });
    },
    [sorting, updateParams],
  );

  const setSearch = useCallback(
    (q: string) => {
      updateParams({ q: q || undefined, page: undefined });
    },
    [updateParams],
  );

  const setFilter = useCallback(
    (key: TFilterKeys[number], value: string | undefined) => {
      updateParams({ [key]: value, page: undefined });
    },
    [updateParams],
  );

  // Object matching backend paginationSchema shape
  const queryInput = useMemo(
    () => ({
      q: search || undefined,
      page,
      limit,
      sortBy,
      sortDir,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)),
    }),
    [search, page, limit, sortBy, sortDir, filters],
  );

  return {
    pagination,
    sorting,
    search,
    filters,
    onPaginationChange,
    onSortingChange,
    setSearch,
    setFilter,
    queryInput,
  };
}
