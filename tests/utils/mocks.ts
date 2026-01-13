/**
 * Test utilities for mocking external APIs
 */

export function mockAaveKitResponse(data: unknown) {
  return {
    ok: true,
    json: async () => Promise.resolve(data),
  } as Response;
}

export function mockSubgraphResponse(data: unknown) {
  return {
    ok: true,
    json: async () => Promise.resolve(data),
  } as Response;
}

export function mockRpcResponse(result: string) {
  return {
    ok: true,
    json: async () =>
      Promise.resolve({
        jsonrpc: "2.0",
        id: 1,
        result,
      }),
  } as Response;
}

export function mockErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    statusText: message,
    json: async () =>
      Promise.resolve({
        error: {
          code: status,
          message,
        },
      }),
  } as Response;
}
