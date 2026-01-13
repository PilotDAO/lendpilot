-- CreateTable: MarketTimeseries
CREATE TABLE IF NOT EXISTS "market_timeseries" (
    "id" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "window" TEXT NOT NULL,
    "totalSuppliedUSD" DOUBLE PRECISION NOT NULL,
    "totalBorrowedUSD" DOUBLE PRECISION NOT NULL,
    "availableLiquidityUSD" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_timeseries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AssetSnapshot
CREATE TABLE IF NOT EXISTS "asset_snapshots" (
    "id" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "underlyingAsset" VARCHAR(42) NOT NULL,
    "date" DATE NOT NULL,
    "suppliedTokens" TEXT NOT NULL,
    "borrowedTokens" TEXT NOT NULL,
    "availableLiquidity" TEXT NOT NULL,
    "supplyAPR" DOUBLE PRECISION NOT NULL,
    "borrowAPR" DOUBLE PRECISION NOT NULL,
    "utilizationRate" DOUBLE PRECISION NOT NULL,
    "oraclePrice" DOUBLE PRECISION NOT NULL,
    "totalSuppliedUSD" DOUBLE PRECISION NOT NULL,
    "totalBorrowedUSD" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "market_timeseries_marketKey_date_window_key" ON "market_timeseries"("marketKey", "date", "window");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "market_timeseries_marketKey_window_date_idx" ON "market_timeseries"("marketKey", "window", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "market_timeseries_marketKey_window_idx" ON "market_timeseries"("marketKey", "window");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "asset_snapshots_marketKey_underlyingAsset_date_key" ON "asset_snapshots"("marketKey", "underlyingAsset", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_snapshots_marketKey_underlyingAsset_date_idx" ON "asset_snapshots"("marketKey", "underlyingAsset", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_snapshots_marketKey_date_idx" ON "asset_snapshots"("marketKey", "date");
