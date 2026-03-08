import { useCallback, useEffect, useRef, useState } from "react";

const MIN_PRIMARY_LOADER_MS = 220;

export default function useCursorWindowedList({
  fetchPage,
  deps = [],
  pageSize = 100,
  maxBufferRows = 3000,
  trimBatch = 1000,
  enabled = true,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [virtualStartIndex, setVirtualStartIndex] = useState(0);

  const rowsRef = useRef([]);
  const fetchingRef = useRef(false);
  const requestIdRef = useRef(0);
  const virtualStartRef = useRef(0);
  const primaryLoadStartedAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setIsFetchingMore(false);
      return;
    }
    if (rowsRef.current.length === 0) {
      setLoading(true);
    }
  }, [enabled]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    virtualStartRef.current = virtualStartIndex;
  }, [virtualStartIndex]);

  const fetchRows = useCallback(
    async ({ cursorValue = null, append = false } = {}) => {
      if (!enabled) return;
      if (append && fetchingRef.current) return;

      const requestId = ++requestIdRef.current;
      if (append) {
        fetchingRef.current = true;
        setIsFetchingMore(true);
      } else {
        primaryLoadStartedAtRef.current = Date.now();
        setLoading(true);
      }

      try {
        const response = await fetchPage({
          cursor: cursorValue,
          limit: pageSize,
          append,
        });

        if (requestId !== requestIdRef.current) return;

        const nextRows = Array.isArray(response?.rows) ? response.rows : [];
        const meta = response?.meta || {};
        const fetchedNextCursor =
          typeof meta.nextCursor === "string" && meta.nextCursor.trim() !== ""
            ? meta.nextCursor
            : null;

        if (append) {
          const merged = [...rowsRef.current, ...nextRows];
          let nextData = merged;
          let nextVirtualStart = virtualStartRef.current;

          if (merged.length > maxBufferRows) {
            const trimBy = Math.min(trimBatch, merged.length - maxBufferRows);
            nextData = merged.slice(trimBy);
            nextVirtualStart += trimBy;
          }

          rowsRef.current = nextData;
          virtualStartRef.current = nextVirtualStart;
          setRows(nextData);
          setVirtualStartIndex(nextVirtualStart);
        } else {
          rowsRef.current = nextRows;
          virtualStartRef.current = 0;
          setRows(nextRows);
          setVirtualStartIndex(0);
        }

        setHasMore(Boolean(meta.hasMore));
        setNextCursor(fetchedNextCursor);
      } catch (_error) {
        if (requestId !== requestIdRef.current) return;
        if (!append) {
          rowsRef.current = [];
          virtualStartRef.current = 0;
          setRows([]);
          setVirtualStartIndex(0);
          setHasMore(false);
          setNextCursor(null);
        }
      } finally {
        if (append) {
          fetchingRef.current = false;
          setIsFetchingMore(false);
        } else {
          if (requestId === requestIdRef.current) {
            const elapsed = Date.now() - primaryLoadStartedAtRef.current;
            const waitFor = Math.max(0, MIN_PRIMARY_LOADER_MS - elapsed);
            if (waitFor > 0) {
              await new Promise((resolve) => setTimeout(resolve, waitFor));
            }
            if (requestId === requestIdRef.current) {
              setLoading(false);
            }
          }
        }
      }
    },
    [enabled, fetchPage, maxBufferRows, pageSize, trimBatch],
  );

  useEffect(() => {
    if (!enabled) return;
    fetchRows({ cursorValue: null, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchRows, pageSize, ...deps]);

  const loadMore = useCallback(() => {
    if (!enabled) return;
    if (loading || isFetchingMore || !hasMore || !nextCursor) return;
    fetchRows({ cursorValue: nextCursor, append: true });
  }, [enabled, fetchRows, hasMore, isFetchingMore, loading, nextCursor]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    fetchRows({ cursorValue: null, append: false });
  }, [enabled, fetchRows]);

  return {
    rows,
    setRows,
    loading,
    isFetchingMore,
    hasMore,
    nextCursor,
    virtualStartIndex,
    loadMore,
    refresh,
  };
}
