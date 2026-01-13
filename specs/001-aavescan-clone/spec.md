# Feature Specification: Aavescan Clone - Aave Protocol Analytics Platform

**Feature Branch**: `001-aavescan-clone`  
**Created**: 2026-01-11  
**Status**: Draft  
**Input**: User description: "Используй файл spec-temp.md как входное ТЗ"

## Clarifications

### Session 2026-01-11

- Q: When data is unavailable or errors occur, should the system show inline messages, dedicated error pages, or both? → A: Inline messages with graceful degradation (show partial data + message)
- Q: When invalid market key or asset address is provided in URL, should system show error page or redirect to default? → A: Show 404 error page with clear message
- Q: What CSV format should be used for exports to ensure compatibility? → A: Standard format: comma separator, UTF-8 encoding, ISO date format (YYYY-MM-DD)
- Q: Should pages automatically refresh data in background or require manual refresh? → A: Manual refresh only (F5 or refresh button)
- Q: Should web interface be responsive for mobile devices or desktop-only? → A: Responsive design for mobile devices

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Market Overview (Priority: P1)

Users need to see an overview of all available assets in a market (e.g., Ethereum V3) with key metrics including supply, borrowing, and interest rates. This is the primary entry point for exploring the Aave protocol data.

**Why this priority**: This is the main landing page that provides users with a comprehensive view of all assets in a market. Without this, users cannot discover or navigate to specific assets. It's the foundation for all other features.

**Independent Test**: Can be fully tested by navigating to a market page (e.g., `/ethereum-v3`) and verifying that:
- All assets in the market are displayed in a sortable table
- Key metrics (supplied amount, borrowed amount, APR) are shown for each asset
- Users can sort by any column
- The page loads within 3 seconds

**Acceptance Scenarios**:

1. **Given** a user visits a market page (e.g., `/ethereum-v3`), **When** the page loads, **Then** they see a table with all assets showing supplied amount, borrowed amount, supply APR, borrow APR, and 30-day APR trend
2. **Given** a market page is displayed, **When** a user clicks on a column header, **Then** the table sorts by that column (ascending/descending)
3. **Given** a market page is displayed, **When** a user views the top metrics section, **Then** they see total supply, available supply, and total borrowing amounts for the entire market
4. **Given** a market page is displayed, **When** a user hovers over the 30-day APR micro-chart, **Then** they see tooltip with last value, min, max, and change over 30 days

---

### User Story 2 - View Asset Details (Priority: P1)

Users need detailed information about a specific asset including current rates, historical data, and impact analysis. This allows users to make informed decisions about lending or borrowing.

**Why this priority**: This is the core analytical feature that provides deep insights into individual assets. Users need this to understand historical trends, current state, and potential impact of large transactions.

**Independent Test**: Can be fully tested by navigating to an asset page (e.g., `/ethereum-v3/0xc02aaa...`) and verifying that:
- Current metrics are displayed (APR, supplied, borrowed, price)
- Historical charts are shown with multiple metric options
- Daily and monthly snapshots are available
- CSV export works for historical data
- Liquidity impact scenarios are calculated and displayed

**Acceptance Scenarios**:

1. **Given** a user visits an asset page, **When** the page loads, **Then** they see top cards with current Supply APR, Borrow APR, Supplied amount, Borrowed amount, Oracle price, and token amounts
2. **Given** an asset page is displayed, **When** a user selects a different metric from the chart switcher, **Then** the main chart updates to show that metric over time
3. **Given** an asset page is displayed, **When** a user views the Average Lending Rates table, **Then** they see average APR for Supply and Borrow across 1d, 7d, 30d, 6m, and 1y periods
4. **Given** an asset page is displayed, **When** a user clicks "Download 90 days CSV", **Then** they receive a CSV file with daily snapshot data
5. **Given** an asset page is displayed, **When** a user views the Liquidity Impact section, **Then** they see scenarios showing how different transaction sizes (100M, 250M, 500M, 1B) would affect utilization and rates

---

### User Story 3 - View Stablecoins Across Markets (Priority: P2)

Users need to see all stablecoins across different markets in one place to compare rates and availability. This helps users find the best opportunities for stablecoin lending/borrowing.

**Why this priority**: Stablecoins are a major use case for DeFi users. This aggregated view provides value by allowing comparison across markets without navigating multiple pages.

**Independent Test**: Can be fully tested by navigating to `/stablecoins` and verifying that:
- All stablecoins from all markets are displayed
- Users can filter by specific market
- Total supplied and borrowed amounts are shown
- 30-day APR trends are visible for each stablecoin

**Acceptance Scenarios**:

1. **Given** a user visits the stablecoins page, **When** the page loads, **Then** they see a table with all stablecoins from all markets showing asset, market, supplied amount, borrowed amount, and APR
2. **Given** the stablecoins page is displayed, **When** a user selects a specific market from the filter, **Then** the table shows only stablecoins from that market
3. **Given** the stablecoins page is displayed, **When** a user views the totals section, **Then** they see aggregate total supplied and total borrowed across all displayed stablecoins

---

### User Story 4 - View Market Trends and Changes (Priority: P2)

Users need to see how market supply and borrowing have changed over time to understand market dynamics and trends. This provides insights into market growth and activity.

**Why this priority**: Historical trends help users understand market behavior and make better decisions. This complements the asset-level historical data.

**Independent Test**: Can be fully tested by navigating to `/ethereum-v3/supply-change` or `/ethereum-v3/borrow-change` and verifying that:
- Charts show total supply/borrow changes over time
- Charts show changes by individual asset
- Table shows 1d, 7d, and 30d changes for each asset
- All data is accessible without requiring registration

**Acceptance Scenarios**:

1. **Given** a user visits a supply-change or borrow-change page, **When** the page loads, **Then** they see charts showing total market changes and changes by asset
2. **Given** a trends page is displayed, **When** a user views the summary cards, **Then** they see total supplied/borrowed and changes over 1d, 7d, and 30d periods
3. **Given** a trends page is displayed, **When** a user views the changes table, **Then** they see each asset with its supplied/borrowed amount and 1d/7d/30d changes

---

### User Story 5 - Export Historical Data (Priority: P3)

Users need to export historical data for their own analysis, reporting, or record-keeping. This enables advanced users to perform custom analysis.

**Why this priority**: While valuable for power users, this is not essential for basic usage. It's a nice-to-have that enhances the platform's utility but doesn't block core functionality.

**Independent Test**: Can be fully tested by navigating to an asset page and clicking CSV export buttons, verifying that:
- CSV files are downloaded with correct data
- Data format matches specification (dates, decimals, encoding)
- Both daily and monthly exports work

**Acceptance Scenarios**:

1. **Given** a user is on an asset page, **When** they click "Download 90 days CSV" for daily snapshots, **Then** they receive a CSV file with 90 days of daily data
2. **Given** a user is on an asset page, **When** they click "Download CSV" for monthly snapshots, **Then** they receive a CSV file with monthly aggregated data
3. **Given** a CSV file is downloaded, **When** a user opens it, **Then** the data is properly formatted with comma separator, UTF-8 encoding, ISO date format (YYYY-MM-DD), and correct decimal precision

---

### Edge Cases

- What happens when historical data is unavailable for a date range? System shows "Insufficient data" message inline where data would appear, while displaying any available partial data (graceful degradation)
- How does system handle missing or incomplete data for an asset? System displays available data and shows inline message indicating which data is incomplete or unavailable
- What happens when external data sources are temporarily unavailable? System shows cached data if available with inline indicator, or inline error message if no cached data exists
- How does system handle invalid market keys or asset addresses? System shows 404 error page with clear message explaining the issue (invalid format or resource not found)
- What happens when rate limiting is exceeded? System returns 429 error with Retry-After header
- How does system handle very large numbers in calculations? System uses appropriate precision to avoid rounding errors

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all assets in a market with current supply, borrowing, and APR metrics
- **FR-002**: System MUST allow users to sort market tables by any column (ascending/descending)
- **FR-003**: System MUST display market-level totals (total supply, available supply, total borrowing) in a prominent summary section
- **FR-004**: System MUST show 30-day APR trends as micro-charts with tooltips showing key statistics
- **FR-005**: System MUST display detailed asset information including current rates, supplied/borrowed amounts, and oracle price
- **FR-006**: System MUST provide historical charts for assets with multiple metric options (Supply APR, Borrow APR, Supplied $, Borrowed $, Utilization, Price)
- **FR-007**: System MUST display average lending rates table showing 1d, 7d, 30d, 6m, and 1y averages for Supply and Borrow APR
- **FR-008**: System MUST provide daily snapshot data for at least 90 days
- **FR-009**: System MUST provide monthly snapshot data for at least 24 months
- **FR-010**: System MUST allow users to export daily and monthly snapshots as CSV files using standard format (comma separator, UTF-8 encoding, ISO date format YYYY-MM-DD)
- **FR-011**: System MUST calculate and display liquidity impact scenarios for different transaction sizes (100M, 250M, 500M, 1B) and actions (Deposit, Borrow, Repay, Withdraw)
- **FR-012**: System MUST display all stablecoins across markets in a single view
- **FR-013**: System MUST allow filtering stablecoins by market
- **FR-014**: System MUST display market supply and borrowing trends over time
- **FR-015**: System MUST show 1d, 7d, and 30d changes for supply and borrowing
- **FR-016**: System MUST calculate historical APR using index-based formulas (not current rates)
- **FR-017**: System MUST normalize all addresses to lowercase for comparison and storage
- **FR-018**: System MUST validate all input addresses and market keys, showing 404 error page with clear message when invalid or not found
- **FR-019**: System MUST handle missing data gracefully by showing inline "Insufficient data" messages while displaying any available partial data (graceful degradation)
- **FR-020**: System MUST cache data appropriately to ensure fast page loads. Data updates require manual page refresh (F5 or refresh button)
- **FR-021**: System MUST retry failed requests with exponential backoff
- **FR-022**: System MUST provide fallback data sources when primary sources are unavailable
- **FR-023**: System MUST enforce rate limiting to prevent abuse
- **FR-024**: System MUST NOT require user registration or login for any features
- **FR-025**: System MUST NOT display incentive-related information (Merkl, ACI, reward APR, total APR)
- **FR-026**: System MUST NOT provide PNG/JPEG export for charts
- **FR-027**: System MUST display all percentages using "%" format, not "pp" (percentage points)
- **FR-028**: System MUST show only Protocol APR, excluding any incentive-based rates

### Key Entities *(include if feature involves data)*

- **Market**: Represents a deployment of Aave protocol (e.g., Ethereum V3, Arbitrum V3). Has a unique key, display name, pool address, and configuration for data sources
- **Asset/Reserve**: Represents a specific token in a market pool. Has address, symbol, name, decimals, and current state (supplied, borrowed, APR, utilization)
- **Snapshot**: Represents the state of an asset at a specific point in time (daily or monthly). Contains all metrics needed to calculate historical APR and trends
- **Market Totals**: Aggregated metrics across all assets in a market (total supplied, total borrowed, available liquidity)
- **Liquidity Impact Scenario**: Represents a hypothetical transaction (action + amount) and its calculated impact on utilization and rates

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view market overview page and see all assets within 3 seconds of page load
- **SC-002**: Users can navigate to any asset detail page and see complete information within 3 seconds
- **SC-003**: Users can export 90 days of daily snapshot data as CSV in under 5 seconds
- **SC-004**: System displays accurate APR calculations based on historical index data (verified against known test cases)
- **SC-005**: System handles data source failures gracefully, showing cached data or appropriate error messages without crashing
- **SC-006**: All pages load and display correctly without requiring user authentication
- **SC-007**: System correctly filters and displays stablecoins across markets based on user selection
- **SC-008**: Historical charts display correctly for all supported time ranges (30d, 6m, 1y)
- **SC-009**: Liquidity impact calculations show accurate utilization and rate changes for all scenario combinations
- **SC-010**: System maintains data accuracy with proper handling of big numbers and decimal precision

## Assumptions

- Users have modern web browsers with JavaScript enabled (desktop and mobile)
- Users understand basic DeFi concepts (lending, borrowing, APR)
- Primary target market is Ethereum V3, with other markets added incrementally
- External data sources (AaveKit GraphQL, The Graph, RPC) are generally available but may have occasional outages
- Historical data may have gaps for some assets or time periods
- Users expect current data when they load or refresh pages (data is updated server-side every 30-60 seconds, but users manually refresh to see updates)
- CSV exports are primarily for analysis purposes, not real-time trading decisions

## Dependencies

- Access to AaveKit GraphQL API for current market and asset data
- Access to The Graph subgraph for historical snapshots
- Access to Ethereum RPC endpoints for block number resolution
- Configuration data (markets.json, stablecoins.json, liquidityImpactScenarios.json) must be available

## Out of Scope

- User registration, login, or authentication
- Pro/premium features or paid subscriptions
- Incentive-related data (Merkl, ACI, reward APR)
- Portfolio tracking or user-specific data
- Watchlist functionality
- PNG/JPEG chart exports
- SVG chart exports
- Support for markets beyond Ethereum V3 in initial release (can be added incrementally)
- Real-time notifications or alerts
- Mobile app (web-only, but web interface must be responsive for mobile devices)
