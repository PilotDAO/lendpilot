# Применение миграции вручную (если Prisma не подключается)

Если `prisma migrate` не работает из-за проблем с подключением, примените миграцию вручную через Supabase SQL Editor.

## Шаги:

1. Откройте Supabase Dashboard: https://app.supabase.com
2. Выберите ваш проект
3. Перейдите в **SQL Editor**
4. Скопируйте содержимое файла `prisma/migrations/init_migration.sql`
5. Вставьте в SQL Editor и нажмите **Run**

Или выполните SQL команды напрямую:

```sql
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
CREATE INDEX IF NOT EXISTS "market_timeseries_marketKey_window_date_idx" ON "market_timeseries"("marketKey", "window", "date");
CREATE INDEX IF NOT EXISTS "market_timeseries_marketKey_window_idx" ON "market_timeseries"("marketKey", "window");

CREATE UNIQUE INDEX IF NOT EXISTS "asset_snapshots_marketKey_underlyingAsset_date_key" ON "asset_snapshots"("marketKey", "underlyingAsset", "date");
CREATE INDEX IF NOT EXISTS "asset_snapshots_marketKey_underlyingAsset_date_idx" ON "asset_snapshots"("marketKey", "underlyingAsset", "date");
CREATE INDEX IF NOT EXISTS "asset_snapshots_marketKey_date_idx" ON "asset_snapshots"("marketKey", "date");
```

После применения миграции, запустите синхронизацию данных:

```bash
npm run sync:market-data
```
