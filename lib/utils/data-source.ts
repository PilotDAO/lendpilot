/**
 * Utility functions for determining data sources for markets
 * 
 * All markets now use AaveKit for current data (stored in DB)
 * Historical data comes from Subgraph (as per original spec)
 */

/**
 * Determines which data source to use for current data
 * @param marketKey - The market key
 * @returns 'aavekit' for all markets (data stored in DB)
 */
export function getDataSourceForMarket(marketKey: string): 'aavekit' {
  return 'aavekit';
}

/**
 * Checks if a market uses Subgraph for historical data
 * @returns true for all markets (historical data always from Subgraph)
 */
export function usesSubgraphForHistory(marketKey: string): boolean {
  return true; // All markets use Subgraph for historical data
}

/**
 * @deprecated Use getDataSourceForMarket() instead
 * Checks if a market uses Subgraph as data source
 */
export function usesSubgraph(marketKey: string): boolean {
  return false; // No markets use Subgraph for current data anymore
}

/**
 * @deprecated Use getDataSourceForMarket() instead
 * Checks if a market uses AaveKit as data source
 */
export function usesAaveKit(marketKey: string): boolean {
  return true; // All markets use AaveKit for current data
}
