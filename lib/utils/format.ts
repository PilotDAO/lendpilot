/**
 * Format USD values in a human-readable format
 * Examples:
 * - 1022314604.07 -> "$1.02B"
 * - 180260936.26 -> "$180.26M"
 * - 1634633.69 -> "$1.63M"
 * - 174454.66 -> "$174.45K"
 * - 1234.56 -> "$1,234.56"
 */
export function formatUSD(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  } else if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format large numbers for chart axis labels
 * Returns abbreviated format (B, M, K) without $ sign
 * Handles very large numbers and scientific notation
 */
export function formatNumber(value: number): string {
  // Handle invalid values
  if (!isFinite(value) || isNaN(value)) {
    return "0";
  }

  // Handle very large numbers that might be in scientific notation
  // Convert to regular number if needed
  let numValue = value;
  if (Math.abs(value) >= 1e15) {
    // For very large numbers, use a more precise conversion
    numValue = Number(value.toFixed(0));
  }

  if (numValue >= 1e12) {
    const trillions = numValue / 1e12;
    // Avoid scientific notation in the result
    if (trillions >= 1000) {
      return `${(trillions / 1000).toFixed(2)}Q`; // Quadrillion
    }
    return `${trillions.toFixed(2)}T`;
  } else if (numValue >= 1e9) {
    const billions = numValue / 1e9;
    return `${billions.toFixed(2)}B`;
  } else if (numValue >= 1e6) {
    const millions = numValue / 1e6;
    return `${millions.toFixed(2)}M`;
  } else if (numValue >= 1e3) {
    const thousands = numValue / 1e3;
    return `${thousands.toFixed(2)}K`;
  }
  
  // For small numbers, avoid scientific notation
  if (Math.abs(numValue) < 0.01 && numValue !== 0) {
    return numValue.toExponential(2);
  }
  
  return numValue.toFixed(2);
}
