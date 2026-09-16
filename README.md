# ALT 2.5 — Automatic NFL Version

This replaces the hard-coded Week 2 starter.

Automatic now:
- Current NFL week and schedule
- Live consensus totals from The Odds API
- Stadium weather from Open-Meteo
- Recent completed-season scoring/defense
- Model projection, side, confidence and fixed 2.5-point cushion

Required Vercel environment variable: ODDS_API_KEY

Upload the CONTENTS of this folder to the same GitHub repo and overwrite the old files. Vercel will redeploy automatically.

Note: ESPN's scoreboard endpoint is public but unofficial/undocumented. The model is an MVP, not a validated betting model.
