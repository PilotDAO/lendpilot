# Tasks: Aavescan Clone - Aave Protocol Analytics Platform

**Input**: Design documents from `/specs/001-aavescan-clone/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Tests are included as per constitution requirements (Section 7)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3])
- Include exact file paths in descriptions

## Path Conventions

- **Next.js App Router**: `app/`, `lib/`, `data/`, `schema/`, `scripts/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create Next.js project with App Router in repository root
- [X] T002 [P] Configure TypeScript with strict mode in tsconfig.json
- [X] T003 [P] Install and configure TailwindCSS in tailwind.config.ts
- [X] T004 [P] Install dependencies: TanStack Table, Apache ECharts, zod, big.js (or decimal.js)
- [X] T005 [P] Setup shadcn/ui or create minimal UI primitives directory in app/components/ui/
- [X] T006 [P] Configure ESLint and Prettier in .eslintrc.json and .prettierrc
- [X] T007 [P] Create directory structure: app/, lib/, data/, schema/, scripts/, tests/
- [X] T008 [P] Setup environment variable validation with zod in lib/config/env.ts
- [X] T009 Create .env.local.example with all required environment variables
- [X] T010 [P] Initialize git repository and create .gitignore for Next.js project

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### API Clients & External Integrations

- [X] T011 [P] Create AaveKit GraphQL client in lib/api/aavekit.ts with graphql-request
- [X] T012 [P] Create The Graph subgraph client in lib/api/subgraph.ts with graphql-request
- [X] T013 [P] Create Ethereum RPC client with failover logic in lib/api/rpc.ts
- [X] T014 [P] Implement RPC failover: sequential retry through RPC list in lib/api/rpc.ts
- [X] T015 [P] Implement binary search for timestamp → blockNumber in lib/utils/block-resolver.ts
- [X] T016 [P] Extract and store AaveKit GraphQL schema in schema/aavekit_schema.json
- [X] T017 [P] Extract and store Aave Subgraph schema in schema/aave_subgraph_schema.json
- [X] T018 [P] Setup GraphQL codegen to generate TypeScript types in lib/types/generated/
- [X] T019 [P] Configure codegen for AaveKit schema in codegen-aavekit.yml
- [X] T020 [P] Configure codegen for Aave Subgraph schema in codegen-subgraph.yml

### Caching Infrastructure

- [X] T021 [P] Implement LRU cache wrapper in lib/cache/lru-cache.ts using lru-cache package
- [X] T022 [P] Create cache instances per data type (live, snapshots, mappings) in lib/cache/cache-instances.ts
- [X] T023 [P] Implement stale-if-error pattern in lib/cache/cache-instances.ts
- [X] T024 [P] Add cache TTL configuration from environment variables in lib/cache/cache-instances.ts

### Utilities & Helpers

- [X] T025 [P] Implement address normalization utility in lib/utils/address.ts (lowercase, validation)
- [X] T026 [P] Create BigNumber utility wrapper in lib/utils/big-number.ts (big.js or decimal.js)
- [X] T027 [P] Implement address validation with zod schema in lib/utils/address.ts
- [X] T028 [P] Create market key validation utility in lib/utils/market.ts (check against markets.json)

### Calculation Modules

- [X] T029 [P] Implement APR calculation from indices in lib/calculations/apr.ts (index-based formula)
- [X] T030 [P] Implement market/asset totals calculation in lib/calculations/totals.ts
- [X] T031 [P] Implement price conversion (USDx1e8 → USD) in lib/calculations/totals.ts
- [X] T032 [P] Implement liquidity impact calculation in lib/calculations/liquidity-impact.ts

### Configuration & Data

- [X] T033 [P] Create Playwright scraper script in scripts/scrape-aavescan.ts
- [X] T034 [P] Implement markets.json generation in scripts/scrape-aavescan.ts
- [X] T035 [P] Implement stablecoins.json generation in scripts/scrape-aavescan.ts
- [X] T036 [P] Implement liquidityImpactScenarios.json generation in scripts/scrape-aavescan.ts
- [X] T037 [P] Create preflight check script in scripts/preflight.ts
- [X] T038 [P] Implement AaveKit connectivity check in scripts/preflight.ts
- [X] T039 [P] Implement Subgraph connectivity check in scripts/preflight.ts
- [X] T040 [P] Implement RPC failover check in scripts/preflight.ts
- [X] T041 [P] Implement pool mapping verification in scripts/preflight.ts

### Error Handling & Retry

- [X] T042 [P] Implement exponential backoff retry utility in lib/utils/retry.ts (3 attempts: 1s, 2s, 4s)
- [X] T043 [P] Create error response formatter in lib/utils/errors.ts (standard error format)
- [X] T044 [P] Implement rate limiting middleware in lib/middleware/rate-limit.ts (100/min live, 20/min historical)

### Testing Infrastructure

- [X] T045 [P] Setup Vitest or Jest configuration in vitest.config.ts or jest.config.js
- [X] T046 [P] Setup Playwright for E2E tests in playwright.config.ts
- [X] T047 [P] Create test utilities for mocking external APIs in tests/utils/mocks.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Market Overview (Priority: P1) 🎯 MVP

**Goal**: Users can view all assets in a market with key metrics, sortable table, and market totals summary

**Independent Test**: Navigate to `/ethereum-v3` and verify: all assets displayed in sortable table, key metrics shown, sorting works, page loads < 3 seconds

### Tests for User Story 1

- [X] T048 [P] [US1] Create unit test for market totals calculation in tests/unit/calculations/totals.test.ts
- [X] T049 [P] [US1] Create integration test for GET /api/v1/market/{marketKey} in tests/integration/api/market.test.ts
- [X] T050 [P] [US1] Create E2E smoke test for market page in tests/e2e/smoke/market-page.test.ts

### Implementation for User Story 1

- [X] T051 [US1] Implement GET /api/v1/markets endpoint in app/api/v1/markets/route.ts (read markets.json)
- [X] T052 [US1] Implement GET /api/v1/market/{marketKey} endpoint in app/api/v1/market/[marketKey]/route.ts
- [X] T053 [US1] Create AaveKit market query function in lib/api/aavekit.ts (markets query)
- [X] T054 [US1] Transform AaveKit response to Reserve entities in lib/api/aavekit.ts
- [X] T055 [US1] Calculate market totals from reserves in lib/calculations/totals.ts
- [X] T056 [US1] Implement address normalization in market endpoint (validate and normalize)
- [X] T057 [US1] Add caching for market data (TTL: 30-60s) in app/api/v1/market/[marketKey]/route.ts
- [X] T058 [US1] Add error handling (404 for invalid market, 503 for upstream errors) in app/api/v1/market/[marketKey]/route.ts
- [X] T059 [US1] Create market overview page component in app/(routes)/[marketKey]/page.tsx
- [X] T060 [US1] Create market totals summary component in app/components/market/MarketTotals.tsx
- [X] T061 [US1] Create reserves table component with TanStack Table in app/components/tables/ReservesTable.tsx
- [X] T062 [US1] Implement column sorting (ASC/DESC) in app/components/tables/ReservesTable.tsx
- [X] T063 [US1] Add responsive design for mobile devices in app/components/tables/ReservesTable.tsx
- [X] T064 [US1] Implement loading state with skeleton UI in app/(routes)/[marketKey]/page.tsx
- [X] T065 [US1] Implement error state with inline message in app/(routes)/[marketKey]/page.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Market overview page works with sortable table and totals.

---

## Phase 4: User Story 2 - View Asset Details (Priority: P1)

**Goal**: Users can view detailed asset information including current rates, historical charts, snapshots, and liquidity impact

**Independent Test**: Navigate to `/ethereum-v3/0xc02aaa...` and verify: top cards display, charts work, snapshots available, CSV export works, liquidity impact calculated

### Tests for User Story 2

- [X] T066 [P] [US2] Create unit test for APR calculation from indices in tests/unit/calculations/apr.test.ts
- [X] T067 [P] [US2] Create unit test for liquidity impact calculation in tests/unit/calculations/liquidity-impact.test.ts
- [X] T068 [P] [US2] Create integration test for GET /api/v1/reserve/{marketKey}/{underlying} in tests/integration/api/reserve.test.ts
- [X] T069 [P] [US2] Create integration test for snapshots endpoints in tests/integration/api/snapshots.test.ts
- [X] T070 [P] [US2] Create E2E smoke test for asset page in tests/e2e/smoke/asset-page.test.ts

### Implementation for User Story 2

- [X] T071 [US2] Implement GET /api/v1/reserve/{marketKey}/{underlying} endpoint in app/api/v1/reserve/[marketKey]/[underlying]/route.ts
- [X] T072 [US2] Create AaveKit reserve query function in lib/api/aavekit.ts (reserve query)
- [X] T073 [US2] Implement poolAddress → poolEntityId mapping in lib/api/subgraph.ts (pools query)
- [X] T074 [US2] Implement daily snapshot query from subgraph in lib/api/subgraph.ts (reserves at block)
- [X] T075 [US2] Implement monthly snapshot aggregation in lib/calculations/snapshots.ts
- [X] T076 [US2] Calculate average lending rates (1d/7d/30d/6m/1y) in lib/calculations/apr.ts
- [X] T077 [US2] Implement GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/daily in app/api/v1/reserve/[marketKey]/[underlying]/snapshots/daily/route.ts
- [X] T078 [US2] Implement GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/monthly in app/api/v1/reserve/[marketKey]/[underlying]/snapshots/monthly/route.ts
- [X] T079 [US2] Implement GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/daily.csv in app/api/v1/reserve/[marketKey]/[underlying]/snapshots/daily/route.csv.ts
- [X] T080 [US2] Implement GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/monthly.csv in app/api/v1/reserve/[marketKey]/[underlying]/snapshots/monthly/route.csv.ts
- [X] T081 [US2] Format CSV export (comma separator, UTF-8, ISO dates) in app/api/v1/reserve/[marketKey]/[underlying]/snapshots/daily/route.csv.ts
- [X] T082 [US2] Implement GET /api/v1/reserve/{marketKey}/{underlying}/liquidity-impact in app/api/v1/reserve/[marketKey]/[underlying]/snapshots/liquidity-impact/route.ts
- [X] T083 [US2] Load liquidity impact scenarios from data/liquidityImpactScenarios.json in lib/calculations/liquidity-impact.ts
- [X] T084 [US2] Calculate projected state for each scenario in lib/calculations/liquidity-impact.ts
- [X] T085 [US2] Create asset detail page component in app/(routes)/[marketKey]/[assetAddress]/page.tsx
- [X] T086 [US2] Create top cards component (APR, amounts, price) in app/components/asset/AssetTopCards.tsx
- [X] T087 [US2] Create main chart component with ECharts in app/components/charts/MainChart.tsx
- [X] T088 [US2] Implement chart metric switcher (Supply APR, Borrow APR, Supplied $, etc.) in app/components/charts/MainChart.tsx
- [X] T089 [US2] Create average lending rates table component in app/components/asset/AverageLendingRatesTable.tsx
- [X] T090 [US2] Create daily snapshots table component in app/components/asset/DailySnapshotsTable.tsx
- [X] T091 [US2] Create monthly snapshots table component in app/components/asset/MonthlySnapshotsTable.tsx
- [X] T092 [US2] Add CSV download buttons to snapshots tables in app/components/asset/DailySnapshotsTable.tsx
- [X] T093 [US2] Create liquidity impact table component in app/components/asset/LiquidityImpactTable.tsx
- [X] T094 [US2] Create mini curve chart for liquidity impact in app/components/charts/LiquidityImpactChart.tsx
- [X] T095 [US2] Implement loading states for all sections in app/(routes)/[marketKey]/[assetAddress]/page.tsx
- [X] T096 [US2] Implement error handling with inline messages in app/(routes)/[marketKey]/[assetAddress]/page.tsx
- [X] T097 [US2] Add responsive design for mobile devices in app/(routes)/[marketKey]/[assetAddress]/page.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Asset detail page fully functional with all features.

---

## Phase 5: User Story 3 - View Stablecoins Across Markets (Priority: P2)

**Goal**: Users can view all stablecoins across markets in one place with filtering and comparison

**Independent Test**: Navigate to `/stablecoins` and verify: all stablecoins displayed, market filter works, totals shown, 30-day APR trends visible

### Tests for User Story 3

- [X] T098 [P] [US3] Create integration test for stablecoins aggregation in tests/integration/api/stablecoins.test.ts
- [X] T099 [P] [US3] Create E2E smoke test for stablecoins page in tests/e2e/smoke/stablecoins.test.ts

### Implementation for User Story 3

- [X] T100 [US3] Load stablecoins configuration from data/stablecoins.json in lib/data/stablecoins.ts
- [X] T101 [US3] Aggregate stablecoin data across all markets in lib/calculations/stablecoins.ts
- [X] T102 [US3] Create stablecoins page component in app/(routes)/stablecoins/page.tsx
- [X] T103 [US3] Create stablecoins table component with TanStack Table in app/components/tables/StablecoinsTable.tsx
- [X] T104 [US3] Implement market filter dropdown in app/components/tables/StablecoinsTable.tsx
- [X] T105 [US3] Calculate aggregate totals (supplied, borrowed) in app/(routes)/stablecoins/page.tsx
- [X] T106 [US3] Create totals summary component in app/components/stablecoins/StablecoinsTotals.tsx
- [ ] T107 [US3] Implement 30-day APR micro-chart for each stablecoin in app/components/tables/StablecoinsTable.tsx
- [X] T108 [US3] Add sorting functionality (default: Supplied desc) in app/components/tables/StablecoinsTable.tsx
- [X] T109 [US3] Implement loading state in app/(routes)/stablecoins/page.tsx
- [X] T110 [US3] Implement error handling with inline messages in app/(routes)/stablecoins/page.tsx
- [X] T111 [US3] Add responsive design for mobile devices in app/(routes)/stablecoins/page.tsx

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently. Stablecoins page functional.

---

## Phase 6: User Story 4 - View Market Trends and Changes (Priority: P2)

**Goal**: Users can view market supply and borrowing trends over time with charts and change tables

**Independent Test**: Navigate to `/ethereum-v3/supply-change` or `/ethereum-v3/borrow-change` and verify: charts display, summary cards show changes, table shows 1d/7d/30d changes

### Tests for User Story 4

- [X] T112 [P] [US4] Create unit test for market trends calculation in tests/unit/calculations/trends.test.ts
- [X] T113 [P] [US4] Create integration test for GET /api/v1/market/{marketKey}/timeseries in tests/integration/api/timeseries.test.ts
- [X] T114 [P] [US4] Create E2E smoke test for trends pages in tests/e2e/smoke/trends.test.ts

### Implementation for User Story 4

- [X] T115 [US4] Implement GET /api/v1/market/{marketKey}/timeseries endpoint in app/api/v1/market/[marketKey]/timeseries/route.ts
- [X] T116 [US4] Calculate market totals time series from daily snapshots in lib/calculations/trends.ts
- [X] T117 [US4] Calculate 1d/7d/30d changes for each asset in lib/calculations/trends.ts
- [X] T118 [US4] Create supply-change page component in app/(routes)/[marketKey]/supply-change/page.tsx
- [X] T119 [US4] Create borrow-change page component in app/(routes)/[marketKey]/borrow-change/page.tsx
- [X] T120 [US4] Create redirect from /[marketKey]/charts to supply-change in app/(routes)/[marketKey]/charts/page.tsx
- [X] T121 [US4] Create summary cards component (totals + 1d/7d/30d changes) in app/components/trends/TrendsSummaryCards.tsx
- [X] T122 [US4] Create total supply/borrow chart with ECharts in app/components/charts/TrendsTotalChart.tsx
- [X] T123 [US4] Create by-asset chart with ECharts in app/components/charts/TrendsByAssetChart.tsx
- [X] T124 [US4] Create changes table component with 1d/7d/30d columns in app/components/tables/TrendsChangesTable.tsx
- [X] T125 [US4] Implement time window selector (30d/6m/1y) for compound-style block in app/components/trends/TrendsSummaryCards.tsx
- [X] T126 [US4] Add caching for timeseries data (TTL: 6-24h) in app/api/v1/market/[marketKey]/timeseries/route.ts
- [X] T127 [US4] Implement loading states in app/(routes)/[marketKey]/supply-change/page.tsx
- [X] T128 [US4] Implement error handling with inline messages in app/(routes)/[marketKey]/supply-change/page.tsx
- [X] T129 [US4] Add responsive design for mobile devices in app/(routes)/[marketKey]/supply-change/page.tsx

**Checkpoint**: At this point, User Stories 1, 2, 3, AND 4 should all work independently. Trends pages functional.

---

## Phase 7: User Story 5 - Export Historical Data (Priority: P3)

**Goal**: Users can export daily and monthly snapshots as CSV files for analysis

**Independent Test**: Navigate to asset page, click CSV export buttons, verify: files download, format correct (comma, UTF-8, ISO dates), data accurate

### Tests for User Story 5

- [X] T130 [P] [US5] Create integration test for CSV export endpoints in tests/integration/api/csv-export.test.ts
- [X] T131 [P] [US5] Verify CSV format (comma, UTF-8, ISO dates) in tests/integration/api/csv-export.test.ts

### Implementation for User Story 5

- [X] T132 [US5] Verify CSV export endpoints already implemented (T079, T080) - add Content-Disposition headers
- [X] T133 [US5] Ensure CSV formatting matches spec (comma separator, UTF-8, ISO dates, 2 decimals USD, 4 decimals APR) in app/api/v1/reserve/[marketKey]/[underlying]/snapshots/daily/route.csv.ts
- [X] T134 [US5] Add CSV download button styling (non-accent, below table) in app/components/asset/DailySnapshotsTable.tsx
- [X] T135 [US5] Add CSV download button for monthly snapshots in app/components/asset/MonthlySnapshotsTable.tsx
- [X] T136 [US5] Test CSV export with real data and verify Excel/Google Sheets compatibility

**Checkpoint**: At this point, all user stories should be complete. CSV export functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### 30-Day APR Micro-Charts (US1, US3)

- [ ] T137 [P] Implement 30-day APR micro-chart component with ECharts in app/components/charts/MicroBarChart.tsx
- [ ] T138 [P] Calculate 30-day APR series from daily snapshots in lib/calculations/apr.ts
- [ ] T139 [P] Implement tooltip with last/min/max/Δ30d in app/components/charts/MicroBarChart.tsx
- [ ] T140 [P] Add micro-chart to market table (30d APR column) in app/components/tables/ReservesTable.tsx
- [ ] T141 [P] Add micro-chart to stablecoins table in app/components/tables/StablecoinsTable.tsx
- [ ] T142 [P] Display Δ30d percentage change next to micro-chart in app/components/charts/MicroBarChart.tsx

### Compound-Style Block (US1)

- [ ] T143 [P] Create compound-style metrics block component in app/components/market/CompoundMetricsBlock.tsx
- [ ] T144 [P] Implement time range selector (30d/6m/1y) in app/components/market/CompoundMetricsBlock.tsx
- [ ] T145 [P] Create bar chart for market totals over time in app/components/charts/MarketTotalsChart.tsx
- [ ] T146 [P] Integrate compound block into market page in app/(routes)/[marketKey]/page.tsx

### API Documentation Page

- [ ] T147 [P] Create API documentation page in app/(routes)/api/page.tsx
- [ ] T148 [P] Document BFF API endpoints and data formats in app/(routes)/api/page.tsx
- [ ] T149 [P] Document APR calculation formulas in app/(routes)/api/page.tsx
- [ ] T150 [P] Document totals calculation approach in app/(routes)/api/page.tsx

### Error Handling & UX Improvements

- [ ] T151 [P] Implement 404 error page component in app/not-found.tsx
- [ ] T152 [P] Add clear error messages for invalid market/asset in app/not-found.tsx
- [ ] T153 [P] Implement global error boundary in app/error.tsx
- [ ] T154 [P] Add "Insufficient data" inline messages throughout UI components
- [ ] T155 [P] Ensure all error states show partial data when available (graceful degradation)

### Performance Optimization

- [ ] T156 [P] Implement code splitting for ECharts (lazy load) in app/components/charts/
- [ ] T157 [P] Add HTTP cache headers for static/semi-static data in API routes
- [ ] T158 [P] Optimize bundle size (analyze with @next/bundle-analyzer)
- [ ] T159 [P] Implement streaming for large data responses where possible

### Testing & Quality

- [ ] T160 [P] Add unit tests for all calculation modules in tests/unit/calculations/
- [ ] T161 [P] Add unit tests for utility functions in tests/unit/utils/
- [ ] T162 [P] Add integration tests for all BFF endpoints in tests/integration/api/
- [ ] T163 [P] Complete E2E smoke tests for all pages in tests/e2e/smoke/
- [ ] T164 [P] Run preflight checks and verify all pass
- [ ] T165 [P] Validate quickstart.md instructions work end-to-end

### Documentation

- [ ] T166 [P] Update README.md with project overview and setup instructions
- [ ] T167 [P] Document environment variables in README.md
- [ ] T168 [P] Add code comments for complex calculations in lib/calculations/
- [ ] T169 [P] Document API usage examples in app/(routes)/api/page.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed) OR sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Uses same infrastructure, independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Uses US1 infrastructure but independently testable
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Uses US1/US2 infrastructure but independently testable
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Extends US2, independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- API endpoints before UI components
- Core data fetching before visualization
- Basic functionality before polish
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Different API clients, utilities, calculations marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all API client setup tasks together:
Task: "Create AaveKit GraphQL client in lib/api/aavekit.ts"
Task: "Create The Graph subgraph client in lib/api/subgraph.ts"
Task: "Create Ethereum RPC client with failover logic in lib/api/rpc.ts"

# Launch all utility tasks together:
Task: "Implement address normalization utility in lib/utils/address.ts"
Task: "Create BigNumber utility wrapper in lib/utils/big-number.ts"
Task: "Implement address validation with zod schema in lib/utils/address.ts"

# Launch all calculation modules together:
Task: "Implement APR calculation from indices in lib/calculations/apr.ts"
Task: "Implement market/asset totals calculation in lib/calculations/totals.ts"
Task: "Implement price conversion in lib/calculations/totals.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Market Overview)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Market Overview)
   - Developer B: User Story 2 (Asset Details)
   - Developer C: User Story 3 (Stablecoins)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All file paths are relative to repository root
- Follow constitution requirements strictly (no invention, whitelist sources only)

---

## Task Summary

**Total Tasks**: 169

**Tasks by Phase**:
- Phase 1 (Setup): 10 tasks
- Phase 2 (Foundational): 37 tasks
- Phase 3 (US1 - Market Overview): 18 tasks
- Phase 4 (US2 - Asset Details): 50 tasks
- Phase 5 (US3 - Stablecoins): 14 tasks
- Phase 6 (US4 - Market Trends): 18 tasks
- Phase 7 (US5 - Export): 5 tasks
- Phase 8 (Polish): 19 tasks

**Tasks by User Story**:
- US1: 18 tasks (including tests)
- US2: 50 tasks (including tests)
- US3: 14 tasks (including tests)
- US4: 18 tasks (including tests)
- US5: 5 tasks (including tests)

**Parallel Opportunities**: 89 tasks marked [P] can run in parallel

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only) = 65 tasks
