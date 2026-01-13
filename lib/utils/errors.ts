/**
 * Standard error response formatter
 */

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ErrorResponse {
  const error: ErrorResponse["error"] = {
    code,
    message,
  };
  
  if (details !== undefined) {
    error.details = details;
  }
  
  return { error };
}

export const ErrorCodes = {
  INVALID_MARKET: "INVALID_MARKET",
  INVALID_ADDRESS: "INVALID_ADDRESS",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  MARKET_NOT_FOUND: "MARKET_NOT_FOUND",
  RESERVE_NOT_FOUND: "RESERVE_NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;
