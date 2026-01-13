import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

// Clean up old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  }
}, 60000);

function getClientId(request: NextRequest): string {
  // Use IP address as client identifier
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : request.ip || "unknown";
  return ip;
}

export function rateLimit(
  request: NextRequest,
  limit: number,
  windowMs: number = 60000
): { allowed: boolean; retryAfter?: number } {
  const clientId = getClientId(request);
  const now = Date.now();
  const entry = store[clientId];

  if (!entry || entry.resetAt < now) {
    // New window
    store[clientId] = {
      count: 1,
      resetAt: now + windowMs,
    };
    return { allowed: true };
  }

  if (entry.count >= limit) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

export function rateLimitMiddleware(
  limit: number,
  windowMs: number = 60000
) {
  return (request: NextRequest): NextResponse | null => {
    const { allowed, retryAfter } = rateLimit(request, limit, windowMs);

    if (!allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Rate limit exceeded",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter?.toString() || "60",
          },
        }
      );
    }

    return null; // Continue
  };
}
