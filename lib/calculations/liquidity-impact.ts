import { BigNumber } from "@/lib/utils/big-number";
import { calculateUtilizationRate } from "./totals";

export interface ReserveParameters {
  optimalUtilization: number; // Optimal utilization rate (0-1)
  baseRate: number; // Base rate (as decimal)
  slope1: number; // Slope before optimal (as decimal)
  slope2: number; // Slope after optimal (as decimal)
}

export interface LiquidityImpactScenario {
  action: "Deposit" | "Borrow" | "Repay" | "Withdraw";
  amountUSD: number;
}

export interface LiquidityImpactResult {
  newUtilization: number;
  newSupplyAPR: number;
  newBorrowAPR: number;
  deltaUtilization: number;
  deltaSupplyAPR: number;
  deltaBorrowAPR: number;
}

/**
 * Calculate new rates based on utilization using Aave rate curve
 * 
 * Formula:
 * - borrowAPR = baseRate + (utilization / optimalUtilization) * slope1 (if utilization <= optimal)
 * - borrowAPR = baseRate + slope1 + ((utilization - optimalUtilization) / (1 - optimalUtilization)) * slope2 (if utilization > optimal)
 * - supplyAPR = borrowAPR * utilization * (1 - reserveFactor)
 */
function calculateRates(
  utilization: number,
  params: ReserveParameters,
  reserveFactor: number
): { supplyAPR: number; borrowAPR: number } {
  let borrowAPR: number;
  
  if (utilization <= params.optimalUtilization) {
    // Before optimal: linear increase
    borrowAPR =
      params.baseRate +
      (utilization / params.optimalUtilization) * params.slope1;
  } else {
    // After optimal: steeper increase
    const excessUtilization = utilization - params.optimalUtilization;
    const excessRate = (excessUtilization / (1 - params.optimalUtilization)) * params.slope2;
    borrowAPR = params.baseRate + params.slope1 + excessRate;
  }
  
  // Supply APR = borrowAPR * utilization * (1 - reserveFactor)
  // This is the correct Aave formula: suppliers get a portion of borrow interest
  const supplyAPR = borrowAPR * utilization * (1 - reserveFactor);
  
  return { supplyAPR, borrowAPR };
}

/**
 * Calculate liquidity impact for a scenario
 */
export function calculateLiquidityImpact(
  currentState: {
    borrowedUSD: number;
    availableUSD: number;
    supplyAPR: number;
    borrowAPR: number;
  },
  scenario: LiquidityImpactScenario,
  params: ReserveParameters,
  reserveFactor: number = 0.1 // Default 10% if not provided
): LiquidityImpactResult {
  const { borrowedUSD, availableUSD } = currentState;
  let newBorrowed = new BigNumber(borrowedUSD);
  let newAvailable = new BigNumber(availableUSD);

  // Apply scenario
  switch (scenario.action) {
    case "Deposit":
      newAvailable = newAvailable.plus(scenario.amountUSD);
      break;
    case "Borrow":
      newBorrowed = newBorrowed.plus(scenario.amountUSD);
      newAvailable = newAvailable.minus(scenario.amountUSD);
      break;
    case "Repay":
      newBorrowed = newBorrowed.minus(scenario.amountUSD);
      newAvailable = newAvailable.plus(scenario.amountUSD);
      break;
    case "Withdraw":
      newAvailable = newAvailable.minus(scenario.amountUSD);
      break;
  }

  // Calculate new utilization
  const newUtilization = calculateUtilizationRate(
    newBorrowed.toString(),
    newAvailable.toString()
  );

  // Clamp utilization to 0-1
  const clampedUtilization = Math.max(0, Math.min(1, newUtilization));

  // Calculate new rates
  const { supplyAPR, borrowAPR } = calculateRates(clampedUtilization, params, reserveFactor);

  // Calculate deltas
  const currentUtilization = calculateUtilizationRate(
    borrowedUSD.toString(),
    availableUSD.toString()
  );

  return {
    newUtilization: clampedUtilization,
    newSupplyAPR: supplyAPR,
    newBorrowAPR: borrowAPR,
    deltaUtilization: clampedUtilization - currentUtilization,
    deltaSupplyAPR: supplyAPR - currentState.supplyAPR,
    deltaBorrowAPR: borrowAPR - currentState.borrowAPR,
  };
}
