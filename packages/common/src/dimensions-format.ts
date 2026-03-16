type DimensionInput = {
  width?: unknown;
  length?: unknown;
  height?: unknown;
  area?: unknown;
  unit?: unknown;
};

type ParsedDimensions = {
  width: number | null;
  length: number | null;
  height: number | null;
  area: number | null;
  unit: string;
};

function parseDimensions(dimensions: unknown): ParsedDimensions | null {
  if (!dimensions || typeof dimensions !== "object") return null;
  const record = dimensions as DimensionInput;
  const width = typeof record.width === "number" ? record.width : null;
  const length = typeof record.length === "number" ? record.length : null;
  const height = typeof record.height === "number" ? record.height : null;
  const area = typeof record.area === "number" ? record.area : null;
  const unit = typeof record.unit === "string" ? record.unit : "ft";
  return { width, length, height, area, unit };
}

/**
 * Pair format used in inbox and spot contexts, e.g. "10 x 20 ft".
 * Prefers length as secondary dimension, with height fallback for older records.
 */
export function formatDimensionsPair(dimensions: unknown): string | null {
  const parsed = parseDimensions(dimensions);
  if (!parsed) return null;
  const secondaryDimension = parsed.length ?? parsed.height;
  if (parsed.width == null || secondaryDimension == null) return null;
  return `${parsed.width} x ${secondaryDimension}${parsed.unit ? ` ${parsed.unit}` : ""}`;
}

/**
 * Friendly format used in vendor-facing UI.
 */
export function formatDimensionsFriendly(dimensions: unknown): string | null {
  const parsed = parseDimensions(dimensions);
  if (!parsed) return null;
  if (parsed.width != null && parsed.length != null) {
    return `${parsed.width} × ${parsed.length} ${parsed.unit}`;
  }
  if (parsed.area != null) return `${parsed.area} ${parsed.unit}²`;
  if (parsed.width != null) return `${parsed.width} ${parsed.unit} wide`;
  if (parsed.length != null) return `${parsed.length} ${parsed.unit} long`;
  return null;
}

/**
 * Label format used in template UIs, e.g. "10W × 20L × 8H ft".
 */
export function formatDimensionsLabeled(dimensions: unknown): string | null {
  const parsed = parseDimensions(dimensions);
  if (!parsed) return null;
  const parts: string[] = [];
  if (parsed.width != null) parts.push(`${parsed.width}W`);
  if (parsed.length != null) parts.push(`${parsed.length}L`);
  if (parsed.height != null) parts.push(`${parsed.height}H`);
  if (parts.length === 0) return null;
  return `${parts.join(" × ")} ${parsed.unit}`;
}
