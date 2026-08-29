/* =====================================================================
   MOTEUR DU SITE — Lensois Nouvelle Génération
   - Génère hero / mises en avant / fil à partir de window.ARTICLES
   - Intro cinématique + ambiance sonore (Web Audio, libre de droits)
   - Animations au scroll, parallaxe, menu mobile, pagination
   ===================================================================== */
(function () {
  'use strict';

  var CATS = {
    news:      { label: 'News',      cls: '' },
    mercato:   { label: 'Mercato',   cls: 'mercato' },
    interview: { label: 'Interview', cls: 'interview' },
    mag:       { label: 'Mag',       cls: 'mag' },
    saison:    { label: 'Saison',    cls: 'saison' }
  };

  var PER_PAGE = 6;
  var listOffset = 0;
  var listArticles = [];

  function fmtDate(iso) {
    var p = (iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }
  function cat(c) { return CATS[c] || { label: c || 'News', cls: '' }; }
  // Images de secours (aucune image d'article / photo joueur) : tirage aléatoire dans ce
  // pool, mais STABLE par article (hash de l'id) → chaque article garde toujours la même,
  // vignette et bandeau cohérents, et l'ensemble reste bien réparti. Déposer un fichier
  // ici suffit à l'ajouter au tirage.
  var DEFAULT_POOL = [
    'images/defaut/stade.jpg',
    'images/defaut/stade2.jpg',
    'images/defaut/tribune.jpg',
    'images/defaut/bollaert-nuit.jpg',
    'images/defaut/lens2.jpg',
    'images/defaut/lens3.jpg'
  ];
  function defImg(a) {
    var key = (a && (a.id || a.title)) || '';
    var h = 0;
    for (var i = 0; i < key.length; i++) { h = ((h << 5) - h + key.charCodeAt(i)) | 0; }
    return DEFAULT_POOL[Math.abs(h) % DEFAULT_POOL.length];
  }
  // Slug sans accents (minuscules, alphanumérique) — partagé photo joueur / détection article.
  function slugify(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  // Image d'un article : champ `image` explicite → sinon photo d'un joueur de l'effectif
  // (champ `player` prioritaire, à défaut nom de famille détecté dans le titre) → sinon
  // image générique de catégorie. Le `onerror` des <img> retombe de toute façon sur defImg.
  function artImg(a) {
    if (a.image) return a.image;
    var pp = articlePlayerPhoto(a);
    return pp || defImg(a);
  }
  // Quand l'image d'un article est une photo de joueur (portrait cadré en haut) — qu'elle
  // soit explicite (`image: 'images/players/…'`) ou déduite — on ajoute cette classe pour
  // recadrer vers le visage au lieu du centre → tête visible dans les bandeaux larges.
  function isPlayerImg(src) { return !!src && src.indexOf('images/players/') === 0; }
  function artImgClass(a) {
    return isPlayerImg(a.image || articlePlayerPhoto(a)) ? ' is-portrait' : '';
  }
  // Image de la vue article (au clic) : on veut une VRAIE photo de qualité même si le héros
  // tourne une vidéo → `image` explicite, sinon le poster de la vidéo, sinon photo du joueur cité.
  function artDetailImg(a) {
    return a.image || a.poster || articlePlayerPhoto(a) || defImg(a);
  }
  function articlePlayerPhoto(a) {
    var players = window.PLAYERS || [];
    var i, p;
    // 1) champ explicite `player` (nom, prénom+nom ou slug)
    if (a.player) {
      var want = slugify(a.player);
      for (i = 0; i < players.length; i++) {
        p = players[i];
        var full = slugify(p.name);
        var last = slugify(p.name.split(/\s+/).pop());
        if (want === full || want === last) return playerPhoto(p);
      }
      return '';
    }
    // 2) détection auto : nom de famille présent dans le titre (mot entier)
    var title = ' ' + String(a.title || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    for (i = 0; i < players.length; i++) {
      p = players[i];
      var lastName = slugify(p.name.split(/\s+/).pop());
      if (lastName.length >= 4 && title.indexOf(' ' + lastName + ' ') !== -1) return playerPhoto(p);
    }
    return '';
  }
  function isRecent(iso) {
    // marque "NOUVEAU" si daté d'aujourd'hui ou hier (basé sur la date la plus récente du jeu)
    return iso >= newestDate;
  }
  var newestDate = '';

  function byDateDesc(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }

  // « Chaleur » d'un article pour choisir la une : la FRAÎCHEUR domine (référence = l'article
  // le plus récent du site), un poids de catégorie départage (mercato le plus brûlant), et on
  // peut forcer un coup de pouce éditorial via `hot: true` ou `heat: <nombre>` dans l'article.
  var ST_LABEL = { officiel: 'Officiel', confirme: 'Confirmé', rumeur: 'Rumeur' };
  function stBadge(a) {
    if (!a.statut || !ST_LABEL[a.statut]) return '';
    return '<span class="st-badge st-' + a.statut + '">' + ST_LABEL[a.statut] + '</span>';
  }
  var CAT_HEAT = { mercato: 6, transfert: 6, interview: 4, news: 3, saison: 3, mag: 1 };
  function daysBetween(isoA, isoB) {
    var da = new Date(isoA), db = new Date(isoB);
    if (isNaN(da) || isNaN(db)) return 0;
    return Math.abs(da - db) / 86400000;
  }
  function heatScore(a) {
    var age = daysBetween(newestDate, a.date || '');           // 0 = le plus frais
    var recency = Math.max(0, 30 - age);                       // fenêtre ~1 mois
    var cat = CAT_HEAT[a.category] || 2;
    return recency + cat + (a.hot ? 15 : 0) + (+a.heat || 0);
  }

  // ---------- Rendu ----------
  function render() {
    var all = (window.ARTICLES || []).slice();
    if (!all.length) return;

    newestDate = all.map(function (a) { return a.date; }).sort().pop();

    // Épinglés d'abord, puis tri par date
    var pinned = all.filter(function (a) { return a.pinned; }).sort(byDateDesc);
    var rest   = all.filter(function (a) { return !a.pinned; }).sort(byDateDesc);
    var ordered = pinned.concat(rest);

    // Classement par « chaleur » (fraîcheur + catégorie) — sert à la une ET aux sous-unes
    var byHeat = ordered.slice().sort(function (a, b) {
      var d = heatScore(b) - heatScore(a);
      return d !== 0 ? d : byDateDesc(a, b);
    });
    // Hero : override manuel 'hero' si présent, sinon l'actu la plus brûlante
    var hero = ordered.filter(function (a) { return a.featured === 'hero'; })[0] || byHeat[0];
    // Sous-unes : les 2 articles les plus FRAIS après la une → jamais de vieille info remontée
    var feats = byHeat.filter(function (a) { return a !== hero; }).slice(0, 2);
    // Fil : tout le reste
    var used = [hero].concat(feats);
    listArticles = ordered.filter(function (a) { return used.indexOf(a) === -1; });

    renderHero(hero);
    renderFeats(feats);
    listOffset = 0;
    document.getElementById('articles').innerHTML = '';
    renderMore();

    // ouverture de l'article au clic : bouton du héros + mises en avant
    var hb = document.querySelector('#hero-slot .btn');
    if (hb) hb.addEventListener('click', function (e) { e.preventDefault(); openArticle(hero); });
    document.querySelectorAll('#subfeat-slot .feat').forEach(function (el, i) {
      el.addEventListener('click', function (e) { e.preventDefault(); openArticle(feats[i]); });
    });
  }

  function renderHero(a) {
    var el = document.getElementById('hero-slot');
    if (!a) { el.innerHTML = ''; return; }
    var bg = a.video
      ? '<video class="bg" autoplay muted loop playsinline poster="' + (a.poster || a.image) + '">' +
          '<source src="' + a.video + '" type="video/mp4"></video>'
      : '<img class="bg' + artImgClass(a) + '" src="' + artImg(a) + '" alt="' + esc(a.title) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + defImg(a) + '\'">';
    el.innerHTML =
      '<section class="hero">' +
        bg +
        '<div class="hero-veil"></div>' +
        '<div class="hero-inner">' +
          '<span class="hero-kicker">' + cat(a.category).label + ' · à la une</span>' +
          '<h2 class="hero-title">' + esc(a.title) + '</h2>' +
          '<p class="hero-sub">' + esc(a.excerpt) + '</p>' +
          '<div class="hero-actions">' +
            '<a class="btn btn-gold" href="#actu">Lire l’article</a>' +
            '<span class="hero-date">' + fmtDate(a.date) + '</span>' +
          '</div>' +
        '</div>' +
        '<a class="scroll-cue" href="#recit" aria-label="Descendre dans la mine"><span class="mouse"></span>Descendre</a>' +
      '</section>';
  }

  function renderFeats(list) {
    var el = document.getElementById('subfeat-slot');
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = list.map(function (a) {
      var c = cat(a.category);
      return '<a class="feat" href="#">' +
        '<img class="' + artImgClass(a).trim() + '" src="' + artImg(a) + '" alt="' + esc(a.title) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + defImg(a) + '\'">' +
        '<span class="tag ' + c.cls + '">' + c.label + '</span>' + stBadge(a) +
        '<div class="ft"><h3>' + esc(a.title) + '</h3></div>' +
      '</a>';
    }).join('');
  }

  // Fil d'infos : articles récents (heure) qui renvoient vers l'article
  function renderFil() {
    var el = document.getElementById('filList');
    if (!el) return;
    var list = (window.ARTICLES || []).slice().sort(function (a, b) {
      var da = (a.date || '') + (a.time || '00:00'), db = (b.date || '') + (b.time || '00:00');
      return da < db ? 1 : da > db ? -1 : 0;
    }).slice(0, 6);
    el.innerHTML = list.map(function (a, i) {
      var d = (a.date || '').split('-');
      var short = d.length === 3 ? d[2] + '/' + d[1] : '';          // JJ/MM
      var stamp = a.time ? (short ? short + ' · ' + a.time : a.time) // JJ/MM · HH:MM
                         : (short || fmtDate(a.date));
      return '<li data-i="' + i + '"><span class="fil-dot"></span>' +
        '<div class="fil-c"><span class="time">' + stamp + '</span>' +
        '<span class="fil-t">' + esc(a.title) + '</span></div></li>';
    }).join('');
    el.querySelectorAll('li').forEach(function (li) {
      li.addEventListener('click', function () { openArticle(list[+li.getAttribute('data-i')]); });
    });
  }

  // Dernier match (barre latérale) — piloté par window.CLUB
  function renderMatch() {
    var el = document.getElementById('lastMatch');
    if (!el || !window.CLUB || !CLUB.lastMatch) return;
    var m = CLUB.lastMatch, h = m.home, a = m.away;
    var lensS = +(h.isLens ? h.score : a.score), oppS = +(h.isLens ? a.score : h.score);
    var res = lensS > oppS ? ['win', 'Victoire'] : (lensS < oppS ? ['loss', 'Défaite'] : ['draw', 'Nul']);
    el.innerHTML =
      '<div class="mt-top"><span class="comp">' + esc(m.comp) + '</span>' +
        '<span class="mt-res ' + res[0] + '">' + res[1] + '</span></div>' +
      '<div class="score">' +
        '<div class="team"><span class="dot ' + (h.isLens ? 'rcl' : 'opp') + '">' + esc(h.code) + '</span>' + esc(h.name) + '</div>' +
        '<div class="nums">' + h.score + ' <small>-</small> ' + a.score + '</div>' +
        '<div class="team"><span class="dot ' + (a.isLens ? 'rcl' : 'opp') + '">' + esc(a.code) + '</span>' + esc(a.name) + '</div>' +
      '</div>' +
      '<div class="date">' + esc(m.info) + '</div>';
  }

  // Classement (barre latérale) — piloté par window.CLUB
  function renderStandings() {
    var box = document.getElementById('standingsBox');
    if (!box || !window.CLUB || !CLUB.standings) return;
    var t = document.getElementById('standingsTitle');
    if (t && CLUB.standingsTitle) t.textContent = CLUB.standingsTitle;
    var rows = CLUB.standings.map(function (r) {
      return '<tr' + (r.isLens ? ' class="lens"' : '') + '>' +
        '<td class="pos">' + r.pos + '</td>' +
        '<td class="club">' + esc(r.club) + '</td>' +
        '<td>' + r.played + '</td>' +
        '<td>' + esc(r.diff) + '</td>' +
        '<td>' + r.pts + '</td></tr>';
    }).join('');
    box.innerHTML =
      '<table class="rank">' +
        '<thead><tr><th>#</th><th style="text-align:left">Club</th><th>J</th><th>Diff</th><th>Pts</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  }

  function renderMore() {
    var container = document.getElementById('articles');
    var batch = listArticles.slice(listOffset, listOffset + PER_PAGE);
    batch.forEach(function (a) {
      var c = cat(a.category);
      var newTag = isRecent(a.date) ? '<span class="badge-new">Nouveau</span>' : '';
      var div = document.createElement('div');
      div.className = 'article reveal';
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.innerHTML =
        '<div class="thumb"><img class="' + artImgClass(a).trim() + '" src="' + artImg(a) + '" alt="' + esc(a.title) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + defImg(a) + '\'"></div>' +
        '<div class="article-body">' +
          '<span class="tag ' + c.cls + '">' + c.label + '</span>' + stBadge(a) +
          '<h3>' + esc(a.title) + newTag + '</h3>' +
          '<p class="excerpt">' + esc(a.excerpt) + '</p>' +
          '<p class="meta">' + fmtDate(a.date) + ' · <span class="read-more">Lire l’article →</span></p>' +
        '</div>';
      div.addEventListener('click', function () { openArticle(a); });
      div.addEventListener('keydown', function (e) { if (e.key === 'Enter') openArticle(a); });
      container.appendChild(div);
      revealObserver.observe(div);
    });
    listOffset += batch.length;

    var btn = document.getElementById('loadmore');
    if (listOffset >= listArticles.length) {
      btn.textContent = 'Vous êtes à jour ! ✔';
      btn.disabled = true;
      btn.style.opacity = .6;
    } else {
      btn.textContent = 'Charger plus d’articles';
      btn.disabled = false;
      btn.style.opacity = 1;
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  // Chemin photo d'un joueur : champ `photo` explicite, sinon deviné depuis le nom
  // de famille (images/players/<nom>.jpg). Si le fichier n'existe pas, `onerror`
  // bascule la tuile sur le maillot. → il suffit de déposer une photo bien nommée.
  function playerPhoto(p) {
    if (p.photo) return p.photo;
    var slug = slugify(String(p.name).trim().split(/\s+/).pop());
    return slug ? 'images/players/' + slug + '.jpg' : '';
  }
  // Callback global : si la photo ne charge pas, on la retire (ainsi que son badge) pour
  // révéler le maillot + numéro déjà présents dessous. Le numéro reste donc toujours affiché.
  window.__pjImgFail = function (img) {
    var box = img.parentNode;
    if (!box) return;
    box.className = box.className.replace('duo', 'jersey');
    // retire les numéros superposés à la photo (tuile + modal) → ne reste que le maillot dessous
    var over = box.querySelectorAll('.pnum-badge, .pm-num');
    for (var i = 0; i < over.length; i++) { over[i].parentNode.removeChild(over[i]); }
    img.parentNode.removeChild(img);
  };

  // ---------- Lens Foot TV (vraies vidéos YouTube, chargement différé) ----------
  function ytThumb(id) { return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; }
  function videoCard(v, big) {
    var emb = v.embeddable ? '1' : '0';
    var badge = v.embeddable ? '' : '<span class="vext">YouTube ↗</span>';
    return '<div class="video-card' + (big ? ' big' : '') + '" data-id="' + v.id + '" data-emb="' + emb + '"' +
      ' role="button" tabindex="0" aria-label="' + (v.embeddable ? 'Lire' : 'Ouvrir sur YouTube') + ' : ' + esc(v.title) + '">' +
      '<div class="vthumb" style="background-image:url(' + ytThumb(v.id) + ')"></div>' + badge +
      '<button class="playbtn" aria-hidden="true">▶</button>' +
      '<div class="vmeta"><span class="vtitle">' + esc(v.title) + '</span>' +
      '<span class="vauthor">' + esc(v.author) + '</span></div>' +
    '</div>';
  }
  function playVideo(card) {
    var id = card.getAttribute('data-id');
    if (card.getAttribute('data-emb') === '1') {
      // vidéo intégrable → lecture dans le site
      if (card.classList.contains('playing')) return;
      stopInlineVideo();                 // une seule vidéo à la fois
      card._facade = card.innerHTML;     // mémorise la miniature pour la restaurer
      card.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
        '?autoplay=1&rel=0" title="Vidéo RC Lens" frameborder="0" ' +
        'allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
      card.classList.add('playing');
      playingCard = card;
      document.body.classList.add('lamp-off');
      duckSite(true);                    // coupe le son du site pendant la vidéo
      ignoreScrollStop = true;           // évite un arrêt immédiat (auto-scroll) juste après le lancement
      setTimeout(function () { ignoreScrollStop = false; }, 600);
    } else {
      // vidéo bloquée à l'intégration (LFP/beIN…) → on ouvre sur YouTube
      window.open('https://www.youtube.com/watch?v=' + id, '_blank', 'noopener');
    }
  }
  function stopInlineVideo() {           // stoppe la vidéo en cours (ex. au scroll) et relance le son du site
    if (!playingCard) return;
    if (playingCard._facade != null) playingCard.innerHTML = playingCard._facade;
    playingCard.classList.remove('playing');
    playingCard = null;
    duckSite(false);
  }
  function duckSite(on) {                // coupe (on) / relance (off) le son du site
    videoDuck = on;
    if (audioMode === 'wa' && audioCtx && master) {
      var t = audioCtx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime((muted || videoDuck) ? 0 : 0.95, t + 0.3);
    }
    // en mode simple (file://), audioLerp applique videoDuck
  }
  // la vidéo reste lue tant qu'au moins la moitié est visible à l'écran
  function isMostlyVisible(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return r.height > 0 && visible >= r.height * 0.5;
  }
  function renderVideos() {
    var vids = (window.VIDEOS || []).slice();
    if (!vids.length) return;
    // priorité aux vidéos lisibles dans le site (mises en avant), les redirigées ensuite
    vids.sort(function (a, b) { return (b.embeddable ? 1 : 0) - (a.embeddable ? 1 : 0); });
    var feat = vids.filter(function (v) { return v.embeddable && v.feature; })[0] ||
               vids.filter(function (v) { return v.embeddable; })[0] || vids[0];
    var rest = vids.filter(function (v) { return v !== feat; });
    document.getElementById('tv-feature').innerHTML = videoCard(feat, true);
    document.getElementById('tv-grid').innerHTML = rest.map(function (v) { return videoCard(v, false); }).join('');
    document.querySelectorAll('.video-card').forEach(function (card) {
      card.addEventListener('click', function () { playVideo(card); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playVideo(card); }
      });
    });
  }

  // ---------- Effectif (joueurs) ----------
  var POS = {
    G: { l: 'Gardien', p: 'Gardiens' },
    D: { l: 'Défenseur', p: 'Défenseurs' },
    M: { l: 'Milieu', p: 'Milieux' },
    A: { l: 'Attaquant', p: 'Attaquants' }
  };
  var SEASON_YEAR = 2026;
  var playerList = [];

  function playerMedia(p) {
    var num = (p.num != null) ? p.num : '—';
    var src = playerPhoto(p);
    // Maillot + numéro TOUJOURS présents en couche de fond : le numéro reste visible même
    // si la photo manque. La photo (si elle charge) recouvre ce fond ; sinon `onerror` la
    // retire et révèle le maillot dessous → l'étiquette ne peut jamais disparaître.
    var base = '<span class="pj-stripe"></span><span class="player-num">' + num + '</span>';
    if (!src) return '<span class="player-photo jersey">' + base + '</span>';
    return '<span class="player-photo duo">' + base +
      '<img src="' + src + '" alt="' + esc(p.name) + '" loading="lazy" onerror="window.__pjImgFail(this)">' +
      '<span class="pnum-badge">' + num + '</span></span>';
  }
  function playerCardHTML(p, i) {
    var meta = p.loan ? ('🔁 Prêt · ' + esc(p.loan)) : (p.flag + ' ' + POS[p.pos].l);
    return '<button class="player-card reveal' + (p.loan ? ' is-loan' : '') + '" data-i="' + i +
        '" data-pos="' + p.pos + '" data-loan="' + (p.loan ? '1' : '0') + '">' +
      playerMedia(p) +
      (p.cap ? '<span class="player-cap">C</span>' : '') +
      (p.loan ? '<span class="player-loan">PRÊT</span>' : '') +
      '<span class="player-scrim"><span class="player-name">' + esc(p.name) + '</span>' +
        '<span class="player-meta">' + meta + '</span></span>' +
    '</button>';
  }
  // Affiche/masque les cartes selon le filtre. Les prêtés sont exclus de l'effectif
  // premier ('all' + postes) et regroupés sous le filtre 'loan'.
  function applySquadFilter(f) {
    document.querySelectorAll('#squad .player-card').forEach(function (c) {
      var isLoan = c.getAttribute('data-loan') === '1';
      var show = (f === 'loan') ? isLoan
               : (f === 'all') ? !isLoan
               : (!isLoan && c.getAttribute('data-pos') === f);
      c.style.display = show ? '' : 'none';
    });
  }

  function renderPlayers() {
    var list = window.PLAYERS || [];
    if (!list.length) return;
    var order = { G: 0, D: 1, M: 2, A: 3 };
    playerList = list.slice().sort(function (a, b) {
      return (order[a.pos] - order[b.pos]) || ((a.num || 99) - (b.num || 99));
    });
    var hasLoan = playerList.some(function (p) { return p.loan; });
    var filters = [['all', 'Effectif'], ['G', 'Gardiens'], ['D', 'Défenseurs'], ['M', 'Milieux'], ['A', 'Attaquants']];
    if (hasLoan) filters.push(['loan', 'Prêtés']);
    document.getElementById('squadFilters').innerHTML = filters.map(function (f, i) {
      return '<button class="sq-filter' + (i === 0 ? ' active' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>';
    }).join('');
    document.getElementById('squad').innerHTML = playerList.map(playerCardHTML).join('');
    applySquadFilter('all');   // par défaut : effectif premier (prêtés masqués)
    renderSpotlight();

    document.querySelectorAll('#squad .player-card').forEach(function (c) {
      c.addEventListener('click', function () { openPlayer(playerList[+c.getAttribute('data-i')]); });
      revealObserver.observe(c);
    });
    document.querySelectorAll('#squadFilters .sq-filter').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#squadFilters .sq-filter').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        applySquadFilter(b.getAttribute('data-f'));
      });
    });
  }

  // ---------- Sondage interactif (data/poll.js) ----------
  // Un vote par navigateur et par sondage (clé localStorage = id du sondage). Change l'`id`
  // dans data/poll.js → nouveau sondage, chacun peut revoter. Les compteurs = amorce `base`
  // + le vote local. (Agrégation réelle multi-visiteurs = backend requis.)
  function renderPoll() {
    var box = document.getElementById('pollBox');
    if (!box || !window.POLL || !POLL.options) return;
    var P = window.POLL, key = 'cb_poll_' + P.id, voted = null;
    try { voted = localStorage.getItem(key); } catch (e) {}
    var db = (P.dbUrl || '').replace(/\/+$/, '');           // Realtime DB Firebase (vide = local)
    var base = P.options.map(function (o) { return o.base || 0; });
    var remote = null;                                       // vrais votes lus depuis Firebase

    function counts() {
      return P.options.map(function (o, i) {
        var real = remote ? (remote[i] || 0) : 0;
        var localVote = (!db && voted !== null && +voted === i) ? 1 : 0;
        return base[i] + real + localVote;
      });
    }
    function pushVote(i) {                                   // incrément atomique côté Firebase
      if (!db) return;
      if (remote) remote[i] = (remote[i] || 0) + 1;          // optimiste
      var body = {}; body[i] = { '.sv': { increment: 1 } };
      fetch(db + '/polls/' + encodeURIComponent(P.id) + '.json', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }).catch(function () {});
    }
    function draw() {
      var c = counts(), total = c.reduce(function (a, b) { return a + b; }, 0) || 1;
      var html = '<p class="q">' + esc(P.question) + '</p>';
      P.options.forEach(function (o, i) {
        if (voted !== null) {
          var pct = Math.round(c[i] / total * 100);
          html += '<div class="opt done' + (+voted === i ? ' mine' : '') + '">' +
            '<div class="bar"><div class="fill" style="width:0" data-w="' + pct + '%"></div>' +
            '<div class="lbl"><span>' + (+voted === i ? '✓ ' : '') + esc(o.label) + '</span>' +
            '<span>' + pct + '%</span></div></div></div>';
        } else {
          html += '<button class="opt vote" type="button" data-i="' + i + '">' +
            '<div class="bar"><div class="lbl"><span>' + esc(o.label) + '</span>' +
            '<span class="go">Voter ›</span></div></div></button>';
        }
      });
      html += '<p class="poll-foot">' +
        (voted !== null ? (total + ' vote' + (total > 1 ? 's' : '') + ' · merci !') : 'Donnez votre avis — 1 vote par personne') +
        '</p>';
      box.innerHTML = html;
      requestAnimationFrame(function () {
        box.querySelectorAll('.fill').forEach(function (f) { f.style.width = f.dataset.w; });
      });
      if (voted === null) {
        box.querySelectorAll('.opt.vote').forEach(function (btn) {
          btn.addEventListener('click', function () {
            voted = btn.getAttribute('data-i');
            try { localStorage.setItem(key, voted); } catch (e) {}
            pushVote(+voted);
            draw();
          });
        });
      }
    }
    // En mode Firebase : on lit d'abord les vrais compteurs, puis on affiche
    if (db) {
      fetch(db + '/polls/' + encodeURIComponent(P.id) + '.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          remote = P.options.map(function (_, i) { return (data && data[i] != null) ? +data[i] : 0; });
          draw();
        })
        .catch(function () { remote = P.options.map(function () { return 0; }); draw(); });
    } else {
      draw();
    }
  }

  function pmStat(label, val) {
    return '<div class="pm-stat"><span class="v">' + val + '</span><span class="l">' + label + '</span></div>';
  }
  function openPlayer(p) {
    var m = document.getElementById('playerModal');
    var num = (p.num != null) ? p.num : '—';
    var age = p.born ? (SEASON_YEAR - p.born) : null;
    var skillsUrl = p.video
      ? (/^https?:/.test(p.video) ? p.video : 'https://www.youtube.com/watch?v=' + p.video)
      : 'https://www.youtube.com/results?search_query=' + encodeURIComponent(p.name + ' RC Lens skills');
    var skillsLabel = p.video ? '▶ Skills ↗' : '▶ Vidéos ↗';
    var pmSrc = playerPhoto(p);
    var pmCap = p.cap ? '<span class="player-cap">C</span>' : '';
    var head = pmSrc
      ? '<div class="pm-head duo"><span class="pj-stripe"></span><span class="player-num pm-base-num">' + num + '</span>' +
          '<img src="' + pmSrc + '" alt="' + esc(p.name) + '" onerror="window.__pjImgFail(this)">' +
          pmCap + '<span class="pm-num">' + num + '</span></div>'
      : '<div class="pm-head jersey"><span class="pj-stripe"></span>' +
          pmCap + '<span class="player-num">' + num + '</span></div>';
    var tiles = pmStat('Numéro', num) + pmStat('Poste', POS[p.pos].l) +
                pmStat('Âge', age ? age + ' ans' : '—') + pmStat('Né en', p.born || '—');
    if (p.matches != null) tiles += pmStat('Matchs', p.matches);
    if (p.goals != null) tiles += pmStat('Buts', p.goals);
    if (p.assists != null) tiles += pmStat('Passes déc.', p.assists);
    m.querySelector('.pm-inner').innerHTML =
      '<button class="pm-close" aria-label="Fermer">×</button>' + head +
      '<div class="pm-body">' +
        '<span class="player-meta">' + p.flag + ' ' + esc(p.nat) + (p.cap ? ' · Capitaine' : '') + (p.loan ? ' · Prêté à ' + esc(p.loan) : '') + '</span>' +
        '<h3>' + esc(p.name) + '</h3>' +
        (p.desc ? '<p class="pm-desc">' + esc(p.desc) + '</p>' : '') +
        '<div class="pm-stats">' + tiles + '</div>' +
        (p.matches != null ? '<span class="pm-statyear">Statistiques Ligue 1 · saison 2025-2026</span>' : '') +
        '<div class="pm-actions">' +
          '<a class="btn btn-ghost pm-link" href="https://www.rclens.fr/fr/equipe/saison-2025-2026" target="_blank" rel="noopener">Fiche officielle ↗</a>' +
          '<a class="btn btn-gold pm-skills" href="' + skillsUrl + '" target="_blank" rel="noopener">' + skillsLabel + '</a>' +
        '</div>' +
      '</div>';
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('locked');
    lastFocused = document.activeElement;
    var pmClose = m.querySelector('.pm-close'); if (pmClose) pmClose.focus();
  }
  function closePlayer() {
    var m = document.getElementById('playerModal');
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('locked');
    restoreFocus();
  }

  // ---------- Lecture d'un article (page dédiée) ----------
  function openArticle(a) {
    if (!a) return;
    var m = document.getElementById('articleModal');
    var c = cat(a.category);
    var paras = (a.body && a.body.length ? a.body : [a.excerpt]);
    m.querySelector('.am-inner').innerHTML =
      '<button class="am-close" aria-label="Fermer">×</button>' +
      '<div class="am-hero"><img class="' + (isPlayerImg(artDetailImg(a)) ? 'is-portrait' : '') + '" src="' + artDetailImg(a) + '" alt="' + esc(a.title) + '"' + (a.imgPos ? ' style="object-position:' + a.imgPos + '"' : '') + ' loading="lazy" onerror="this.onerror=null;this.src=\'' + defImg(a) + '\'">' +
        '<span class="tag ' + c.cls + '">' + c.label + '</span>' + stBadge(a) +
        (a.imageCredit ? '<span class="am-credit">📷 ' + esc(a.imageCredit) + '</span>' : '') +
      '</div>' +
      '<article class="am-body">' +
        '<span class="am-meta">' + c.label + ' · ' + fmtDate(a.date) + '</span>' +
        '<h2>' + esc(a.title) + '</h2>' +
        '<p class="am-lead">' + esc(a.excerpt) + '</p>' +
        paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        (a.sources && a.sources.length
          ? '<div class="am-sources"><span class="am-src-label">Sources</span><ul>' +
              a.sources.map(function (s) {
                return '<li><a href="' + s.url + '" target="_blank" rel="noopener">' + esc(s.name) + ' ↗</a></li>';
              }).join('') + '</ul></div>'
          : '') +
      '</article>';
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    m.scrollTop = 0;
    document.body.classList.add('locked');
    lastFocused = document.activeElement;
    var amClose = m.querySelector('.am-close'); if (amClose) amClose.focus();
  }
  function closeArticle() {
    var m = document.getElementById('articleModal');
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('locked');
    restoreFocus();
  }
  // a11y : mémorise l'élément déclencheur et lui rend le focus à la fermeture
  var lastFocused = null;
  function restoreFocus() {
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
    lastFocused = null;
  }
  // ---------- Histoire du club (filons + légendes) ----------
  function openStory(o) {
    var m = document.getElementById('articleModal');
    var img = o.image
      ? '<div class="am-hero"><img src="' + o.image + '" alt="' + esc(o.title) + '"' + (o.imgPos ? ' style="object-position:' + o.imgPos + '"' : '') + '></div>'
      : '';
    m.querySelector('.am-inner').innerHTML =
      '<button class="am-close" aria-label="Fermer">×</button>' + img +
      '<article class="am-body">' +
        (o.meta ? '<span class="am-meta">' + esc(o.meta) + '</span>' : '') +
        '<h2>' + esc(o.title) + '</h2>' +
        (o.paras || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      '</article>';
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    m.scrollTop = 0;
    document.body.classList.add('locked');
    lastFocused = document.activeElement;
    var cb = m.querySelector('.am-close'); if (cb) cb.focus();
  }

  function renderHistoire() {
    var el = document.getElementById('histoireSlot');
    if (!el || !window.HISTOIRE) return;
    var H = window.HISTOIRE;
    var FL = H.filons || [];
    var filons = FL.map(function (f, i) {
      var t = FL.length > 1 ? i / (FL.length - 1) : 0;              // 0 (haut/jaune) -> 1 (bas/rouge)
      var col = 'rgb(' + Math.round(255 - 31 * t) + ',' + Math.round(210 - 180 * t) + ',30)';
      return '<button class="filon" style="--node:' + col + '"><span class="filon-an">' + f.year + '</span>' +
             '<span class="filon-ti">' + esc(f.titre) + '</span></button>';
    }).join('');
    var legs = (H.legendes || []).map(function (l) {
      var ini = l.name.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
      var ph = l.photo
        ? '<span class="leg-ph"><img src="' + l.photo + '" alt="' + esc(l.name) + '" loading="lazy"></span>'
        : '<span class="leg-ph leg-mono">' + esc(ini) + '</span>';
      return '<button class="legende">' + ph +
             '<span class="leg-nom">' + esc(l.name) + '</span>' +
             '<span class="leg-role">' + esc(l.role || '') + '</span>' +
             '<span class="leg-era">' + esc(l.era || '') + '</span></button>';
    }).join('');
    el.innerHTML =
      '<div class="hist-head"><span class="sec-kicker">120 ans au fond</span>' +
        '<h3>La veine du temps</h3>' +
        '<p class="hist-sub">De la surface d’aujourd’hui jusqu’à la fondation, en 1906, dans le charbon — creusez l’histoire du Racing.</p></div>' +
      '<div class="filons">' + filons + '</div>' +
      '<div class="hist-head hist-head2"><span class="sec-kicker">Le panthéon du fond</span>' +
        '<h3>Les légendes sang &amp; or</h3></div>' +
      '<div class="legendes">' + legs + '</div>';
    el.querySelectorAll('.filon').forEach(function (b, i) {
      b.addEventListener('click', function () {
        var f = H.filons[i];
        openStory({ title: f.year + ' — ' + f.titre, meta: 'Histoire du club', paras: f.recit, image: f.image, imgPos: f.imgPos });
      });
    });
    el.querySelectorAll('.legende').forEach(function (b, i) {
      b.addEventListener('click', function () {
        var l = H.legendes[i];
        openStory({ title: l.name, meta: (l.role || '') + ' · ' + (l.era || ''), paras: l.texte, image: l.photo, imgPos: l.imgPos });
      });
    });
  }

  function renderSpotlight() {
    var el = document.getElementById('squadSpotlight');
    if (!el) return;
    var star = playerList.filter(function (p) { return p.cap && p.photo && !p.loan; })[0] ||
               playerList.filter(function (p) { return p.photo && !p.loan; })[0];
    if (!star) { el.innerHTML = ''; return; }
    var num = (star.num != null) ? star.num : '—';
    el.innerHTML =
      '<div class="spotlight">' +
        '<div class="spot-photo duo"><img src="' + star.photo + '" alt="' + esc(star.name) + '">' +
          '<span class="spot-num">' + num + '</span></div>' +
        '<div class="spot-info">' +
          '<span class="sec-kicker">' + (star.cap ? 'Le capitaine' : 'À la une') + '</span>' +
          '<h3>' + esc(star.name) + '</h3>' +
          '<span class="player-meta">' + star.flag + ' ' + esc(star.nat) + ' · ' + POS[star.pos].l + ' · N° ' + num + '</span>' +
          (star.desc ? '<p>' + esc(star.desc) + '</p>' : '') +
          '<button class="btn btn-gold" id="spotBtn">Voir la fiche</button>' +
        '</div>' +
      '</div>';
    var btn = document.getElementById('spotBtn');
    if (btn) btn.addEventListener('click', function () { openPlayer(star); });
  }

  // ---------- Animations au scroll ----------
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); }
    });
  }, { threshold: 0.12 });

  // ---------- Descente dans la mine (parallaxe au scroll) ----------
  var MAX_DEPTH = 1906; // mètres (profondeur max de la descente)
  var mineEls = {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var LEVEL_STEP = 100; // un palier de galerie tous les 100 m
  function cacheMine() {
    mineEls.bg     = document.getElementById('mine');
    mineEls.walls  = document.querySelectorAll('#mine .wall');
    mineEls.beams  = document.getElementById('mineBeams');
    mineEls.haze   = document.getElementById('mineHaze');
    mineEls.lamp   = document.getElementById('mineLamp');
    mineEls.lampOverlay = document.getElementById('lampOverlay');
    mineEls.gaugeN = document.querySelector('#depthGauge .d');
    mineEls.gaugeF = document.querySelector('#depthGauge .rail i');
    mineEls.gauge  = document.getElementById('depthGauge');
    // génère les paliers de galerie avec leur profondeur
    mineEls.levels = [];
    var container = document.getElementById('mineLevels');
    if (container && !reduceMotion) {
      for (var d = LEVEL_STEP; d <= MAX_DEPTH; d += LEVEL_STEP) {
        var lv = document.createElement('div');
        lv.className = 'level';
        lv.setAttribute('data-d', d);
        lv.innerHTML = '<span class="beam"></span><span class="lvl-label">−' + d + ' m</span><span class="beam"></span>';
        container.appendChild(lv);
        mineEls.levels.push(lv);
      }
    }
  }

  function updateMine() {
    var y = window.scrollY || window.pageYOffset;
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    var p = docH > 0 ? Math.min(1, y / docH) : 0;

    // traversée du puits : l'image de fond défile de la surface (0%) vers le fond (100%)
    if (!reduceMotion) {
      if (mineEls.bg) mineEls.bg.style.backgroundPositionY = (p * 100).toFixed(1) + '%';
      if (mineEls.walls) mineEls.walls.forEach(function (w) {
        w.style.backgroundPositionY = (y * 0.5) + 'px';
      });
      if (mineEls.beams) mineEls.beams.style.transform = 'translateY(' + (-(y * 0.75) % 240) + 'px)';
      // paliers de galerie : positionnés à leur vraie profondeur, ils défilent vers le haut
      if (mineEls.levels && mineEls.levels.length) {
        var pxPerM = docH > 0 ? docH / MAX_DEPTH : 1;
        var vh = window.innerHeight;
        mineEls.levels.forEach(function (lv) {
          var screenY = (+lv.getAttribute('data-d')) * pxPerM - y;
          if (screenY < -60 || screenY > vh + 60) {
            lv.style.visibility = 'hidden';
          } else {
            lv.style.visibility = 'visible';
            lv.style.transform = 'translateY(' + screenY + 'px)';
          }
        });
      }
    }
    // l'obscurité s'installe avec la profondeur
    if (mineEls.haze) mineEls.haze.style.opacity = (0.15 + p * 0.85).toFixed(3);
    // jauge de profondeur
    if (mineEls.gaugeN) mineEls.gaugeN.textContent = '−' + Math.round(p * MAX_DEPTH) + ' m';
    if (mineEls.gaugeF) mineEls.gaugeF.style.height = (p * 100) + '%';
    if (mineEls.gauge) mineEls.gauge.classList.toggle('deep', p > 0.15);
    // lampe torche : le voile sombre s'installe et se resserre avec la profondeur
    if (mineEls.lampOverlay) {
      var od = (p - 0.10) * 1.05; od = od < 0 ? 0 : (od > 0.82 ? 0.82 : od);
      mineEls.lampOverlay.style.opacity = od.toFixed(3);
    }
    // la lampe se resserre + les côtés s'assombrissent nettement avec la profondeur
    document.documentElement.style.setProperty('--lampR', (33 - p * 12).toFixed(1) + 'vmax');
    var edge = (p - 0.08) * 1.1; edge = edge < 0 ? 0 : (edge > 0.94 ? 0.94 : edge);
    document.documentElement.style.setProperty('--edge', edge.toFixed(3));
    // mélange sonore corons ↔ ascenseur selon la profondeur, l'activité et le SENS du scroll
    mineDepth = p;
    if (ambienceReady) updateAudioMix(p, isScrolling, scrollDir);
  }

  function buildDust() {
    var wrap = document.getElementById('mineDust');
    if (!wrap || reduceMotion) return;
    for (var i = 0; i < 40; i++) {
      var s = document.createElement('span');
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (Math.random() * 100) + '%';
      var sz = 1 + Math.random() * 2.5;
      s.style.width = s.style.height = sz + 'px';
      s.style.animationDuration = (6 + Math.random() * 10) + 's';
      s.style.animationDelay = (-Math.random() * 12) + 's';
      s.style.opacity = (0.15 + Math.random() * 0.4).toFixed(2);
      wrap.appendChild(s);
    }
  }

  // ---------- Descente automatique PAR PALIERS (clic sur « Descendre ») ----------
  var autoScrolling = false, autoRAF = null, autoPauseTimer = null;
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function startAutoDescend() {
    cancelAutoDescend();
    var y0 = window.scrollY || window.pageYOffset || 0;
    if (reduceMotion) { // mouvement réduit : saut direct vers la section suivante, sans animation
      var next = ['recit', 'palmares', 'effectif', 'tv', 'actu']
        .map(function (id) { var e = document.getElementById(id); return e ? e.getBoundingClientRect().top + y0 - 64 : Infinity; })
        .filter(function (t) { return t > y0 + 24; }).sort(function (a, b) { return a - b; })[0];
      if (next != null && next !== Infinity) window.scrollTo({ top: next, behavior: 'auto' });
      return;
    }
    var maxY = document.documentElement.scrollHeight - window.innerHeight;
    // cibles = hauts des sections (marge pour le header), puis le bas de page
    var targets = [];
    ['recit', 'palmares', 'effectif', 'tv', 'actu'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) targets.push(Math.max(0, el.getBoundingClientRect().top + y0 - 64));
    });
    targets.push(maxY);
    targets = targets.filter(function (t) { return t > y0 + 24; }).sort(function (a, b) { return a - b; });
    var clean = [];
    targets.forEach(function (t) { if (!clean.length || t - clean[clean.length - 1] > 40) clean.push(Math.min(t, maxY)); });
    if (!clean.length) return;
    autoScrolling = true;
    runLeg(0, clean);
  }
  function runLeg(i, targets) {
    if (!autoScrolling) return;
    if (i >= targets.length) { autoScrolling = false; return; }
    var startY = window.scrollY || window.pageYOffset || 0;
    var dist = targets[i] - startY;
    if (dist <= 2) { runLeg(i + 1, targets); return; }
    var dur = Math.min(4200, Math.max(1100, dist * 2.4)); // vitesse ~constante ; décélère à l'arrivée
    var t0 = null;
    function step(ts) {
      if (!autoScrolling) return;
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / dur);
      window.scrollTo({ top: startY + dist * easeInOutCubic(t), behavior: 'auto' }); // 'auto' = ignore le scroll-behavior:smooth
      if (t < 1) { autoRAF = requestAnimationFrame(step); }
      else { autoPauseTimer = setTimeout(function () { runLeg(i + 1, targets); }, 600); } // petite pause à chaque section
    }
    autoRAF = requestAnimationFrame(step);
  }
  function cancelAutoDescend() {
    autoScrolling = false;
    if (autoRAF) { cancelAnimationFrame(autoRAF); autoRAF = null; }
    if (autoPauseTimer) { clearTimeout(autoPauseTimer); autoPauseTimer = null; }
  }

  // ---------- Compteurs animés ----------
  function animateCounters() {
    var nums = document.querySelectorAll('.stats-band .num');
    nums.forEach(function (n) {
      var to = parseFloat(n.dataset.to) || 0;
      var suffix = n.dataset.suffix || '';
      if (reduceMotion) { n.textContent = to + suffix; return; }
      var start = null, dur = 1300;
      function step(ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        n.textContent = Math.round(eased * to) + suffix;
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ---------- Ambiance sonore : corons + ascenseur, mix au scroll ----------
  // En file:// (double-clic), Web Audio ne peut PAS traiter un média local
  // (« MediaElementAudioSource outputs zeroes … CORS ») → mode volume simple.
  // En http(s):// (serveur local), on active le vrai filtre passe-bas.
  var audioCtx, master, audioNodes = {}, coronsEl, elevDownEl, elevUpEl, piocheEl, audioMode = 'plain';
  var ambienceReady = false, muted = false, mineDepth = 0, isScrolling = false, idleTimer = null, scrollDir = 1;
  var volTarget = { corons: 0, down: 0, up: 0, pioche: 0 }, piocheRand = 0.6, coronsVol = 0;
  var videoDuck = false, playingCard = null, ignoreScrollStop = false;

  function startAmbience() {
    if (ambienceReady) { if (audioCtx && audioCtx.resume) audioCtx.resume(); playAudioEls(); return; }
    coronsEl = document.getElementById('audioCorons');
    elevDownEl = document.getElementById('audioElevDown');
    elevUpEl = document.getElementById('audioElevUp');
    piocheEl = document.getElementById('audioPioche');
    if (!coronsEl || !elevDownEl || !elevUpEl) return;
    [coronsEl, elevDownEl, elevUpEl, piocheEl].forEach(function (el) { if (el) el.loop = true; });

    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC && location.protocol !== 'file:') {
      // ---- Mode complet : Web Audio + vrai filtre passe-bas ----
      audioMode = 'wa';
      audioCtx = new AC();
      if (audioCtx.resume) audioCtx.resume();
      master = audioCtx.createGain(); master.gain.value = 0.0001;
      var comp = audioCtx.createDynamicsCompressor();
      master.connect(comp); comp.connect(audioCtx.destination);
      var cs = audioCtx.createMediaElementSource(coronsEl);
      var lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.5;
      var cg = audioCtx.createGain(); cg.gain.value = 0.85;
      cs.connect(lp); lp.connect(cg); cg.connect(master);
      var ds = audioCtx.createMediaElementSource(elevDownEl);
      var dg = audioCtx.createGain(); dg.gain.value = 0; ds.connect(dg); dg.connect(master);
      var us = audioCtx.createMediaElementSource(elevUpEl);
      var ug = audioCtx.createGain(); ug.gain.value = 0; us.connect(ug); ug.connect(master);
      var ps = audioCtx.createMediaElementSource(piocheEl);
      var pg = audioCtx.createGain(); pg.gain.value = 0; ps.connect(pg); pg.connect(master);
      audioNodes = { coronsLP: lp, coronsGain: cg, downGain: dg, upGain: ug, piocheGain: pg };
      master.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.95, audioCtx.currentTime + 1.6);
    } else {
      // ---- Mode simple (file://) : volume direct, lissé par audioLerp ----
      audioMode = 'plain';
      coronsEl.volume = 0; elevDownEl.volume = 0; elevUpEl.volume = 0;
      if (piocheEl) piocheEl.volume = 0;
    }

    requestAnimationFrame(audioLerp);
    startPiocheJitter();
    playAudioEls();
    ambienceReady = true;
    updateAudioMix(mineDepth, false, scrollDir);
    updateToggle();
  }
  // variation aléatoire du volume de la pioche (ambiance de fond de mine)
  function startPiocheJitter() {
    setInterval(function () {
      piocheRand = 0.35 + Math.random() * 0.65;
      if (audioMode === 'wa' && audioCtx && audioNodes.piocheGain) {
        audioNodes.piocheGain.gain.setTargetAtTime(volTarget.pioche * piocheRand, audioCtx.currentTime, 0.4);
      }
    }, 700);
  }

  function playAudioEls() {
    [coronsEl, elevDownEl, elevUpEl, piocheEl].forEach(function (el) {
      if (!el) return;
      var pr = el.play();
      if (pr && pr.catch) pr.catch(function () {});
    });
  }

  // lissage du volume en mode simple — attaque rapide, relâche lente (fondu doux à l'arrêt)
  function approach(cur, target, up, down) {
    var v = cur + (target - cur) * (target > cur ? up : down);
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }
  // enveloppe de boucle des corons : petit fondu au raccord (fin <-> reprise)
  function coronsSeamFactor() {
    if (!coronsEl) return 1;
    var d = coronsEl.duration, ct = coronsEl.currentTime, F = 0.7;
    if (!d || d < 2 * F) return 1;
    var f = 1;
    if (ct > d - F) f = (d - ct) / F;      // fondu de sortie en fin de boucle
    else if (ct < F) f = ct / F;           // fondu d'entrée à la reprise
    f = f < 0 ? 0 : (f > 1 ? 1 : f);
    return 0.3 + 0.7 * f;                  // descend à ~30% au raccord, jamais coupé net
  }
  function audioLerp() {
    if (ambienceReady) {
      var seam = coronsSeamFactor();
      if (audioMode === 'plain') {
        var m = (muted || videoDuck) ? 0 : 1;
        coronsVol = approach(coronsVol, volTarget.corons * m, 0.12, 0.10);
        coronsEl.volume = coronsVol * seam;
        elevDownEl.volume = approach(elevDownEl.volume, volTarget.down * m, 0.16, 0.045);
        elevUpEl.volume = approach(elevUpEl.volume, volTarget.up * m, 0.16, 0.045);
        if (piocheEl) piocheEl.volume = approach(piocheEl.volume, volTarget.pioche * piocheRand * m, 0.10, 0.06);
      } else if (coronsEl) {
        coronsEl.volume = seam;              // mix corons via coronsGain ; enveloppe de boucle via le volume élément
      }
    }
    requestAnimationFrame(audioLerp);
  }

  // mix : corons (s'atténuent vite en descendant) + ascenseur directionnel (descend / monte)
  function updateAudioMix(p, scrolling, dir) {
    if (!ambienceReady) return;
    var corons = 0.60 * Math.pow(1 - Math.min(1, p), 2.4);  // corons bien plus atténués en descendant
    var elev = scrolling ? (0.28 + p * 0.52) * 0.5 : 0;           // ascenseur (un peu moins fort)
    var downV = (dir >= 0) ? elev : 0;                      // scroll bas → son "descend"
    var upV = (dir < 0) ? elev : 0;                         // scroll haut → son "monte"
    var deep = Math.max(0, (p - 0.45) / 0.55);              // présence de "fond de mine"
    var pioche = (scrolling && dir < 0) ? 0 : deep * 0.5;   // au fond même à l'arrêt ; coupée SEULEMENT si on remonte
    volTarget.pioche = pioche;
    if (audioMode === 'wa') {
      var t = audioCtx.currentTime;
      audioNodes.coronsLP.frequency.setTargetAtTime(280 + Math.pow(1 - Math.min(1, p), 2.0) * 5720, t, 0.22);
      audioNodes.coronsGain.gain.setTargetAtTime(corons, t, 0.22);
      // attaque rapide, relâche lente → fondu doux à l'arrêt du scroll
      audioNodes.downGain.gain.setTargetAtTime(downV, t, downV > 0.001 ? 0.10 : 0.35);
      audioNodes.upGain.gain.setTargetAtTime(upV, t, upV > 0.001 ? 0.10 : 0.35);
      audioNodes.piocheGain.gain.setTargetAtTime(pioche * piocheRand, t, 0.3);
    } else {
      volTarget.corons = corons;
      volTarget.down = downV;
      volTarget.up = upV;
    }
  }

  function toggleAudio() {
    if (!ambienceReady) { startAmbience(); return; }
    muted = !muted;
    if (audioMode === 'wa') {
      var t = audioCtx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.95, t + 0.4);
    } // en mode simple, audioLerp applique le mute
    updateToggle();
  }
  function updateToggle() {
    var btn = document.getElementById('audioToggle');
    btn.classList.add('show');
    btn.classList.toggle('muted', muted);
    btn.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
  }

  // ---------- Intro ----------
  function buildEmbers() {
    var wrap = document.getElementById('embers');
    if (!wrap || reduceMotion) return;
    for (var i = 0; i < 26; i++) {
      var e = document.createElement('span');
      e.className = 'ember';
      e.style.left = (Math.random() * 100) + '%';
      e.style.animationDuration = (5 + Math.random() * 7) + 's';
      e.style.animationDelay = (Math.random() * 8) + 's';
      var s = 2 + Math.random() * 4;
      e.style.width = e.style.height = s + 'px';
      wrap.appendChild(e);
    }
  }
  function enterSite() {
    startAmbience();
    document.getElementById('intro').classList.add('hidden');
    document.body.classList.remove('locked');
    var lt = document.getElementById('lampToggle'); if (lt) lt.classList.add('show');
    // libère la vidéo d'intro (elle n'est plus visible)
    setTimeout(function () {
      var iv = document.getElementById('introVideo');
      if (iv) { try { iv.pause(); } catch (e) {} }
    }, 1200);
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', function () {
    render();
    renderFil();
    renderVideos();
    renderPlayers();
    renderMatch();
    renderStandings();
    renderPoll();
    renderHistoire();
    buildEmbers();
    cacheMine();
    buildDust();
    updateMine();
    document.body.classList.add('locked');
    // Mouvement réduit : on fige la vidéo d'intro (le poster reste affiché)
    if (reduceMotion) {
      var iv0 = document.getElementById('introVideo');
      if (iv0) { try { iv0.pause(); iv0.removeAttribute('autoplay'); } catch (e) {} }
    }

    document.getElementById('enterBtn').addEventListener('click', enterSite);
    // démarre les corons dès la 1re interaction (l'autoplay pur est bloqué par le navigateur)
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () { startAmbience(); }, { passive: true });
    });
    // « Descendre » → descente automatique progressive dans la mine
    var cue = document.querySelector('.scroll-cue');
    if (cue) cue.addEventListener('click', function (e) { e.preventDefault(); startAutoDescend(); });
    // toute action de défilement de l'utilisateur interrompt la descente auto
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, function () { cancelAutoDescend(); }, { passive: true });
    });
    document.getElementById('audioToggle').addEventListener('click', toggleAudio);
    var lampToggle = document.getElementById('lampToggle');
    if (lampToggle) lampToggle.addEventListener('click', function () {
      var on = document.body.classList.toggle('lamp-disabled');
      lampToggle.classList.toggle('on', on);
      lampToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      lampToggle.setAttribute('aria-label', on ? 'Rétablir l’ambiance sombre' : 'Éclairer la page (désactiver l’effet sombre)');
    });
    // Sur mobile : le fil d'infos remonte AVANT les articles (retour sidebar sur grand écran)
    (function () {
      var mq = window.matchMedia('(max-width:820px)');
      function placeFil() {
        var w = document.getElementById('filWidget');
        var layout = document.querySelector('#actu .layout');
        var sidebar = document.querySelector('#actu .sidebar');
        if (!w || !layout || !sidebar) return;
        if (mq.matches) { layout.insertBefore(w, layout.firstElementChild); }
        else if (w.parentNode !== sidebar) { sidebar.insertBefore(w, sidebar.children[1] || null); }
      }
      placeFil();
      if (mq.addEventListener) mq.addEventListener('change', placeFil);
    })();
    // Newsletter : inscription Brevo en AJAX (double opt-in configuré côté Brevo)
    (function () {
      var NL_URL = 'https://fd66c9ed.sibforms.com/serve/MUIFAP4QSnqJCuYn_hKfQVomNHLRqKWISXEAWmzr9dayVMmcxLw1-Hb8PfnFkhli03SUKWcXLACedDiPH9W2U0AlfWf7fK4D7DXnSOfJIkQvGRCa-bIcug9dzuztrNnV8uJ6QWTeL8Kbt6cD0WU2GQKyMSJqS-qr6VuPySUwUN5sjilUmx4ICf4SPDLxKAuoVZYOVECJVhZTgVokAQ==?isAjax=1';
      var NL_FALLBACK = 'https://fd66c9ed.sibforms.com/serve/MUIFAP4QSnqJCuYn_hKfQVomNHLRqKWISXEAWmzr9dayVMmcxLw1-Hb8PfnFkhli03SUKWcXLACedDiPH9W2U0AlfWf7fK4D7DXnSOfJIkQvGRCa-bIcug9dzuztrNnV8uJ6QWTeL8Kbt6cD0WU2GQKyMSJqS-qr6VuPySUwUN5sjilUmx4ICf4SPDLxKAuoVZYOVECJVhZTgVokAQ==';
      var f = document.getElementById('nlForm'), msg = document.getElementById('nlMsg');
      if (!f) return;
      function track(ev) { if (window.goatcounter && goatcounter.count) goatcounter.count({ path: 'newsletter-' + ev, event: true }); }
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = f.querySelector('[name="EMAIL"]');
        if (!email.value || email.validity && !email.validity.valid) {
          msg.textContent = 'Adresse e-mail invalide.'; msg.className = 'nl-msg err'; return;
        }
        var btn = f.querySelector('button');
        btn.disabled = true; msg.textContent = 'Inscription en cours…'; msg.className = 'nl-msg';
        track('essai');
        fetch(NL_URL, { method: 'POST', body: new FormData(f) })
          .then(function (r) {
            return r.text().then(function (t) {
              var d = null; try { d = JSON.parse(t); } catch (_) {}
              if ((d && d.success) || (!d && r.ok)) {
                msg.textContent = 'Inscription confirmée — bienvenue chez les Charbonneurs ! Rendez-vous vendredi pour l\u2019hebdo.';
                msg.className = 'nl-msg ok'; f.reset(); track('ok');
              } else {
                msg.textContent = (d && (d.message || (d.errors && d.errors.EMAIL))) || 'Adresse invalide ou déjà inscrite.';
                msg.className = 'nl-msg err'; btn.disabled = false; track('refus');
              }
            });
          })
          .catch(function () {
            // Pas de popup (bloqué sur iOS) : lien cliquable inline vers le formulaire hébergé
            msg.innerHTML = 'Connexion impossible — <a href="' + NL_FALLBACK + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">inscrivez-vous ici</a>.';
            msg.className = 'nl-msg err'; btn.disabled = false; track('reseau');
          });
      });
    })();
    // Score EN DIRECT : lit data/live.json (poussé par GitHub Actions) toutes les 60 s
    (function () {
      // URL du proxy Cloudflare (vrai live). Vide = repli sur live.json (quasi-direct 3-6 min).
      var LIVE_WORKER = '';
      var RAW = 'https://raw.githubusercontent.com/tgrey89/charbonneur/main/data/live.json';
      var box = document.getElementById('lastMatch');
      if (!box) return;
      var saved = null;
      function render(d) {
        var live = d.status === 'IN_PLAY' || d.status === 'PAUSED';
        var md = document.getElementById('menuDirect');
        if (md) md.classList.toggle('is-live', live);
        if (!live) { if (saved !== null) { box.innerHTML = saved; saved = null; } return; }
        if (saved === null) saved = box.innerHTML;
        var min = d.status === 'PAUSED' ? 'MT' : (d.minute ? d.minute + '\u2032' : 'En cours');
        box.innerHTML =
          '<div class="live-line"><span class="live-dot"></span> EN DIRECT \u00b7 ' + esc(d.competition) + '</div>' +
          '<div class="live-score">' + esc(d.home.tla) + ' <strong>' + (d.home.score == null ? '\u2013' : d.home.score) +
          ' - ' + (d.away.score == null ? '\u2013' : d.away.score) + '</strong> ' + esc(d.away.tla) +
          ' <span class="live-min">' + min + '</span></div>' +
          (Array.isArray(d.goals) && d.goals.length
            ? '<ul class="live-goals">' + d.goals.map(function (g) {
                return '<li class="' + (g.side === 'home' ? 'lg-home' : 'lg-away') + '">\u26bd ' +
                  (g.minute ? g.minute + '\u2032 ' : '') + esc(g.scorer || '') +
                  (g.type === 'PENALTY' ? ' (pen.)' : g.type === 'OWN' ? ' (csc)' : '') + '</li>';
              }).join('') + '</ul>'
            : '');
      }
      function tick() {
        var src = LIVE_WORKER || (RAW + '?t=' + Date.now());
        fetch(src).then(function (r) { return r.json(); }).then(render).catch(function () {
          if (LIVE_WORKER) fetch(RAW + '?t=' + Date.now()).then(function (r) { return r.json(); }).then(render).catch(function () {});
        });
      }
      tick();
      setInterval(tick, LIVE_WORKER ? 30000 : 60000);
    })();
    document.getElementById('loadmore').addEventListener('click', renderMore);
    function setMenu(open) {
      var mn = document.getElementById('menu');
      if (open === undefined) open = !mn.classList.contains('open');
      mn.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
    }
    document.getElementById('burger').addEventListener('click', function (e) { e.stopPropagation(); setMenu(); });
    var mc = document.getElementById('menuClose');
    if (mc) mc.addEventListener('click', function (e) { e.stopPropagation(); setMenu(false); });
    var fab = document.getElementById('burgerFab');
    if (fab) fab.addEventListener('click', function (e) { e.stopPropagation(); setMenu(true); });
    // fermeture menu mobile au clic sur un lien
    document.querySelectorAll('#menu a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    // fermeture au tap hors du panneau
    document.addEventListener('click', function (e) {
      var mn = document.getElementById('menu');
      if (mn.classList.contains('open') && !mn.contains(e.target)) setMenu(false);
    });
    // fermeture de la fiche joueur
    var pm = document.getElementById('playerModal');
    pm.addEventListener('click', function (e) {
      if (e.target === pm || e.target.classList.contains('pm-close')) closePlayer();
    });
    var am = document.getElementById('articleModal');
    am.addEventListener('click', function (e) {
      if (e.target === am || e.target.classList.contains('am-close')) closeArticle();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePlayer(); closeArticle(); } });
    // le voile sombre s'efface au survol de la section vidéos (pour voir/cliquer les miniatures)
    var tvSection = document.getElementById('tv');
    if (tvSection) {
      tvSection.addEventListener('mouseenter', function () { document.body.classList.add('lamp-off'); });
      tvSection.addEventListener('mouseleave', function () {
        if (!document.querySelector('.video-card.playing')) document.body.classList.remove('lamp-off');
      });
    }

    // barres de sondage + compteurs de stats à l'apparition
    observeOnce('.poll', function (poll) {
      poll.querySelectorAll('.fill').forEach(function (f) { f.style.width = f.dataset.w; });
    });
    observeOnce('.stats-band', function () { animateCounters(); });

    // animations d'apparition (staggerées) sur tous les éléments .reveal
    document.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });

    // header qui devient solide au scroll + indice de descente qui s'efface
    var header = document.getElementById('siteHeader');
    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      updateMine();
      if (header) header.classList.toggle('scrolled', y > 40);
      document.body.classList.toggle('has-scrolled', y > 60);
    }
    var ticking = false, lastY = window.scrollY || window.pageYOffset || 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY || window.pageYOffset || 0;
      if (y > lastY + 1) scrollDir = 1;         // vers le bas → « ascenseur descend »
      else if (y < lastY - 1) scrollDir = -1;   // vers le haut → « ascenseur monte »
      lastY = y;
      if (playingCard && !ignoreScrollStop && !isMostlyVisible(playingCard)) stopInlineVideo(); // pause quand + de 50% est sorti de l'écran
      isScrolling = true;                        // l'ascenseur tourne pendant qu'on scrolle
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { isScrolling = false; updateMine(); }, 180); // arrêt → l'ascenseur s'estompe en douceur
      if (!ticking) { window.requestAnimationFrame(function () { onScroll(); ticking = false; }); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', updateMine, { passive: true });
    onScroll();

    // lampe de mineur qui suit le curseur
    if (!reduceMotion) {
      var lampTick = false;
      window.addEventListener('mousemove', function (e) {
        if (lampTick) return;
        lampTick = true;
        var cx = e.clientX, cy = e.clientY;
        window.requestAnimationFrame(function () {
          var root = document.documentElement.style;
          root.setProperty('--lx', (cx / window.innerWidth * 100).toFixed(1) + '%');
          root.setProperty('--ly', (cy / window.innerHeight * 100).toFixed(1) + '%');
          lampTick = false;
        });
      }, { passive: true });
    }
  });

  function observeOnce(sel, cb) {
    var el = document.querySelector(sel);
    if (!el) return;
    new IntersectionObserver(function (en, obs) {
      en.forEach(function (e) { if (e.isIntersecting) { cb(el); obs.disconnect(); } });
    }, { threshold: 0.3 }).observe(el);
  }
})();
