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
    comp: 'Ligue 1 · J1',
    home: { code: 'RCL', name: 'RC Lens', score: 5, isLens: true },
    away: { code: 'AJA', name: 'Auxerre', score: 2 },
    info: 'Bollaert · 38 115 spectateurs · doublé de Thauvin'
  },
  // Classement 2026-27 après J1 (source : sports-infos, 23/08/2026) — top 6 affiché
  standingsTitle: 'Classement 2026-27 · après J1',
  standings: [
    { pos: 1, club: 'Marseille', played: 1, diff: '+4', pts: 3 },
    { pos: 2, club: 'RC Lens', played: 1, diff: '+3', pts: 3, isLens: true },
    { pos: 3, club: 'Lille', played: 1, diff: '+2', pts: 3 },
    { pos: 4, club: 'Lyon', played: 1, diff: '+2', pts: 3 },
    { pos: 5, club: 'Monaco', played: 1, diff: '+1', pts: 3 },
    { pos: 6, club: 'Paris SG', played: 1, diff: '0', pts: 1 }
  ]
};
