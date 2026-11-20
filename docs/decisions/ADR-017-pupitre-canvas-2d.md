# ADR-017 — Pupitre de contrôle en canvas 2D en surimpression, dans `src/ui`

## Contexte

La v0.3 veut montrer au joueur ce que fait le moteur : réglage de Kp et de Ki, écorché du moteur du treuil, force demandée et force appliquée, courbes de l'essai. Le lot B a produit quatre maquettes jetables (A analogique, B instruments, C tube cathodique en three.js, D planche de l'ingénieur) ; l'utilisateur a tranché (décision D35 du registre, 2026-11-15) : le pupitre **remplace le panneau de réglage**, reprend l'écorché et l'habillage de A, la lisibilité de B, et la partie « d'où vient la force ? » de D va dans le tableau d'école (D37).

## Décision

- Le pupitre est un plan dessiné en **canvas 2D** (deux canvas : un fond redessiné quand il change, un « vif » redessiné à chaque image), **en surimpression** sur la scène, dans `src/ui/pupitre`. **Pas de portage dans le pipeline three** : pas de lot de traits, pas de matériau TSL.
- Les contrôles restent du **DOM accessible** posé par-dessus (leviers `<input type="range">`, champs numériques, boutons), les colonnes dessinées ont un résumé texte pour les lecteurs d'écran.
- Trois colonnes (réglage, machine, courbes), contrat `ColonnePupitre` ; plan fixe de 1280 × 580 unités mis à l'échelle ; en portrait étroit, seule la colonne de réglage.
- Il se lit du **journal du trajet** `level.tripLog` (T-048) et de l'instantané, en lecture seule ; il n'influe jamais sur le jeu (le trajet est identique bit à bit).
- Échelles des courbes **fixes par niveau** ; ouverture en lecture seule sans pause ; curseur de relecture à l'issue.
- La jauge de force quitte la scène (D36).

## Alternatives écartées

Les raisons ci-dessous sont reconstituées par le rédacteur d'après le log du lot B (`orchestration/logs/v0.3-lot-B.md`) et le code ; le registre ne consigne que la décision D35.

| Option | Raison |
|---|---|
| dessiner le pupitre avec le pipeline de traits du jeu (rubans CPU, TSL) | la maquette A et le coût mesuré (0,26 à 0,42 ms par image de JS pour A en canvas 2D) montrent que le canvas 2D suffit ; le portage multiplierait les lots et les textes à gérer dans `src/render`, qui n'a pas accès aux traductions |
| la maquette C (tube cathodique, three.js, post-traitement) | la plus coûteuse (2,8 à 3,5 ms par image), post-traitement GLSL à réécrire en TSL, texte non traduit ni accessible ; son treuil 3D est gardé comme idée (K54) |
| tout en DOM et SVG | des dizaines de tracés mis à jour à chaque image : le canvas évite des milliers d'écritures DOM |
| garder le panneau de réglage et ajouter une fenêtre de courbes | deux endroits pour le même réglage ; D35 demande un seul pupitre |

Coûts : mesures du log du lot B (Chromium headless, rendu logiciel, pas de GPU réel) ; rien n'a été mesuré sur un GPU réel.

## Conséquences

- `src/ui` ne dépend toujours ni de `three` ni de `src/render` (règle `ui-deps`) ; le pupitre n'ajoute aucune règle de dépendances.
- Le canvas 2D vit à côté du rendu three (deux contextes).
- Le dessin au crayon du pupitre (`crayon.ts`) est une seconde implémentation, en 2D, de la charte du jeu : tremblé à graine et graphite, mais pas le même code que `src/render`.
- Mouvement réduit : le pupitre n'anime rien (rotor lié à la hauteur de la cabine, alertes figées).
- Détail : [pupitre.md](../pupitre.md). Le tableau d'école, autre ajout de la v0.3, est dans [tableau-ecole.md](../tableau-ecole.md).

## Statut

Acceptée (D35, 2026-11-15 ; T-049 à T-051 ; D36 pour la scène). Remplace en partie [ADR-011](ADR-011-interface-dom.md) pour le réglage : le panneau DOM de l'ADR-011 est remplacé par un pupitre dessiné, les contrôles restent du DOM.
