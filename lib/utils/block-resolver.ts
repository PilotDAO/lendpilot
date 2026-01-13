import { getBlockByTimestamp } from "@/lib/api/rpc";

/**
 * Resolves a timestamp (Unix seconds) to an Ethereum block number.
 * Uses binary search for accuracy.
 */
export async function resolveTimestampToBlock(
  timestamp: number
): Promise<number> {
  const { blockNumber } = await getBlockByTimestamp(timestamp);
  return blockNumber;
}

/**
 * Resolves a date (ISO string or Date) to an Ethereum block number.
 */
export async function resolveDateToBlock(
  date: string | Date
): Promise<number> {
  const timestamp =
    typeof date === "string" ? new Date(date).getTime() / 1000 : date.getTime() / 1000;
  return resolveTimestampToBlock(Math.floor(timestamp));
}
