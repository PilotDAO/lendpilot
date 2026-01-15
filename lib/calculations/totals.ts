import { BigNumber } from "@/lib/utils/big-number";
import { isStablecoin } from "@/lib/data/stablecoins";

const PRICE_BASE = 1e8; // USD x 1e8

/**
 * Convert usdExchangeRate from AaveKit to USD price
 * 
 * AaveKit's usdExchangeRate format:
 * - For most tokens: USD / 1e8 (e.g., 0.0000312772325362 for WETH = 3127.72 USD)
 * - For stablecoins: Already in USD format (e.g., 1.0 for USDC = 1 USD)
 * 
 * @param usdExchangeRate - The usdExchangeRate from AaveKit
 * @param symbol - Optional token symbol for stablecoin detection
 * @param address - Optional token address for stablecoin detection
 */
export function priceToUSD(
  usdExchangeRate: string,
  symbol?: string,
  address?: string
): number {
  const price = new BigNumber(usdExchangeRate);
  const priceValue = price.toNumber();
  
  // Check if it's a stablecoin by address or symbol
  // IMPORTANT: Only stablecoins are in USD format. All other tokens use USD/1e8 format.
  // We cannot rely on "value >= 1" check because some tokens (like 1INCH, BAL, CRV)
  // have usdExchangeRate >= 1 but are still in USD/1e8 format.
  const isStable = address ? isStablecoin(address) : false;
  const stablecoinSymbols = ['USDC', 'USDT', 'DAI', 'FRAX', 'GUSD', 'USDP', 'LUSD', 'sUSD', 'BUSD', 'TUSD', 'PYUSD', 'USDG', 'EURC', 'GHO', 'RLUSD', 'USDS', 'USDe', 'USDtb', 'crvUSD', 'mUSD'];
  const isStableBySymbol = symbol && stablecoinSymbols.includes(symbol.toUpperCase());
  
  // Only stablecoins are in USD format, all others use USD/1e8
  if (isStable || isStableBySymbol) {
    // Stablecoins: Already in USD format (e.g., USDC = 1.0)
    const result = priceValue;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[priceToUSD] ${symbol || 'unknown'}: usdExchangeRate=${usdExchangeRate}, format=USD (stablecoin), price=${result}`);
    }
    return result;
  } else {
    // All other tokens: AaveKit's usdExchangeRate format
    // Based on AaveKit API testing:
    // - usdExchangeRate is ALREADY in USD format (e.g., WETH = 3133.4255 means 3133.4255 USD)
    // - No conversion needed - use value directly
    // 
    // Previous assumption that it was in USD/1e8 or USD*1e8 format was incorrect.
    const result = priceValue;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[priceToUSD] ${symbol || 'unknown'}: usdExchangeRate=${usdExchangeRate}, format=USD (already in USD), price=${result}`);
    }
    return result;
  }
}

/**
 * Convert price.priceInEth from Subgraph to USD price
 * 
 * Subgraph's price.priceInEth format varies by network:
 * - Ethereum: USD * 1e8 (e.g., 312772000000000 = 3127.72 USD, 26356060 = 0.26356060 USD)
 * - Other L2s: May use different formats or have incomplete data
 * 
 * IMPORTANT: For Ethereum, ALL prices are in USD * 1e8 format, regardless of value magnitude.
 * The previous auto-detection logic was incorrect - it assumed values < 1e10 were already in USD,
 * but even small values like 26356060 are still in USD * 1e8 format (0.26356060 USD).
 * 
 * @param priceInEth - The price.priceInEth from Subgraph
 * @param symbol - Optional token symbol for logging
 * @param marketKey - Optional market key to determine price format (defaults to ethereum-v3)
 */
export function priceFromSubgraphToUSD(
  priceInEth: string,
  symbol?: string,
  marketKey?: string
): number {
  const price = new BigNumber(priceInEth);
  const priceValue = price.toNumber();
  
  // For Ethereum, always use USD * 1e8 format
  // For other networks, use auto-detection but be more conservative
  const isEthereum = !marketKey || marketKey === 'ethereum-v3' || 
                     marketKey === 'ethereum-ether-fi-v3' || 
                     marketKey === 'ethereum-lido-v3' || 
                     marketKey === 'ethereum-horizon-v3';
  
  if (priceValue === 0) {
    // Zero price - return as is (often indicates missing data in Subgraph)
    return 0;
  }
  
  if (isEthereum) {
    // Ethereum: Always USD * 1e8 format, regardless of value magnitude
    const result = price.div(PRICE_BASE).toNumber();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[priceFromSubgraphToUSD] ${symbol || 'unknown'}: priceInEth=${priceInEth}, format=USD*1e8 (Ethereum), price=${result}`);
    }
    return result;
  } else {
    // Other networks: Auto-detect format
    // If value >= 1e6, likely USD * 1e8 format
    // If value < 1e6 and < 1, likely already in USD format
    // If value >= 1 and < 1e6, try both formats and see which makes more sense
    if (priceValue >= 1e6) {
      // Large values: Likely USD * 1e8 format
      const result = price.div(PRICE_BASE).toNumber();
      if (process.env.NODE_ENV === 'development') {
        console.log(`[priceFromSubgraphToUSD] ${symbol || 'unknown'}: priceInEth=${priceInEth}, format=USD*1e8 (auto-detected), price=${result}`);
      }
      return result;
    } else if (priceValue < 1) {
      // Very small values: Likely already in USD format
      const result = priceValue;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[priceFromSubgraphToUSD] ${symbol || 'unknown'}: priceInEth=${priceInEth}, format=USD (already, <1), price=${result}`);
      }
      return result;
    } else {
      // Medium values (1 <= value < 1e6): Could be either format
      // For non-Ethereum networks, if the value looks like a reasonable USD price,
      // use it directly. Otherwise, divide by 1e8.
      // If value is between 1 and 1000, it's likely already in USD
      if (priceValue >= 1 && priceValue < 1000) {
        const result = priceValue;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[priceFromSubgraphToUSD] ${symbol || 'unknown'}: priceInEth=${priceInEth}, format=USD (reasonable range), price=${result}`);
        }
        return result;
      } else {
        // Try USD * 1e8 format
        const result = price.div(PRICE_BASE).toNumber();
        if (process.env.NODE_ENV === 'development') {
          console.log(`[priceFromSubgraphToUSD] ${symbol || 'unknown'}: priceInEth=${priceInEth}, format=USD*1e8 (fallback), price=${result}`);
        }
        return result;
      }
    }
  }
}

/**
 * Calculate total supplied in USD from AaveKit (human-readable format)
 * 
 * Note: AaveKit returns DecimalValue.value which is already in human-readable format
 * (e.g., "4465088507.84705" for 4.465B tokens), not in on-chain format.
 * So we don't need to divide by 10^decimals - just multiply by price.
 */
export function calculateTotalSuppliedUSD(
  suppliedTokens: string,
  decimals: number,
  priceUSD: number
): number {
  // AaveKit's DecimalValue.value is already human-readable, so no conversion needed
  const tokens = new BigNumber(suppliedTokens);
  return tokens.times(priceUSD).toNumber();
}

/**
 * Calculate total borrowed in USD from AaveKit (human-readable format)
 * 
 * Note: AaveKit returns DecimalValue.value which is already in human-readable format
 * (e.g., "3817353610.418048" for 3.817B tokens), not in on-chain format.
 * So we don't need to divide by 10^decimals - just multiply by price.
 */
export function calculateTotalBorrowedUSD(
  borrowedTokens: string,
  decimals: number,
  priceUSD: number
): number {
  // AaveKit's DecimalValue.value is already human-readable, so no conversion needed
  const tokens = new BigNumber(borrowedTokens);
  return tokens.times(priceUSD).toNumber();
}

/**
 * Calculate total supplied in USD from Subgraph (on-chain format)
 * 
 * Note: Subgraph returns BigInt strings in on-chain format (e.g., "4465088507847050" for 4.465B tokens with 6 decimals).
 * So we need to divide by 10^decimals to get human-readable format, then multiply by price.
 */
export function calculateTotalSuppliedUSDFromSubgraph(
  suppliedTokens: string,
  decimals: number,
  priceUSD: number
): number {
  // Subgraph returns on-chain format, so convert using fromOnchain
  const tokens = BigNumber.fromOnchain(suppliedTokens, decimals);
  return tokens.times(priceUSD).toNumber();
}

/**
 * Calculate total borrowed in USD from Subgraph (on-chain format)
 * 
 * Note: Subgraph returns BigInt strings in on-chain format (e.g., "3817353610418048" for 3.817B tokens with 6 decimals).
 * So we need to divide by 10^decimals to get human-readable format, then multiply by price.
 */
export function calculateTotalBorrowedUSDFromSubgraph(
  borrowedTokens: string,
  decimals: number,
  priceUSD: number
): number {
  // Subgraph returns on-chain format, so convert using fromOnchain
  const tokens = BigNumber.fromOnchain(borrowedTokens, decimals);
  return tokens.times(priceUSD).toNumber();
}

/**
 * Calculate available liquidity in USD
 * 
 * Note: AaveKit returns DecimalValue.value which is already in human-readable format,
 * not in on-chain format. So we don't need to divide by 10^decimals - just multiply by price.
 */
export function calculateAvailableLiquidityUSD(
  availableLiquidity: string,
  decimals: number,
  priceUSD: number
): number {
  // AaveKit's DecimalValue.value is already human-readable, so no conversion needed
  const liquidity = new BigNumber(availableLiquidity);
  return liquidity.times(priceUSD).toNumber();
}

/**
 * Calculate utilization rate (0-1)
 */
export function calculateUtilizationRate(
  borrowed: string,
  available: string
): number {
  const borrowedBN = new BigNumber(borrowed);
  const availableBN = new BigNumber(available);
  const total = borrowedBN.plus(availableBN);

  if (total.eq(0)) {
    return 0;
  }

  return borrowedBN.div(total).toNumber();
}

/**
 * Calculate market totals from reserves
 */
export function calculateMarketTotals(reserves: Array<{
  currentState: {
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
  };
}>) {
  return reserves.reduce(
    (acc, reserve) => {
      acc.totalSupply += reserve.currentState.totalSuppliedUSD;
      acc.supply += reserve.currentState.totalSuppliedUSD - reserve.currentState.totalBorrowedUSD;
      acc.borrowing += reserve.currentState.totalBorrowedUSD;
      return acc;
    },
    { totalSupply: 0, supply: 0, borrowing: 0, assetCount: reserves.length }
  );
}
