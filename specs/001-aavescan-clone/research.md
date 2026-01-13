# Research & Technical Decisions

**Feature**: Aavescan Clone - Aave Protocol Analytics Platform  
**Date**: 2026-01-11  
**Phase**: 0 - Research & Discovery

## Overview

This document consolidates research findings and technical decisions made during the planning phase. All decisions align with the project constitution and spec-temp.md requirements.

## Technology Stack Decisions

### Frontend Framework

**Decision**: Next.js 14+ with App Router

**Rationale**:
- Required by constitution (Section 9.1)
- App Router provides server components and API routes for BFF layer
- Built-in TypeScript support
- Excellent performance and SEO capabilities
- Server-side rendering for fast initial page loads

**Alternatives considered**:
- Remix: Similar capabilities but less ecosystem maturity
- Vite + React: Would require separate backend setup, violates BFF integration requirement

### UI Framework

**Decision**: TailwindCSS + shadcn/ui (Radix-based) or minimal custom primitives

**Rationale**:
- TailwindCSS required by constitution
- shadcn/ui provides accessible, unstyled components (Radix-based)
- Minimal bundle size impact
- Custom primitives acceptable if shadcn/ui is too heavy

**Alternatives considered**:
- Material-UI: Too heavy, violates "не тащить тяжёлые UI‑фреймворки"
- Chakra UI: Similar concerns about bundle size

### Data Tables

**Decision**: TanStack Table v8+

**Rationale**:
- Required by constitution (Section 9.1)
- Excellent sorting, filtering, and virtualization capabilities
- Headless design allows full UI control
- TypeScript-first

**Alternatives considered**: None (constitution requirement)

### Charting Library

**Decision**: Apache ECharts

**Rationale**:
- Required by constitution (Section 8.5)
- Recharts explicitly forbidden
- Powerful visualization capabilities
- Good TypeScript support
- Handles large datasets efficiently

**Alternatives considered**: None (constitution requirement)

### Data Validation

**Decision**: zod

**Rationale**:
- Required by constitution (Section 9.1)
- TypeScript-first validation
- Runtime type safety
- Excellent error messages

### Big Number Operations

**Decision**: big.js or decimal.js

**Rationale**:
- Required by constitution (Section 9.1)
- Needed for precise calculations with onchain integers
- Avoids JavaScript float precision issues
- Both libraries support division, exponentiation, and decimal operations

**Decision needed**: Choose between big.js (smaller) or decimal.js (more features). Recommendation: Start with big.js, migrate to decimal.js if more advanced features needed.

## Architecture Decisions

### BFF Layer Implementation

**Decision**: Next.js API Routes (server-side)

**Rationale**:
- Constitution requires BFF layer (Section 9.2)
- Next.js API routes provide server-side execution
- No separate backend service needed
- Integrated with frontend for optimal performance
- API keys stay server-side only

**Implementation pattern**:
- `/app/api/v1/*` routes for all BFF endpoints
- Server components for data fetching in pages
- Client components only for interactive UI

### Caching Strategy

**Decision**: In-memory LRU cache with optional persistence

**Rationale**:
- Constitution requires server-side caching (Section 5.1)
- LRU eviction when max size (1000 entries) reached
- TTL: 30-60s for live data, 6-24h for historical
- Optional file/KV persistence for production resilience

**Implementation**:
- Use `lru-cache` npm package
- Separate cache instances per data type
- Stale-if-error pattern for resilience

### Error Handling & Retry

**Decision**: Exponential backoff with 3 attempts

**Rationale**:
- Constitution requires retry on 429/5xx (Section 5.2)
- Intervals: 1s, 2s, 4s
- Return stale cache if available after all attempts
- Log all retry attempts at WARN level

**Implementation**:
- Custom retry utility with exponential backoff
- Integrate with cache for stale-if-error
- Proper error logging and monitoring

### RPC Failover

**Decision**: Sequential failover through RPC list

**Rationale**:
- Constitution requires RPC failover (Section 5.3)
- Priority list: drpc.org, llamarpc.com, ankr.com, publicnode.com
- cloudflare-eth.com as last resort (known unstable)
- Log which RPC used and which failed

**Implementation**:
- RPC client with failover logic
- Binary search for timestamp → block conversion
- Proper error handling and logging

## Data Source Integration

### AaveKit GraphQL

**Decision**: Use official AaveKit GraphQL API

**Rationale**:
- Constitution whitelist (Section 2.1)
- Provides current market/asset state
- Verified schema available
- TimeWindow enum confirmed: LAST_DAY, LAST_WEEK, LAST_MONTH, LAST_SIX_MONTHS, LAST_YEAR

**Implementation**:
- GraphQL client (graphql-request or Apollo)
- Codegen for TypeScript types
- Schema introspection stored in `schema/aavekit_schema.json`

### The Graph Subgraph

**Decision**: Use The Graph Gateway with Aave V3 subgraph

**Rationale**:
- Constitution whitelist (Section 2.1)
- Provides historical snapshots
- Verified subgraph ID for Ethereum V3: `Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g`
- Critical invariant: Pool.id ≠ Pool.pool (Section 3.1)

**Implementation**:
- GraphQL client for subgraph queries
- Pool mapping: `pools(where: { pool: <poolAddress> })` → `Pool.id`
- Reserve queries: `reserves(where: { pool: <Pool.id> }, block: { number })`
- Schema introspection stored in `schema/aave_subgraph_schema.json`

### Ethereum RPC

**Decision**: Use failover RPC list for block resolution

**Rationale**:
- Constitution whitelist (Section 2.1)
- Needed for timestamp → blockNumber conversion
- Binary search algorithm for accuracy

**Implementation**:
- RPC client with failover
- Binary search: estimate → bracket → search
- Cache block numbers for 24 hours

## Calculation Formulas

### APR from Indices

**Decision**: Use index-based calculation (not current rates)

**Rationale**:
- Spec-temp.md Section 5.4 requires index-based calculation
- Formula: `dailyGrowth = (indexNow / indexStart)^(1/N)`, `APR = (dailyGrowth - 1) * 365`
- Handles arbitrary time intervals correctly

**Implementation**:
- Use big.js/decimal.js for precision
- Handle missing data (max 2 days gap, else "Insufficient data")

### Total Values

**Decision**: Follow Aavescan API docs formulas

**Rationale**:
- Spec-temp.md Section 5.3 references Aavescan formulas
- Price base: USD x 1e8 (verified for Ethereum V3)
- Formulas: `priceUSD = price.priceInEth / 1e8`, `totalSuppliedUSD = suppliedTokens * priceUSD`

**Implementation**:
- Big number operations for all calculations
- Proper decimal handling (divide by 10^decimals)

### Liquidity Impact

**Decision**: Use Aave protocol formulas for utilization and rates

**Rationale**:
- Spec-temp.md Section 5.5 requires standard Aave formulas
- Calculate new utilization after scenario
- Apply Aave rate curve based on utilization and reserve parameters

**Implementation**:
- Extract reserve parameters (optimalUtilization, baseRate, slope1, slope2)
- Calculate new utilization: `newUtil = newDebt / (newDebt + newAvailable)`
- Apply rate formula based on utilization zone

## Configuration Management

### Market Configuration

**Decision**: JSON files with Playwright scraper

**Rationale**:
- Spec-temp.md Section 7 requires scraping aavescan.com
- Structure: `{ marketKey, displayName, poolAddress, subgraphId, chainId, rpcUrls }`
- Version controlled, manually updated when needed

**Implementation**:
- `scripts/scrape-aavescan.ts` using Playwright
- Output: `data/markets.json`
- Command: `pnpm scrape-aavescan`

### Stablecoins Configuration

**Decision**: JSON file with market associations

**Rationale**:
- Spec-temp.md Section 7.1 requires stablecoins list
- Structure: `{ symbol, address, markets[] }`
- Scraped from aavescan.com/stablecoins

### Liquidity Impact Scenarios

**Decision**: JSON file with default and overrides

**Rationale**:
- Spec-temp.md Section 7.1 requires scenario definitions
- Structure: `{ default: [{ action, amount }], overrides: { "market/asset": [...] } }`
- Actions: Deposit, Borrow, Repay, Withdraw
- Amounts: 100M, 250M, 500M, 1B

## Testing Strategy

### Unit Tests

**Decision**: Vitest or Jest

**Rationale**:
- Constitution requires unit tests (Section 7.1)
- Test: decimals conversion, USD conversion, APR calculations, sorting, formatting
- Fast execution, good TypeScript support

### Integration Tests

**Decision**: Next.js API route testing

**Rationale**:
- Test BFF endpoints with mocked external APIs
- Test error handling, caching, rate limiting
- Use MSW (Mock Service Worker) for API mocking

### E2E Tests

**Decision**: Playwright

**Rationale**:
- Constitution requires E2E smoke tests (Section 7.3)
- Test: `/ethereum-v3`, `/stablecoins`, `/ethereum-v3/<asset>`
- Performance verification (< 3 seconds)

### Preflight Checks

**Decision**: Custom script (`pnpm preflight`)

**Rationale**:
- Constitution requires preflight (Section 4.1)
- Verify: AaveKit access, Subgraph access, RPC failover, pool mapping
- Generate report artifact

## Security Considerations

### API Key Management

**Decision**: Environment variables only

**Rationale**:
- Constitution requires secure storage (Section 10.1)
- Never log secrets
- Use Vercel Environment Variables in production
- Rotate if exposed

### Input Validation

**Decision**: zod schemas for all inputs

**Rationale**:
- Constitution requires validation (Section 10.2)
- Validate: addresses (0x + 40 hex), market keys (against markets.json)
- Return 400 with clear message on invalid input

### Rate Limiting

**Decision**: IP-based rate limiting

**Rationale**:
- Constitution requires rate limiting (Section 10.3)
- Limits: 100 req/min (live), 20 req/min (historical)
- Return 429 with Retry-After header

## Performance Optimizations

### Code Splitting

**Decision**: Next.js automatic code splitting + manual optimization

**Rationale**:
- Reduce initial bundle size
- Lazy load chart libraries (ECharts) on demand
- Route-based splitting via App Router

### Data Fetching

**Decision**: Server components + streaming where possible

**Rationale**:
- Next.js App Router supports streaming
- Server components reduce client-side data fetching
- Improve Time to First Byte (TTFB)

### Caching Strategy

**Decision**: Multi-layer caching

**Rationale**:
- Server-side LRU cache (fast access)
- HTTP cache headers for static data
- Stale-if-error for resilience

## Accessibility

**Decision**: WCAG 2.1 AA compliance (deferred to implementation)

**Rationale**:
- Responsive design required (clarification session)
- shadcn/ui (Radix) provides accessible primitives
- Specific accessibility requirements to be defined in implementation phase

## Open Questions Resolved

All questions from specification clarification session have been resolved:
1. ✅ Error display: Inline messages with graceful degradation
2. ✅ Invalid URL handling: 404 error page
3. ✅ CSV format: Standard (comma, UTF-8, ISO dates)
4. ✅ Data refresh: Manual only (F5/refresh button)
5. ✅ Mobile support: Responsive design

## Next Steps

1. Create data model (Phase 1)
2. Generate API contracts (Phase 1)
3. Create quickstart guide (Phase 1)
4. Update agent context (Phase 1)
5. Generate tasks (Phase 2)
