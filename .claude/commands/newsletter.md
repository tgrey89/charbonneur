# /newsletter — envoi de la newsletter Charbonneur

Déclenche le workflow GitHub Actions `newsletter.yml`, qui compose l'e-mail depuis
`data/articles.js` (articles des 7 derniers jours) et l'envoie via l'API Brevo.
La clé Brevo vit dans le secret GitHub `BREVO_API_KEY` — jamais dans le repo ni en chat.

## Prérequis
- Token GitHub fourni par Thibaut dans la session (portée : repo `charbonneur`, Actions).

## Modes
- **Envoi réel** (défaut) : à toute la liste Brevo. Ne le faire que sur demande claire
  (« envoie la newsletter »). En cas de doute → demander.
- **Test** (« test newsletter ») : envoi transactionnel à une seule adresse.
  Adresse par défaut : thibaut.gras@gmail.com (confirmer si autre).

## Procédure
1. Dispatch :
   `POST https://api.github.com/repos/tgrey89/charbonneur/actions/workflows/newsletter.yml/dispatches`
   body : `{"ref":"main","inputs":{"test_email":"<adresse ou vide>","days":"7"}}`
   (test_email vide ⇒ envoi réel à la liste.)
2. Attendre ~45 s, lire le dernier run : `GET .../actions/runs?per_page=1`.
3. Si `failure` : lire les annotations du check-run (`GET <check_run_url>/annotations`)
   — le script y remonte l'erreur Brevo. Les logs bruts (Azure blob) sont inaccessibles.
4. Rendre compte : statut, nb d'articles inclus (visible dans le message d'erreur/succès).

## Rappels
- Envoi automatique : cron chaque vendredi 17h00 UTC (pas d'envoi si aucun article sur 7 j).
- Jamais 2 envois réels le même jour sans demande explicite.
- Le gabarit HTML vit dans `scripts/newsletter.js` (sombre natif, charbon/or, logo du site).

## Garde-fous d'envoi (19/08/2026)
- Envoi réel : seuls les articles ayant vécu ≥ 24h sur le site partent (sas de relecture).
  Le mode test n'a pas cette contrainte.
- Les articles `statut: 'rumeur'` de plus de 72h sont exclus automatiquement.
- Badges OFFICIEL / RUMEUR affichés dans l'e-mail.
