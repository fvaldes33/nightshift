import type { NextFunction, Request, Response } from "express";
import { getClientIp } from "./get-client-ip";

interface SlidingWindow {
  timestamps: number[];
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_EVENTS = 100; // per IP per eventId per minute
const CLEANUP_INTERVAL_MS = 60_000; // clean up stale entries every minute

const windows = new Map<string, SlidingWindow>();

// Periodically clean up expired windows to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows) {
    window.timestamps = window.timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (window.timestamps.length === 0) {
      windows.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Sliding window rate limiter middleware for the collect endpoint.
 * Limits to ~100 events/min per IP per eventId.
 * Counts individual events in each batch, not just requests.
 * Must be applied AFTER body parsing (needs req.body.eventId + req.body.events).
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const eventId = req.body?.eventId;
  if (typeof eventId !== "string") {
    // Let the route handler deal with validation errors
    next();
    return;
  }

  const ip = getClientIp(req);
  const key = `${ip}:${eventId}`;
  const now = Date.now();

  let window = windows.get(key);
  if (!window) {
    window = { timestamps: [] };
    windows.set(key, window);
  }

  // Remove timestamps outside the sliding window
  window.timestamps = window.timestamps.filter((ts) => now - ts < WINDOW_MS);

  // Count each event in the batch, not just the request
  const eventCount = Array.isArray(req.body?.events) ? req.body.events.length : 1;

  if (window.timestamps.length + eventCount > MAX_EVENTS) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  // Add one timestamp entry per event so the sliding window tracks total events
  for (let i = 0; i < eventCount; i++) {
    window.timestamps.push(now);
  }
  next();
}
