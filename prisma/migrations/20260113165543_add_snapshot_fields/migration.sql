-- AlterTable: Add missing fields to asset_snapshots
ALTER TABLE "asset_snapshots" 
ADD COLUMN IF NOT EXISTS "blockNumber" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "timestamp" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "liquidityIndex" TEXT NOT NULL DEFAULT '0',
ADD COLUMN IF NOT EXISTS "variableBorrowIndex" TEXT NOT NULL DEFAULT '0';

-- CreateIndex for faster queries
CREATE INDEX IF NOT EXISTS "asset_snapshots_marketKey_underlyingAsset_idx" 
ON "asset_snapshots"("marketKey", "underlyingAsset");
