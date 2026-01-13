# Deployment Guide

## Environment Variables

### Development

Все переменные окружения хранятся в `.env.local` (не коммитится в git).

**Текущие настройки:**
- `GRAPH_API_KEY` - установлен и работает
- Все остальные переменные имеют дефолтные значения

### Production

Для production окружения нужно установить переменные окружения на вашем хостинге:

#### Vercel

1. Перейдите в Settings → Environment Variables
2. Добавьте переменные:
   - `GRAPH_API_KEY` = `d553ff02ebe18bd8c4a58408666f126c`
   - `AAVE_SUBGRAPH_ID` = `Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g` (опционально, есть дефолт)
   - `ETH_RPC_URLS` = `https://eth.drpc.org,https://eth.llamarpc.com,https://rpc.ankr.com/eth,https://ethereum-rpc.publicnode.com` (опционально, есть дефолт)

#### Railway / Render / Другие платформы

Установите переменные окружения через панель управления или CLI:

```bash
# Railway
railway variables set GRAPH_API_KEY=d553ff02ebe18bd8c4a58408666f126c

# Render
# Через Dashboard → Environment → Add Environment Variable
```

#### Docker / Self-hosted

Создайте `.env.production` или установите через docker-compose:

```yaml
environment:
  - GRAPH_API_KEY=d553ff02ebe18bd8c4a58408666f126c
  - AAVE_SUBGRAPH_ID=Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g
```

## Build & Deploy

```bash
# Build
npm run build

# Start production server
npm start
```

## Verification

После деплоя проверьте:

1. **API endpoints работают:**
   ```bash
   curl https://your-domain.com/api/v1/markets
   curl https://your-domain.com/api/v1/market/ethereum-v3
   ```

2. **Timeseries API работает (требует GRAPH_API_KEY):**
   ```bash
   curl https://your-domain.com/api/v1/market/ethereum-v3/timeseries?window=30d
   ```

3. **Страницы загружаются:**
   - `https://your-domain.com/ethereum-v3`
   - `https://your-domain.com/stablecoins`
   - `https://your-domain.com/ethereum-v3/supply-change`

## Troubleshooting

### API возвращает 503

- Проверьте, что `GRAPH_API_KEY` установлен в production
- Проверьте логи на наличие ошибок "auth error: missing API key"

### Build fails

- Убедитесь, что все обязательные переменные имеют дефолтные значения
- Проверьте `lib/config/env.ts` - там настроены дефолты для build
