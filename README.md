# ALT 2.5 — Hot Picks build

Adds a fourth tab: **🔥 Hot Picks**

The app automatically ranks the current NFL week's five strongest model plays.

## Hot Score
Hot Score is **not** a claimed win probability. It is a 0–100 ranking score built from:
- absolute model edge vs. the market total
- data completeness / sample quality
- number of sportsbooks contributing to the consensus
- whether weather is available
- the same underlying model inputs already used by ALT 2.5

The five highest-scoring games receive `hotRank` 1–5 and appear in the Hot Picks tab.

Core model inputs remain:
- live consensus total
- recent scoring and points allowed
- YPP efficiency
- pace / play volume
- red zone
- third down
- explosive plays when the feed supplies them
- turnovers
- home/away form
- weather
- injuries

Required Vercel variable:
`ODDS_API_KEY`

This is a ranking model, not a guarantee or calibrated probability model.
