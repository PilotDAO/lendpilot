-- CreateTable: AaveKitRawSnapshot
CREATE TABLE "aavekit_raw_snapshots" (
    "id" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "rawData" JSONB NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'aavekit',
    "blockNumber" BIGINT,
    "collectionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aavekit_raw_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aavekit_raw_snapshots_marketKey_idx" ON "aavekit_raw_snapshots"("marketKey");

-- CreateIndex
CREATE INDEX "aavekit_raw_snapshots_marketKey_date_idx" ON "aavekit_raw_snapshots"("marketKey", "date");

-- CreateIndex
CREATE INDEX "aavekit_raw_snapshots_date_idx" ON "aavekit_raw_snapshots"("date");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX "aavekit_raw_snapshots_marketKey_date_dataSource_key" ON "aavekit_raw_snapshots"("marketKey", "date", "dataSource");

-- AlterTable: MarketTimeseries - Add dataSource and rawDataId
ALTER TABLE "market_timeseries" ADD COLUMN "dataSource" TEXT NOT NULL DEFAULT 'subgraph';
ALTER TABLE "market_timeseries" ADD COLUMN "rawDataId" TEXT;

-- CreateIndex for rawDataId
CREATE INDEX "market_timeseries_rawDataId_idx" ON "market_timeseries"("rawDataId");

-- AlterTable: AssetSnapshot - Add dataSource and rawDataId
ALTER TABLE "asset_snapshots" ADD COLUMN "dataSource" TEXT NOT NULL DEFAULT 'subgraph';
ALTER TABLE "asset_snapshots" ADD COLUMN "rawDataId" TEXT;

-- CreateIndex for rawDataId
CREATE INDEX "asset_snapshots_rawDataId_idx" ON "asset_snapshots"("rawDataId");
