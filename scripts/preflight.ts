#!/usr/bin/env tsx
/**
 * Preflight checks for AaveKit, Subgraph, and RPC connectivity
 */

import { queryMarkets } from "@/lib/api/aavekit";
import { queryPoolByAddress } from "@/lib/api/subgraph";
import { getBlockNumber } from "@/lib/api/rpc";
import { env } from "@/lib/config/env";

interface CheckResult {
  name: string;
  status: "pass" | "fail";
  message: string;
}

const results: CheckResult[] = [];

async function checkAaveKit(): Promise<void> {
  try {
    const markets = await queryMarkets();
    results.push({
      name: "AaveKit GraphQL",
      status: "pass",
      message: `Connected. Found ${markets.length} markets.`,
    });
  } catch (error) {
    results.push({
      name: "AaveKit GraphQL",
      status: "fail",
      message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function checkSubgraph(): Promise<void> {
  try {
    // Test with Ethereum V3 pool address
    const poolAddress = "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2";
    const pool = await queryPoolByAddress(env.AAVE_SUBGRAPH_ID, poolAddress);
    
    if (pool) {
      results.push({
        name: "Aave Subgraph",
        status: "pass",
        message: `Connected. Pool mapping works. Pool ID: ${pool.id}`,
      });
    } else {
      results.push({
        name: "Aave Subgraph",
        status: "fail",
        message: "Pool mapping failed - pool not found",
      });
    }
  } catch (error) {
    results.push({
      name: "Aave Subgraph",
      status: "fail",
      message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function checkRpcFailover(): Promise<void> {
  try {
    const rpcUrls = env.ETH_RPC_URLS;
    let lastError: Error | null = null;
    let successUrl = "";

    for (const url of rpcUrls) {
      try {
        const blockNumber = await getBlockNumber(url);
        successUrl = url;
        results.push({
          name: "Ethereum RPC Failover",
          status: "pass",
          message: `Connected via ${url}. Latest block: ${blockNumber}`,
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    results.push({
      name: "Ethereum RPC Failover",
      status: "fail",
      message: `All RPC endpoints failed. Last error: ${lastError?.message || "Unknown"}`,
    });
  } catch (error) {
    results.push({
      name: "Ethereum RPC Failover",
      status: "fail",
      message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function main() {
  console.log("🔍 Running preflight checks...\n");

  await checkAaveKit();
  await checkSubgraph();
  await checkRpcFailover();

  console.log("\n📊 Results:\n");
  let allPassed = true;

  for (const result of results) {
    const icon = result.status === "pass" ? "✓" : "✗";
    const status = result.status === "pass" ? "PASS" : "FAIL";
    console.log(`${icon} ${result.name}: ${status}`);
    console.log(`  ${result.message}\n`);

    if (result.status === "fail") {
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log("✅ All checks passed!");
    process.exit(0);
  } else {
    console.log("❌ Some checks failed. Please review the errors above.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
