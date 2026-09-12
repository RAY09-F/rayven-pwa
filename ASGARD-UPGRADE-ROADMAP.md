# ASGARD upgrade record — 12 September 2026

## What this release does

- Keeps all trades simulated and all existing real-money execution blocks in place.
- Adds two cloud-run, five-minute meme-coin experiments: DOGE/SKOLL and SHIB/HATI. Kraken's public pair listing was checked before adding them.
- Separates stock/ETF, non-meme crypto, combined regular-market, and meme-coin results. All categories still share the existing simulated portfolio, not separate funded accounts.
- Adds /trading-lab.html with closed automatic trade counts, net realized P/L, historical win rate, average net per trade, profit factor and trailing three-hour results. Manual demos are excluded. No-trade win rates remain unavailable, not fabricated.
- Rejects malformed/unfinished candles and stale crypto feeds. Checks stops even when the strategy candle was already processed, models gap-down stops, and refreshes the daily loss limit after each close.
- Preserves the 3% realized daily-loss limit, existing position limits, and adds a 10% combined meme allocation ceiling. Fees are included in position sizing.
- Uses 0.80% per-fill crypto taker fees as a conservative Tier 1 assumption verified from Kraken's current schedule; crypto slippage remains modeled, with a larger 0.50% meme assumption. These are not account-specific quotes. Historical records are not rewritten.
- Runs in Cloudflare's existing five-minute schedule independently of the PC. Stock/ETF experiments respect regular US exchange sessions. No quota forces entries; 20–30 completed trades per 2–3 hours is not guaranteed or a quality criterion.

Baseline before release: 35 retained closed trades, 7 wins (20%), net realized PAPER P/L −$241.83. This is not evidence for deploying real capital. Cash is not equity when positions are open.

## Ten tasks to make the research system smarter

1. **Data integrity — implemented in this release:** closed candles, malformed-feed rejection, crypto staleness checks. Next: exchange-aligned stock aggregation and missing-bar detection.
2. **Separate experiments — implemented:** regular markets and DOGE/SHIB categories. Next: genuinely isolated paper books with independent cash and attribution.
3. **Honest performance — implemented:** sample counts, profit factor, average net result, manual-demo exclusion. Next: full mark-to-market drawdown and confidence intervals adjusted for correlated trades.
4. **Realistic execution — partly implemented:** modeled costs, gap-aware stops and fee-aware sizing. Next: order-book spread, depth, market impact, entry-candle tick stops and delayed-fill simulation. Current fills remain candle-based approximations.
5. **Walk-forward validation — planned:** train on past windows, freeze parameters, then score unseen windows; retain every failed variant to expose selection bias.
6. **Market regime comparison — planned:** compare momentum and mean reversion across trending, sideways and high-volatility periods. Keep a no-trade baseline.
7. **Portfolio risk — partly implemented:** immediate daily-loss checks and bounded meme exposure. Next: correlated exposure across every agent, unrealized-loss limits and volatility stress tests.
8. **Meme screening — planned:** liquidity, spread, volume quality, concentration and contract-risk evidence before expanding beyond exchange-listed DOGE/SHIB. Never treat “unknown” as safe.
9. **Decision journal — existing basic journals, expansion planned:** preserve signal version, input timestamps, rejected-entry reason, modeled fills and outcome; summarize recurring failures without changing strategies automatically.
10. **Durable execution and health — planned:** one serialized durable paper ledger, idempotent fills, replay/recovery tests, scheduler heartbeat and stale-feed alerts. Existing KV writes are not a transactional exchange ledger.

A target win rate is a research hypothesis. Eight $1 wins and two $10 losses still lose $12 before any additional costs. Increasing risk does not create an edge. Have a qualified financial professional review any future live-capital plan.

## Ten visual / PC experience tasks

These are proposed next tasks, not silently installed changes.

1. A static 4K ASGARD Crown wallpaper with deliberate empty space for desktop icons.
2. Agent-themed wallpaper palettes that switch with Thor/Loki/Odin, separate from the RGB sleep override.
3. A gaming profile that pauses decorative animation while retaining voice and cloud monitoring.
4. One coordinated Windows cursor/accent/icon palette with readable contrast.
5. An optional compact desktop status strip for temperatures, frame time and ASGARD connection health.
6. A physical fan-ring layout map so accent colors follow real LED zones precisely.
7. Smooth, restrained RGB transitions with a persistent lights-off override.
8. A mobile trading observatory with quick range filters and readable chart tooltips.
9. A unified notification style and short agent-specific sounds, with quiet-hours controls.
10. A clean secondary-monitor command display with calendar, tasks and genuine system metrics.

## Fortnite findings and reversible changes

Observed hardware: Ryzen 7 5700X; RTX 5060 Ti; 32 GB DDR4 configured at 3200 MT/s. Windows power plan was Balanced. Saved Fortnite configuration was 1920×1080, VSync off, low shadows/effects/textures, ES3.1 feature preference, Epic view distance and a 240 FPS cap. No Fortnite process was running during the edit.

Backups: `%LOCALAPPDATA%/ASGARD-Performance/GameUserSettings-before-*.ini`.
Changed only: FrameRateLimit 240 → 0 (uncapped benchmark), view distance 3 → 1 (Medium), bStopRenderingInBackground False → True.

Next benchmark: same map/replay, same resolution, a five-minute warm-up, then three comparable runs. Record average FPS, 1% low, frame-time spikes, CPU per-core load, GPU utilization, temperatures and clocks. Compare Performance rendering and DX12 separately after shader warm-up. An uncapped limit is for measurement; choose a stable cap afterward. Do not compare an empty Creative map with a busy Battle Royale match.

At very high FPS the CPU may be the limit, but it has not been measured here. No 650–750 FPS guarantee, overclock, BIOS tweak, security disabling, driver installation, or new power plan was applied. RAM already reports 3200 MT/s; there is no evidence here that enabling a memory profile will improve it. Restore the backup if visual clarity or pacing is worse. Game updates/cloud settings may overwrite the saved configuration.

## Business and tool ideas to validate

These are hypotheses, not revenue forecasts or researched proof of demand.

- **Missed-call follow-up assistant for local service businesses:** start with one consenting pilot business, measure recovered appointments, preserve call disclosure and approval controls.
- **Quote and meeting follow-up service:** convert the business's own notes into drafts, reminders and a daily summary; measure hours saved before pricing it.
- **Competitor change briefs:** monitor public business websites and prices, deliver sourced meaningful changes, and charge only after a customer validates usefulness.
- **ASGARD desktop personalization package:** repeatable logo, wallpaper and hardware-aware RGB setup; validate device compatibility and support time first.

Useful next tools: replay evaluator, dataset provenance inspector, experiment comparison, portfolio exposure viewer, feed-health inspector, benchmark recorder, and business-pilot tracker. None should claim a connection or performance result it has not measured.

## Sources checked

- Kraken OHLC: https://docs.kraken.com/api-reference/market-data/get-ohlc-data — final candle is uncommitted.
- Kraken fee schedule: https://www.kraken.com/features/fee-schedule — checked 12 September 2026; fee tiers vary.
- Epic FPS guidance: https://www.epicgames.com/help/c-34254770/c-38015632/a25544495
- FINRA frequent trading basics: https://syndication.finra.org/content/frequent-intraday-trading-understanding-basics

Validation scope: automated tests and live HTTP/data-feed checks; no live-money orders and no measured Fortnite gameplay benchmark. The broader research and visual roadmap remains future work.
