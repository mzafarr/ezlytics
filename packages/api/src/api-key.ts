import { db } from "@my-better-t-app/db";

const extractBearerToken = (authorizationHeader?: string | null) => {
  if (!authorizationHeader) {
    return "";
  }
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
};

type ApiKeyFailure = {
  ok: false;
  error: string;
};

type ApiKeySuccess = {
  ok: true;
  apiKey: string;
  siteId: string;
};

export type ApiKeyResult = ApiKeyFailure | ApiKeySuccess;

export const verifyApiKey = async (
  authorizationHeader?: string | null,
): Promise<ApiKeyResult> => {
  const apiKey = extractBearerToken(authorizationHeader);
  if (!apiKey) {
    return { ok: false, error: "API key required" };
  }

  const siteRecord = await db.query.site.findFirst({
    columns: { id: true },
    where: (sites, { eq }) => eq(sites.apiKey, apiKey),
  });

  if (!siteRecord) {
    return { ok: false, error: "Invalid API key" };
  }

  return {
    ok: true,
    apiKey,
    siteId: siteRecord.id,
  };
};
