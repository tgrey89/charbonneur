/* =====================================================================
   NEWSLETTER CHARBONNEUR — envoi automatisé via l'API Brevo.
   Exécuté par GitHub Actions (.github/workflows/newsletter.yml).

   Env requis :
   - BREVO_API_KEY  (secret GitHub Actions)
   Env optionnels :
   - TEST_EMAIL     → envoi transactionnel à cette seule adresse (mode test)
   - DAYS           → fenêtre d'articles (défaut 7 jours)
   - LIST_ID        → id de liste Brevo (défaut : première liste du compte)
   ===================================================================== */
const fs = require('fs');

const API = 'https://api.brevo.com/v3';
const KEY = process.env.BREVO_API_KEY;
const SITE = 'https://tgrey89.github.io/charbonneur/';
const DAYS = parseInt(process.env.DAYS || '7', 10);

if (!KEY) { console.error('BREVO_API_KEY manquant'); process.exit(1); }

// --- Charger les articles (data/articles.js définit window.ARTICLES) ---
const window = {};
eval(fs.readFileSync('data/articles.js', 'utf8'));
const cutoff = Date.now() - DAYS * 864e5;
const isTest = !!process.env.TEST_EMAIL;
// Sas de maturation : en envoi réel, un article doit avoir vécu >= 24h sur le site
const MIN_AGE_MS = isTest ? 0 : parseFloat(process.env.MIN_AGE_H !== undefined && process.env.MIN_AGE_H !== '' ? process.env.MIN_AGE_H : '24') * 3600e3;
// Péremption : une rumeur > 72h non passée en confirmé/officiel n'est plus envoyée
const RUMOR_TTL_MS = 72 * 3600e3;
const arts = window.ARTICLES
  .filter(a => {
    const t = new Date(a.date + 'T' + (a.time || '12:00'));
    if (t < cutoff) return false;
    const age = Date.now() - t;
    if (age < MIN_AGE_MS) return false;
    if (a.statut === 'rumeur' && age > RUMOR_TTL_MS) return false;
    return true;
  })
  .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

if (!arts.length) { console.log('Aucun article sur ' + DAYS + ' j → pas d\'envoi.'); process.exit(0); }

// --- Composer le HTML (layout table, compatible clients mail) ---
const CAT = { mercato: 'MERCATO', saison: 'SAISON', news: 'NEWS', interview: 'INTERVIEW', mag: 'MAG' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ST_CHIP = {
  officiel: '<span style="display:inline-block;font:800 10px/1 Arial;letter-spacing:.08em;color:#fff;background:#2e9e5b;padding:5px 10px;border-radius:999px">OFFICIEL</span>',
  confirme: '<span style="display:inline-block;font:800 10px/1 Arial;letter-spacing:.08em;color:#ffd21e;border:1px solid #ffd21e;padding:4px 9px;border-radius:999px">CONFIRM&Eacute;</span>',
  rumeur:   '<span style="display:inline-block;font:800 10px/1 Arial;letter-spacing:.08em;color:#ff9c9c;border:1px solid #e01e1e;padding:4px 9px;border-radius:999px">RUMEUR</span>'
};
const rows = arts.map((a, k) => `
  ${k > 0 ? `<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="border-top:1px solid #2b2723;font:800 11px Arial;color:#ffd21e;padding-top:2px" width="18">&#9670;</td>
    <td style="border-top:1px solid #2b2723"></td></tr></table></td></tr>` : ''}
  <tr><td style="padding:20px 24px 22px">
    <span style="display:inline-block;font:800 10px/1 'Segoe UI',Tahoma,Arial,sans-serif;letter-spacing:.1em;color:#0a0807;background:#ffd21e;padding:5px 10px;border-radius:999px">${CAT[a.category] || 'ACTU'}</span>
    ${a.statut && ST_CHIP[a.statut] ? ' ' + ST_CHIP[a.statut] : ''}
    <span style="font:700 11px/1 'Segoe UI',Arial,sans-serif;color:#e01e1e">&nbsp;&#9679;&nbsp;</span><span style="font:400 11px/1 'Segoe UI',Arial,sans-serif;color:#6f675e">${a.date}</span>
    <div style="font:800 19px/1.3 'Segoe UI',Tahoma,Arial,sans-serif;color:#f2efe9;margin:10px 0 6px">${esc(a.title)}</div>
    <div style="font:400 14px/1.55 'Segoe UI',Arial,sans-serif;color:#a49b90">${esc(a.excerpt || '')}</div>
  </td></tr>`).join('');

const LOGO = SITE + 'images/logo/logo2.png';
const COVER = SITE + 'images/og-cover.jpg';
const LAMP = SITE + 'images/logo/lamp-btn.png';
const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#0a0807">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0807"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#141110;border:1px solid #2b2723;border-radius:8px;overflow:hidden">

  <!-- Veine d'or -->
  <tr><td style="height:4px;background:#ffd21e;font-size:0;line-height:0">&nbsp;</td></tr>

  <!-- Masthead : logo + titre, sur fond charbon -->
  <tr><td style="background:#0a0807;padding:20px 24px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px" width="60"><img src="${LOGO}" width="52" alt="Charbonneurs" style="display:block;border:0"></td>
      <td>
        <div style="font:800 27px/1 'Segoe UI',Tahoma,Arial,sans-serif;color:#ffd21e;letter-spacing:.01em">CHARBONNEURS</div>
        <div style="font:600 10px/1.8 'Segoe UI',Arial,sans-serif;color:#a49b90;letter-spacing:.16em">L&rsquo;ACTUALIT&Eacute; DU RC LENS, DE LA MINE &Agrave; BOLLAERT</div>
      </td>
      <td align="right" width="34"><img src="${LAMP}" width="18" alt="" style="display:block;border:0;opacity:.9"></td>
    </tr></table>
  </td></tr>

  <!-- Bannière visuelle du site -->
  <tr><td style="background:#0a0807;font-size:0;line-height:0"><a href="${SITE}" style="text-decoration:none"><img src="${COVER}" width="600" alt="Charbonneurs — le site des supporters du RC Lens" style="display:block;border:0;width:100%;height:auto"></a></td></tr>

  <!-- Kicker de section, comme sur le site -->
  <tr><td style="padding:20px 24px 2px">
    <div style="font:800 11px/1 'Segoe UI',Arial,sans-serif;letter-spacing:.22em;color:#ffd21e">&#9472;&#9472;&nbsp; L&rsquo;ACTU DE LA SEMAINE</div>
  </td></tr>

  ${rows}

  <!-- Bouton retour à la surface -->
  <tr><td align="center" style="padding:6px 24px 26px">
    <a href="${SITE}#actu" style="font:800 14px 'Segoe UI',Arial,sans-serif;color:#0a0807;background:#ffd21e;text-decoration:none;padding:14px 28px;border-radius:6px;display:inline-block">&#9874; Remonter &agrave; la surface &mdash; lire sur le site</a>
  </td></tr>

  <!-- Pied de page, liseré sang -->
  <tr><td style="padding:14px 24px;background:#0a0807;border-top:3px solid #e01e1e;font:400 11px/1.7 'Segoe UI',Arial,sans-serif;color:#6f675e">
    <span style="color:#a49b90">Descendu de la fosse, remont&eacute; dans votre bo&icirc;te mail.</span><br>
    Charbonneurs &mdash; site non officiel de supporters du RC Lens &mdash; <a href="${SITE}" style="color:#a49b90">${SITE.replace('https://','')}</a><br>
    Vous recevez cet e-mail car vous &ecirc;tes inscrit &agrave; la newsletter. {{ unsubscribe }}
  </td></tr>
</table></td></tr></table></body></html>`;

const subject = 'Charbonneurs — ' + esc(arts[0].title);

async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'api-key': KEY, 'accept': 'application/json', 'content-type': 'application/json', ...(opts.headers || {}) }
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + txt);
  return txt ? JSON.parse(txt) : {};
}

(async () => {
  // Expéditeur : premier sender validé du compte
  const senders = (await api('/senders')).senders.filter(s => s.active);
  const wanted = (process.env.SENDER_EMAIL || '').trim().toLowerCase();
  if (wanted) {
    const hit = senders.find(s => s.email.toLowerCase() === wanted);
    if (hit) senders.unshift(hit);
    else console.log('::warning::SENDER_EMAIL ' + wanted + " n'est pas un expéditeur vérifié Brevo — repli sur " + (senders[0] ? senders[0].email : 'aucun'));
  }
  if (!senders.length) throw new Error('Aucun expéditeur validé dans Brevo');
  const sender = { name: 'Charbonneurs', email: senders[0].email };

  if (process.env.TEST_EMAIL) {
    // Mode test : e-mail transactionnel à une seule adresse
    const body = { sender, to: [{ email: process.env.TEST_EMAIL }], subject: '[TEST] ' + subject,
      htmlContent: html.replace('{{ unsubscribe }}', '(lien de désinscription inséré lors des vrais envois)') };
    await api('/smtp/email', { method: 'POST', body: JSON.stringify(body) });
    console.log('Test envoyé à ' + process.env.TEST_EMAIL + ' (' + arts.length + ' articles).');
    return;
  }

  // Mode direct : contournement du moteur de campagnes (transactionnel individuel)
  if ((process.env.MODE || '').toLowerCase() === 'direct') {
    let listId = parseInt(process.env.LIST_ID || '0', 10);
    if (!listId) {
      const lists = (await api('/contacts/lists?limit=10')).lists || [];
      listId = lists.length ? lists[0].id : 0;
    }
    const emails = [];
    for (let off = 0; ; off += 500) {
      const page = (await api('/contacts/lists/' + listId + '/contacts?limit=500&offset=' + off)).contacts || [];
      page.forEach(c => { if (!c.emailBlacklisted) emails.push(c.email); });
      if (page.length < 500) break;
    }
    if (!emails.length) throw new Error('Liste ' + listId + ' vide — envoi direct annulé');
    const unsubFoot = '<a href="mailto:' + sender.email + '?subject=D%C3%A9sinscription%20newsletter" style="color:#8d8578">Se d\u00e9sinscrire</a>';
    let ok = 0, ko = 0;
    for (const to of emails) {
      try {
        await api('/smtp/email', { method: 'POST', body: JSON.stringify({
          sender, to: [{ email: to }], subject,
          htmlContent: html.replace('{{ unsubscribe }}', unsubFoot)
        }) });
        ok++;
      } catch (e) { ko++; console.log('::warning::échec vers un destinataire : ' + String(e.message).slice(0, 120)); }
      await new Promise(r => setTimeout(r, 400));
    }
    console.log('::notice::Envoi DIRECT terminé : ' + ok + ' délivré(s) au transactionnel, ' + ko + ' échec(s), ' + arts.length + ' articles.');
    return;
  }

  // Envoi réel : campagne à la liste
  let listId = parseInt(process.env.LIST_ID || '0', 10);
  if (!listId) {
    const lists = (await api('/contacts/lists?limit=10')).lists || [];
    if (!lists.length) throw new Error('Aucune liste de contacts Brevo');
    listId = lists[0].id;
  }
  // Garde-fou destinataires : vérifier la composition RÉELLE de la liste
  let members = 0;
  try { members = (await api('/contacts/lists/' + listId + '/contacts?limit=1')).count || 0; } catch (_) {}
  if (!members) {
    // Rattacher explicitement tous les contacts non blacklistés à la liste
    const emails = [];
    for (let off = 0; ; off += 500) {
      const page = (await api('/contacts?limit=500&offset=' + off)).contacts || [];
      page.forEach(c => { if (!c.emailBlacklisted) emails.push(c.email); });
      if (page.length < 500) break;
    }
    if (!emails.length) throw new Error('Aucun contact actif dans le compte — envoi annulé');
    await api('/contacts/lists/' + listId + '/contacts/add', { method: 'POST', body: JSON.stringify({ emails }) });
    members = (await api('/contacts/lists/' + listId + '/contacts?limit=1')).count || emails.length;
    console.log('::notice::Liste ' + listId + ' recomposée : ' + emails.length + ' contact(s) rattaché(s).');
  }
  console.log('::notice::Destinataires dans la liste ' + listId + ' : ' + members);
  const camp = await api('/emailCampaigns', { method: 'POST', body: JSON.stringify({
    name: 'Charbonneurs ' + new Date().toISOString().slice(0, 10),
    subject, sender, type: 'classic',
    htmlContent: html.replace('{{ unsubscribe }}', '<a href="{{ unsubscribe }}" style="color:#888">Se désinscrire</a>'),
    recipients: { listIds: [listId] }
  }) });
  await api('/emailCampaigns/' + camp.id + '/sendNow', { method: 'POST', body: '{}' });
  console.log('::notice::Campagne #' + camp.id + ' envoyée à la liste ' + listId + ' (' + arts.length + ' articles, ' + members + ' destinataires).');
  // Contrôle post-envoi : relire les stats de la campagne
  await new Promise(r => setTimeout(r, 8000));
  try {
    const st = ((await api('/emailCampaigns/' + camp.id)).statistics || {}).globalStats || {};
    console.log('::notice::Stats campagne #' + camp.id + ' : envoyés=' + (st.sent || 0) + ' délivrés=' + (st.delivered || 0));
    if (!st.sent) console.log('::warning::La campagne indique 0 envoyé — si cela persiste, le compte Brevo attend probablement une validation (bannière dans le tableau de bord Brevo).');
  } catch (_) {}
})().catch(e => {
  var m = String(e.message).replace(/[\r\n]+/g, ' ').slice(0, 400);
  console.error(m);
  // Annotation GitHub : visible via l'API même quand les logs bruts ne le sont pas
  console.log('::error::' + m);
  process.exit(1);
});
