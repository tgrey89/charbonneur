/* ============================================================
   CHARBONNEURS — LIVE PROXY (Cloudflare Worker)
   Rôle : appeler API-Football avec la clé secrète, mettre en
   cache 60-90 s, et servir un JSON léger à tous les visiteurs.
   Quota protégé : ~80 requêtes par jour de match (plafond 100).
   Secret à configurer dans le Worker : APIFOOT (clé api-football)
   ============================================================ */
const TEAM = 116;            // RC Lens chez API-Football
const CACHE_LIVE = 45;       // secondes de cache pendant un match
const CACHE_IDLE = 600;      // hors match : 10 min
const ALLOWED = 'https://tgrey89.github.io';

export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED,
      'content-type': 'application/json; charset=utf-8'
    };
    const cache = caches.default;
    const cacheKey = new Request('https://live.charbonneurs/state');
    let hit = await cache.match(cacheKey);
    if (hit) return new Response(await hit.text(), { headers: cors });

    const api = (path) => fetch('https://v3.football.api-sports.io/' + path, {
      headers: { 'x-apisports-key': env.APIFOOT }
    }).then(r => r.json());

    let out = { status: 'IDLE', updated: new Date().toISOString() };
    let ttl = CACHE_IDLE;
    try {
      // Match du jour pour Lens (fuseau Paris)
      const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
      const fx = await api('fixtures?team=' + TEAM + '&date=' + today);
      const f = (fx.response || [])[0];
      if (f) {
        const st = f.fixture.status || {};
        const live = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(st.short);
        out = {
          status: live ? 'IN_PLAY' : (['FT', 'AET', 'PEN'].includes(st.short) ? 'FINISHED' : 'TIMED'),
          phase: st.short, minute: st.elapsed || null,
          competition: (f.league || {}).name || '',
          utcDate: f.fixture.date,
          home: { name: f.teams.home.name, tla: f.teams.home.name.slice(0, 3).toUpperCase(), score: f.goals.home },
          away: { name: f.teams.away.name, tla: f.teams.away.name.slice(0, 3).toUpperCase(), score: f.goals.away },
          goals: [], updated: new Date().toISOString()
        };
        if (live || out.status === 'FINISHED') {
          const ev = await api('fixtures/events?fixture=' + f.fixture.id);
          out.goals = (ev.response || [])
            .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
            .map(e => ({
              minute: e.time.elapsed + (e.time.extra ? '+' + e.time.extra : ''),
              scorer: (e.player || {}).name || '',
              side: e.team.id === f.teams.home.id ? 'home' : 'away',
              type: e.detail === 'Penalty' ? 'PENALTY' : e.detail === 'Own Goal' ? 'OWN' : ''
            }));
        }
        ttl = live ? CACHE_LIVE : CACHE_IDLE;
      }
    } catch (e) { out.error = String(e).slice(0, 120); }

    const body = JSON.stringify(out);
    ctx.waitUntil(cache.put(cacheKey, new Response(body, {
      headers: { 'cache-control': 'max-age=' + ttl }
    })));
    return new Response(body, { headers: cors });
  }
};
