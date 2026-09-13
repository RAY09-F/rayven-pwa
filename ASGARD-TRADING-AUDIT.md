# ASGARD trading audit and upgrade status

Verified September 12, 2026 (Pacific). Paper simulation only.
Live release: `1449c8cb-99f2-4a0c-9441-5bdabd5305c0`.

## What happened to the money

| Measure | Audited amount |
|---|---:|
| Starting paper capital | $10,000.00 |
| Available cash | $5,771.94 |
| Cost of open positions, including entry fees | $3,889.26 |
| Cached marked value of open positions | $3,918.77 |
| Total marked account equity | $9,690.70 |
| Realized closed loss | -$338.81 |
| Unrealized open gain | +$29.51 |
| Total marked loss | -$309.30 |

Cash had been mistaken for total account value. Open positions account for most
of the difference; this is not a $5,000 realized loss. Reconciliation is within
floating-point rounding. Stock marks are from the previous market session, not
live Saturday quotes. Exit costs are not deducted from marked equity. Original
trade records and the account were preserved; no reset was used to improve results.

The strategies nevertheless performed poorly. The regular automatic book had
6 wins in 36 closes (16.67%); two meme closes both lost. Small mean-reversion
targets could not cover modeled round-trip costs. A short chronological replay
of three fixed strategies over five crypto markets produced losses in all 15
combinations after costs. No 75–80% win rate, profitability, or live-money
readiness has been demonstrated.

## Trading tasks

| Requested task | Delivered and remaining limits |
|---|---|
| 1. Unseen historical tests | Added chronological 60/40 replay split with next-bar execution. Crypto replay uses 720 available bars, 288 held out. Cannot establish that those historical periods were never examined during earlier development. Stock history remains insufficient. |
| 2. Market regimes | Added trending, sideways, and volatile classifications and replay breakdowns. The short sample does not guarantee adequate examples of every regime. |
| 3. Spread and depth | Crypto paper entries and exits use available Kraken bid/ask depth and VWAP. Missing/insufficient entry depth blocks entry; exits retain a documented candle fallback. Historical depth and stock spread remain modeled. |
| 4. Unrealized loss and drawdown | Added cash versus equity, marked position value, unrealized P/L, reconciliation, equity peak, drawdown and an 8% marked drawdown entry guard. Legacy cash points are not presented as equity. |
| 5. Correlated exposure | Added same-instrument stacking checks and group allocation caps: crypto 25%, other groups 30%; existing meme allocation cap remains. Group proxies are not measured dynamic correlations. |
| 6. Meme screening | Added available order-book liquidity and order participation checks, alongside portfolio limits. On-chain holder concentration remains unavailable; it is not inferred from order-book data. |
| 7. Decision reasons | Records accepted, held and rejected outcomes in a recent journal, with durable archived decisions/trades and separate cycle error health. |
| 8. Baselines | Three fixed strategies compare against cash and buy-and-hold using independent replay balances and modeled fees/slippage. Stock results await enough archived bars. |
| 9. Independent accounts | Each replay experiment starts with its own $10,000 simulated balance. The ongoing paper agents still share the original account; persistent separate live-paper experiment accounts remain future work. |
| 10. Ledger and health | Deployed serialized SQLite Durable Object transactions for paper state, fills and cycle markers, copied forward from KV; added scheduler heartbeat and dashboard alerts. No new outbound telephone alert subscription was created. |

Additional entry checks require adequate data, cost coverage, and a cooldown
after five consecutive recent losses. Missing volume no longer qualifies a
momentum signal. Missing ADX no longer qualifies a trend signal. These controls
may reduce trade count; they do not create a proven profitable strategy.

The new `paper_research_replay` tool is available through the agent tool catalog
and Odin's research mini-agents. It compares historical simulations; it does not
send real orders. Eleven lab tools are now cataloged, 457 local tools overall.

Fee assumptions remain explicit. The modeled Kraken base taker fee is 0.80%
per side, as checked against the [official fee schedule](https://www.kraken.com/features/fee-schedule).
That is a simulation assumption, not a claim about a connected account's tier.
Depth and candles use the official [order book](https://docs.kraken.com/api-reference/market-data/get-order-book)
and [OHLC](https://docs.kraken.com/api-reference/market-data/get-ohlc-data) data.

## PC and visual tasks

| Requested task | Delivered and remaining limits |
|---|---|
| 1. Crown wallpaper | Created and installed a dark ASGARD crown wallpaper; Thor version applied. |
| 2. Agent palettes | Installed Thor, Loki and Odin wallpaper variants; paired helper follows the selected agent when Match desktop is enabled. |
| 3. Gaming mode | Added a persisted Settings switch that pauses decorative humanoid rendering and CSS animation. Normal motion is restored when disabled. No Fortnite FPS gain is claimed. |
| 4. Windows accents and icons | Added reversible matching Windows accent colors; retained existing ASGARD app icons. An additional desktop shortcut was not created because automatic approval review blocked the command. |
| 5. Sensor display | Added live GPU temperature/utilization and free memory to the paired command center. Game frame times and CPU temperature are not measured; that part remains pending. |
| 6. Fan rings | Existing working RGB palettes retained. Controller is configured as four generic 32-LED strips. Lian Li brand alone does not identify the LED layout; exact ring-only mapping needs the model or a supervised physical mapping test. |
| 7. Transitions and sleep | Added a brief brightness dip during agent switches and persisted Sleep lights/Wake lights controls. This is not a per-LED color crossfade. Lights are currently on. |
| 8. Mobile trading charts | Added responsive marked-equity chart and UTC date filters. Only correctly valued samples are plotted; historical cash-only samples are excluded. |
| 9. Sounds | Added optional agent-specific chimes for agent changes and completed replies, off by default. |
| 10. Second screen | Deployed a command center with account metrics, scheduler status, local sensors and full-screen control. |

Use [ASGARD](https://asgrard-backend.rayanfahil2.workers.dev/),
[Trading research](https://asgrard-backend.rayanfahil2.workers.dev/trading-lab.html),
or [Command center](https://asgrard-backend.rayanfahil2.workers.dev/command-center.html).
Desktop controls are in ASGARD Settings. Sensor readings require the existing
paired browser on this PC. Cloud paper scheduling continues without the PC;
wallpaper and RGB control require the PC and local helper.

## Verification and recovery

- 163 automated checks passed, including actual ledger code tested with SQLite
  for copy-forward migration, transaction rollback and serialization, plus
  valuation, cost rejection, order-book execution and replay lookahead checks.
- Live account reconciled; scheduled cycle reported healthy after migration.
- Browser verified account metrics, research results, gaming toggle, desktop
  match control and real local GPU telemetry.
- Root index and public index match. The original KV data is retained.
- Desktop original wallpaper/accent is backed up in the local helper directory;
  Restore desktop uses it. Sleep lights preserves the saved brightness.
- IMPORTANT: paper state now lives in PAPER_LEDGER. Recovery must retain its
  binding and SQLite migration and forward-fix code. Redeploying old KV-only
  trading code would read stale state after new trades; do not do that.

Audit JSON, replay results and test output are in the parent `deliverables`
directory. Remaining work is identified explicitly above rather than reported
as completed.
