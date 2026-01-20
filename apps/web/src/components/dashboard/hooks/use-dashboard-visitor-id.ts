"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { defaultDemoVisitorId, storageKeyDemoVisitorId } from "../schema";

export function useDashboardVisitorId() {
  const [currentVisitorId, setCurrentVisitorId] = useState(defaultDemoVisitorId);
  const storageErrorRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKeyDemoVisitorId);
      if (stored) {
        setCurrentVisitorId(stored);
        return;
      }
      localStorage.setItem(storageKeyDemoVisitorId, defaultDemoVisitorId);
      setCurrentVisitorId(defaultDemoVisitorId);
    } catch {
      if (!storageErrorRef.current) {
        storageErrorRef.current = true;
        toast.error("Unable to persist demo visitor id.");
      }
      setCurrentVisitorId(defaultDemoVisitorId);
    }
  }, []);

  return { currentVisitorId, setCurrentVisitorId };
}
