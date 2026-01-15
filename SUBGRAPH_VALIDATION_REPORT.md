# Subgraph Validation Report

**Date:** 2026-01-13  
**Total Markets Tested:** 20  
**Validation Method:** Compare 1 day of Subgraph data with current AaveKit API data

## Summary

- ✅ **Reliable Markets:** 0
- ⚠️  **Unreliable Markets:** 11
- ❌ **Error Markets:** 9

## Key Findings

### 1. No Markets Are Fully Reliable
None of the tested markets have Subgraph data that matches AaveKit within acceptable tolerances (<10% difference).

### 2. Common Issues

#### Missing Reserves
Many Subgraphs are missing recent reserves:
- **arbitrum-v3**: Only 8/20 reserves (missing 12)
- **base-v3**: Only 7/14 reserves (missing 7)
- **avalanche-v3**: Only 12/18 reserves (missing 6)
- **optimism-v3**: Only 8/14 reserves (missing 6)
- **ink-v3**: 0/9 reserves (completely empty)

#### Price Mismatches
Most markets have significant price differences:
- **ethereum-v3**: 47/60 price mismatches
- **linea-v3**: 8/8 price mismatches
- **ethereum-lido-v3**: 8/9 price mismatches

#### Data Inconsistencies
- **ethereum-v3**: -45.5% supply difference (Subgraph shows less)
- **linea-v3**: +482.7% supply difference (Subgraph shows more)
- **optimism-v3**: +728.9% supply difference (Subgraph shows more)
- **scroll-v3**: -7.1% supply but +140.1% borrow difference

### 3. Error Markets

Markets that cannot be queried from Subgraph:
- **ethereum-horizon-v3**: Pool not found
- **bnb-v3, gnosis-v3, polygon-v3, zk-sync-v3, celo-v3**: Block too old (before minimum startBlock)
- **metis-v3, plasma-v3**: 404 error (Subgraph not found)
- **soneium-v3**: Indexers unavailable

## Detailed Results

### Unreliable Markets

| Market | Subgraph Reserves | AaveKit Reserves | Missing | Supply Diff | Borrow Diff | Price Match |
|--------|------------------|-----------------|---------|-------------|-------------|-------------|
| ethereum-v3 | 60 | 60 | 0 | -45.5% | -8.9% | 13/60 |
| ethereum-ether-fi-v3 | 4 | 4 | 0 | -100.0% | -100.0% | 0/4 |
| ethereum-lido-v3 | 9 | 9 | 0 | -81.4% | -59.3% | 1/9 |
| optimism-v3 | 8 | 14 | 6 | +728.9% | +1514.9% | 3/8 |
| sonic-v3 | 4 | 4 | 0 | +180.8% | +338.5% | 0/4 |
| base-v3 | 7 | 14 | 7 | -71.3% | -49.9% | 4/7 |
| arbitrum-v3 | 8 | 20 | 12 | -97.8% | -98.7% | 3/8 |
| avalanche-v3 | 12 | 18 | 6 | -57.8% | -63.4% | 5/12 |
| ink-v3 | 0 | 9 | 9 | -100.0% | -100.0% | N/A |
| linea-v3 | 8 | 9 | 1 | +482.7% | +1073.8% | 0/8 |
| scroll-v3 | 5 | 5 | 0 | -7.1% | +140.1% | 1/5 |

### Error Markets

| Market | Error Type |
|--------|-----------|
| ethereum-horizon-v3 | Pool not found |
| bnb-v3 | Block before minimum startBlock |
| gnosis-v3 | Block before minimum startBlock |
| polygon-v3 | Block before minimum startBlock |
| zk-sync-v3 | Block before minimum startBlock |
| metis-v3 | 404 - Subgraph not found |
| soneium-v3 | Indexers unavailable |
| plasma-v3 | 404 - Subgraph not found |
| celo-v3 | Block before minimum startBlock |

## Recommendations

### 1. Use AaveKit for All Markets
Since no Subgraph markets are reliable, we should:
- Use AaveKit API for current data (already implemented)
- Skip historical data collection from Subgraph for unreliable markets
- Consider alternative sources for historical data

### 2. Updated UNRELIABLE_MARKETS List

```typescript
const UNRELIABLE_MARKETS = [
  'ethereum-v3',
  'ethereum-ether-fi-v3',
  'ethereum-lido-v3',
  'optimism-v3',
  'sonic-v3',
  'base-v3',
  'arbitrum-v3',
  'avalanche-v3',
  'ink-v3',
  'linea-v3',
  'scroll-v3',
];
```

### 3. Error Markets Handling
Markets with errors should be handled separately:
- Markets with "block before minimum startBlock" errors might work with historical queries
- Markets with 404 errors need Subgraph ID verification
- Markets with unavailable indexers need to wait for indexer sync

## Conclusion

**Subgraph data is unreliable for all tested markets.** The main issues are:
1. Missing reserves (Subgraphs not synced with latest additions)
2. Price format inconsistencies
3. Data calculation differences
4. Incomplete or unavailable Subgraphs

**Recommendation:** Continue using AaveKit API for current data and avoid Subgraph for historical data collection until Subgraphs are fixed or alternative data sources are found.
