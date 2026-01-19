const stripTags = (value: string) => value.replace(/<[^>]*>/g, "");
const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const sanitizeString = (value: string, maxLength = 255) => {
  const sanitized = collapseWhitespace(stripTags(value));
  if (!sanitized) {
    return "";
  }
  return sanitized.length > maxLength ? sanitized.slice(0, maxLength) : sanitized;
};

export const sanitizeMetadataRecord = (
  record: Record<string, unknown> | null | undefined,
  maxLength = 255,
) => {
  if (!record) {
    return null;
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      const cleaned = sanitizeString(value, maxLength);
      if (cleaned) {
        sanitized[key] = cleaned;
      }
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = sanitizeMetadataRecord(value as Record<string, unknown>, maxLength);
      if (nested && Object.keys(nested).length > 0) {
        sanitized[key] = nested;
      }
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};
