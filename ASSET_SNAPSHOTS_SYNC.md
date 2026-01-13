# Asset Snapshots Database Sync

## Обзор

Теперь все daily snapshots сохраняются в базу данных и читаются оттуда, что значительно ускоряет API и устраняет таймауты.

## Что изменилось

1. **Схема БД обновлена** - добавлены поля:
   - `blockNumber` (BIGINT) - номер блока
   - `timestamp` (BIGINT) - Unix timestamp
   - `liquidityIndex` (TEXT) - индекс ликвидности для расчета APR
   - `variableBorrowIndex` (TEXT) - индекс займа для расчета APR

2. **API endpoints обновлены**:
   - `/api/v1/reserve/{marketKey}/{underlying}/snapshots/daily` - читает из БД
   - `/api/v1/reserve/{marketKey}/{underlying}/snapshots/monthly` - читает из БД

3. **Новые функции синхронизации**:
   - `syncAssetSnapshots()` - синхронизирует snapshots для одного asset
   - `syncMarketAssetSnapshots()` - синхронизирует все assets в market
   - `syncAllAssetSnapshots()` - синхронизирует все markets и assets

## Использование

### Первая синхронизация (заполнение БД)

```bash
# Синхронизировать все snapshots (может занять время)
npm run sync:market-data

# Или только snapshots
npx tsx scripts/sync-market-data.ts
```

### Синхронизация через Cron

1. **Vercel Cron** (рекомендуется):
   ```json
   // vercel.json
   {
     "crons": [
       {
         "path": "/api/cron/sync-asset-snapshots",
         "schedule": "0 2 * * *"  // Каждый день в 2:00 UTC
       }
     ]
   }
   ```

2. **Ручной вызов**:
   ```bash
   curl -X POST http://localhost:3000/api/cron/sync-asset-snapshots \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

### Синхронизация конкретного asset

```typescript
import { syncAssetSnapshots } from '@/lib/workers/asset-snapshots-sync';

// Синхронизировать последние 90 дней
await syncAssetSnapshots('ethereum-v3', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 90);
```

## Преимущества

1. **Быстрые ответы API** - данные из БД вместо генерации на лету
2. **Нет таймаутов** - данные предзагружены
3. **Масштабируемость** - можно синхронизировать в фоне
4. **Надежность** - данные сохраняются, даже если subgraph недоступен

## Структура данных

Snapshots сохраняются в таблице `asset_snapshots` с уникальным ключом:
- `marketKey` + `underlyingAsset` + `date`

Индексы для быстрого поиска:
- `(marketKey, underlyingAsset, date)`
- `(marketKey, date)`
- `(marketKey, underlyingAsset)`

## Мониторинг

Проверить количество snapshots в БД:
```sql
SELECT 
  marketKey, 
  COUNT(*) as snapshot_count,
  MIN(date) as first_date,
  MAX(date) as last_date
FROM asset_snapshots
GROUP BY marketKey;
```

## Очистка старых данных

По умолчанию сохраняются последние 90 дней. Для очистки старых данных:

```typescript
import { prisma } from '@/lib/db/prisma';

const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 365); // Удалить старше 365 дней

await prisma.assetSnapshot.deleteMany({
  where: {
    date: {
      lt: cutoffDate,
    },
  },
});
```
