# ALT25 — Smart Multi-Sport v2

This build upgrades the non-NFL models without increasing the paid Odds API market/region footprint.

## What stays the same
- NFL model and NFL 2-hour odds cache
- NCAA / NBA / WNBA / MLB tabs
- only Top 3 selections for non-NFL sports
- literal ALT25 +/- 2.5 cushion
- US region + totals market only
- 6-hour paid odds cache for non-NFL sports
- lazy loading: a non-NFL sport is queried only when its tab is opened

## Smarter non-NFL inputs
All non-NFL models now use:
- recent scoring offense
- recent scoring defense
- last-three scoring trend
- home/away splits
- rest days
- scoring / total volatility
- sportsbook consensus depth

NBA/WNBA:
- basketball-specific rest adjustment, including short-rest/back-to-back style penalties

NCAA:
- football-specific recent-form, defense, home/away and rest adjustments

MLB:
- recent runs scored/allowed
- home/away run context
- recent trend and volatility
- probable starting pitchers and season ERA when available from the public MLB Stats API

## API-credit impact
No additional Odds API markets or regions were added. The new intelligence comes from public/free statistical feeds and calculations inside ALT25. MLB Stats API calls and ESPN public-data calls do not consume The Odds API quota.

## Important
The non-NFL models are still experimental. Hot Score is a ranking score, not a win probability. Backtesting is the next major step for calibration.
