# Quick Start Guide

**Feature**: Aavescan Clone - Aave Protocol Analytics Platform  
**Date**: 2026-01-11

## Prerequisites

- Node.js 18+ and npm/pnpm
- Access to AaveKit GraphQL API (public, no auth required)
- The Graph API key (for subgraph access)
- Git repository initialized

## Initial Setup

### 1. Install Dependencies

```bash
# Install project dependencies
pnpm install

# Or with npm
npm install
```

### 2. Environment Variables

Create `.env.local` file in repository root:

```env
# AaveKit GraphQL (public, no key needed)
AAVEKIT_GRAPHQL_URL=https://api.v3.aave.com/graphql

# The Graph Gateway
GRAPH_API_KEY=your_graph_api_key_here
AAVE_SUBGRAPH_ID=Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g

# Ethereum RPC (comma-separated, failover order)
ETH_RPC_URLS=https://eth.drpc.org,https://eth.llamarpc.com,https://rpc.ankr.com/eth,https://ethereum-rpc.publicnode.com

# Optional: Cache configuration
CACHE_TTL_LIVE=60
CACHE_TTL_SNAPSHOTS=21600
CACHE_MAX_SIZE=1000
LOG_LEVEL=info
```

### 3. Generate Configuration Files

Run the Playwright scraper to generate market configurations:

```bash
pnpm scrape-aavescan
```

This creates:
- `data/markets.json` - Market configurations
- `data/stablecoins.json` - Stablecoin definitions
- `data/liquidityImpactScenarios.json` - Scenario configurations

### 4. Generate GraphQL Types

Extract and store GraphQL schemas:

```bash
# Extract AaveKit schema
pnpm extract-aavekit-schema

# Extract Aave Subgraph schema
pnpm extract-subgraph-schema
```

Generate TypeScript types:

```bash
pnpm codegen
```

This creates types in `lib/types/generated/`.

### 5. Run Preflight Checks

Verify all data sources and configurations:

```bash
pnpm preflight
```

Expected output: `✓ All checks passed`

## Development

### Start Development Server

```bash
pnpm dev
```

Application will be available at `http://localhost:3000`

### Available Routes

- `/ethereum-v3` - Market overview
- `/ethereum-v3/0x...` - Asset details (replace with actual address)
- `/stablecoins` - Stablecoins view
- `/ethereum-v3/supply-change` - Supply trends
- `/ethereum-v3/borrow-change` - Borrow trends
- `/api` - API documentation

### BFF API Endpoints

- `GET /api/v1/markets` - List markets
- `GET /api/v1/market/{marketKey}` - Market data
- `GET /api/v1/market/{marketKey}/timeseries?window=30d` - Market time series
- `GET /api/v1/reserve/{marketKey}/{underlying}` - Reserve data
- `GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/daily?days=90` - Daily snapshots
- `GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/daily.csv?days=90` - CSV export

## Testing

### Unit Tests

```bash
pnpm test:unit
```

Tests cover:
- Calculations (APR, totals, conversions)
- Utilities (address normalization, block resolution)
- Cache operations

### Integration Tests

```bash
pnpm test:integration
```

Tests cover:
- BFF API endpoints
- Error handling
- Caching behavior
- Rate limiting

### E2E Tests

```bash
pnpm test:e2e
```

Smoke tests:
- Market page load
- Stablecoins page
- Asset detail page

## Building for Production

### Build

```bash
pnpm build
```

### Start Production Server

```bash
pnpm start
```

### Environment Variables for Production

Ensure all environment variables are set in your hosting platform (e.g., Vercel Environment Variables):

- `GRAPH_API_KEY` - Must be set
- `AAVE_SUBGRAPH_ID` - Default provided, override if needed
- `ETH_RPC_URLS` - Comma-separated list

## Project Structure

```
app/                    # Next.js App Router pages
├── (routes)/          # Route groups
│   ├── [marketKey]/   # Market pages
│   └── stablecoins/   # Stablecoins page
├── api/               # BFF API routes
│   └── v1/            # API v1 endpoints
└── components/         # React components
    ├── ui/            # UI primitives
    ├── charts/        # ECharts wrappers
    └── tables/        # TanStack Table wrappers

lib/                   # Shared libraries
├── api/               # External API clients
├── cache/             # Caching utilities
├── calculations/      # Business logic
└── utils/             # Helper functions

data/                  # Configuration files
schema/                # GraphQL schemas
scripts/               # Utility scripts
tests/                 # Test files
```

## Key Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Testing
pnpm test             # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests
pnpm test:e2e         # E2E tests

# Code Quality
pnpm lint             # Lint code
pnpm type-check       # TypeScript type checking

# Utilities
pnpm preflight        # Run preflight checks
pnpm scrape-aavescan  # Generate configs
pnpm codegen          # Generate GraphQL types
```

## Troubleshooting

### Preflight Fails

If preflight checks fail:

1. Verify `GRAPH_API_KEY` is set correctly
2. Check network connectivity to AaveKit and The Graph
3. Verify RPC endpoints are accessible
4. Check that `AAVE_SUBGRAPH_ID` is correct for your target network

### API Errors

If BFF API returns errors:

1. Check server logs for detailed error messages
2. Verify external API availability (AaveKit, The Graph)
3. Check cache status (may be serving stale data)
4. Verify rate limits aren't exceeded

### Data Not Loading

If pages show "Insufficient data":

1. Check that market configuration exists in `data/markets.json`
2. Verify subgraph is synced (check `_meta.hasIndexingErrors`)
3. Check RPC endpoints for block resolution
4. Verify asset addresses are correct (lowercase, valid format)

## Next Steps

1. Review [data-model.md](./data-model.md) for entity definitions
2. Review [contracts/bff-api.openapi.yaml](./contracts/bff-api.openapi.yaml) for API details
3. Run `/speckit.tasks` to generate implementation tasks
4. Start implementing features following the task breakdown

## Resources

- [Specification](./spec.md) - Feature requirements
- [Research](./research.md) - Technical decisions
- [Data Model](./data-model.md) - Entity definitions
- [API Contract](./contracts/bff-api.openapi.yaml) - OpenAPI specification
- [Constitution](../../.specify/memory/constitution.md) - Project principles
