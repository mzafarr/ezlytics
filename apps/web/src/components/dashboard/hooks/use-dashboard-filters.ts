"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  filtersSchema,
  defaultFilters,
  filterLabels,
  storageKeyFilters,
  type Filters,
} from "../schema";

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

export function useDashboardFilters() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const filtersStorageErrorRef = useRef(false);

  // Load filters from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKeyFilters);
      if (stored) {
        const parsed = filtersSchema.safeParse(JSON.parse(stored));
        if (parsed.success) {
          setFilters(parsed.data);
        }
      }
    } catch {
      // Ignore storage errors on read
    }
  }, []);

  // Save filters to local storage
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyFilters, JSON.stringify(filters));
    } catch {
      if (!filtersStorageErrorRef.current) {
        filtersStorageErrorRef.current = true;
        toast.error("Failed to save filters locally");
      }
    }
  }, [filters]);

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as Array<[keyof Filters, string]>)
      .map(([key, value]) => ({
        key,
        label: filterLabels[key],
        value: value.trim(),
      }))
      .filter((f) => f.value.length > 0);
  }, [filters]);

  const activeFilterCount = activeFilters.length;

  const applyFilter = (key: keyof Filters, value: string) => {
    if (!value.trim()) {
      return;
    }
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyDateFilter = (date: string) => {
    if (!date.trim()) {
      return;
    }
    setFilters((current) => ({ ...current, startDate: date, endDate: date }));
  };

  const clearFilter = (key: keyof Filters) => {
    setFilters((current) => ({ ...current, [key]: "" }));
  };

  const dateRange = useMemo(
    () => ({
      from: filters.startDate ? new Date(filters.startDate) : undefined,
      to: filters.endDate ? new Date(filters.endDate) : undefined,
    }),
    [filters.startDate, filters.endDate],
  );

  const setDateRange = (range: {
    from: Date | undefined;
    to: Date | undefined;
  }) => {
    setFilters((current) => ({
      ...current,
      startDate: range.from ? formatDate(range.from) : "",
      endDate: range.to ? formatDate(range.to) : "",
    }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  return {
    filters,
    setFilters,
    activeFilters,
    activeFilterCount,
    applyFilter,
    applyDateFilter,
    clearFilter,
    dateRange,
    setDateRange,
    resetFilters,
  };
}
