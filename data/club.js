/* =====================================================================
   DONNÉES CLUB — dernier match + classement (widgets de la barre latérale)
   Édité par la procédure /maj (bloc « club »).
   Données RÉELLES fin de saison 2025-2026 :
   - CLASSEMENT : lensois.com/classement/ (widget scoreaxis).
   - DERNIER MATCH : finale de la Como Cup (amical, recoupée via
     OneFootball / Lensois.com). Classement : table finale 2025-2026
     conservée jusqu'à la 1re journée de L1 2026-27 (22 août).
   ===================================================================== */
window.CLUB = {
  // Dernier match : finale de la Como Cup remportée face à Villarreal (1er août 2026, Côme)
  lastMatch: {
    comp: 'Ligue des champions · J1',
    home: { code: 'SLA', name: 'Slavia Prague', score: 2 },
    away: { code: 'RCL', name: 'RC Lens', score: 3, isLens: true },
    info: 'Eden Arena · renversement dans le temps additionnel (Thauvin, Aguilar)'
  },
  // Classement 2026-27 après J3 (source : robot live-standings, 11/09/2026) — top 5 + Lens
  standingsTitle: 'Classement 2026-27 · après J3',
  standings: [
    { pos: 1, club: 'Monaco', played: 3, diff: '+4', pts: 9 },
    { pos: 2, club: 'Lyon', played: 3, diff: '+4', pts: 7 },
    { pos: 3, club: 'Paris FC', played: 3, diff: '+4', pts: 7 },
    { pos: 4, club: 'Lille', played: 3, diff: '+3', pts: 7 },
    { pos: 5, club: 'Rennes', played: 3, diff: '+2', pts: 7 },
    { pos: 11, club: 'RC Lens', played: 3, diff: '+1', pts: 3, isLens: true }
  ]
};
