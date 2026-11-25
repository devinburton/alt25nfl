const round = value => Math.round(value * 10) / 10;
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export function projectTeamTotals(game, sport, homeSpread, nflProjectedMargin) {
  const { total, projected, awayProfile, homeProfile } = game;
  if (![total, projected, homeSpread].every(Number.isFinite)) return null;

  // A negative home spread means the market expects the home team to win.
  const marketMargin = -homeSpread;
  const profiles = [awayProfile, homeProfile];
  const hasForm = profiles.every(profile =>
    profile?.games >= 3 && [profile.pointsFor, profile.pointsAllowed].every(Number.isFinite)
  );
  let modelMargin = marketMargin;
  if (hasForm) {
    if (sport === "NFL") {
      modelMargin = Number.isFinite(nflProjectedMargin) ? nflProjectedMargin : marketMargin;
    } else {
      const formMargin = (
        (homeProfile.pointsFor - homeProfile.pointsAllowed) -
        (awayProfile.pointsFor - awayProfile.pointsAllowed)
      ) / 2;
      modelMargin += 0.4 * clamp(formMargin - marketMargin, 12);
    }
  }

  const cushion = sport === "NFL" ? 1.5 : 2.5;
  const scoreTotal = hasForm ? projected : total;
  const teams = [{name:game.away, sign:-1}, {name:game.home, sign:1}].map(({name, sign}) => {
    const implied = (total + sign * marketMargin) / 2;
    const points = (scoreTotal + sign * modelMargin) / 2;
    const gap = points - implied;
    const side = hasForm && Math.abs(gap) >= cushion ? (gap > 0 ? "OVER" : "UNDER") : null;
    // Round toward a more favorable half-point and keep the model cushion.
    const target = side === "OVER" ? Math.floor(points - cushion - 0.5) + 0.5
      : side === "UNDER" ? Math.ceil(points + cushion - 0.5) + 0.5 : null;
    return { name, implied:round(implied), projected:hasForm ? round(points) : null, gap:hasForm ? round(gap) : null, side, target };
  });
  return teams.every(team => team.implied > 0 && (team.projected === null || team.projected > 0))
    ? teams : null;
}
