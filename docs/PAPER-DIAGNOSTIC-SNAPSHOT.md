# Paper trading diagnostic snapshot
Generated 2026-09-14T21:45:48.256Z. Simulated money only.
Closed trades: 43; wins: 9; win rate: 20.93%; realized P&L: $-376.51.
Cached-mark equity: $9661.77. Reconciliation difference: 3.183231456205249e-12.

## Separate categories
| Category | Closed trades | Win rate | Net P&L |
|---|---:|---:|---:|
| regular | 40 | 20.00% | $-323.36 |
| stocks | 11 | 27.27% | $-68.30 |
| crypto | 29 | 17.24% | $-255.06 |
| memes | 2 | 0.00% | $-53.84 |

## Existing chronological replay
Each row uses an independent simulated account. Cached windows may overlap across agents. Do not pool rows as independent evidence.
| Agent | Strategy | Trades | Win rate | Net P&L |
|---|---|---:|---:|---:|
| btc | meanReversion | 6 | 0.00% | $-89.92 |
| btc | momentum | 6 | 16.67% | $-83.85 |
| btc | trendFollowing | 4 | 50.00% | $-8.72 |
| spy | meanReversion | 5 | 0.00% | $-26.63 |
| spy | momentum | 1 | 100.00% | $8.85 |
| spy | trendFollowing | 2 | 100.00% | $14.52 |
| qqq | meanReversion | 6 | 0.00% | $-39.15 |
| qqq | momentum | 1 | 100.00% | $9.20 |
| qqq | trendFollowing | 4 | 75.00% | $18.36 |
| gld | meanReversion | 16 | 0.00% | $-281.41 |
| gld | momentum | 0 | not available | $0.00 |
| gld | trendFollowing | 5 | 100.00% | $41.16 |
| uso | meanReversion | 6 | 0.00% | $-114.44 |
| uso | momentum | 3 | 100.00% | $104.71 |
| uso | trendFollowing | 8 | 75.00% | $173.87 |
| freya | meanReversion | 6 | 0.00% | $-84.79 |
| freya | momentum | 5 | 20.00% | $-41.23 |
| freya | trendFollowing | 7 | 14.29% | $-163.37 |
| tyr | meanReversion | 6 | 0.00% | $-96.79 |
| tyr | momentum | 7 | 0.00% | $-117.34 |
| tyr | trendFollowing | 5 | 0.00% | $-79.04 |
| baldr | meanReversion | 5 | 0.00% | $-26.63 |
| baldr | momentum | 1 | 100.00% | $8.85 |
| baldr | trendFollowing | 2 | 100.00% | $14.52 |
| heimdall | meanReversion | 6 | 0.00% | $-39.15 |
| heimdall | momentum | 1 | 100.00% | $9.20 |
| heimdall | trendFollowing | 4 | 75.00% | $18.36 |
| vidar | meanReversion | 16 | 0.00% | $-281.41 |
| vidar | momentum | 0 | not available | $0.00 |
| vidar | trendFollowing | 5 | 100.00% | $41.16 |
| dogeMomentum | meanReversion | 14 | 0.00% | $-358.57 |
| dogeMomentum | momentum | 8 | 0.00% | $-203.19 |
| dogeMomentum | trendFollowing | 9 | 0.00% | $-229.52 |
| shibMomentum | meanReversion | 11 | 0.00% | $-269.18 |
| shibMomentum | momentum | 9 | 0.00% | $-240.95 |
| shibMomentum | trendFollowing | 9 | 0.00% | $-243.48 |

## Interpretation and limits
- Negative net results are evidence against promoting these current settings to real money; this report does not alter positions or settings.
- High percentages from one or a few trades are not validated win rates. No 75–80% target has been demonstrated.
- The replay uses cached history, fixed 10% sizing and 2% stops, not the exact live-paper entry policy. It does not prove bars were unseen during prior development.
- Replay buy-and-hold uses full capital while strategies deploy 10% per entry; raw P&L comparisons are not exposure-matched.
- Further work: independent forward paper evaluation, exposure-matched baselines, larger disjoint windows and historical execution-cost data.
- Market-history validation now rejects insufficient, nonfinite, impossible-range or duplicate/out-of-order candles before entry/replay calculations. This prevents bad inputs; it does not manufacture profitable signals.
