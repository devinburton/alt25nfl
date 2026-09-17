# ALT 2.5 — Credit Saver + Hot Picks + Parlays

This build keeps the 2-hour Odds API cache and includes two extra tabs without adding extra Odds API calls.

## Tabs
- All Games
- OVER Picks
- UNDER Picks
- 🔥 Hot Picks — top five model-rated games
- 🎯 3-Leg Parlay — top three model-rated games from the full weekly slate
- 🎰 Sunday Lottery Ticket — **EVERY Sunday game** on the slate, ranked by Hot Score, as one mega-longshot totals ticket

## Sunday Lottery Ticket
This is intentionally the "Mega Millions" style tab:
- every Sunday NFL game with a posted total is included
- each leg uses the ALT 2.5 model's OVER/UNDER side and 2.5-point cushion
- games are shown in Hot Score order, but none are omitted
- extremely high variance by design

## Important
Hot Score is a ranking score, not a calibrated win probability.

The extra tabs use the same already-loaded weekly board and do **not** trigger additional Odds API requests.

## Credit Saver
The Odds API response is cached for 2 hours with Next.js `unstable_cache`.

Required Vercel variable:
`ODDS_API_KEY`
