import type { Request } from "express";

/**
 * Extract the client IP from the request.
 *
 * Behind a reverse proxy (Cloudflare, nginx, etc.), X-Forwarded-For contains:
 *   client-supplied, ..., proxy-appended
 * The rightmost entry is the one the trusted proxy added — take that one.
 * Falls back to req.ip (Express) or "unknown".
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    const trustedIp = ips[ips.length - 1];
    if (trustedIp) return trustedIp;
  }
  return req.ip || "unknown";
}
