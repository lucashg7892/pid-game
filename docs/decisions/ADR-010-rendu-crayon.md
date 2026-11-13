# ADR-010 — Rendu au crayon par rubans CPU préalloués et matériaux TSL

## Contexte

Le jeu se dessine au crayon sur papier millimétré (décision D1) avec three.js, en WebGPU ou en WebGL2 (D5). La spec T-001 §7 impose au plus 50 appels de dessin, 30 000 triangles et aucune allocation par image. Les traits doivent trembler un peu (« boiling ») sans perdre le déterminisme des tests.

## Décision

- Chaque trait est une polyligne transformée en ruban de triangles par le CPU (`StrokeBatch`), dans des tableaux **préalloués** réécrits en place ; les `BufferAttribute` de three enveloppent ces tableaux sans copie (T-009).
- Les traits sont groupés en **5 lots** (un par matériau et fréquence de mise à jour) : 4 appels de dessin à l'état initial, 7 au plus.
- Papier et crayon sont des matériaux à **nœuds TSL** : un seul code, compilé en WGSL et en GLSL. Anticrénelage au shader (`fwidth`), sans MSAA ; correction d'opacité pour un mélange d'aspect sRGB.
- Tremblé à graine (hachage entier 32 bits), graine changée 8 fois par seconde, figée avec `prefers-reduced-motion`.
- Toute la géométrie est calculée dans des fichiers purs, testés sous Node ; seuls 6 fichiers sur 18 importent three, dont `camera.ts` pour un type seulement.

## Alternatives écartées

| Option | Raison |
|---|---|
| `Line` / `LineBasicMaterial` de three | épaisseur de 1 px imposée par WebGL ; pas de tremblé d'épaisseur ni d'extrémités effilées |
| `Line2` (lignes épaisses des exemples three) | dépend du backend et des exemples, un objet par trait, plus d'appels de dessin |
| textures de trait ou images | poids du téléchargement, rendu flou à l'agrandissement, pas de tremblé |
| MSAA | coût mémoire, comportement différent selon le backend, les traits fins clignotent quand même |

## Conséquences

- Budget tenu (12 400 triangles au plus préalloués) ; mesures dans [rendu.md](../rendu.md#lots-et-budget-de-dessin).
- Le même dessin sur les deux backends, mais **WebGPU réel n'a été exercé par aucun test automatique** (log T-010).
- Les matériaux transparents `DoubleSide` exigent `forceSinglePass`, sinon three double les appels (log T-009).
- Un test de pixels qui vérifie la position ne vérifie pas l'aspect : toute retouche du rendu est comparée à une capture de référence (leçon L9, ADR-012).
- « Aucune allocation par image » est établi par construction et par l'identité des tableaux, sans mesure du tas.

## Statut

Accepté (T-008, T-009 ; 2026-11-13).
