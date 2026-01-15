import { NextRequest, NextResponse } from "next/server";
import { normalizeAddress, validateAddress } from "@/lib/utils/address";
import { validateMarketKey } from "@/lib/utils/market";
import { createErrorResponse, ErrorCodes } from "@/lib/utils/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import {
  calculateLiquidityImpact,
  type ReserveParameters,
} from "@/lib/calculations/liquidity-impact";
import { getReserveFromDB } from "@/lib/api/db-market-data";
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

    // Get reserve parameters from DB (now stored in rawData)
    // All markets now use DB for current data (collected from AaveKit API via daily cron)
    let reserveWithParams: any = null;
    try {
      reserveWithParams = await getReserveFromDB(marketKey, normalizedAddress);
    } catch (dbError) {
      console.warn(`Failed to fetch reserve from DB for ${marketKey}/${normalizedAddress}:`, dbError);
      // Continue with defaults if DB lookup fails
    }

    // Get reserve parameters from DB (with fallback to defaults)
    // Note: PercentValue.value is in decimal format (0.1 = 10%), so we use it directly
    const optimalUsageRate = reserveWithParams?.optimalUsageRate
      ? new BigNumber(reserveWithParams.optimalUsageRate).toNumber()
      : 0.8; // Default 80%
    
    const baseRate = reserveWithParams?.baseVariableBorrowRate
      ? new BigNumber(reserveWithParams.baseVariableBorrowRate).toNumber()
      : 0.0; // Default 0%
    
    const slope1 = reserveWithParams?.variableRateSlope1
      ? new BigNumber(reserveWithParams.variableRateSlope1).toNumber()
      : 0.04; // Default 4%
    
    const slope2 = reserveWithParams?.variableRateSlope2
      ? new BigNumber(reserveWithParams.variableRateSlope2).toNumber()
      : 0.75; // Default 75%
    
    const reserveFactor = reserveWithParams?.reserveFactor
      ? new BigNumber(reserveWithParams.reserveFactor).toNumber()
      : 0.1; // Default 10%

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[LiquidityImpact] Reserve parameters for ${normalizedAddress}:`, {
        optimalUsageRate,
        baseRate,
        slope1,
        slope2,
        reserveFactor,
        hasOptimalUsageRate: !!reserveWithParams?.optimalUsageRate,
        hasBaseRate: !!reserveWithParams?.baseVariableBorrowRate,
        hasSlope1: !!reserveWithParams?.variableRateSlope1,
        hasSlope2: !!reserveWithParams?.variableRateSlope2,
        hasReserveFactor: !!reserveWithParams?.reserveFactor,
        source: reserveWithParams ? 'DB' : 'defaults',
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
          hasParametersFromDB: {
            optimalUsageRate: !!reserveWithParams?.optimalUsageRate,
            baseRate: !!reserveWithParams?.baseVariableBorrowRate,
            slope1: !!reserveWithParams?.variableRateSlope1,
            slope2: !!reserveWithParams?.variableRateSlope2,
            reserveFactor: !!reserveWithParams?.reserveFactor,
          },
          source: reserveWithParams ? 'DB' : 'defaults',
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
