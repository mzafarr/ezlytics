"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  defaultExclusions,
  exclusionSchema,
  storageKeyExclusions,
  type Exclusions,
} from "../schema";

export function useDashboardExclusions() {
  const [exclusions, setExclusions] = useState<Exclusions>(defaultExclusions);
  const storageErrorRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKeyExclusions);
      if (stored) {
        const parsed = exclusionSchema.safeParse(JSON.parse(stored));
        if (parsed.success) {
          setExclusions(parsed.data);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyExclusions, JSON.stringify(exclusions));
    } catch {
      if (!storageErrorRef.current) {
        storageErrorRef.current = true;
        toast.error("Failed to save exclusions locally");
      }
    }
  }, [exclusions]);

  return { exclusions, setExclusions };
}
