# ALT 2.5 NFL Totals

Deployable Next.js starter for your web betting group.

## Core rule
Use the market total, choose OVER or UNDER from the model, then move the line exactly 2.5 points in the pick's favor.

## Built now
- Week 2 NFL board
- Vegas/main total
- projected total and edge
- OVER/UNDER model decision
- fixed 2.5-point alternate line
- confidence
- weather display
- current fallback snapshot
- optional live consensus totals from The Odds API
- mobile-friendly layout

## Run
1. Install Node.js 20+
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000

## Live odds
Create `.env.local`:
`ODDS_API_KEY=your_key_here`

The API key stays server-side.

## Deploy
Push this folder to GitHub, import it into Vercel, add `ODDS_API_KEY` as an environment variable, then deploy.

## Next model upgrade
Add a real stats feed for offensive/defensive EPA, pace, success rate, injuries, explosive plays and home/away splits, then back-test the weights. The current starter is a transparent MVP, not a predictive-grade finished model.
