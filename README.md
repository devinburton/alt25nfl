# ALT25 — Multi-Sport Totals

This build keeps the NFL Always-On behavior and expands ALT25 beyond NFL-only branding.

## Navigation
- NFL
- NCAA Totals
- NBA Totals
- WNBA Totals
- Baseball Totals

## NFL
NFL remains the full board with:
- All Games
- Overs
- Unders
- Hot Picks
- Always-On / Early Board / Next Slate modes
- existing weather, injuries, efficiency, Hot Score and 2-hour Odds API cache

The old 3-Leg Parlay and Sunday Lottery tabs are removed.

## Other sports
NCAA, NBA, WNBA and MLB display only the **top 3 model-rated totals** from the next relevant slate (or fewer when fewer games exist).

- NCAA uses the nearest weekly slate.
- NBA/WNBA/MLB use the next game-day slate.
- Offseason sports stay visible but make no paid odds call after the free active-sports check says they are inactive.
- Other-sport odds are cached for 6 hours.
- Tabs are lazy-loaded: a non-NFL league is not queried until you click its tab.

## Data / model
The Odds API supplies consensus totals. ESPN public scoreboard data supplies recent scoring results for the non-NFL models.

The non-NFL models are sport-specific recent scoring/defense models anchored to the market total. They are intentionally simpler than the NFL model and do not pretend to use unavailable metrics.

The ALT25 2.5-point/run cushion is preserved across sports.

## Required Vercel variable
ODDS_API_KEY
