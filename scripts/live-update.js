/* Score en direct : interroge football-data.org (clé en secret GitHub) et écrit
   data/live.json si l'état a changé. Le site lit ce fichier via raw.githubusercontent.
   Sort silencieusement s'il n'y a pas de match du jour (économie de commits). */
const fs = require('fs');
const KEY = process.env.FOOTBALL_DATA_KEY;
const TEAM = 546; // RC Lens chez football-data.org
if (!KEY) { console.log('::warning::FOOTBALL_DATA_KEY absent — direct désactivé.'); process.exit(0); }

(async () => {
  const now = new Date();
  // Garde économe : si un prochain match est mémorisé et lointain, ne pas appeler l'API
  try {
    const prev = JSON.parse(fs.readFileSync('data/live.json', 'utf8'));
    const ref = prev.nextMatch || (prev.status === 'TIMED' ? prev.utcDate : null);
    if (!['IN_PLAY', 'PAUSED'].includes(prev.status) && ref) {
      const dt = new Date(ref) - now;
      const since = now - new Date(prev.updated || 0);
      // On ré-appelle l'API si : match dans <30 min, match potentiellement en cours,
      // ou dernière vérification vieille de >12h (rattrapage calendrier)
      if (dt > 30 * 60e3 && since < 12 * 3600e3) {
        console.log('Prochain match dans ' + Math.round(dt / 36e5) + 'h — pas d\'appel API.');
        process.exit(0);
      }
    }
  } catch (_) {}
  const d = x => x.toISOString().slice(0, 10);
  const from = d(new Date(now - 12 * 3600e3)), to = d(new Date(+now + 7 * 86400e3));
  const r = await fetch(`https://api.football-data.org/v4/teams/${TEAM}/matches?dateFrom=${from}&dateTo=${to}`,
    { headers: { 'X-Auth-Token': KEY } });
  if (!r.ok) { console.log('::error::football-data ' + r.status + ' ' + (await r.text()).slice(0, 150)); process.exit(1); }
  const matches = (await r.json()).matches || [];
  if (!matches.length) { console.log('Pas de match Lens sur la fenêtre — rien à faire.'); process.exit(0); }

  let m = matches.find(x => ['IN_PLAY', 'PAUSED'].includes(x.status)) || matches[0];
  // Détail du match (inclut les buteurs si disponibles sur l'offre gratuite)
  let goals = [];
  try {
    const det = await (await fetch('https://api.football-data.org/v4/matches/' + m.id, { headers: { 'X-Auth-Token': KEY } })).json();
    if (det && det.match) det.goals = det.match.goals, det.status = det.match.status;
    if (Array.isArray(det.goals)) {
      goals = det.goals.map(g => ({
        minute: g.minute,
        scorer: (g.scorer || {}).name || '',
        side: g.team && g.team.id === m.homeTeam.id ? 'home' : 'away',
        type: g.type || ''
      }));
    }
    if (det.minute !== undefined && det.minute !== null) m.minute = det.minute;
  } catch (_) {}
  const home = m.homeTeam, away = m.awayTeam, sc = m.score;
  const cur = (sc.fullTime.home !== null ? sc.fullTime : sc.halfTime);
  const tla = t => ((t.tla || t.shortName || t.name || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()) || '???';
  const out = {
    status: m.status, // TIMED, IN_PLAY, PAUSED, FINISHED...
    minute: m.minute || null,
    utcDate: m.utcDate,
    competition: (m.competition || {}).name || '',
    home: { name: home.shortName || home.name, tla: tla(home), score: cur.home },
    away: { name: away.shortName || away.name, tla: tla(away), score: cur.away },
    goals: goals,
    nextMatch: (matches.find(x => x.status === 'TIMED' || x.status === 'SCHEDULED') || {}).utcDate || null,
    updated: now.toISOString()
  };
  const path = 'data/live.json';
  const prev = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
  const next = JSON.stringify(out, null, 1);
  // Ne réécrire que si changement significatif (hors horodatage)
  const strip = s => s.replace(/"updated":[^,}]+/,'');
  if (strip(prev) === strip(next)) { console.log('Direct inchangé (' + m.status + ').'); process.exit(0); }
  fs.writeFileSync(path, next);
  fs.writeFileSync('.live-changed', '1');
  console.log('::notice::Direct mis à jour : ' + out.home.tla + ' ' + (out.home.score ?? '–') + '-' + (out.away.score ?? '–') + ' ' + out.away.tla + ' (' + m.status + ')');
})().catch(e => { console.log('::error::' + String(e.message).slice(0, 200)); process.exit(1); });
