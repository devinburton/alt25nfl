// Transparent research estimates; these probabilities have not been calibrated.
import { decimalOdds } from './nbaSpreadsModel.js';
export const SINGLES_RULES = { minProbability: .55, minEdge: .03, minReturn: .02, maxPlays: 10, maxAgeHours: 8 };
const round = n => Math.round(n * 10) / 10;
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^losangeles/, 'la');
function cdf(x) {
  const z = Math.abs(x), t = 1 / (1 + .2316419 * z);
  const p = 1 - .3989422804014327 * Math.exp(-z * z / 2) * t * (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? p : 1 - p;
}
export function totalProbabilities(projection, line, sigma, side) {
  const step = Number.isInteger(line) ? .5 : 0;
  const under = cdf((line - step - projection) / sigma);
  const over = 1 - cdf((line + step - projection) / sigma);
  return { win: side === 'OVER' ? over : under, loss: side === 'OVER' ? under : over, push: Math.max(0, 1 - under - over) };
}
export function selectTopSingles(candidates, now = Date.now()) {
  const ranked = candidates.filter(x => Date.parse(x.kickoff) > now && x.probability >= SINGLES_RULES.minProbability && x.edge >= SINGLES_RULES.minEdge && x.expectedReturn >= SINGLES_RULES.minReturn)
    .sort((a, b) => b.probability - a.probability || b.expectedReturn - a.expectedReturn);
  const seen = new Set();
  return ranked.filter(x => { const key = `${x.sport}:${x.id}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 10).map((x, i) => ({ ...x, rank: i + 1 }));
}
export function analyzeSingleTotal(game, config, history, { now = Date.now(), fetchedAt, research } = {}) {
  const base = { id: game.id, sport: config.id, away: game.away, home: game.home, kickoff: game.kickoff };
  const pass = reason => ({ ...base, candidates: [], reason });
  if (!(Date.parse(game.kickoff) > now)) return pass('Game has started or its start time is missing.');
  if (!Number.isFinite(game.total) || game.booksCount < 2) return pass('Need a consensus total from two books.');
  const fetched = Date.parse(fetchedAt);
  if (!Number.isFinite(fetched) || fetched > now + 300000 || now - fetched > 8 * 3600000) return pass('Odds snapshot is unavailable or stale.');
  const minGames = config.modelType === 'football' ? 4 : config.modelType === 'baseball' ? 10 : 8;
  const rowsFor = team => history.filter(g => g.completed && g.seasonType === 2 && Date.parse(g.kickoff) < Math.min(now, Date.parse(game.kickoff)) && Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore) && [norm(g.home), norm(g.away)].includes(norm(team)))
    .sort((a,b) => Date.parse(b.kickoff)-Date.parse(a.kickoff)).filter((g,i,a) => a.findIndex(x=>x.id===g.id)===i).slice(0, 12);
  const away = rowsFor(game.away), home = rowsFor(game.home);
  if (Math.min(away.length, home.length) < minGames) return pass(`Need ${minGames} recent regular-season games per team; found ${away.length}/${home.length}.`);
  if (config.id === 'NBA' && (!research?.available || research.unresolvedLeader)) return pass('NBA injury check is unavailable or a leading scorer has an unresolved status.');
  // Estimate matchup total from scoring and defense, with strong consensus anchoring.
  const totals = [...away, ...home].map(g=>g.homeScore+g.awayScore);
  const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
  const raw = (mean(away.map(g=>g.homeScore+g.awayScore)) + mean(home.map(g=>g.homeScore+g.awayScore))) / 2;
  const cap = config.modelType === 'baseball' ? 3.5 : config.modelType === 'football' ? 10 : 12;
  const projection = game.total + Math.max(-cap, Math.min(cap, raw-game.total)) * .55;
  const pooled = [...new Map([...away,...home].map(g=>[g.id,g])).values()].map(g=>g.homeScore+g.awayScore);
  const average = mean(pooled);
  const variance = pooled.reduce((s,t)=>s+(t-average)**2,0)/Math.max(1,pooled.length-1);
  const floor = config.modelType === 'baseball' ? 4 : config.modelType === 'football' ? 14 : 19;
  const sigma = Math.max(floor, Math.sqrt(variance)) * Math.sqrt(1+1/away.length+1/home.length);
  const quotes = (game.totalQuotes || []).filter(q => ['OVER','UNDER'].includes(q.side) && Number.isFinite(q.line) && decimalOdds(q.price) && Date.parse(q.updatedAt) <= now+300000 && now-Date.parse(q.updatedAt) <= 8*3600000);
  const candidates = [];
  for (const q of quotes) {
    // Paired prices must be the same book, line and snapshot; never combine unrelated markets.
    const other = quotes.find(x=>x.book===q.book && x.side!==q.side && x.line===q.line && x.updatedAt===q.updatedAt);
    if (!other) continue;
    const decimal = decimalOdds(q.price), p = totalProbabilities(projection,q.line,sigma,q.side);
    const breakEven = 1/decimal;
    const conditional = p.win/(p.win+p.loss);
    const edge = conditional-breakEven;
    const expectedReturn = p.win*(decimal-1)-p.loss;
    if (p.win < SINGLES_RULES.minProbability || edge < SINGLES_RULES.minEdge || expectedReturn < SINGLES_RULES.minReturn) continue;
    const impliedOther = 1/decimalOdds(other.price);
    candidates.push({...base, side:q.side,line:q.line,price:q.price,book:q.book,quotedAt:q.updatedAt,probability:p.win,pushProbability:p.push,breakEven,edge,expectedReturn,marketProbability:breakEven/(breakEven+impliedOther),projection:round(projection),sample:{away:away.length,home:home.length}, reasons:[`Recent matchup scoring baseline ${round(raw)}; consensus ${game.total}; market-anchored projection ${round(projection)}.`,`Regular-season samples: ${away.length} away-team games and ${home.length} home-team games. Preseason and postseason excluded.`,`Probability uses a scoring distribution with ${round(sigma)}-point uncertainty, including a small-sample allowance.`, ...(config.id==='NBA'?['NBA injury feed checked; no unresolved leading-scorer designation.']:[])],risks:['Uncalibrated research estimate; a true or profitable edge has not been established.','Cached quote: availability and price may change. Confirm both before betting.',config.id==='NBA'?'Confirmed starting lineups and individual injury impacts are not modeled.':'Injuries, weather, confirmed lineups and starting pitchers are not screened by this totals model.']});
  }
  return {...base,candidates,reason:candidates.length?null:'No paired, fresh quote clears 55% estimated win chance, a 3-point probability edge and 2% estimated return.'};
}
