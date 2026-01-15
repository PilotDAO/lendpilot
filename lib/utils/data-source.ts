/**
 * Utility functions for determining data sources for markets
 */

export const ETHEREUM_V3_MARKET_KEY = 'ethereum-v3';

/**
 * Determines which data source to use for a market
 * @param marketKey - The market key
 * @returns 'subgraph' for Ethereum V3, 'aavekit' for others
 */
export function getDataSourceForMarket(marketKey: string): 'subgraph' | 'aavekit' {
  return marketKey === ETHEREUM_V3_MARKET_KEY ? 'subgraph' : 'aavekit';
}

/**
 * Checks if a market uses Subgraph as data source
 */
export function usesSubgraph(marketKey: string): boolean {
  return getDataSourceForMarket(marketKey) === 'subgraph';
}

/**
 * Checks if a market uses AaveKit as data source
 */
export function usesAaveKit(marketKey: string): boolean {
  return getDataSourceForMarket(marketKey) === 'aavekit';
}
