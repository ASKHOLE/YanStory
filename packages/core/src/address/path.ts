export interface AddressPath {
  segments: string[];
}

export function parseAddressPath(raw: string): AddressPath {
  const normalized = raw
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
  if (normalized.length === 0) {
    return { segments: [] };
  }
  return { segments: normalized.split("/") };
}

export function formatAddressPath(path: AddressPath): string {
  return path.segments.join("/");
}

export function joinAddressPath(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

export function addressHead(path: AddressPath): string | undefined {
  return path.segments[0];
}

export function addressTail(path: AddressPath): AddressPath {
  return { segments: path.segments.slice(1) };
}

export function isGlobSegment(segment: string): boolean {
  return segment.includes("*") || segment.includes("?") || segment.includes("[");
}

export function matchSegment(pattern: string, segment: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === segment;

  const regex = new RegExp(
    `^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`
  );
  return regex.test(segment);
}
