import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import {
  calculateLiquidityImpact,
  type ReserveParameters,
} from "@/lib/calculations/liquidity-impact";
import { queryReserve } from "@/lib/api/aavekit";
import { BigNumber } from "@/lib/utils/big-number";
import { readFileSync } from "fs";
import { join } from "path";

interface LiquidityImpactScenariosConfig {
  default: Array<{
    action: "Deposit" | "Borrow" | "Repay" | "Withdraw";
    amount: string;
  }>;
  overrides: Record<string, Array<{
    action: "Deposit" | "Borrow" | "Repay" | "Withdraw";
    amount: string;
  }>>;
}

function loadScenarios(): LiquidityImpactScenariosConfig {
  try {
    const filePath = join(process.cwd(), "data", "liquidityImpactScenarios.json");
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as LiquidityImpactScenariosConfig;
  } catch {
    console.warn("Failed to load liquidityImpactScenarios.json, using defaults");
    return {
      default: [
        { action: "Deposit", amount: "100000000" },
        { action: "Borrow", amount: "100000000" },
        { action: "Deposit", amount: "250000000" },
        { action: "Borrow", amount: "250000000" },
        { action: "Deposit", amount: "500000000" },
        { action: "Borrow", amount: "500000000" },
        { action: "Deposit", amount: "1000000000" },
        { action: "Borrow", amount: "1000000000" },
      ],
      overrides: {},
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketKey: string; underlying: string }> }
) {
  // Rate limiting
  const rateLimitResponse = rateLimitMiddleware(100, 60000)(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { marketKey, underlying } = await params;

  // Validate inputs
  if (!validateMarketKey(marketKey) || !validateAddress(underlying)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_ADDRESS, "Invalid market or address"),
      { status: 404 }
    );
  }

  const normalizedAddress = normalizeAddress(underlying);

  try {
    // Fetch current reserve state from API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const reserveResponse = await fetch(
      `${baseUrl}/api/v1/reserve/${marketKey}/${normalizedAddress}`
    );

    if (!reserveResponse.ok) {
      throw new Error(`Failed to fetch reserve: ${reserveResponse.statusText}`);
    }

    const reserve = await reserveResponse.json();
    const currentState = reserve.currentState;

    // Fetch reserve parameters from AaveKit API
    const aaveKitReserve = await queryReserve(marketKey, normalizedAddress);
    if (!aaveKitReserve) {
      throw new Error("Reserve not found in AaveKit");
    }

    // Get reserve parameters from API (with fallback to defaults)
    // Note: PercentValue.value is in decimal format (0.1 = 10%), so we use it directly
    const optimalUsageRate = aaveKitReserve.optimalUsageRate
      ? new BigNumber(aaveKitReserve.optimalUsageRate).toNumber()
      : 0.8; // Default 80%
    
    const baseRate = aaveKitReserve.baseVariableBorrowRate
      ? new BigNumber(aaveKitReserve.baseVariableBorrowRate).toNumber()
      : 0.0; // Default 0%
    
    const slope1 = aaveKitReserve.variableRateSlope1
      ? new BigNumber(aaveKitReserve.variableRateSlope1).toNumber()
      : 0.04; // Default 4%
    
    const slope2 = aaveKitReserve.variableRateSlope2
      ? new BigNumber(aaveKitReserve.variableRateSlope2).toNumber()
      : 0.75; // Default 75%
    
    const reserveFactor = aaveKitReserve.reserveFactor
      ? new BigNumber(aaveKitReserve.reserveFactor).toNumber()
      : 0.1; // Default 10%

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[LiquidityImpact] Reserve parameters for ${normalizedAddress}:`, {
        optimalUsageRate,
        baseRate,
        slope1,
        slope2,
        reserveFactor,
        hasOptimalUsageRate: !!aaveKitReserve.optimalUsageRate,
        hasBaseRate: !!aaveKitReserve.baseVariableBorrowRate,
        hasSlope1: !!aaveKitReserve.variableRateSlope1,
        hasSlope2: !!aaveKitReserve.variableRateSlope2,
        hasReserveFactor: !!aaveKitReserve.reserveFactor,
      });
    }

    const params: ReserveParameters = {
      optimalUtilization: optimalUsageRate,
      baseRate: baseRate,
      slope1: slope1,
      slope2: slope2,
    };

    // Load scenarios
    const scenariosConfig = loadScenarios();
    const scenarios = scenariosConfig.overrides[normalizedAddress] || scenariosConfig.default;

    // Calculate impact for each scenario
    const results = scenarios.map((scenario) => {
      const impact = calculateLiquidityImpact(
        {
          borrowedUSD: currentState.totalBorrowedUSD,
          availableUSD: currentState.totalSuppliedUSD - currentState.totalBorrowedUSD,
          supplyAPR: currentState.supplyAPR,
          borrowAPR: currentState.borrowAPR,
        },
        {
          action: scenario.action,
          amountUSD: parseFloat(scenario.amount),
        },
        params,
        reserveFactor
      );

      return {
        scenario: {
          action: scenario.action,
          amountUSD: parseFloat(scenario.amount),
        },
        impact,
      };
    });

    return NextResponse.json({ 
      results,
      // Debug info (only in development)
      ...(process.env.NODE_ENV === 'development' ? {
        debug: {
          reserveParameters: {
            optimalUsageRate,
            baseRate,
            slope1,
            slope2,
            reserveFactor,
          },
          hasParametersFromAPI: {
            optimalUsageRate: !!aaveKitReserve.optimalUsageRate,
            baseRate: !!aaveKitReserve.baseVariableBorrowRate,
            slope1: !!aaveKitReserve.variableRateSlope1,
            slope2: !!aaveKitReserve.variableRateSlope2,
            reserveFactor: !!aaveKitReserve.reserveFactor,
          },
        },
      } : {}),
    });
  } catch (error) {
    console.error(
      `Error calculating liquidity impact for ${marketKey}/${normalizedAddress}:`,
      error
    );
    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.UPSTREAM_ERROR,
        "Failed to calculate liquidity impact",
        error instanceof Error ? error.message : String(error)
      ),
      { status: 503 }
    );
  }
}
