# Implementation Plan: Aavescan Clone - Aave Protocol Analytics Platform

**Branch**: `001-aavescan-clone` | **Date**: 2026-01-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-aavescan-clone/spec.md`

## Summary

Build a web-based analytics platform for Aave protocol data, providing market overviews, asset details, historical trends, and data export capabilities. The platform clones the UX/UI structure of aavescan.com while excluding Pro features and incentive-related data. Implementation uses Next.js App Router with TypeScript, server-side BFF layer for data aggregation, and client-side visualization components.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+  
**Primary Dependencies**: 
- Next.js 14+ (App Router)
- TailwindCSS
- TanStack Table (v8+)
- Apache ECharts
- zod (validation)
- big.js or decimal.js (big number operations)
- shadcn/ui or minimal custom UI primitives (Radix-based)

**Storage**: 
- In-memory LRU cache (server-side, max 1000 entries per data type)
- Optional: file-based or KV store for cache persistence
- Configuration files: `data/markets.json`, `data/stablecoins.json`, `data/liquidityImpactScenarios.json`
- Schema files: `schema/aavekit_schema.json`, `schema/aave_subgraph_schema.json`

**Testing**: 
- Unit: Vitest or Jest
- Integration: Next.js API route testing
- E2E: Playwright
- Preflight: Custom script (`pnpm preflight`)

**Target Platform**: 
- Web browsers (desktop and mobile, responsive design)
- Server: Node.js runtime (Vercel, or similar)

**Project Type**: Web application (Next.js monorepo with App Router)

**Performance Goals**: 
- Page load: < 3 seconds (SC-001, SC-002)
- CSV export: < 5 seconds (SC-003)
- API response: < 500ms for live data, < 2s for historical data

**Constraints**: 
- BFF layer mandatory (no client-side external API calls)
- Server-side caching required (TTL: 30-60s live, 6-24h historical)
- Rate limiting: 100 req/min (live), 20 req/min (historical) per IP
- Retry with exponential backoff (max 3 attempts: 1s, 2s, 4s)
- Manual page refresh only (no auto-refresh)

**Scale/Scope**: 
- Initial: Ethereum V3 market (~60 assets)
- Expandable: Additional markets via configuration
- Users: Public web application (no authentication)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gates

- ✅ **Source of Truth**: spec-temp.md is the authoritative source (referenced in spec)
- ✅ **No Invention Policy**: All API endpoints, GraphQL fields, formulas from spec-temp.md
- ✅ **Data Sources Whitelist**: Only AaveKit GraphQL, The Graph Gateway, Ethereum RPC (failover list)
- ✅ **BFF Layer**: All external API calls through server-side routes (Next.js API routes)
- ✅ **Stack Compliance**: Next.js App Router, TypeScript, TailwindCSS, TanStack Table, Apache ECharts, zod, big.js/decimal.js
- ✅ **Pro/Incentives Exclusion**: No user registration, no incentive data display
- ✅ **Export Format**: CSV only (no PNG/JPEG), standard format (comma, UTF-8, ISO dates)

### Post-Phase 1 Re-check

**Status**: ✅ All gates passed

- ✅ **BFF Layer**: All API routes defined in `/app/api/v1/` structure (server-side only)
- ✅ **Data Sources**: Only whitelisted sources used (AaveKit, The Graph, RPC failover)
- ✅ **Stack Compliance**: Next.js App Router, TypeScript, TailwindCSS, TanStack Table, Apache ECharts, zod, big.js/decimal.js
- ✅ **Schema Lock**: Schema files defined in project structure (`schema/aavekit_schema.json`, `schema/aave_subgraph_schema.json`)
- ✅ **Codegen**: TypeScript types generation planned (`lib/types/generated/`)
- ✅ **Cache Strategy**: In-memory LRU cache with TTL as per constitution
- ✅ **Retry/Backoff**: Exponential backoff (3 attempts, 1s/2s/4s) defined in research
- ✅ **RPC Failover**: Sequential failover through priority list defined
- ✅ **No Pro/Incentives**: Not included in API contracts or data model
- ✅ **Export Format**: CSV only, standard format (comma, UTF-8, ISO dates)

## Project Structure

### Documentation (this feature)

```text
specs/001-aavescan-clone/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── bff-api.openapi.yaml
│   └── graphql-schemas/
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Next.js App Router structure
app/
├── (routes)/
│   ├── [marketKey]/
│   │   ├── page.tsx                    # Market overview
│   │   ├── [assetAddress]/
│   │   │   └── page.tsx                # Asset details
│   │   ├── supply-change/
│   │   │   └── page.tsx                # Supply trends
│   │   └── borrow-change/
│   │       └── page.tsx                # Borrow trends
│   ├── stablecoins/
│   │   └── page.tsx                    # Stablecoins view
│   └── api/
│       └── page.tsx                     # API documentation
├── api/
│   └── v1/
│       ├── markets/
│       │   └── route.ts                 # GET /api/v1/markets
│       ├── market/
│       │   ├── [marketKey]/
│       │   │   ├── route.ts             # GET /api/v1/market/{marketKey}
│       │   │   └── timeseries/
│       │   │       └── route.ts         # GET /api/v1/market/{marketKey}/timeseries
│       │   └── [marketKey]/
│       │       └── [assetAddress]/
│       │           └── route.ts         # GET /api/v1/reserve/{marketKey}/{assetAddress}
│       └── reserve/
│           └── [marketKey]/
│               └── [assetAddress]/
│                   ├── route.ts        # GET /api/v1/reserve/{marketKey}/{assetAddress}
│                   └── snapshots/
│                       ├── daily/
│                       │   ├── route.ts # GET /api/v1/reserve/.../snapshots/daily
│                       │   └── route.csv.ts # GET /api/v1/reserve/.../snapshots/daily.csv
│                       ├── monthly/
│                       │   ├── route.ts
│                       │   └── route.csv.ts
│                       └── liquidity-impact/
│                           └── route.ts
├── components/
│   ├── ui/                              # shadcn/ui or custom primitives
│   ├── charts/                          # ECharts wrappers
│   ├── tables/                          # TanStack Table wrappers
│   └── layout/
├── lib/
│   ├── api/
│   │   ├── aavekit.ts                   # AaveKit GraphQL client
│   │   ├── subgraph.ts                  # The Graph client
│   │   └── rpc.ts                       # Ethereum RPC client (failover)
│   ├── cache/
│   │   └── lru-cache.ts                 # Server-side LRU cache
│   ├── calculations/
│   │   ├── apr.ts                       # APR calculations from indices
│   │   ├── totals.ts                    # Market/asset totals
│   │   └── liquidity-impact.ts          # Liquidity impact scenarios
│   ├── utils/
│   │   ├── address.ts                   # Address normalization
│   │   ├── big-number.ts                # Big number operations
│   │   └── block-resolver.ts            # Timestamp → block number
│   └── types/
│       └── generated/                   # GraphQL codegen types
├── data/
│   ├── markets.json                     # Market configurations
│   ├── stablecoins.json                 # Stablecoin definitions
│   └── liquidityImpactScenarios.json    # Scenario configurations
├── schema/
│   ├── aavekit_schema.json              # AaveKit GraphQL introspection
│   └── aave_subgraph_schema.json        # Aave Subgraph introspection
├── scripts/
│   ├── scrape-aavescan.ts               # Playwright scraper for configs
│   └── preflight.ts                     # Preflight checks
└── tools/
    └── apps-script/                     # Reference Apps Script code
        └── Code.gs

tests/
├── unit/
│   ├── calculations/
│   ├── utils/
│   └── cache/
├── integration/
│   └── api/
└── e2e/
    └── smoke/
```

**Structure Decision**: Next.js App Router monorepo structure. Frontend and backend (BFF) are integrated in the same Next.js application using App Router's server components and API routes. This aligns with the constitution requirement for a BFF layer while maintaining a single codebase.

## Complexity Tracking

> **No constitution violations identified. All architectural choices align with constitution principles.**
