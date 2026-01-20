"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { type Funnel, funnelsSchema, storageKeyFunnels } from "../schema";
import { createId } from "../utils";

const createSampleFunnel = (): Funnel => ({
  id: createId(),
  name: "Sample funnel",
  steps: [
    { id: createId(), name: "Landing page", type: "page", urlContains: "/" },
    {
      id: createId(),
      name: "Pricing page",
      type: "page",
      urlContains: "/pricing",
    },
    { id: createId(), name: "Signup", type: "goal", goalName: "signup" },
  ],
});

const createEmptyFunnel = (): Funnel => ({
  id: createId(),
  name: "",
  steps: [{ id: createId(), name: "", type: "page", urlContains: "/" }],
});

export function useFunnels() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [funnelDraft, setFunnelDraft] = useState<Funnel>(() =>
    createEmptyFunnel(),
  );
  const storageErrorRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKeyFunnels);
      if (stored) {
        const parsed = funnelsSchema.safeParse(JSON.parse(stored));
        if (parsed.success && parsed.data.length > 0) {
          setFunnels(parsed.data);
          setActiveFunnelId(parsed.data[0].id);
          setFunnelDraft(parsed.data[0]);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (funnels.length > 0) {
        localStorage.setItem(storageKeyFunnels, JSON.stringify(funnels));
      }
    } catch {
      if (!storageErrorRef.current) {
        storageErrorRef.current = true;
        toast.error("Failed to save funnels locally");
      }
    }
  }, [funnels]);

  return {
    funnels,
    setFunnels,
    activeFunnelId,
    setActiveFunnelId,
    funnelDraft,
    setFunnelDraft,
    createSampleFunnel,
    createEmptyFunnel,
  };
}
