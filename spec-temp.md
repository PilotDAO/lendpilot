# Техническое задание (FINAL) — клон Aavescan (без Pro/регистрации и без Incentives)

> **Цель документа**: дать полный, точный, "без догадок" набор требований/деталей для реализации веб‑приложения‑клона aavescan.com с заранее согласованными изменениями.

---

## 0) Общее описание проекта

### 0.1. Цель
Сделать веб‑приложение‑клон **aavescan.com** по UX/структуре страниц и основным данным **Aave**, с заранее согласованными изменениями:
- **Pro не делаем** (никакой регистрации/логина/платных ограничений/апсейла).
- **Incentives не делаем** (Merkl/ACI/Reward APR/Total APR — удаляем, везде показываем только **Protocol APR**).
- UI/поведение — **максимально как у Aavescan**, плюс правки из обсуждения (см. разделы 4–6).

### 0.2. Принцип "точности"
Мы **не угадываем**:
- список рынков/стейблов/сценариев — берём **как у Aavescan** (см. раздел 7: Playwright‑скрейп).
- расчёты исторических ставок и снапшотов — берём **ровно по описанию Aavescan** (см. раздел 5.4, 9.2).

### 0.3. Ограничения и допущения

**Поддерживаемые сети (MVP):**
- **Ethereum V3** — полностью проверено и протестировано
- Другие сети (Arbitrum V3, Polygon V3 и т.д.) — добавляются постепенно через конфигурацию `data/markets.json`

**Допущения:**
- Price base всегда `USD x 1e8` (проверено на Ethereum V3, для других сетей требуется валидация)
- Subgraph ID для каждой сети указывается в конфигурации рынка
- RPC endpoints для каждой сети указываются в конфигурации
- При отсутствии данных за период показываем сообщение "Insufficient data"

---

## 1) Неголсы (что точно НЕ делаем)

1) **Pro‑функции**: логин, подписки, "Subscribe to download CSV", закрытые метрики, лимиты по истории, pro‑баннеры.  
2) **Incentives**:
   - Merkl incentives,
   - ACI Merit Program,
   - reward APR, total APR,
   - подсказки/иконки info про incentives.
3) Любые "портфельные"/юзер‑данные (если не было отдельно оговорено).
4) **Watchlist** — не включаем в MVP (опционально для будущих версий).
5) **SVG export графиков** — не включаем в MVP (оставляем только CSV).

---

## 2) Источники данных (то, что мы проверили руками)

### 2.1. AaveKit GraphQL (официальный Aave API)
- URL: `https://api.v3.aave.com/graphql`
- Используем для:
  - **текущего состояния** рынка/резерва (APR, utilisation, caps и т.п.),
  - метаданных токенов (name/symbol/decimals/imageUrl),
  - (опционально) истории APY через `supplyAPYHistory` / `borrowAPYHistory`.

**Проверено** через интроспекцию: в схеме точно есть:
- `markets(request: MarketsRequest!): [Market!]!`
- `market(request: MarketRequest!): Market`
- `reserve(request: ReserveRequest!): Reserve`
- `borrowAPYHistory(request: BorrowAPYHistoryRequest!): [APYSample!]!`
- `supplyAPYHistory(request: SupplyAPYHistoryRequest!): [APYSample!]!`
- `usdExchangeRates`, `chains`.

**TimeWindow enum (проверено):**
- `LAST_DAY`
- `LAST_WEEK`
- `LAST_MONTH`
- `LAST_SIX_MONTHS`
- `LAST_YEAR`

### 2.2. Aave v3 Subgraph (The Graph gateway) — для снапшотов/истории
Используем **The Graph gateway**:

- URL шаблон:  
  `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${AAVE_SUBGRAPH_ID}`

**Проверено, что работает** с:
- `AAVE_SUBGRAPH_ID = Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g` (Ethereum V3)

**Ключевой нюанс (поймали в логах и исправили):**
- В субграфе **Pool.id ≠ pool address** (адрес пула).
- Пример (Ethereum V3):
  - `Pool.id = 0x2f39d218133afab8f2b819b1066c7e434ad94e9e`
  - `Pool.pool = 0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2`
- Поэтому резервы фильтруются так: `reserves(where:{ pool: <Pool.id> })`, а не по адресу пула.

**Проверено:**
- `pools(first:1)` отдаёт `Pool` с полями `id`, `pool`, `addressProviderId`, `lastUpdateTimestamp`.
- `reserves(where:{ pool: <Pool.id> })` отдаёт **~60** резервов для Ethereum V3.
- `Reserve.id` = конкатенация `underlyingAsset + Pool.id` (как строка).

**Для других сетей:**
- Subgraph ID указывается в `data/markets.json` для каждого рынка
- Формат: `{ marketKey: string, subgraphId: string, ... }`

### 2.3. Ethereum RPC (для timestamp -> block)
Нам нужен `blockNumber` "на конец дня" (UTC), чтобы запросить состояние в субграфе через `block: { number: ... }`.

Мы пробовали публичные RPC:
- `https://cloudflare-eth.com` — **давал ошибки** `Cannot fulfill request` / `Internal error` на наших вызовах.
- **Рабочие (проверено):**
  - `https://eth.drpc.org`
  - `https://eth.llamarpc.com`
- Также добавили как fallback:
  - `https://rpc.ankr.com/eth`
  - `https://ethereum-rpc.publicnode.com`

**Для других сетей:**
- RPC endpoints указываются в `data/markets.json` для каждого рынка
- Формат: `{ marketKey: string, rpcUrls: string[], ... }`

---

## 3) Архитектура приложения

### 3.1. Стек (минимально сложный и поддерживаемый)
- Next.js (App Router) + TypeScript
- TailwindCSS
- UI primitives: shadcn/ui (Radix) **или** минимальный собственный набор (главное — не тащить тяжёлые UI‑фреймворки).
- Таблицы: TanStack Table (с сортировками).
- Графики: **Apache ECharts** (требование из обсуждения).
- Данные/валидация: zod.
- Работа с большими числами: `big.js` или `decimal.js` (нужны деления BigInt‑строк и степени).

### 3.2. Почему BFF (серверный слой)
- Не светить ключи (The Graph API key).
- Централизовать кэш, ретраи, деградацию и фоллбеки.
- Стабилизировать фронт: фронт не должен знать о тонкостях Pool.id vs pool address.

### 3.3. Кэширование/лимиты (важно)
Точные лимиты AaveKit/TheGraph **официально не фиксировали** в обсуждении, поэтому делаем безопасно:

**Server-side cache:**
- Тип: in‑memory LRU + опционально файл/kv
- Размер: максимум 1000 записей на тип данных
- При переполнении: LRU eviction (удаление наименее используемых)

**TTL:**
- market/reserve "live": 30–60 секунд
- daily snapshots: 6–24 часа (они по сути "история", не меняется)
- mapping poolAddress->poolEntityId: 24 часа

**Стратегия инвалидации:**
- При успешном ответе: обновляем кэш с новым TTL
- При ошибке: не инвалидируем кэш, отдаём stale если доступен

### 3.4. Обработка ошибок и деградация

**При 429/5xx ошибках:**
- Экспоненциальный backoff:
  - Максимум 3 попытки
  - Интервалы: 1s, 2s, 4s
  - На каждой попытке логируем с уровнем WARN
- Если есть кэш — отдаём **stale** после всех попыток
- Если кэша нет и все попытки исчерпаны:
  - Для live данных: возвращаем 503 с сообщением "Service temporarily unavailable"
  - Для исторических данных: возвращаем 404 с сообщением "Historical data not available"

**RPC failover:**
- При ошибке RPC: автоматический переход на следующий URL из списка
- Логируем какой RPC использован и какие упали
- Если все RPC упали: возвращаем ошибку с деталями последней попытки

**Мониторинг:**
- Логируем все ошибки API с контекстом (endpoint, параметры, статус код)
- Метрики: количество запросов, успешных/неуспешных, время ответа
- Алерты: при >10% ошибок за 5 минут

### 3.5. Безопасность

**Валидация входных данных:**
- Все параметры URL валидируются через zod схемы
- Адреса проверяются на формат (0x + 40 hex символов)
- Market keys проверяются против списка из `data/markets.json`
- При невалидных данных: возвращаем 400 с описанием ошибки

**Защита от DoS:**
- Rate limiting на BFF endpoints:
  - 100 запросов в минуту на IP для live данных
  - 20 запросов в минуту на IP для исторических данных
- При превышении: возвращаем 429 с Retry-After заголовком

**Секреты:**
- API keys хранятся только в environment variables
- Никогда не логируем секреты
- В production использовать secure storage (например, Vercel Environment Variables)

---

## 4) Роуты и страницы (как у Aavescan)

> URL‑структура как у Aavescan.

### 4.1. Markets (главная/маркет)
- `/{marketKey}`  
  Пример у Aavescan: `/ethereum-v3`

Состав:
1) Верхний блок метрик (мы меняем — см. 6.1).
2) Таблица резервов:
   - Asset (иконка + name + symbol)
   - Supplied ($)
   - Supply APR (protocol only)
   - Borrowed ($)
   - Borrow APR (protocol only)
   - 30d APR (мы меняем на микробары borrow — см. 6.2)
3) Сортировки по всем колонкам (требование).
4) Плотность / видимость колонок (опционально, если время позволяет).

### 4.2. Asset page
- `/{marketKey}/{underlyingAddress}`  
  Пример: `/ethereum-v3/0xc02aaa...`

Состав как у Aavescan:
1) Top cards:
   - Supply APR
   - Borrow APR
   - Supplied ($)
   - Borrowed ($)
   - Oracle price ($)
   - Supplied (token)
   - Borrowed (token)
2) Большой график + переключатель метрики (Supply APR / Borrow APR / Supplied $ / Borrowed $ / Util / Supplied / Borrowed / Price).
3) Section "Average lending rates" (таблица 1d/7d/30d/6m/1y) — как у Aavescan, но в нашем UI стиле.
4) "Daily snapshots" (таблица) + download CSV (90d).
5) "Monthly snapshots" (таблица) + download CSV.
6) "Liquidity impact" (таблица сценариев Deposit/Borrow/Repay/Withdraw) + мини‑модель (curve) в колонке Model.

### 4.3. Stablecoins
- `/stablecoins`
1) Фильтр Market (All markets + конкретный).
2) Тоталы: Total supplied, Total borrowed.
3) Таблица:
   - Asset
   - Market
   - Supplied ($)
   - Supply APR (protocol only)
   - Borrowed ($)
   - Borrow APR (protocol only)
   - 30d APR (borrow micro‑chart/бар)

### 4.4. Charts (маркетные изменения)
Как у Aavescan:
- `/{marketKey}/supply-change`
- `/{marketKey}/borrow-change`
и `/{marketKey}/charts` редиректит на supply-change.

Состав:
- Верхние карточки (Total supplied/borrowed и изменения 1d/7d/30d) — **без Pro‑блокировок**.
- Два графика:
  - Total supplied/borrowed ($)
  - Supplied/Borrowed by asset ($)
- Таблица изменений:
  - Supplied/Borrowed ($) + 1d/7d/30d

### 4.5. API page
- `/api`
Делаем как "документацию" нашего API (BFF), но по смыслу — как у Aavescan API docs:
- какие поля отдаём,
- как считаем totals,
- как считаем исторические APR через индексы.

---

## 5) Данные и расчёты

### 5.1. Нормализация адресов
- Всегда хранить и сравнивать адреса **lowercase**.
- В URL принимать как lowercase, приводить при обработке.
- Валидация:
  - Формат: `0x` + 40 hex символов (case-insensitive)
  - При невалидном формате: возвращаем 400
  - Checksummed адреса автоматически приводятся к lowercase

### 5.2. Снапшот резерва (основа для истории/графиков)
Берём из субграфа на конкретном `blockNumber`:

Минимальный набор полей (точно есть в схеме субграфа — мы видели их в интроспекции/логах):
- `underlyingAsset`
- `symbol`, `name`, `decimals`
- `totalATokenSupply`
- `availableLiquidity`
- `totalCurrentVariableDebt`
- `totalPrincipalStableDebt` (может быть 0; в сумме долга учитываем)
- `liquidityIndex`
- `variableBorrowIndex`
- `liquidityRate`
- `variableBorrowRate`
- `utilizationRate` (в субграфе приходит как decimal string)
- `price { priceInEth, lastUpdateTimestamp }`  
  **Важно:** по нашим тестам база цены определена как `USD x 1e8` (см. логи `priceBase=USDx1e8`).

### 5.3. Total значения (как в Aavescan API docs)
> Формулы 1:1 повторяют подход Aavescan (мы сверяли по их API‑странице).

Для резерва в момент времени:
- `priceUSD = price.priceInEth / 1e8`  *(т.к. база USDx1e8 была обнаружена/проверена в наших тестах)*
- `suppliedTokens = totalATokenSupply / 10^decimals`
- `borrowedTokens = (totalCurrentVariableDebt + totalPrincipalStableDebt) / 10^decimals`
- `totalSuppliedUSD = suppliedTokens * priceUSD`
- `totalBorrowedUSD = borrowedTokens * priceUSD`

Для рынка в момент времени:
- `marketTotalSuppliedUSD = sum(reserve.totalSuppliedUSD)`
- `marketTotalBorrowedUSD = sum(reserve.totalBorrowedUSD)`
- `marketAvailableLiquidityUSD = sum( availableLiquidity/10^decimals * priceUSD )`
- Доп. метрики для верхнего блока:
  - `Total supply` = `marketTotalSuppliedUSD`
  - `Supply` = `marketAvailableLiquidityUSD`
  - `Borrowing` = `marketTotalBorrowedUSD`  
  *(именно эти 3 метрики ты просил в "compound‑блоке")*

### 5.4. Исторические APR через индексы (как рекомендует Aavescan)
Исторические ставки считаем **не из "current rate"**, а через рост индексов между двумя снапшотами.

**Общая формула для произвольного интервала:**

Пусть:
- `I0` = liquidityIndex в момент T0
- `I1` = liquidityIndex в момент T1
- `B0` = variableBorrowIndex в момент T0
- `B1` = variableBorrowIndex в момент T1
- `Δt` = (T1 - T0) в днях (точное количество дней как decimal)

Тогда рост:
- `gSupply = I1 / I0`
- `gBorrow = B1 / B0`

**Для APR за период Δt дней:**
- `dailyGrowthSupply = gSupply^(1/Δt)`
- `dailyGrowthBorrow = gBorrow^(1/Δt)`
- `APR_supply = (dailyGrowthSupply - 1) * 365`
- `APR_borrow = (dailyGrowthBorrow - 1) * 365`

**Для среднего APR за N дней** (например, 30d):
- `indexStart` = индекс на момент (now - N дней, endOfDay UTC)
- `indexNow` = индекс на момент (now, или последний доступный снапшот)
- `g = indexNow / indexStart`
- `dailyGrowth = g^(1/N)` где N — точное количество дней между снапшотами
- `avgAPR_N = (dailyGrowth - 1) * 365`

**Обработка пропусков данных:**
- Если нет снапшота на нужную дату: используем ближайший доступный (не более 2 дней разницы)
- Если разница > 2 дней: считаем данные недоступными, показываем "Insufficient data"
- При расчёте среднего: используем только дни с доступными данными

**В UI:**
- показываем **проценты**, без "pp" (требование: "pp вместо % не используй").
- формат: `12.34%` и для дельт: `(+0.12%)`, `(-0.08%)`.
- округление: 2 знака после запятой для APR

### 5.5. Liquidity Impact — модель кривой

**Формула кривой:**
Используем стандартную формулу Aave для расчёта utilization rate и новых ставок после изменения ликвидности.

**Алгоритм:**
1) Берём текущее состояние резерва (availableLiquidity, totalDebt, params)
2) Применяем сценарий (Deposit/Borrow/Repay/Withdraw) с указанной суммой
3) Пересчитываем:
   - `newAvailableLiquidity = currentAvailableLiquidity ± scenarioAmount`
   - `newTotalDebt = currentTotalDebt ± scenarioAmount` (для Borrow/Repay)
   - `newUtilization = newTotalDebt / (newTotalDebt + newAvailableLiquidity)`
4) Применяем формулу ставок Aave на основе `newUtilization` и параметров резерва (optimalUtilization, baseRate, slope1, slope2)
5) Считаем дельты: `ΔUtilization`, `ΔSupplyAPR`, `ΔBorrowAPR`

**Визуализация кривой:**
- Мини-график показывает utilization rate (x-axis) vs APR (y-axis)
- Отмечаем текущую точку и новую точку после сценария
- Используем ECharts для отрисовки

---

## 6) Подтверждённые изменения UX относительно Aavescan

### 6.1. Market page: верхний блок как compound.finance
Замена двух маленьких карточек (Total supplied/borrowed со sparkline) на большой блок:

- бар‑чарт динамики (time range переключатель 30d / 6m / 1y)
- справа/сверху три метрики:
  - Total supply (USD)
  - Supply (USD, available liquidity)
  - Borrowing (USD)
- Абсолютные значения (USD), формат как у Aavescan.

### 6.2. Market table: 30d APR → микробары Borrow + Δ30d
В колонке "30d APR":
- показываем **только borrow APR** (как ты выбрал).
- вместо sparkline делаем **микро‑барчарт** (ECharts).

**Спецификация микробаров:**
- Данные: 30 точек (по одной на день за последние 30 дней)
- При пропусках: линейная интерполяция между доступными точками
- Если доступно < 7 точек: показываем сообщение "Insufficient data" вместо графика
- Размер: минимум 100px ширина, 20px высота
- Масштаб: автоматический (min-max по данным)
- Цвет: градиент от минимального к максимальному значению

**Рядом отображаем:**
- `Δ30d` (в процентах), т.е. `last - first` по серии
- Формат: `(+0.12%)` или `(-0.08%)` с цветом (зелёный/красный)

**Tooltip по ховеру:**
- last (последнее значение)
- min (минимальное значение)
- max (максимальное значение)
- Δ30d (изменение за период)
- Дата первой точки
- Дата последней точки

### 6.3. Экспорт графиков
- **PNG/JPEG — убрать** (твоё требование).
- **SVG — убрать** (не включаем в MVP).
- **CSV:**
  - на Asset: "Download 90 days CSV" есть,
  - для market tables — если делаем export, кнопка **не акцентная** и под таблицей.

**Формат CSV:**
- Заголовки: Date, Supply APR (%), Borrow APR (%), Supplied (USD), Borrowed (USD), Utilization Rate (%), Price (USD)
- Формат даты: YYYY-MM-DD
- Разделитель: запятая
- Кодировка: UTF-8
- Округление: 2 знака после запятой для USD, 4 знака для APR и Utilization
- Пустые значения: оставляем пустыми (не "N/A" или "—")

### 6.4. Average lending rates
Секция "Average lending rates" — делаем **таблицей как у Aavescan**, стилистически как market‑таблица:
- строки: Supply APR, Borrow APR
- колонки: 1d, 7d, 30d, 6m, 1y

### 6.5. Сортировки
- На market и stablecoins таблицах — сортировка по **каждой колонке** (ASC/DESC).
- Дефолт как у Aavescan:
  - market: по Supplied ($) desc
  - stablecoins: по Supplied ($) desc
- Обработка null/undefined:
  - При сортировке по возрастанию: null/undefined в конце
  - При сортировке по убыванию: null/undefined в начале

---

## 7) Hardcodes "как у Aavescan" (без ручного копипаста)

Ты просил "те же хардкоды" и "не проходить второй раз" — значит делаем **генератор конфигов**.

### 7.1. Playwright скрейпер
В репозитории:
- `scripts/scrape-aavescan.ts`

Он должен собрать:
1) `data/markets.json`  
   Структура:
   ```json
   [
     {
       "marketKey": "ethereum-v3",
       "displayName": "Ethereum V3",
       "poolAddress": "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
       "subgraphId": "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g",
       "chainId": 1,
       "rpcUrls": [
         "https://eth.drpc.org",
         "https://eth.llamarpc.com",
         "https://rpc.ankr.com/eth",
         "https://ethereum-rpc.publicnode.com"
       ],
       "url": "https://aavescan.com/ethereum-v3"
     }
   ]
   ```

2) `data/stablecoins.json`  
   Список stablecoin tokens, которые присутствуют на `/stablecoins` (symbol + address если удаётся извлечь из ссылок).
   Структура:
   ```json
   [
     {
       "symbol": "USDC",
       "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
       "markets": ["ethereum-v3", "arbitrum-v3"]
     }
   ]
   ```

3) `data/liquidityImpactScenarios.json`
   Сценарии из таблицы Liquidity impact:
   - 4 действия: Deposit/Borrow/Repay/Withdraw
   - суммы: `$100M`, `$250M`, `$500M`, `$1B`
   - (если на некоторых рынках/активах список отличается — сохраняем per‑market/per‑asset override)
   Структура:
   ```json
   {
     "default": [
       { "action": "Deposit", "amount": "100000000" },
       { "action": "Deposit", "amount": "250000000" },
       { "action": "Deposit", "amount": "500000000" },
       { "action": "Deposit", "amount": "1000000000" },
       { "action": "Borrow", "amount": "100000000" },
       ...
     ],
     "overrides": {
       "ethereum-v3/0x...": [...]
     }
   }
   ```

> Примечание: Aavescan в HTML отдаёт ссылки на ассеты. В большинстве случаев `href` содержит адрес токена — это используем как источник истины.

### 7.2. Обновление конфигов
- Скрипт запускается вручную при необходимости обновления списка рынков/стейблов
- Команда: `pnpm scrape-aavescan`
- Результат сохраняется в `data/*.json`
- Версионируется в git

---

## 8) Конфигурация (ENV)

### 8.1. Обязательные
- `AAVEKIT_GRAPHQL_URL=https://api.v3.aave.com/graphql`
- `GRAPH_API_KEY=...` *(The Graph gateway)*
- `AAVE_SUBGRAPH_ID=Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g` *(проверено для Ethereum V3, для других сетей берётся из markets.json)*

### 8.2. RPC список (с failover)
- `ETH_RPC_URLS` (CSV или JSON‑строка):
  - `https://eth.drpc.org`
  - `https://eth.llamarpc.com`
  - `https://rpc.ankr.com/eth`
  - `https://ethereum-rpc.publicnode.com`
  - `https://cloudflare-eth.com` *(может падать, но пусть будет последним)*

**Примечание:** Для других сетей RPC URLs берутся из `data/markets.json`.

### 8.3. Опциональные
- `CACHE_TTL_LIVE=60` (секунды для live данных, по умолчанию 60)
- `CACHE_TTL_SNAPSHOTS=21600` (секунды для снапшотов, по умолчанию 6 часов)
- `CACHE_MAX_SIZE=1000` (максимальное количество записей в кэше)
- `LOG_LEVEL=info` (debug, info, warn, error)

---

## 9) Серверные модули и методы (точные реализации, которые мы проверили)

### 9.1. Маппинг poolAddress -> poolEntityId (Subgraph)
Алгоритм:
1) Из market config берём `poolAddress` (например `0x87870...`).
2) Запрос в субграф:
```graphql
query PoolByAddress($pool: String!) {
  pools(where: { pool: $pool }) { id pool lastUpdateTimestamp }
}
```
3) Берём `pools[0].id` — это `poolEntityId`.
4) Кэшируем результат на 24 часа.

> Это исправило ошибку "Pool not found by pools(where:{pool})", когда пытались подставлять `Pool.id` вместо `Pool.pool`.

### 9.2. Timestamp -> block (через RPC)
Мы отказались от blocks‑subgraph (он был "subgraph not found"), поэтому используем RPC.

Требование:
- найти блок **с timestamp <= targetTs**, максимально близкий.

Реализация:
1) `eth_getBlockByNumber("latest", false)` → `latestNumber`, `latestTimestamp`.
2) Быстрая оценка `est = latestNumber - (latestTimestamp - targetTs)/12` (12с как среднее) и clamp в диапазон.
3) Дальше `binary search` по номеру блока:
   - `mid = floor((lo+hi)/2)`
   - `eth_getBlockByNumber(hex(mid), false)` → timestamp
   - если ts <= targetTs → lo = mid, else hi = mid-1
4) На любом RPC‑фейле → failover на следующий URL из списка RPC для данной сети.
5) Кэшируем результат (blockNumber для конкретного timestamp) на 24 часа.

### 9.3. Daily snapshot (рынок) — 1 запрос в субграф на день
После того как есть `blockNumber` и `poolEntityId`:
```graphql
query ReservesAtBlock($poolId: String!, $block: Int!) {
  reserves(
    first: 1000,
    where: { pool: $poolId },
    block: { number: $block }
  ) {
    underlyingAsset
    symbol
    name
    decimals
    totalATokenSupply
    availableLiquidity
    totalCurrentVariableDebt
    totalPrincipalStableDebt
    liquidityIndex
    variableBorrowIndex
    utilizationRate
    liquidityRate
    variableBorrowRate
    price { priceInEth lastUpdateTimestamp }
    lastUpdateTimestamp
  }
}
```

Из этого строим:
- market totals (Total supply / Supply / Borrowing)
- per-asset daily snapshot rows (как у Aavescan)

---

## 10) BFF API (то, что реализуем в приложении)

### 10.1. Markets config
- `GET /api/v1/markets` → отдаёт `data/markets.json`
  - Response: `{ markets: Market[] }`
  - Кэш: нет (читаем из файла)

### 10.2. Market "live"
- `GET /api/v1/market/{marketKey}`
  - дергает AaveKit `market(request:{address,chainId})`
  - нормализует в формат UI таблицы
  - incentives не отдаёт
  - Response: `{ reserves: Reserve[], totals: MarketTotals }`
  - Кэш: 30-60 секунд

### 10.3. Market timeseries (для compound‑блока)
- `GET /api/v1/market/{marketKey}/timeseries?window=30d|6m|1y`
  - строит daily series по субграфу (по дням, endOfDay UTC)
  - кеширует результат
  - Response: `{ data: { date: string, totalSupply: number, supply: number, borrowing: number }[] }`
  - Кэш: 6-24 часа

### 10.4. Reserve page data
- `GET /api/v1/reserve/{marketKey}/{underlying}`
  - AaveKit `reserve(...)` → live данные
  - subgraph snapshots (daily/monthly) → история/таблицы/графики
  - Response: `{ live: ReserveData, history: HistoryData }`
  - Кэш: live 30-60 секунд, history 6-24 часа

### 10.5. Snapshots
- `GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/daily?days=90`
  - Response: `{ snapshots: DailySnapshot[] }`
- `GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/monthly?months=24`
  - Response: `{ snapshots: MonthlySnapshot[] }`
- CSV export:
  - `GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/daily.csv?days=90`
    - Content-Type: `text/csv; charset=utf-8`
    - Content-Disposition: `attachment; filename="daily-snapshots-{asset}-{days}d.csv"`
  - `GET /api/v1/reserve/{marketKey}/{underlying}/snapshots/monthly.csv?months=24`
    - Content-Type: `text/csv; charset=utf-8`
    - Content-Disposition: `attachment; filename="monthly-snapshots-{asset}-{months}m.csv"`
- Кэш: 6-24 часа

### 10.6. Liquidity impact
- `GET /api/v1/reserve/{marketKey}/{underlying}/liquidity-impact`
  - берёт live состояния (liquidity, available, debt, params)
  - применяет сценарии из `data/liquidityImpactScenarios.json`
  - считает newUtilization + new rates + Δ (в процентах)
  - Response: `{ scenarios: LiquidityImpactScenario[] }`
  - Кэш: 30-60 секунд (зависит от live данных)

### 10.7. Обработка ошибок API
Все endpoints возвращают стандартный формат ошибок:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {} // опционально
  }
}
```

Коды ошибок:
- `INVALID_MARKET` (400): невалидный marketKey
- `INVALID_ADDRESS` (400): невалидный адрес токена
- `MARKET_NOT_FOUND` (404): рынок не найден
- `RESERVE_NOT_FOUND` (404): резерв не найден
- `INSUFFICIENT_DATA` (404): недостаточно данных для запроса
- `RATE_LIMIT_EXCEEDED` (429): превышен лимит запросов
- `SERVICE_UNAVAILABLE` (503): внешний сервис недоступен
- `INTERNAL_ERROR` (500): внутренняя ошибка сервера

---

## 11) Тест‑план (чтобы "не второй раз")

### 11.1. Preflight (авто)
В репо должен быть `pnpm preflight`:
1) Проверить доступность AaveKit GraphQL.
2) Проверить доступность The Graph subgraph (через gateway) + `_meta.hasIndexingErrors`.
3) Проверить что pool mapping работает:
   - по `poolAddress` нашли `poolEntityId`
   - `reserves(where:{pool:poolEntityId})` отдаёт > 0
4) Проверить RPC:
   - получить latest block
   - найти blockAtOrBefore для вчерашнего endOfDay
5) Сгенерировать daily snapshot для 1 дня и убедиться:
   - reservesCount > 0
   - price выглядит как USD (для стейблов около 1.0)

**Выход:**
- При успехе: код 0, выводим "✓ All checks passed"
- При ошибке: код 1, выводим детали ошибки

### 11.2. Unit тесты
**Формулы расчёта:**
- Тесты для расчёта APR через индексы (различные интервалы)
- Тесты для total значений (supplied, borrowed, liquidity)
- Тесты для нормализации адресов
- Тесты для обработки пропусков данных

**Утилиты:**
- Тесты для timestamp -> block conversion
- Тесты для poolAddress -> poolEntityId mapping
- Тесты для кэширования (TTL, eviction)

### 11.3. Integration тесты
**BFF API:**
- Тесты для всех endpoints с моками внешних API
- Тесты для обработки ошибок (429, 5xx, timeout)
- Тесты для кэширования
- Тесты для rate limiting

### 11.4. UI acceptance
- Market page:
  - сортировка по Supplied desc по умолчанию
  - micro‑bar Borrow APR + Δ30d + tooltip
  - верхний compound‑блок строится и переключает окно
- Asset page:
  - top cards совпадают с live данными
  - daily snapshots (90 строк или меньше)
  - monthly snapshots корректно агрегируют
  - liquidity impact показывает 4 сценария на действие (100M/250M/500M/1B)
- Stablecoins:
  - без incentives тултипов
  - фильтр по market работает
- Charts:
  - supply-change и borrow-change работают
  - таблицы изменений и графики строятся

### 11.5. E2E тесты (опционально)
- Полный flow: загрузка market page → переход на asset → скачивание CSV
- Проверка производительности: страница загружается < 3 секунд

---

## 12) Приложение: Apps Script (то, чем мы реально дебажили)

> Это не обязательная часть прод‑кода. Это "инструментальный" код для проверки схем/эндпоинтов, который у нас реально работал, включая failover RPC.  
> Если хочешь — Cursor может перенести логику в Node.

Вынеси в `tools/apps-script/Code.gs` (как отдельный файл в репо) — см. следующий блок.

```js
/**
 * Apps Script TOOLING (REFERENCE)
 * - AaveKit GraphQL introspection
 * - The Graph subgraph smoke
 * - Daily snapshot via RPC timestamp->block + subgraph block query
 *
 * НИЧЕГО НЕ ХАРДКОДИМ как секреты — задаём Script Properties:
 * - GRAPH_API_KEY
 * - AAVE_SUBGRAPH_ID (по умолчанию: Cd2gEDV... )
 */

const CFG = {
  AAVEKIT_URL: "https://api.v3.aave.com/graphql",
  SUBGRAPH_ID_DEFAULT: "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g",
  OUTPUT_FOLDER_NAME: "aavescan-clone-debug",
  ETH_RPC_URLS: [
    "https://eth.drpc.org",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://ethereum-rpc.publicnode.com",
    "https://cloudflare-eth.com",
  ],
};

function subgraphEndpoint_() {
  const p = PropertiesService.getScriptProperties();
  const key = p.getProperty("GRAPH_API_KEY");
  const id = p.getProperty("AAVE_SUBGRAPH_ID") || CFG.SUBGRAPH_ID_DEFAULT;
  if (!key) throw new Error("Set GRAPH_API_KEY in Script Properties");
  if (!id) throw new Error("Set AAVE_SUBGRAPH_ID in Script Properties");
  return `https://gateway.thegraph.com/api/${key}/subgraphs/id/${id}`;
}

function gql_(url, query, variables) {
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ query, variables: variables || {} }),
    muteHttpExceptions: true,
  });
  const text = res.getContentText();
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error("Non-JSON: " + text.slice(0, 200)); }
  if (json.errors) throw new Error("GraphQL errors: " + JSON.stringify(json.errors));
  return json.data;
}

function getOrCreateFolder_() {
  const it = DriveApp.getFoldersByName(CFG.OUTPUT_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(CFG.OUTPUT_FOLDER_NAME);
}

function saveJson_(filename, obj) {
  const folder = getOrCreateFolder_();
  const file = folder.createFile(filename, JSON.stringify(obj, null, 2), MimeType.PLAIN_TEXT);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/** ===== The Graph: pool mapping ===== */
function subgraph_getPoolEntityIdByPoolAddress_(poolAddressLower) {
  const q = `
    query PoolByAddress($pool: String!) {
      pools(where: { pool: $pool }) { id pool lastUpdateTimestamp }
    }
  `;
  const data = gql_(subgraphEndpoint_(), q, { pool: poolAddressLower });
  if (!data.pools || data.pools.length === 0) return null;
  return data.pools[0].id;
}

/** ===== RPC helper with failover ===== */
function ethRpc_(method, params) {
  const payload = { jsonrpc: "2.0", id: 1, method, params: params || [] };
  let lastErr = null;

  for (const url of CFG.ETH_RPC_URLS) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      const txt = res.getContentText();
      const json = JSON.parse(txt);
      if (json.error) throw new Error(JSON.stringify(json.error));
      return { url, result: json.result };
    } catch (e) {
      lastErr = { url, message: String(e) };
    }
  }
  throw new Error("RPC all failed: " + JSON.stringify(lastErr));
}

function hexToInt_(hex) { return parseInt(hex, 16); }
function intToHex_(n) { return "0x" + n.toString(16); }

function getLatestBlock_() {
  const r = ethRpc_("eth_getBlockByNumber", ["latest", false]);
  const b = r.result;
  return {
    rpcUsed: r.url,
    number: hexToInt_(b.number),
    timestamp: hexToInt_(b.timestamp),
  };
}

function getBlock_(n) {
  const r = ethRpc_("eth_getBlockByNumber", [intToHex_(n), false]);
  const b = r.result;
  return {
    rpcUsed: r.url,
    number: n,
    timestamp: hexToInt_(b.timestamp),
  };
}

/** Find block with timestamp <= targetTs (UTC seconds) */
function findBlockAtOrBefore_(targetTs) {
  const latest = getLatestBlock_();
  const avgBlockTime = 12;
  let est = Math.floor(latest.number - (latest.timestamp - targetTs) / avgBlockTime);
  if (est < 1) est = 1;
  if (est > latest.number) est = latest.number;

  // Bracket
  let lo = Math.max(1, est - 50000);
  let hi = Math.min(latest.number, est + 50000);

  // Expand until bracket contains target
  while (lo > 1 && getBlock_(lo).timestamp > targetTs) lo = Math.max(1, lo - 50000);
  while (hi < latest.number && getBlock_(hi).timestamp < targetTs) hi = Math.min(latest.number, hi + 50000);

  // Binary search
  let best = lo;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const bm = getBlock_(mid);
    if (bm.timestamp <= targetTs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const b = getBlock_(best);
  return { rpcUsed: b.rpcUsed, number: best, timestamp: b.timestamp };
}

/** ===== Daily snapshot smoke ===== */
function runDailySnapshotSmoke() {
  // Ethereum V3 pool address from our logs
  const poolAddress = "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2";
  const poolEntityId = subgraph_getPoolEntityIdByPoolAddress_(poolAddress);

  if (!poolEntityId) throw new Error("Pool not found in subgraph by pool address");

  const dayIso = "2026-01-11"; // any day
  const endTs = Math.floor(new Date(dayIso + "T23:59:59Z").getTime() / 1000);

  const blk = findBlockAtOrBefore_(endTs);

  const q = `
    query ReservesAtBlock($poolId: String!, $block: Int!) {
      _meta { hasIndexingErrors block { number } }
      reserves(first: 1000, where: { pool: $poolId }, block: { number: $block }) {
        underlyingAsset
        symbol
        decimals
        totalATokenSupply
        availableLiquidity
        totalCurrentVariableDebt
        totalPrincipalStableDebt
        liquidityIndex
        variableBorrowIndex
        utilizationRate
        liquidityRate
        variableBorrowRate
        price { priceInEth }
      }
    }
  `;
  const data = gql_(subgraphEndpoint_(), q, { poolId: poolEntityId, block: blk.number });

  Logger.log("rpcUsed=" + blk.rpcUsed + " block=" + blk.number + " ts=" + blk.timestamp);
  Logger.log("reservesCount=" + data.reserves.length);
  const url = saveJson_("DAILY_SNAPSHOT_SMOKE_" + dayIso + ".json", { dayIso, endTs, blk, poolEntityId, data });
  Logger.log("Saved: " + url);
}
```

---

## 13) Ограничения/реальность по рынкам (честно)

В ходе дебага мы **реально проверили** полный цикл (subgraph + rpc + снапшоты) на:
- **Ethereum V3** (pool address `0x87870...`, poolEntityId `0x2f39...`, subgraph id `Cd2g...`).

Чтобы 1:1 покрыть все рынки как у Aavescan, нужно:
- добавить per‑market:
  - правильный subgraph id (под соответствующую сеть),
  - RPC endpoints для этой сети.
- Это выносится в `data/markets.json` и расширяется постепенно.

**План расширения:**
1. MVP: только Ethereum V3
2. Phase 2: добавить Arbitrum V3, Polygon V3 (после проверки subgraph IDs и RPC)
3. Phase 3: остальные сети по мере необходимости

---

## 14) Готовые критерии "DONE"

Задача считается выполненной, когда:

1) `/ethereum-v3` загружается < 2–3с, таблица резервов заполнена, сортировки работают.
2) Колонка 30d APR = микробар borrow + Δ30d + tooltip.
3) Верхний compound‑блок строится и переключает окна 30d/6m/1y.
4) `/ethereum-v3/{asset}`:
   - top cards отображаются,
   - daily snapshots (90d) строятся и CSV скачивается,
   - monthly snapshots строятся и CSV скачивается,
   - liquidity impact работает и выдаёт 4 строки сценариев на действие.
5) `/stablecoins` работает, market filter работает, incentives нигде не отображаются.
6) `/ethereum-v3/supply-change` и `/ethereum-v3/borrow-change` работают (без Pro‑ограничений).
7) Все preflight проверки проходят успешно.
8) Unit тесты для формул проходят.
9) BFF API возвращает корректные данные и обрабатывает ошибки.

---

## 15) Производительность и мониторинг

### 15.1. Целевые метрики
- Время загрузки страницы: < 3 секунд (first contentful paint)
- Время ответа BFF API: < 500ms для live данных, < 2s для исторических
- Размер bundle: минимизировать, использовать code splitting

### 15.2. Логирование
**Уровни:**
- `debug`: детальная информация для разработки
- `info`: обычные операции (запросы, кэш hits)
- `warn`: предупреждения (fallback на stale cache, RPC failover)
- `error`: ошибки (API failures, невалидные данные)

**Формат:**
```json
{
  "timestamp": "2026-01-11T12:00:00Z",
  "level": "info",
  "service": "bff",
  "endpoint": "/api/v1/market/ethereum-v3",
  "duration": 234,
  "cache": "hit",
  "message": "Request completed"
}
```

### 15.3. Метрики для мониторинга
- Количество запросов по endpoint
- Успешность запросов (success rate)
- Время ответа (p50, p95, p99)
- Cache hit rate
- Количество ошибок по типу
- RPC failover rate

---

## Приложение A: Глоссарий

- **Market**: рынок Aave (например, Ethereum V3, Arbitrum V3)
- **Reserve**: отдельный актив в пуле (например, USDC, WETH)
- **Pool**: контракт пула ликвидности Aave
- **Pool.id**: идентификатор пула в субграфе (не равен адресу пула)
- **Pool.pool**: адрес контракта пула
- **Snapshot**: состояние резерва/рынка на конкретный момент времени (блок)
- **APR**: годовая процентная ставка (Annual Percentage Rate)
- **Protocol APR**: APR только от протокола (без incentives)
- **Utilization Rate**: коэффициент использования ликвидности (debt / (debt + available))
- **BFF**: Backend For Frontend (серверный слой приложения)

---

## Приложение B: Ссылки и ресурсы

- Aavescan: https://aavescan.com
- AaveKit GraphQL API: https://api.v3.aave.com/graphql
- The Graph Gateway: https://gateway.thegraph.com
- Aave Protocol: https://aave.com

---

**Версия документа:** 1.0  
**Дата:** 2026-01-11  
**Статус:** FINAL