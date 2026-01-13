# Data Model

**Feature**: Aavescan Clone - Aave Protocol Analytics Platform  
**Date**: 2026-01-11  
**Phase**: 1 - Design & Contracts

## Overview

This document defines the data entities, their attributes, relationships, and validation rules for the Aavescan Clone platform. All entities are derived from external data sources (AaveKit GraphQL, The Graph Subgraph) and transformed for UI presentation.

## Core Entities

### Market

Represents a deployment of Aave protocol (e.g., Ethereum V3, Arbitrum V3).

**Source**: Configuration file (`data/markets.json`) + AaveKit GraphQL

**Attributes**:
- `marketKey` (string, required, unique): URL-friendly identifier (e.g., "ethereum-v3")
  - Validation: lowercase, kebab-case, matches pattern `^[a-z0-9-]+$`
- `displayName` (string, required): Human-readable name (e.g., "Ethereum V3")
- `poolAddress` (string, required): Ethereum address of the pool contract
  - Validation: 0x + 40 hex characters, normalized to lowercase
- `subgraphId` (string, required): The Graph subgraph ID for this market
- `chainId` (number, required): Blockchain chain ID (1 for Ethereum mainnet)
- `rpcUrls` (string[], required, min 1): Array of RPC endpoints for failover
  - Order matters: first is primary, last is least preferred
- `url` (string, optional): Reference URL to aavescan.com

**Relationships**:
- Has many: `Asset/Reserve`
- Has one: `MarketTotals` (aggregated)

**State**: Static (loaded from config, updated manually via scraper)

**Example**:
```json
{
  "marketKey": "ethereum-v3",
  "displayName": "Ethereum V3",
  "poolAddress": "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
  "subgraphId": "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g",
  "chainId": 1,
  "rpcUrls": [
    "https://eth.drpc.org",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://ethereum-rpc.publicnode.com"
  ]
}
```

### Asset/Reserve

Represents a specific token in a market pool.

**Source**: AaveKit GraphQL (`reserve` query) + The Graph Subgraph

**Attributes**:
- `underlyingAsset` (string, required, unique per market): Token contract address
  - Validation: 0x + 40 hex characters, normalized to lowercase
- `symbol` (string, required): Token symbol (e.g., "USDC", "WETH")
- `name` (string, required): Token full name
- `decimals` (number, required, 0-18): Token decimals
- `imageUrl` (string, optional): Token icon URL
- `marketKey` (string, required): Reference to Market
- `currentState` (object, required):
  - `suppliedTokens` (BigNumber): Total supplied tokens (raw onchain value)
  - `borrowedTokens` (BigNumber): Total borrowed tokens (raw onchain value)
  - `availableLiquidity` (BigNumber): Available liquidity (raw onchain value)
  - `supplyAPR` (number): Current supply APR (protocol only, as decimal, e.g., 0.05 for 5%)
  - `borrowAPR` (number): Current borrow APR (protocol only, as decimal)
  - `utilizationRate` (number): Utilization rate (0-1, as decimal)
  - `oraclePrice` (number): Oracle price in USD
  - `totalSuppliedUSD` (number): Total supplied in USD
  - `totalBorrowedUSD` (number): Total borrowed in USD
- `indices` (object, optional, for historical calculations):
  - `liquidityIndex` (BigNumber): Current liquidity index
  - `variableBorrowIndex` (BigNumber): Current variable borrow index
- `lastUpdateTimestamp` (number, optional): Last update timestamp (Unix seconds)

**Relationships**:
- Belongs to: `Market`
- Has many: `Snapshot` (daily, monthly)
- Has one: `LiquidityImpactScenario[]` (calculated, not stored)

**State**: Dynamic (updated every 30-60 seconds from AaveKit)

**Validation Rules**:
- Address must be valid Ethereum address format
- Decimals must be between 0 and 18
- APR values must be non-negative
- Utilization rate must be between 0 and 1
- Price must be positive

### Snapshot

Represents the state of an asset at a specific point in time (daily or monthly).

**Source**: The Graph Subgraph (queried at specific block number)

**Attributes**:
- `underlyingAsset` (string, required): Token address (normalized lowercase)
- `marketKey` (string, required): Market identifier
- `date` (string, required): Date in ISO format (YYYY-MM-DD)
- `blockNumber` (number, required): Ethereum block number
- `blockTimestamp` (number, required): Block timestamp (Unix seconds)
- `type` (enum, required): "daily" | "monthly"
- `metrics` (object, required):
  - `totalATokenSupply` (BigNumber): Total aToken supply (raw)
  - `availableLiquidity` (BigNumber): Available liquidity (raw)
  - `totalCurrentVariableDebt` (BigNumber): Variable debt (raw)
  - `totalPrincipalStableDebt` (BigNumber): Stable debt (raw, may be 0)
  - `liquidityIndex` (BigNumber): Liquidity index at snapshot
  - `variableBorrowIndex` (BigNumber): Variable borrow index at snapshot
  - `liquidityRate` (number): Liquidity rate (as decimal)
  - `variableBorrowRate` (number): Variable borrow rate (as decimal)
  - `utilizationRate` (number): Utilization rate (0-1, as decimal)
  - `priceUSD` (number): Price in USD (calculated: priceInEth / 1e8)
  - `suppliedTokens` (number): Supplied tokens (calculated, human-readable)
  - `borrowedTokens` (number): Borrowed tokens (calculated, human-readable)
  - `totalSuppliedUSD` (number): Total supplied in USD
  - `totalBorrowedUSD` (number): Total borrowed in USD

**Relationships**:
- Belongs to: `Asset/Reserve`
- Used for: Historical APR calculations, trend charts

**State**: Immutable (historical data, doesn't change)

**Validation Rules**:
- Date must be valid ISO date string
- Block number must be positive integer
- All BigNumber values must be non-negative
- Price must be positive
- Utilization rate must be between 0 and 1

### MarketTotals

Aggregated metrics across all assets in a market.

**Source**: Calculated from Asset/Reserve entities

**Attributes**:
- `marketKey` (string, required): Market identifier
- `timestamp` (number, required): Calculation timestamp (Unix seconds)
- `totalSupply` (number, required): Total supplied across all assets (USD)
- `supply` (number, required): Available liquidity across all assets (USD)
- `borrowing` (number, required): Total borrowed across all assets (USD)
- `assetCount` (number, required): Number of assets in market

**Relationships**:
- Belongs to: `Market` (1:1)

**State**: Calculated on-demand (cached 30-60 seconds)

**Validation Rules**:
- All USD values must be non-negative
- Asset count must be positive
- Total supply >= borrowing (logical constraint)

### LiquidityImpactScenario

Represents a hypothetical transaction and its calculated impact.

**Source**: Calculated on-demand (not stored)

**Attributes**:
- `underlyingAsset` (string, required): Token address
- `marketKey` (string, required): Market identifier
- `action` (enum, required): "Deposit" | "Borrow" | "Repay" | "Withdraw"
- `amountUSD` (number, required): Transaction amount in USD (e.g., 100000000 for $100M)
- `currentState` (object, required): Current asset state before scenario
- `projectedState` (object, required): Projected state after scenario
  - `newUtilization` (number): New utilization rate (0-1)
  - `newSupplyAPR` (number): New supply APR (as decimal)
  - `newBorrowAPR` (number): New borrow APR (as decimal)
  - `deltaUtilization` (number): Change in utilization (as decimal, e.g., 0.05 for +5%)
  - `deltaSupplyAPR` (number): Change in supply APR (as decimal)
  - `deltaBorrowAPR` (number): Change in borrow APR (as decimal)

**Relationships**:
- Belongs to: `Asset/Reserve` (calculated, not stored)

**State**: Ephemeral (calculated on-demand, not persisted)

**Validation Rules**:
- Amount must be positive
- Utilization must remain between 0 and 1
- APR values must be non-negative

## Derived/Computed Entities

### AverageLendingRates

Calculated average APR over time periods.

**Source**: Calculated from Snapshot entities

**Attributes**:
- `underlyingAsset` (string, required)
- `marketKey` (string, required)
- `periods` (object, required):
  - `1d` (number | null): Average APR over 1 day
  - `7d` (number | null): Average APR over 7 days
  - `30d` (number | null): Average APR over 30 days
  - `6m` (number | null): Average APR over 6 months
  - `1y` (number | null): Average APR over 1 year
- `supplyAPR` (object, required): Supply APR averages by period
- `borrowAPR` (object, required): Borrow APR averages by period

**Calculation**: Uses index-based formula from spec-temp.md Section 5.4

**State**: Calculated on-demand (cached 6-24 hours)

### MarketTrends

Market-level supply/borrow changes over time.

**Source**: Calculated from Snapshot entities aggregated by market

**Attributes**:
- `marketKey` (string, required)
- `date` (string, required): Date in ISO format
- `totalSuppliedUSD` (number, required)
- `totalBorrowedUSD` (number, required)
- `change1d` (object, optional): Change over 1 day
  - `supplied` (number): Change in supplied (USD)
  - `borrowed` (number): Change in borrowed (USD)
  - `suppliedPercent` (number): Percentage change
  - `borrowedPercent` (number): Percentage change
- `change7d` (object, optional): Change over 7 days
- `change30d` (object, optional): Change over 30 days

**State**: Calculated on-demand (cached 6-24 hours)

## Configuration Entities

### StablecoinDefinition

Defines which tokens are considered stablecoins.

**Source**: Configuration file (`data/stablecoins.json`)

**Attributes**:
- `symbol` (string, required): Token symbol
- `address` (string, required): Token address (normalized lowercase)
- `markets` (string[], required): Market keys where this stablecoin exists

**State**: Static (loaded from config)

### LiquidityImpactScenarioConfig

Configuration for liquidity impact scenarios.

**Source**: Configuration file (`data/liquidityImpactScenarios.json`)

**Attributes**:
- `default` (array, required): Default scenarios
  - `action` (enum): "Deposit" | "Borrow" | "Repay" | "Withdraw"
  - `amount` (string): Amount in USD (e.g., "100000000" for $100M)
- `overrides` (object, optional): Per-market or per-asset overrides
  - Key format: `"{marketKey}/{assetAddress}"` or `"{marketKey}"`
  - Value: Array of scenarios (same structure as default)

**State**: Static (loaded from config)

## Data Flow

### Live Data Flow

1. User requests market/asset page
2. BFF API route calls AaveKit GraphQL
3. Data transformed to Asset/Reserve entities
4. Cached (TTL: 30-60 seconds)
5. Returned to client

### Historical Data Flow

1. User requests historical data (snapshots, trends)
2. BFF API route determines required date range
3. For each date: resolve timestamp → blockNumber via RPC
4. Query The Graph Subgraph at specific block
5. Transform to Snapshot entities
6. Calculate derived metrics (APR, totals)
7. Cache results (TTL: 6-24 hours)
8. Return to client

### Liquidity Impact Flow

1. User requests liquidity impact
2. BFF API route loads current asset state
3. Load scenario config
4. For each scenario: calculate projected state
5. Return calculated scenarios (not cached, recalculated each time)

## Validation Rules Summary

### Address Validation
- Format: `0x` + 40 hex characters (case-insensitive)
- Normalization: Always stored and compared in lowercase
- Validation: zod schema `z.string().regex(/^0x[a-f0-9]{40}$/i).transform(s => s.toLowerCase())`

### Market Key Validation
- Format: lowercase, kebab-case
- Validation: Must exist in `markets.json`
- zod schema: `z.string().refine(key => markets.includes(key))`

### BigNumber Handling
- All onchain integer values stored as BigNumber (big.js or decimal.js)
- Conversion to human-readable: divide by `10^decimals`
- Calculations: Use BigNumber operations, not JavaScript numbers

### Date/Time Validation
- Dates: ISO format (YYYY-MM-DD)
- Timestamps: Unix seconds (number)
- Block numbers: Positive integers

## Data Integrity Constraints

1. **Market uniqueness**: `marketKey` must be unique across all markets
2. **Asset uniqueness**: `underlyingAsset + marketKey` must be unique
3. **Snapshot uniqueness**: `underlyingAsset + marketKey + date + type` must be unique
4. **Logical constraints**:
   - `totalSupply >= borrowing` (market totals)
   - `utilizationRate = borrowed / (borrowed + available)` (for assets)
   - `priceUSD > 0` (all prices must be positive)

## Error Handling

### Missing Data
- Return partial data with inline "Insufficient data" message
- Never return null/undefined for required fields (use defaults or skip entity)

### Invalid Data
- Validate all inputs with zod schemas
- Return 400 for invalid format
- Return 404 for not found (invalid market/asset)

### Calculation Errors
- Log errors with context
- Return "Insufficient data" message to user
- Never crash on calculation errors
