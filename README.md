# ALT 2.5 — Final v2 correction

This is the stop-here-for-now build.

It adds/fixes:
- more tolerant ESPN stat parsing for total yards and plays, so YPP can populate when the feed provides those stats
- red-zone efficiency parsing
- third-down efficiency parsing
- explosive-play counting from completed-game play data when available
- upcoming-game injury parsing from the game summary when available
- live totals, weather, current week, scoring, pace, turnovers, home/away form, projection, confidence
- fixed 2.5-point cushion

Required Vercel environment variable:
ODDS_API_KEY

Important: ESPN public endpoints are unofficial/undocumented. If a field is missing, ALT 2.5 shows a dash / skips that component instead of inventing a value.
