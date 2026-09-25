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


## Late-season context v3
NBA and WNBA now include a conservative standings-based late-season modifier:
- likely-clinched teams: small downward total adjustment for possible rest/rotation risk
- bubble/seeding teams: small positive motivation adjustment
- likely-eliminated teams: Hot Score confidence penalty for rotation volatility
- visible late-season context note in each affected card

This is deliberately a small modifier. It does not claim to know a coach's exact lineup plan.


## All-sports late-season context v4
The context layer now covers every ALT25 sport:
- NFL: playoff / seeding / elimination context when standings support it
- NCAA: conservative late-season record/stakes context only; it does not invent playoff status
- NBA: playoff / seeding / elimination context
- WNBA: playoff / seeding / elimination context
- MLB: playoff / seeding / elimination context with smaller run adjustments

The model treats this as a modifier, not as a replacement for the sport's core totals model. When context is uncertain, confidence is reduced instead of forcing a directional total change.


## NFL Top 10 WR ALT Matchups
Added to the NFL page. It identifies the 10 defenses allowing the highest opponent passing yards per completion, checks the current week's upcoming opponents, then ranks qualifying wide receivers using the defensive matchup plus season receiving production. It does not add a paid player-prop market request to The Odds API.


## WR matchup bug fix
Fixed the ESPN schedule parser so each weekly matchup includes `homeId` and `awayId`.
The WR matchup builder needs those team IDs to retrieve the offense's WR depth chart.
Without them, the defense filter worked but no WR candidates could be attached, producing
"No qualifying WR matchups found." The ranking logic and Odds API usage are unchanged.


## WR matchup v6 reliability fix
- changed the cache key so the old empty WR result is not reused
- stopped relying on ESPN's year-wide scoreboard request for prior games
- explicitly loads recent completed NFL game dates
- uses current team rosters to identify true WRs
- calculates each WR's production from actual completed-game receiving boxscores
- adds diagnostics to the empty-state message so future feed failures can be identified immediately
