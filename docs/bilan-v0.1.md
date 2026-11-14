# Bilan de la v0.1

À quoi sert cette page : résumer pour un lecteur extérieur ce que contient la v0.1 de Huygens’s world, ses chiffres clés, la façon dont elle a été produite, les leçons tirées et la suite prévue. Verdict de la validation finale T-012 : **v0.1 validée avec réserves** le 2026-11-13 ([rapport](validation/T-012-v0.1.md)). État décrit : commit `88ae23c`, celui de la validation. Les chiffres qui ont changé depuis (tests, clés de texte, défauts connus) sont relevés au commit `13e8b7e` et marqués comme tels ; les autres restent ceux de `88ae23c`. **Cette page décrit la v0.1 : son état reste celui du commit `88ae23c`.** Les tâches validées depuis (T-017 à T-022 : écrans titre et menu, valeurs de jeu du niveau 1, niveau 2, trajet de 10 s et Kp par défaut 2000) sont décrites dans le [CHANGELOG](CHANGELOG.md) et dans les pages techniques ; les chiffres de cette page qui ne valent plus au commit `08908b6` portent une mention datée.

## Ce que contient la v0.1

Une tranche verticale : un seul niveau, « Le vide », complet (décision D4 du registre, spec [T-001](specs/T-001-tranche-verticale.md) §1).

- Le bonhomme marche jusqu'à une console, le joueur règle le gain Kp d'un contrôleur proportionnel, puis lance un ascenseur. Kp trop faible : la cabine s'arrête sous la marche (erreur statique). Kp trop fort : elle dépasse et heurte la poutre. Voir [jeu.md](jeu.md).
- Un noyau de simulation pur et déterministe (`src/sim`), validé contre une solution exacte calculée sous MATLAB. Voir [simulation.md](simulation.md).
- Un rendu au crayon sur papier millimétré, en WebGPU avec repli WebGL2, et une page de repli sans GPU, ou après une perte du contexte GPU ou une erreur inattendue (T-014). Voir [rendu.md](rendu.md).
- Une interface en français et en anglais, jouable au clavier, à la souris et au tactile, avec annonces pour lecteurs d'écran. Voir [interface.md](interface.md).
- Une intégration continue sur GitHub Actions et un déploiement GitHub Pages manuel. Voir [developpement.md](developpement.md#intégration-continue).

Objectifs de la spec, d'après T-012 §C : O1 (niveau jouable) atteint ; O2 (voir erreur statique, dépassement, saturation) atteint, saturation sans preuve de bout en bout à `88ae23c` (e2e et capture ajoutés ensuite par T-016) ; O3 (fondations, dont CI et Pages) partiel ; O4 (physique couverte par un oracle) atteint.

## Chiffres clés

| Mesure | Valeur | Source |
|---|---|---|
| Tests unitaires (Vitest) | 439 tests, 36 fichiers, tous verts au commit `13e8b7e` (426 tests, 34 fichiers à `88ae23c`) ; 586 tests, 45 fichiers au commit `119519b` ; 602 tests, 45 fichiers au commit `08908b6` | `npm test` aux commits `13e8b7e`, `119519b` et `08908b6` ; rapport T-012 §A pour `88ae23c` |
| Tests de bout en bout (Playwright) | 70 tests dans 7 fichiers au commit `08908b6` (69 à `119519b`), 39 dans 5 fichiers au commit `13e8b7e` (listes de `npx playwright test --list`) ; 28 tests dans 3 fichiers, verts en 1,7 min au commit `566a8a3` | exécution par l'orchestrateur, log `orchestration/logs/T-010.md`, pour les 28 premiers ; liste confirmée par T-012 §A. Les tests ajoutés depuis n'ont pas été exécutés par le rédacteur |
| Couverture du noyau `src/sim` | 100 % des lignes, branches et fonctions (seuils 95 / 90) | `npm run test:cov`, rapport T-012 §A |
| JavaScript du build | 885,25 kB, soit 246,57 kB gzip (budget de la spec : 400 kB gzip) | `npm run check`, rapport T-012 §A |
| Polices (Patrick Hand, 2 fichiers woff2) | 23 944 et 20 112 octets, chargées à la demande | `stat` sur `public/fonts/` au commit `88ae23c` |
| Écart simulation / modèle exact | 1,42e-7 m au pire sur la hauteur y | MATLAB, rapport T-012 §B |
| Fenêtre de réussite | Kp ∈ [2000 ; 3800] N/m, contiguë ; 0 désaccord sur 80 issues (v0.1). **Depuis T-020 : [1000 ; 5000] N/m**, 41 valeurs contiguës, 0 désaccord sur 80 issues ; relancé à T-022 avec un horizon de 1200 pas (10 s) : même fenêtre, 0 désaccord sur 80 | MATLAB, rapport T-012 §B ; log T-020 |
| Marges aux bornes hautes | +5,842 mm à Kp = 3800 ; −1,865 mm à Kp = 3900 (v0.1). **Depuis T-020 : +1,74 mm à Kp = 5000 ; −1,79 mm à Kp = 5100** (poutre 3,3626 m) | MATLAB, rapport T-012 §B ; log T-020 |
| Textes traduits | 159 clés par langue au commit `08908b6`, 158 à `119519b`, 115 au commit `13e8b7e` (111 à `88ae23c`), mêmes clés en FR et EN | comptage par script ; rapport T-012 §C et §F |
| Défauts connus | 35 (K1 à K35) au commit `08908b6`, dont 13 corrigés (K1, K2, K3, K6, K16, K17, K18, K19, K20, K21, K23, K24, K32) ; 33 (K1 à K33) à `119519b`, dont 12 corrigés et 1 corrigé en partie (K22) ; plus aucun majeur ouvert (24 dont 8 corrigés au commit `13e8b7e`) ; à `88ae23c` : 22, dont 1 majeur (K16), aucun bloquant | [defauts-connus.md](defauts-connus.md) |

## Comment elle a été produite

Un orchestrateur (Claude) a discuté le design avec l'utilisateur, puis découpé le travail en tâches numérotées ([ADR-004](decisions/ADR-004-orchestration.md)).
Chaque tâche a été confiée à un sous-agent Claude Opus 5.5 dans un seul rôle : concepteur, réalisateur, validateur ou rédacteur.
Chaque agent a rendu un certificat : fichiers et SHA-256, commandes et codes de sortie, critères PASS ou FAIL avec preuve, doutes.
L'orchestrateur a recalculé les hash et relancé les commandes ; un certificat non reproductible valait échec.
Deux validateurs indépendants, qui n'avaient pas vu la réalisation, ont relu le noyau (T-005) puis la version entière (T-012).
La physique est validée par MATLAB contre une solution exacte, hors du site ([ADR-006](decisions/ADR-006-oracle-matlab.md)).
Les agents travaillaient dans une VM sans navigateur : les tests e2e ont été exécutés par l'orchestrateur ailleurs ([ADR-012](decisions/ADR-012-tests-navigateur.md)).
L'orchestrateur a aussi regardé les captures d'écran, même quand tous les tests passaient.
Le registre `orchestration/REGISTRE.md` compte 19 tâches pour la v0.1, celle-ci comprise, du 2026-11-12 au 2026-11-13 ([CHANGELOG.md](CHANGELOG.md)).
Les défauts mineurs ont été consignés plutôt que corrigés, pour finir la version (décision D18).

## Leçons

Reformulées depuis le registre (`orchestration/REGISTRE.md` §4, L1 à L10).

1. **Dire où est le code.** Un agent qui a plusieurs façons d'accéder aux fichiers doit savoir laquelle atteint le vrai dépôt (L1).
2. **Séparer « lu » et « exécuté ».** Un fait seulement lu dans le source n'est pas prouvé ; il devient un critère de la tâche suivante (L2).
3. **Relire la spec avant d'ajouter une exigence.** Un critère ajouté par l'orchestrateur a contredit la spec (L3).
4. **Commandes courtes, au premier plan.** L'environnement des agents ne garde pas de processus en arrière-plan (L4).
5. **Documenter un état figé.** Le rédacteur passe après la validation, jamais en parallèle d'un réalisateur (L5).
6. **Se méfier des outils d'écriture.** Certains convertissent les échappements Unicode ; les fichiers sensibles s'écrivent par script (L6).
7. **Nommer le commit documenté.** « HEAD » bouge ; on donne un hash fixe et on n'ajoute rien en fin de tâche (L7).
8. **Un « non exécuté » honnête vaut mieux qu'un PASS supposé.** Sans navigateur, les agents ne peuvent pas lancer l'e2e ; un autre l'exécute (L8).
9. **Regarder les images.** Un test de position ne vérifie pas l'aspect ; une régression visible est passée avec des tests verts (L9).
10. **Vérifier les permissions avant de lancer un agent.** Une autorisation expirée a fait échouer un build sans défaut du projet (L10).

## La suite du parcours

La progression pédagogique est fixée par la décision D8 du registre : boucle ouverte et fermée, contrôleur P, système du premier ordre, terme I (avec l'emballement de l'intégrale, ou windup), terme D (avec le bruit), PID complet, puis défi final. Les termes I et D sont des non-objectifs de la v0.1 ([spec T-001](specs/T-001-tranche-verticale.md) §1) ; l'écran de victoire du niveau 1 annonce déjà le terme I (spec §6). Depuis la v0.1, le terme I a un niveau : le niveau 2 « La mémoire » (T-021a et T-021b, [ADR-016](decisions/ADR-016-controleur-pi-sans-anti-windup.md)), sans anti-windup, dont la valeur de jeu pose encore question (K32).

Avant d'y aller, le rapport T-012 recommandait pour la v0.2 : gérer la perte de contexte GPU (K16, fait en T-014), ajouter un e2e de saturation (K20, fait en T-016), faire tourner la CI sur GitHub et trancher la publication (K14), mettre en pause à l'ouverture de l'aide (K19, fait en T-015), essayer WebGPU réel et le tactile sur appareil (K8, K9). Restent ouverts : K14, K8 et K9.
