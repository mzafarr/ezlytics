/**
 * Ingest geo resolution helpers.
 *
 * Functions for resolving geolocation data from headers and MaxMind database.
 */

import { existsSync } from "node:fs";
import * as maxmind from "maxmind";
import { MAX_STRING_LENGTH } from "@/app/api/v1/ingest/schema";

export const normalizeCountry = (value: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === "unknown") {
    return null;
  }
  const upper = trimmed.toUpperCase();
  return upper.length > 2 ? upper.slice(0, 2) : upper;
};

export const getHeaderValue = (headers: Headers, keys: string[]) => {
  for (const key of keys) {
    const value = headers.get(key);
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

export const parseCoordinateHeader = (
  value: string | null,
  min: number,
  max: number,
) => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return clampCoordinate(parsed, min, max);
};

export const normalizeGeoValue = (value: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === "unknown") {
    return null;
  }
  return trimmed.length > MAX_STRING_LENGTH
    ? trimmed.slice(0, MAX_STRING_LENGTH)
    : trimmed;
};

export const clampCoordinate = (
  value: number | null | undefined,
  min: number,
  max: number,
) => {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
};

let geoReaderPromise: Promise<maxmind.Reader<maxmind.CityResponse>> | null =
  null;
let geoReaderPath: string | null = null;

export const readGeoDatabase = (path: string) => {
  if (!existsSync(path)) {
    return null;
  }
  if (!geoReaderPromise || geoReaderPath !== path) {
    geoReaderPath = path;
    geoReaderPromise = maxmind.open<maxmind.CityResponse>(path).catch(() => {
      geoReaderPromise = null;
      geoReaderPath = null;
      return Promise.reject(new Error("MaxMind database open failed"));
    });
  }
  return geoReaderPromise;
};

export const resolveGeoFromMaxMind = async (ip: string, mmdbPath: string) => {
  if (!maxmind.validate(ip)) {
    return null;
  }
  const readerPromise = readGeoDatabase(mmdbPath);
  if (!readerPromise) {
    return null;
  }
  let reader: maxmind.Reader<maxmind.CityResponse>;
  try {
    reader = await readerPromise;
  } catch (error) {
    return null;
  }
  if (!reader) {
    return null;
  }
  const result = reader.get(ip);
  if (!result) {
    return null;
  }
  const region =
    result.subdivisions?.[0]?.names?.en ??
    result.subdivisions?.[0]?.names?.["en"];
  return {
    country: normalizeCountry(result.country?.iso_code ?? null),
    region: normalizeGeoValue(region ?? null),
    city: normalizeGeoValue(
      result.city?.names?.en ?? result.city?.names?.["en"] ?? null,
    ),
    latitude: clampCoordinate(result.location?.latitude, -90, 90),
    longitude: clampCoordinate(result.location?.longitude, -180, 180),
  };
};

export interface GeoFromHeaders {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export const resolveGeoFromHeaders = (headers: Headers): GeoFromHeaders => {
  const headerCountry = normalizeCountry(
    getHeaderValue(headers, [
      "x-vercel-ip-country",
      "cf-ipcountry",
      "x-country-code",
      "x-geo-country",
      "x-geo-country-code",
    ]),
  );
  const headerRegion = normalizeGeoValue(
    getHeaderValue(headers, [
      "x-vercel-ip-country-region",
      "x-vercel-ip-country-region-name",
      "cf-region",
      "x-geo-region",
      "x-geo-region-name",
    ]),
  );
  const headerCity = normalizeGeoValue(
    getHeaderValue(headers, ["x-vercel-ip-city", "cf-city", "x-geo-city"]),
  );
  const headerLatitude = parseCoordinateHeader(
    getHeaderValue(headers, [
      "x-vercel-ip-latitude",
      "cf-iplatitude",
      "x-geo-latitude",
    ]),
    -90,
    90,
  );
  const headerLongitude = parseCoordinateHeader(
    getHeaderValue(headers, [
      "x-vercel-ip-longitude",
      "cf-iplongitude",
      "x-geo-longitude",
    ]),
    -180,
    180,
  );
  return {
    country: headerCountry,
    region: headerRegion,
    city: headerCity,
    latitude: headerLatitude,
    longitude: headerLongitude,
  };
};
