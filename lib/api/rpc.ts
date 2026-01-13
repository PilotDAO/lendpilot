import { env } from "@/lib/config/env";

export interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

export interface Block {
  number: string;
  timestamp: string;
}

async function rpcCall<T>(
  url: string,
  method: string,
  params: unknown[],
  timeout: number = 10000 // 10 seconds default timeout
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`RPC call failed: ${response.statusText}`);
    }

    const data: RpcResponse<T> = await response.json();

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message} (code: ${data.error.code})`);
    }

    if (!data.result) {
      throw new Error("RPC response missing result");
    }

    return data.result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`RPC call timeout after ${timeout}ms`);
    }
    throw error;
  }
}

export async function getBlockByNumber(
  url: string,
  blockNumber: number | "latest",
  timeout: number = 10000
): Promise<Block> {
  return rpcCall<Block>(
    url,
    "eth_getBlockByNumber",
    [
      typeof blockNumber === "number" ? `0x${blockNumber.toString(16)}` : "latest",
      false,
    ],
    timeout
  );
}

export async function getBlockNumber(url: string): Promise<number> {
  const result = await rpcCall<string>(url, "eth_blockNumber", []);
  return parseInt(result, 16);
}

export async function getBlockByTimestamp(
  timestamp: number,
  timeout: number = 30000 // 30 seconds for binary search
): Promise<{ blockNumber: number; block: Block }> {
  const rpcUrls = env.ETH_RPC_URLS;
  let lastError: Error | null = null;

  // Overall timeout for the entire operation
  const startTime = Date.now();

  for (const url of rpcUrls) {
    try {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeout) {
        throw new Error(`Operation timeout after ${timeout}ms`);
      }

      // Binary search for block number
      const latestBlock = await getBlockByNumber(url, "latest", 10000);
      const latestBlockNumber = parseInt(latestBlock.number, 16);
      const latestTimestamp = parseInt(latestBlock.timestamp, 16);

      if (timestamp > latestTimestamp) {
        return {
          blockNumber: latestBlockNumber,
          block: latestBlock,
        };
      }

      // Binary search with timeout per request
      let low = 0;
      let high = latestBlockNumber;
      const maxIterations = 20; // Limit binary search iterations
      let iterations = 0;

      while (low <= high && iterations < maxIterations) {
        // Check timeout on each iteration
        if (Date.now() - startTime > timeout) {
          throw new Error(`Operation timeout after ${timeout}ms`);
        }

        iterations++;
        const mid = Math.floor((low + high) / 2);
        const midBlock = await getBlockByNumber(url, mid, 5000); // 5s per request
        const midTimestamp = parseInt(midBlock.timestamp, 16);

        if (midTimestamp === timestamp) {
          return {
            blockNumber: mid,
            block: midBlock,
          };
        } else if (midTimestamp < timestamp) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      // Return the block at or before the timestamp
      const resultBlock = await getBlockByNumber(url, high, 5000);
      return {
        blockNumber: high,
        block: resultBlock,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      continue; // Try next RPC
    }
  }

  throw new Error(
    `All RPC endpoints failed. Last error: ${lastError?.message || "Unknown"}`
  );
}
