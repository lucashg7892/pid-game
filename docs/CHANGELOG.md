# Journal des modifications

À quoi sert cette page : retrouver ce que chaque tâche validée a apporté, avec ses réserves, et le commit qui la contient. Une entrée par tâche, la plus récente en premier (ordre des commits). Sources : `orchestration/REGISTRE.md`, `orchestration/logs/` et `git log --oneline`.

## Correspondance tâche → commit

Sortie de `git log --oneline 88ae23c` (18 commits) pour les lignes jusqu'à `88ae23c`. Les quatre lignes de `13e8b7e` à `a165a14` viennent de `git log --oneline 88ae23c..13e8b7e` (branche `migration`) ; les douze lignes de `119519b` à `a001622` viennent de `git log --oneline a001622..119519b`, plus `a001622` lui-même ; les cinq lignes du haut (de `a5b4bec` à `a308ada`) viennent de `git log --oneline a5b4bec..a308ada`, plus `a5b4bec` lui-même (commit de D-016). Les commits de documentation et de protocole qui s'intercalent entre `88ae23c` et `13e8b7e` (T-013, P-001 à P-004) n'y figurent pas.

| Commit | Contenu |
|---|---|
| `a308ada` | P-010 (N1) : version 0.2.0 (`package.json` et racine du lockfile) |
| `0459420` | T-025 (N1) : captures périmées régénérées (K35) |
| `1da298f` | T-024 (N2) : jauge du terme intégral au niveau 2 (K30), étiquettes FR/EN, légende, e2e et captures |
| `badab42` | T-023 (N3) : oracle MATLAB du contrôleur PI et test d'oracle exact (K28) |
| `a5b4bec` | D-016 (N1) : documentation du trajet de 10 s, du Kp par défaut 2000 et du correctif K32 |
| `08908b6` | T-022 (N3) : trajet de 10 s, Kp par défaut 2000, tolérance du niveau 2 à 0,10 m (K32), oracle MATLAB relancé |
| `87eaf09` | P-009 (N1) : décisions D27 à D30 au registre (10 s, Kp par défaut 2000, K32, K26 reporté) |
| `dfc5849` | D-015 (N1) : documentation des tâches P-006 à T-021b (écrans, niveau 1 retouché, PI, niveau 2), ADR-015 et ADR-016 |
| `119519b` | T-021b (N2) : niveau 2 La mémoire (PI, Kp fixé à 2500, réglage de Ki), menu à deux entrées |
| `99324fd` | T-021a (N3) : contrôleur PI du noyau, Ki = 0 identique au P, tests de déterminisme |
| `e9ce171` | T-017e (N2) : composition titre, menu et niveau, bouton Menu (pause, issue), K18, e2e et captures |
| `6aef101` | T-017d (N2) : écrans titre et menu des niveaux, textes FR/EN, test du copyright contre LICENSE |
| `7e61f7d` | T-017abc (N2) : machine d'écrans `src/app`, `attachLevel` / `detachLevel`, `Ui.destroy`, K23 et K24 |
| `c3a9f04` | T-020 (N3) : niveau 1, fenêtre [1000 ; 5000], tolérance 0,5 m, poutre 3,3626 m, 6 s, Kp par défaut 500, oracle MATLAB relancé |
| `c5c0235` | T-019 (N2) : bulle d'ouverture, vocabulaire « plateau d'arrivée », étiquettes permanentes de la jauge de force |
| `e75b70b` | P-008 (N1) : décisions D24 à D26 au registre (K6 à 6 s, fenêtre 1000-5000, Kp du niveau 2) |
| `8091429` | T-017 et T-018 (N1) : specs de l'écran titre avec menu et du niveau 2 avec Ki |
| `0db54c1` | P-007 (N1) : décisions D20 à D23 au registre (niveau 2 avec Ki, écran titre, Échap) |
| `063304d` | P-006 (N1) : consignes e2e (PNG de `docs/img`, PowerShell) et texte de repli « recommencer » |
| `a001622` | D-014 (N1) : documentation des correctifs P-005, T-014, T-015 et T-016 |
| `13e8b7e` | T-016 : e2e de saturation et capture `docs/img/t016-saturation.png` (K20) |
| `88be7ac` | T-015 : l'aide met en pause pendant un trajet, `aria-modal`, piège de focus, focus sur « Rejouer » (K19, K21) |
| `2b3c01e` | T-014 : perte de contexte GPU et exception après démarrage, page de repli d'échec (K16, K17) |
| `a165a14` | P-005 : vrai signe moins, invite de rotation en portrait, Échap ferme le réglage, version 0.1.0 (K1, K2, K3, K22) |
| `88ae23c` | T-012 : validation finale indépendante de la v0.1 (validée avec réserves) ; défauts connus K16 à K22 |
| `8736af7` | T-011 : CI GitHub Actions (check + e2e) et déploiement Pages manuel ; liste des défauts connus |
| `bf0624d` | D-010 : documentation du rendu et de l'interface, tutoriel mis à jour (`npm.cmd`), ADR-010 à 012, errata |
| `566a8a3` | T-010 : interface, commandes définitives, accessibilité, police manuscrite, titre « Huygens’s world », e2e |
| `1af2a29` | T-009 : rendu au crayon du niveau 1, commandes clavier provisoires, e2e |
| `ed46321` | T-008 : démarrage WebGPU/WebGL2, caméra, papier millimétré, page de repli, e2e |
| `e3231a4` | D-007 : documentation de la logique du niveau, tutoriel de lancement local, ADR-009 |
| `7bcd9ce` | D-004 : documentation du noyau, de l'i18n et de la validation ; errata de la spec ; ADR-005 à 008 |
| `6259ccc` | T-007 : logique du niveau 1 et ses tests ; log T-007 |
| `c00e678` | registre : logs T-004b et T-006 |
| `1ee1010` | T-006 : i18n FR/EN |
| `bf7fd65` | licence MIT (`LICENSE`) et registre d'orchestration (T-000 à T-005) |
| `9569ca4` | T-005 : validation indépendante du noyau, rapport et scripts MATLAB |
| `1dc5f7e` | D-002 : documentation technique initiale |
| `beb6086` | T-003, T-004 et T-004b : noyau de simulation et ses tests (un seul commit pour les trois tâches) |
| `ff1bb60` | T-002 : socle outillé (`package.json` et `vitest.config.ts` y sont déjà dans leur état après T-003, avec `test:cov`) |
| `d57b05b` | T-001 : spécification |
| `e627a96` | T-000 : initialisation du dépôt |

Les neuf premiers commits ont été créés après coup, à la suite, à partir de l'état validé : leur ordre ne suit pas exactement l'ordre des validations (T-004b, validée après T-005, est dans `beb6086`). Depuis `6259ccc`, chaque tâche validée a son commit.

## Versions

- **v0.2.0 — version courante, état du commit `a308ada` (2026-11-14)**. `package.json` et la racine de `package-lock.json` valent `0.2.0` depuis P-010 (`a308ada`). **Aucun rapport de validation finale n'existe pour la v0.2** : il n'y a pas de verdict global. Quatre tâches N3 ont chacune été validées indépendamment par un validateur (T-020, T-021a, T-022, T-023) ; les autres tâches de la version sont de niveau N1 ou N2, vérifiées par l'orchestrateur. Contenu, par rapport à la v0.1 (état `88ae23c`) :
  - **Écran titre et menu des niveaux** (T-017 : machine d'écrans `src/app`, écrans DOM, bouton « Menu », mention de copyright contre `LICENSE`).
  - **Niveau 1 retouché** (T-020, T-022) : fenêtre de réussite Kp ∈ [1000 ; 5000] N/m, poutre à 3,3626 m, tolérance de marche 0,5 m, trajet de 10 s (1200 pas), Kp par défaut 2000 (un lancement sans réglage gagne au pas 262), bulle d'ouverture et vocabulaire « plateau d'arrivée », étiquettes permanentes de la jauge de force (T-019).
  - **Niveau 2 « La mémoire »** (T-021a, T-021b, T-022) : contrôleur PI du noyau (Ki = 0 identique au P bit à bit, pas d'anti-windup), Kp fixé à 2500 N/m, Ki réglable de 0 à 8000 N/(m·s) par pas de 100 (défaut 2000, qui heurte la poutre), tolérance d'arrivée de 0,10 m ; issues : victoire, choc, trop court, trop lent.
  - **Oracle exact du PI** (T-023) : `validation/matlab/t018_*.m` et `tests/sim/pi-exact.test.ts` ; 0 désaccord noyau / exact sur 113 valeurs de Ki.
  - **Jauge du terme intégral I** au niveau 2 (T-024).
  - **Défauts corrigés depuis la v0.1** (`orchestration/DEFAUTS-CONNUS.md`) : K1, K2, K3 (P-005), K6 (T-020 puis T-022), K16, K17 (T-014), K18, K23, K24 (T-017), K19, K21 (T-015), K20 (T-016), K28 (T-023), K30 (T-024), K32 (T-022), K35 (T-025) ; K22 en partie (version 0.2.0, `prefers-reduced-motion` reste lu au démarrage). K25 (portrait 390 px, mesures rognées) n'est pas corrigé.
  - **Défauts restants** : K4, K5, K7 à K15, K22 (partie `prefers-reduced-motion`), K25, K26, K27, K29, K31, K33, K34, K36, K37, K38 ; voir [defauts-connus.md](defauts-connus.md).
- **v0.1 — validée avec réserves le 2026-11-13** (rapport [validation/T-012-v0.1.md](validation/T-012-v0.1.md), bilan [bilan-v0.1.md](bilan-v0.1.md)). Le champ `version` de `package.json` valait `0.0.0` au commit de la validation (K22) ; il valait `0.1.0` depuis P-005 (`a165a14`), il vaut `0.2.0` depuis P-010 (`a308ada`).

## D-017 — Clôture de la v0.2 : documentation des tâches T-023 à P-010 (2026-11-14)

Documentation de quatre commits, `badab42` (T-023), `1da298f` (T-024), `0459420` (T-025) et `a308ada` (P-010, version 0.2.0), à la suite de D-016 (`a5b4bec`), sur l'état figé `a308ada` (branche `migration`, arbre propre). Aucun code, aucune configuration, aucune PNG de `docs/img/` modifiés ; le rédacteur n'a exécuté ni l'e2e (il réécrit les captures) ni MATLAB. Source des mesures : `orchestration/logs/T-023.md` (vérifiées par un validateur indépendant), `orchestration/DEFAUTS-CONNUS.md`, le code et les tests du commit.

Tâches documentées, avec leur commit :

- **T-023** (`badab42`, N3, validateur indépendant, « validé avec réserves », réserve R1 levée) : oracle MATLAB du contrôleur PI (`validation/matlab/t018_*.m`, 8 fichiers), `validation/data/pi_traj_dt120.csv` et `pi_sweep_summary.csv`, test d'oracle exact `tests/sim/pi-exact.test.ts` (22 tests). 0 désaccord noyau / exact sur 113 Ki ; pire écart y 1,5e-7 m, ẏ 1,524e-6 m/s, I 2,144e-4 N ; tolérances du test y 1e-6 m, ẏ 1e-5 m/s, I 1e-3 N ; bornes exactes de Ki (Kp = 2500, tolérance 0,10 m, 1200 pas) : step → slow 128,3759, première victoire 138,5864, choc 841,3209 (841,0670 avec y entre deux pas) ; Ki critique échantillonné 18 310,30 N/(m·s), soit 0,9155 fois la limite continue 8·Kp. K28 corrigé, K34 précisé. `src/sim` inchangé.
- **T-024** (`1da298f`, N2) : jauge du terme intégral I au niveau 2 (K30) : seconde jauge à droite de la jauge de force, même échelle (0 à 5000 N), repère m·g, remplissage |I| ; constantes `GAUGE_I_MIN_X` = 6 et `GAUGE_I_MAX_X` = 6,42 ; étiquettes « Terme intégral I » puis « I : {i} N » ; ligne de légende `level2.legend.integral` ; ligne « Terme I » du panneau de mesures pour les lecteurs d'écran ; ancres `iGauge` et `iGaugeVisible` ; « 5000 N max » et « poids » à droite de la jauge I au niveau 2 ; décalages de 6 px en portrait au niveau 2 (`GAUGE_TITLE_LIFT`, `DIMENSION_NUDGE`) ; niveau 1 identique ; quatre clés de texte ajoutées ; captures `docs/img/t024-niveau2-jauge-i.png` et `t024-niveau2-jauge-i-portrait.png`. K30 corrigé ; K36, K37 et K38 ajoutés ; K31 reste reporté.
- **T-025** (`0459420`, N1) : captures régénérées par l'e2e (K35 corrigé) : `t008-paper-1280x720`, `t009-01`, `t009-02`, `t009-06`, `t010-01`, `t010-06`, `t021-niveau2-reglage`, `-victoire`, `-choc` et `-portrait` ; `t019-approche-fr` et `t019-portrait-fr` refaites à la main (script ponctuel, `?e2e=1&screen=level1&lang=fr`, aucun test ne les écrit) : elles montrent Kp = 2000 N/m ; `t010-02`, `t010-03` et `t010-05` non touchées.
- **P-010** (`a308ada`, N1) : version 0.2.0 (`package.json` et racine du lockfile).

Chiffres relevés au commit `a308ada` :

| Mesure | Valeur | Avant (`08908b6`) |
|---|---|---|
| `npm.cmd test` | 47 fichiers, 649 tests verts | 45 fichiers, 602 tests |
| `npx.cmd playwright test --list` | 74 tests dans 7 fichiers (non exécutés par le rédacteur) | 70 tests dans 7 fichiers |
| `npm.cmd run lint:arch` | 67 modules, 178 dépendances, 0 violation | idem |
| clés de texte par langue (script) | 163 | 159 |
| `npm.cmd run test:cov` | `src/sim` 100 % (192/192 instructions, 102/102 branches, 38/38 fonctions, 178/178 lignes) | idem |
| `npm.cmd run build` | JavaScript 909,76 kB (253,52 kB gzip), CSS 7,51 kB (2,45 kB gzip) | 907,79 kB (252,84 kB gzip), CSS 7,30 kB (2,42 kB gzip) |

- **Pages mises à jour** : `simulation.md`, `physique/ascenseur.md`, `jeu.md`, `rendu.md` (jauge I, ancres), `interface.md` (section de la jauge I, captures t024), `architecture.md`, `i18n-accessibilite.md`, `tests.md` (section « Oracle exact du PI »), `developpement.md`, `tutoriel-lancer-en-local.md`, ADR-006 et ADR-016 (oracle du PI fait, K28 fermé), `defauts-connus.md` (K1 à K38 : K28, K30 et K35 corrigés, K34 précisé, K36 à K38 ajoutés, K31 reporté), `specs/T-018` (retouches de T-023 à T-025), `README.md` et ce journal.
- **ADR** : aucune nouvelle ; les ADR-006 et ADR-016 consignent l'oracle du PI.
- **Valeurs historiques conservées** (datées) : les nombres de tests (602, 586, 439), de tests e2e (70, 69), de clés (159, 158), les tailles de build d'avant et le texte de `bilan-v0.1.md` (état `88ae23c`) restent là où ils sont donnés comme mesures d'un commit précédent.
- **Non confirmé** : e2e et MATLAB non exécutés par le rédacteur (les mesures de T-023 viennent de son journal) ; triangles de `rendu.md` mesurés au commit `119519b`, non remesurés pour la jauge I ; WebGPU réel (K8).

## D-016 — Documentation des tâches P-009 et T-022 (2026-11-14)

Documentation de deux commits, `87eaf09` (P-009) et `08908b6` (T-022), sur l'état figé `08908b6` (branche `migration`, arbre propre). Aucun code, aucune configuration, aucune PNG de `docs/img/` modifiés ; le rédacteur n'a pas exécuté l'e2e (il réécrit les captures). Source des mesures : `orchestration/logs/T-022.md` (vérifiées par un validateur indépendant), `src/game/constants.ts`, `src/render/curve.ts`, et deux relevés du rédacteur (issues de Kp et de Ki sur 1200 pas par un script jetable, supprimé).

Tâches documentées, avec leur commit :

- **P-009** (`87eaf09`, N1) : décisions D27 (durée maximale 10 s), D28 (`KP_DEFAULT` 2000), D29 (K32 : tolérance du niveau 2 à 0,10 m) et D30 (K26 reporté) au registre.
- **T-022** (`08908b6`, N3, validateur indépendant, verdict « validé avec réserves », réserves levées) : `TRIP_MAX_STEPS` 720 → 1200 (10 s) pour les deux niveaux ; `KP_DEFAULT` 500 → 2000 (un lancement sans réglage gagne au niveau 1, pas 262, e = 0,245 m) ; `KI_DEFAULT` = `KP_DEFAULT` = 2000, hors de la fenêtre gagnante (choc au pas 57) ; `LEVEL2_ARRIVAL_TOLERANCE` 0,5 → 0,10 m (K32 corrigé) ; textes `level2.fail.step`, `level2.fail.slow`, `hud.status.fail.slow`, `level2.goal`, `level2.win` reformulés et nouvelle clé `hud.status.fail.stepKi` ; oracle MATLAB relancé (`kMax` 1200, « horizon 1200 pas (10.0 s) », 0 désaccord sur 80, fenêtre [1000 ; 5000]) et CSV de synthèse régénéré ; deux captures `docs/img/t022-niveau1-trop-court.png` et `docs/img/t022-niveau2-trop-court.png`.

Mesures recopiées : niveau 1 inchangé (fenêtre [1000 ; 5000], poutre 3,3626 m, tolérance 0,5 m, marges 1,745 mm, 1,791 mm et 9,5 mm), victoire la plus lente au pas 301 (marge 899 pas). Niveau 2 (Kp = 2500, tolérance 0,10 m, 1200 pas), grille de Ki de 100 : trop court de 0 à 100, victoire de 200 à 800, choc de 900 à 8000, aucun « trop lent » ; au pas de 10 : trop court de 0 à 120, « trop lent » à 130, victoire de 140 à 840, choc dès 850. Ki est nécessaire : le P seul s'arrête à 0,196 m.

Chiffres relevés au commit `08908b6` :

| Mesure | Valeur | Avant (`119519b`) |
|---|---|---|
| `npm.cmd test` | 45 fichiers, 602 tests verts | 45 fichiers, 586 tests |
| `npx.cmd playwright test --list` | 70 tests dans 7 fichiers (non exécutés par le rédacteur) | 69 tests dans 7 fichiers |
| `npm.cmd run lint:arch` | 67 modules, 178 dépendances, 0 violation | idem |
| clés de texte par langue (script) | 159 | 158 |
| `npm.cmd run test:cov` | `src/sim` 100 % (192/192 instructions, 102/102 branches) ; `src/game` 100 % (318/318, 107/107, mesure à part) | idem |
| `npm.cmd run build` | JavaScript 907,79 kB (252,84 kB gzip), CSS 7,30 kB (2,42 kB gzip) | 907,32 kB (252,72 kB gzip) |

- **Pages mises à jour** : `jeu.md`, `physique/ascenseur.md`, `simulation.md`, `rendu.md`, `interface.md` (légendes des captures périmées, K35, et des deux captures de T-022), `tests.md`, `architecture.md`, `i18n-accessibilite.md`, `developpement.md`, `tutoriel-lancer-en-local.md`, `defauts-connus.md` (K1 à K35 : K32 et K6 corrigés, K26 reporté, K34 et K35 ajoutés), `bilan-v0.1.md` (mentions datées), `README.md`, ADR-006 et ADR-016 (K32 corrigé), `specs/T-018` (retouche de T-022) et `specs/T-001-errata.md` (point 20).
- **ADR** : aucune nouvelle ; l'ADR-016 consigne la correction de K32.
- **Valeurs historiques conservées** (datées) : 720 pas, 6 s, Kp par défaut 500 et tolérance de 0,5 m au niveau 2 restent écrits là où ils décrivent l'état de T-020 à T-021b (journal, mesures de T-021a, specs, errata, bilan de la v0.1).
- **Non confirmé** : les captures `t021-*`, `t010-01`, `t010-02`, `t010-06`, `t009-0x` et `t008-paper-1280x720` sont périmées (K35) et n'ont pas été régénérées ; WebGPU réel (K8) et e2e non exécutés par le rédacteur ; les triangles de `rendu.md` datent de `119519b`.

## D-015 — Documentation des tâches P-006 à T-021b (2026-11-13)

Documentation de onze commits, de `063304d` à `119519b`, sur l'état figé `119519b` (branche `migration`, arbre propre). Aucun code, aucune configuration, aucune PNG de `docs/img/` modifiés ; le rédacteur n'a exécuté aucun test e2e (il réécrirait les captures), seulement `npx.cmd playwright test --list`.

Tâches documentées, avec leur commit :

- **P-006** (`063304d`) : consignes e2e et texte de repli « recommencer » (`fallback.lost.explanation` et `fallback.error.explanation`). **P-007** (`0db54c1`) et **P-008** (`e75b70b`) : décisions D20 à D26 au registre (niveau 2 avec Ki, écran titre, Échap, K6 à 6 s, fenêtre [1000 ; 5000], Kp du niveau 2). Specs **T-017** et **T-018** (`8091429`).
- **T-019** (`c5c0235`, N2) : bulle d'ouverture `level1.goal` réécrite, « quai » devient « plateau d'arrivée » en français, étiquettes permanentes de la jauge de force (« Force du moteur », « 5000 N max », « poids »), ancres de rendu `gaugeMax` et `gaugeWeight`.
- **T-020** (`c3a9f04`, N3, validateur indépendant) : niveau 1 : `TRIP_MAX_STEPS` 720 (6 s), `STEP_TOLERANCE` 0,5 m, `BEAM_HEIGHT` 3,3626 m, `KP_DEFAULT` 500, fenêtre de réussite [1000 ; 5000] N/m (marges : 1,74 mm sous la poutre à 5000, 1,79 mm au-dessus à 5100, 9,5 mm de tolérance à 1000 ; victoire la plus lente au pas 301) ; cadrage fixé par `PLAY_ZONE_TOP` = 5,5 m (remplace `PLAY_ZONE_ABOVE_BEAM`) ; oracle MATLAB relancé (0 désaccord sur 80) ; textes 0,5 m et 3,36 m ; K6 corrigé, K7 mis à jour. Verdict « validé avec réserves » (R1 corrigée par l'orchestrateur).
- **T-017abc** (`7e61f7d`, N2) : module pur `src/app` (machine d'écrans titre, menu, niveau), `attachLevel` et `detachLevel` de la session de rendu, `Ui.destroy()`, K23 et K24 corrigés. **T-017d** (`6aef101`) : écrans titre et menu (`src/ui/screens*.ts`, `screen-keys.ts`), copyright égal à `LICENSE` (test). **T-017e** (`e9ce171`) : composition dans `main.ts` (paramètre `screen` du mode `?e2e=1`), bouton « Menu » en pause et à l'issue, K18 corrigé (`ResizeObserver`).
- **T-021a** (`99324fd`, N3, validateur indépendant) : `createProportionalIntegralController` et `createElevatorPiLoop`, Ki = 0 identique au P bit à bit, pas d'anti-windup ; oracle MATLAB du PI et test d'oracle exact TypeScript reportés (K28 ; faits en T-023, voir plus haut). Verdict « validé, sans réserve ».
- **T-021b** (`119519b`, N2) : niveau 2 « La mémoire » (`createLevel2`, machine commune `src/game/elevator-level.ts`, Kp fixé à 2500, réglage de Ki, issues choc, trop court et trop lent, `LEVEL2_ARRIVAL_TOLERANCE`), menu à deux entrées. Point documenté honnêtement à l'époque (corrigé depuis par T-022, voir [D-016](#d-016--documentation-des-tâches-p-009-et-t-022-2026-11-14)) : avec la tolérance de 0,5 m, Ki = 0 gagnait et aucun Ki de 0 à 8000 ne donnait « trop court » ni « trop lent » (K32).

Chiffres relevés au commit `119519b` :

| Mesure | Valeur | Avant (`13e8b7e`) |
|---|---|---|
| `npm.cmd test` | 45 fichiers, 586 tests verts | 36 fichiers, 439 tests |
| `npx.cmd playwright test --list` | 69 tests dans 7 fichiers (jamais exécutés par le rédacteur) | 39 tests dans 5 fichiers |
| `npm.cmd run lint:arch` | 67 modules, 178 dépendances, 0 violation, 9 règles | 57 modules, 147 dépendances, 8 règles |
| clés de texte par langue (script) | 158 | 115 |
| `npm.cmd run test:cov` | `src/sim` 100 % (192/192 instructions, 102/102 branches) ; `src/game` 100 % (mesure à part) ; `src/app` 92,3 % des lignes (mesure à part) | `src/sim` 100 % |
| `npm.cmd run build` | JavaScript 907,32 kB (252,72 kB gzip), CSS 7,30 kB (2,42 kB gzip) | 885,25 kB (246,57 kB gzip) à `566a8a3` |

Dans les logs de l'orchestrateur : `npm run check` vert avec 454 tests et 41 e2e verts à la fin de T-020 ; 524 tests et 58 e2e verts à la fin de T-021a.

- **Pages mises à jour** : `jeu.md`, `physique/ascenseur.md`, `simulation.md`, `rendu.md`, `interface.md`, `architecture.md`, `i18n-accessibilite.md`, `tests.md`, `developpement.md`, `tutoriel-lancer-en-local.md`, `defauts-connus.md` (K25 à K33 ; K6, K18, K23 et K24 corrigés ; K7 avec ses nouvelles marges), `bilan-v0.1.md` (mentions datées ; la v0.1 reste décrite à `88ae23c`), `README.md` et ce journal. ADR-006, ADR-009 et ADR-011 reçoivent une ligne datée ; `specs/T-001-errata.md` une note de mise à jour.
- **ADR créées** : [ADR-015](decisions/ADR-015-etat-application-machine-ecrans.md) (machine d'écrans pure, session de rendu unique) et [ADR-016](decisions/ADR-016-controleur-pi-sans-anti-windup.md) (PI sans anti-windup, validation unitaire seulement, tolérance du niveau 2).
- **Specs** : section « Écarts à la réalisation » ajoutée en fin de [T-017](specs/T-017-ecran-titre-et-menu.md) et de [T-018](specs/T-018-niveau-2-ascenseur-ki.md) ; le reste de ces specs n'est pas modifié.
- **Captures** : t009-05, t009-06, t010-01, t010-02 et t010-05 n'ont pas été régénérées depuis le changement des tests qui les produisent ; leurs légendes dans `rendu.md` et `interface.md` le disent. `t019-approche-fr.png` et `t019-portrait-fr.png` ont été refaites au commit `a308ada` et montrent Kp = 2000 N/m.
- **Non confirmé** : le résultat des e2e depuis T-017e (jamais exécutés par le rédacteur) ; la mesure des appels de dessin en papier seul (titre et menu) ; la couverture de `src/render` et de `src/ui` (non refaite).
- Rédacteur seul, aucun code modifié. Commit : à venir.

## D-014 — Documentation des correctifs P-005, T-014, T-015 et T-016 (2026-11-13)

Les quatre tâches ci-dessous corrigent huit des défauts connus ; état documenté : commit `13e8b7e`. Chiffres relevés au commit `13e8b7e` : `npm test` donne 36 fichiers et 439 tests verts (426 au commit `566a8a3`) ; `npx playwright test --list` donne 39 tests dans 5 fichiers (28 dans 3 fichiers) ; `npm run lint:arch` : 57 modules (55). Le rédacteur n'a exécuté aucun test e2e.

- **P-005** (`a165a14`) : `formatNumber` remplace le signe moins d'ICU par le vrai signe moins U+2212 (`MINUS`, dans `src/i18n/format.ts`) (K1). Échap en phase de réglage ferme le panneau de Kp (nouvelle intention `closeTuning`, qui appelle `level.interact()`), hors réglage il met en pause (K3). En portrait, la barre du haut mesure 76 px (`TOP_BAR_PORTRAIT`), l'invite de rotation est posée à `top: 80px` et `ROTATE_BAR` passe de 44 à 48 (K2). `package.json` : version `0.1.0` (K22 en partie ; `prefers-reduced-motion` reste lu au démarrage seulement). Texte de l'aide : « Échap : fermer le réglage de Kp, ou pause ».
- **T-014** (`2b3c01e`) : perte de contexte GPU (`renderer.onDeviceLost`, WebGL et WebGPU) et exception après le démarrage arrêtent la session, retirent l'interface et affichent une page de repli d'échec (`src/render/failure.ts`, `showFailurePage` dans `src/main.ts`, clés `fallback.lost.*` et `fallback.error.*`) (K16, K17). Crochet `crashNextFrame()` du mode `?e2e=1`. Tests : `tests/render/failure.test.ts` (4), `tests/e2e/failure.spec.ts` (4). Le chemin WebGPU `device.lost` n'est exercé par aucun test.
- **T-015** (`88be7ac`) : l'aide met en pause pendant un trajet et ne reprend à la fermeture que si c'est elle qui a mis en pause (`src/ui/help.ts`) (K19) ; `aria-modal`, piège de focus, focus rendu à l'ouvreur, focus sur le bouton de l'issue, plus d'`aria-pressed` sur « Pause » (K21) ; `z-index: 2` sur `.ui-help`. Tests : `tests/ui/help.test.ts` (8), e2e (j) à (n) de `ui.spec.ts`. Nouveaux défauts : K23, K24.
- **T-016** (`13e8b7e`) : `tests/e2e/saturation.spec.ts` (2 tests) et capture `docs/img/t016-saturation.png` (K20).
- Pages mises à jour : `interface.md`, `rendu.md`, `architecture.md`, `i18n-accessibilite.md`, `tests.md`, `developpement.md`, `tutoriel-lancer-en-local.md`, `defauts-connus.md`, `bilan-v0.1.md`, `README.md` et ce journal. Aucune ADR : aucune décision structurante. Rédacteur seul, aucun code modifié.

## T-013 — Documentation finale de la v0.1 (2026-11-13)

- Ajoute [bilan-v0.1.md](bilan-v0.1.md), [defauts-connus.md](defauts-connus.md) et [ADR-013](decisions/ADR-013-ci-et-pages-manuel.md) ; met à jour `README.md` (FR et EN), l'index, `developpement.md`, `tests.md`, `architecture.md` et ce journal : la CI n'est plus annoncée comme à venir, le déploiement Pages est décrit avec ses 3 étapes d'activation.
- Corrige `interface.md` : le focus ne revient au bouton « ? » que s'il était dans l'aide (affirmation 7 de T-012, vérifiée dans `src/ui/overlay.ts`).
- État documenté : commit `88ae23c`. Rédacteur seul, aucun code modifié.
- Commit : à venir.

## T-012 — Validation finale indépendante de la v0.1 (2026-11-13)

- Ajoute le rapport [validation/T-012-v0.1.md](validation/T-012-v0.1.md). Verdict : **v0.1 validée avec réserves**. Commit examiné : `8736af7`.
- Relancé par le validateur : `npm run check`, `npm run test:cov`, `npm run lint:arch` (codes 0, 426 tests, `src/sim` couvert à 100 %) ; 28 tests e2e listés, non exécutés (VM sans navigateur) ; MATLAB « T005 : FIN SANS ERREUR », marges inchangées (+5,842 / −1,865 mm), 0 désaccord sur 80 issues ; 8 attaques Vitest sur la logique de jeu, toutes conformes ; 10 affirmations de la doc vérifiées, 9 vraies.
- Constats : aucun bloquant ; 1 majeur (perte de contexte GPU), 4 mineurs, 5 remarques, consignés en K16 à K22 ([defauts-connus.md](defauts-connus.md)).
- Vérification de l'orchestrateur : hash du rapport identique au certificat ; pas de relance (décision D18). Les 28 e2e verts datent de `566a8a3` ; `src/` et `tests/` n'ont pas changé depuis.
- Commit : `88ae23c`.
- Statut : validé avec réserves. Réserves : objectif O3 partiel (CI jamais exécutée sur GitHub, Pages non publié) ; saturation sans preuve de bout en bout ; e2e non relancés par le validateur.

## T-011 — Intégration continue et déploiement Pages manuel (2026-11-13)

- Ajoute `.github/workflows/ci.yml` (push sur `main` et pull requests : `npm run check` puis e2e Chromium) et `.github/workflows/deploy.yml` (publication de `dist/` sur Pages, déclenchement manuel). Voir [tests.md](tests.md#intégration-continue) et [developpement.md](developpement.md#déploiement-sur-github-pages).
- Vérification de l'agent : YAML valide, `actionlint` 1.7.12 sans message, `npm run check` code 0, préfixe `/pid-game/` présent dans `dist/`.
- Vérification de l'orchestrateur : 2 SHA-256 identiques ; version v7 de `actions/checkout` confirmée par `git ls-remote`.
- Commit : `8736af7`.
- Statut : validé. Non exécuté : les workflows eux-mêmes (première exécution au prochain push). Le dépôt reste privé (décision D17), d'où le déploiement manuel ([ADR-013](decisions/ADR-013-ci-et-pages-manuel.md)).

## D-010 — Documentation du rendu et de l'interface (2026-11-13)

- Ajoute [rendu.md](rendu.md), [interface.md](interface.md) et les ADR-010 à 012 ; met à jour 15 pages, dont le tutoriel (`npm.cmd` sous PowerShell) et les errata. État documenté : commit `566a8a3`.
- Vérification de l'orchestrateur : 6 SHA-256 identiques ; 176 liens relatifs dont 11 images, 0 cassé ; `npm run check` code 0 (426 tests).
- Commit : `bf0624d`.
- Statut : validé. Réserve de l'agent : son build a échoué par EPERM sur `dist/` (autorisation de suppression expirée, leçon L10), pas un défaut du projet. Points signalés, devenus K10, K12 et K13.

## T-010 — Interface, commandes, accessibilité, titre (2026-11-13)

- Ajoute `src/ui/` (modèle de vue, disposition, bandeau d'aide, touches, annonces, DOM superposé, `ui.css`), la police Patrick Hand (`public/fonts/`, OFL 1.1), 22 clés i18n et le titre « Huygens’s world » (D15) ; `src/main.ts` branche l'interface et le clavier. Tests : `tests/ui/` (4 fichiers, 77 tests) et `tests/e2e/ui.spec.ts` (12 tests). Voir [interface.md](interface.md).
- Déclencheur : essai de l'utilisateur sur son PC Windows (D16) : tout fonctionne, mais sans texte on oublie les touches.
- Deux passes (T-010, T-010b). Passe 1 : 26 tests e2e sur 28 ; le test d'accessibilité (d) supposait à tort que `blur()` ramène la tabulation au début du document. Passe 2 : test (d) corrigé, panneaux posés à gauche du bonhomme et de la console, légende dépliée au premier trajet seulement.
- Vérification de l'orchestrateur : `PW_CHROME_PATH=/usr/bin/google-chrome npx playwright test` : 28 tests verts (1,7 min), dont une partie complète au clavier réel en FR (victoire) et en EN (choc) ; captures regardées ; `npm run check` code 0 (426 tests).
- Commit : `566a8a3`.
- Statut : validé. Réserves :
  - portrait 390 px : l'étiquette de Kp est en partie masquée par l'invite de rotation ;
  - l'erreur négative s'affiche avec un trait d'union ASCII (« -0,03 m ») et non le signe moins ;
  - aucune touche ne referme le panneau de réglage sans lancer ;
  - boutons tactiles non essayés sur un vrai écran tactile ;
  - « aucune allocation par image » de l'UI établi par construction, non mesuré ;
  - embarquement et sortie du bonhomme non animés ; WebGPU réel constaté seulement par l'utilisateur, backend non relevé.

## T-009 — Rendu au crayon du niveau 1 (2026-11-13)

- Ajoute les traits de crayon (`stroke-batch.ts`, `pencil-style.ts`, `pencil-material.ts`, `noise.ts`, `patterns.ts`), le décor, le bonhomme (`walker-pose.ts`), la courbe (`curve.ts`), la jauge (`gauge.ts`) et le peintre (`level-painter.ts`, `level-view.ts`). Tests : `tests/render/` et `tests/e2e/level.spec.ts`. Voir [rendu.md](rendu.md).
- Trois passes. T-009 : 6 appels de dessin au lieu de 4. T-009b : `forceSinglePass` (objets transparents `DoubleSide` dessinés deux fois), pose debout, jauge refaite ; mais régression du papier à 1280 × 720 vue sur les captures, non détectée par les tests. T-009c : régime « un seul pixel » limité sous 1 px, position quantifiée, 3 tests d'uniformité des lignes de mètre.
- Vérification de l'orchestrateur : 16 tests e2e verts (34,6 s) ; captures regardées ; `npm run check` code 0 (349 tests).
- Commit : `1af2a29`.
- Statut : validé. Choix acceptés : poutre en deux corbeaux ; échelle de temps à deux régimes ; pas de MSAA ; vue de face. Réserves : WebGPU réel non exercé ; scène minuscule en portrait (traitée en T-010 par l'invite de rotation) ; commandes clavier provisoires (remplacées en T-010).
- Décision de l'utilisateur pendant la tâche : le style lui plaît, il est conservé.

## T-008 — Démarrage du rendu, caméra, papier millimétré (2026-11-13)

- Ajoute `bootstrap.ts`, `session.ts`, `stage.ts`, `camera.ts`, `options.ts`, `paper.ts`, la page de repli traduite, `public/favicon.svg`, `playwright.config.ts` et `tests/e2e/render.spec.ts`. Retire l'exemption three de `src/main.ts` (réserve E2 levée).
- Deux passes. Passe 1 : rendu fonctionnel mais 6 tests e2e sur 6 en échec sur la console (favicon absent, avertissements de SwiftShader, message « No available adapters. ») et sur le compte d'appels. Passe 2 (T-008b) : favicon, listes blanches console justifiées, variable `PW_CHROME_PATH`.
- Vérification de l'orchestrateur : 6 tests e2e verts (9,9 s) dans Chrome for Testing 153 headless ; captures regardées ; `npm run check` code 0 (273 tests, 35 modules).
- Commit : `ed46321`.
- Statut : validé. Réserves : WebGPU réel jamais exercé ; cadrage 17 × 7 m au lieu de « ~12 × 6,75 m », vue de face sans plongée ; lien de la page de repli vers un dépôt encore privé.
- Leçon L8 : la VM des agents ne peut pas télécharger de navigateur ; l'e2e est exécuté par l'orchestrateur.

## D-007 — Documentation de la logique du niveau, tutoriel (2026-11-12)

- Ajoute [jeu.md](jeu.md), [tutoriel-lancer-en-local.md](tutoriel-lancer-en-local.md) et l'ADR-009 ; met à jour architecture, tests, développement, index, simulation, ce journal et le README.
- Vérification de l'orchestrateur : 10 SHA-256 identiques ; 108 liens relatifs, 0 cassé ; constantes de `src/game` toutes présentes dans `jeu.md`.
- Commit : `e3231a4`.
- Statut : validé avec réserve : 4 mentions « Prévu (T-007) » restaient dans `physique/ascenseur.md`, fichier non autorisé pour D-007 ; corrigées en D-010.

## D-004 — Documentation du noyau, de l'i18n et de la validation (2026-11-12)

- Ajoute [simulation.md](simulation.md), [physique/ascenseur.md](physique/ascenseur.md), [i18n-accessibilite.md](i18n-accessibilite.md), les [errata de la spec T-001](specs/T-001-errata.md) et les ADR-005 à ADR-008 ; met à jour `README.md`, `docs/README.md`, `architecture.md`, `developpement.md`, `tests.md` et ce journal.
- Vérification de l'orchestrateur : 14 SHA-256 identiques ; 76 liens relatifs, 0 cassé ; recalcul indépendant de e_ss, ζ, Mp et t_pic pour 1000, 2500 et 4000 N/m conforme.
- Commit : `7bcd9ce`.
- Statut : validé pour l'état `c00e678` (avant T-007). Points reportés à D-007 : mentions « Prévu (T-007) » dépassées ; tutoriel de lancement local ; titre provisoire ; dépôt GitHub.

## T-007 — Logique du niveau 1 (2026-11-12)

- Ajoute `src/game/` (7 fichiers : machine à états, arbitre des issues, marche du bonhomme, file d'événements, constantes) et `tests/game/` (6 fichiers de test, 62 tests, plus `helpers.ts`). Voir [jeu.md](jeu.md) et [ADR-009](decisions/ADR-009-machine-a-etats.md).
- Issues : `noLift` de 0 à 100 N/m, `step` de 200 à 1900, `win` de 2000 à 3800, `bonk` de 3900 à 8000 ; pas d'issue identiques à T-005 (2500 → 291, 3800 → 273, 3900 → 63).
- Vérification de l'orchestrateur : 14 SHA-256 identiques ; contre-épreuve par l'API publique en images irrégulières (8 à 40 ms) puis à 1/60 s, mêmes résultats (dont 2700 N/m → victoire au pas 289, non testé par l'agent) ; couverture `src/game` 100 % ; `npm run check` code 0 (231 tests, 28 modules sans violation).
- Commit : `6259ccc`.
- Statut : validé. Arbitrages et contrats :
  - D-a : le réglage ne produit que des multiples de 100 N/m ; `initialKp` sert aux tests hors grille (150 N/m) ;
  - D-b : `restart` revient au réglage (spec §6.6) ;
  - contrats pour T-008 à T-010 : instantané et événements réutilisés, à copier ; interpolation par `alpha` ; enregistreur de signaux avant chaque pas ; animations d'embarquement et de sortie laissées au rendu.
- Applique la recommandation D-11 de T-005 (issues à 3800 et 3900 N/m figées par un test).

## T-006 — Internationalisation FR/EN (2026-11-12)

- Ajoute `src/i18n/` (7 fichiers TypeScript, `locales/fr.json`, `locales/en.json`, 89 clés par langue) et `tests/i18n/` (5 fichiers, 70 tests). Voir [i18n-accessibilite.md](i18n-accessibilite.md).
- Interpolation stricte (`I18nError`), clés et paramètres typés, formatage par `Intl.NumberFormat`, détection de langue, traducteur avec abonnés. Aucune bibliothèque externe, aucun tsconfig modifié.
- Vérification de l'orchestrateur : parité des clés et typographie contrôlées par un script indépendant ; `npm run check` code 0 (169 tests, 21 modules sans violation) ; `npm run test:cov` 100 % sur `src/sim`.
- Commit : `1ee1010`.
- Statut : validé. Points reportés :
  - titre du jeu (« PID au crayon » / « Pencil PID ») : décision de l'utilisateur ;
  - textes de la spec §6 enrichis (voir [errata](specs/T-001-errata.md)) ;
  - contrat T-007/T-010 : paramètres = chaînes déjà formatées ;
  - T-010 : bouton de langue avec attribut `lang`, rendu de U+202F dans la police manuscrite.

## T-004b — Corrections du noyau issues de T-005 (2026-11-12)

- Traite les défauts D-1 (consigne non finie → `RangeError`), D-2 (borne `MAX_SIM_DT` = 1/30 s), D-4 (test de σ à Kp = 8000), D-6 (test de trajectoire exacte `tests/sim/exact.test.ts`), D-7 (état initial invalide → `RangeError`), D-12 (signal inconnu → `RangeError`).
- `tests/sim/` : 9 fichiers, 98 tests verts. `reference.test.ts` et `determinism.test.ts` inchangés.
- Commit : `beb6086` (avec T-003 et T-004).
- Statut : validé. Réserves :
  - couverture et `npm run check` global d'abord crus sur la sortie de l'agent, puis reconfirmés pendant la validation de T-006 ;
  - l'horloge `createFixedStepClock` n'est pas bornée en `dt` ; la boucle refuse un `dt` trop grand ;
  - deux tests de `loop.test.ts` adaptés (dt 0,1 et 0,5 s désormais hors borne), intention inchangée.

## T-005 — Validation indépendante du noyau (2026-11-12)

- Ajoute `validation/` (9 scripts MATLAB, 3 CSV, `README.md`) et le rapport [validation/T-005-noyau.md](validation/T-005-noyau.md). Oracle exact par exponentielle de matrice, sans RK4.
- Écart RK4 / exact ≤ 1,42e-7 m ; Kp critique 97 079 N/m à dt = 1/120 s ; fenêtre [2000 ; 3800] N/m confirmée ; 8 mutants tués sur 8.
- Vérification de l'orchestrateur : `t005_run_all.m` relancé dans MATLAB, « FIN SANS ERREUR », mêmes chiffres.
- Commit : `9569ca4`.
- Statut : validé avec réserves (noyau validé avec réserves, aucun défaut bloquant ni majeur). Suites :
  - D-1, D-2, D-6, D-7 → T-004b (fait) ;
  - D-3, D-4, D-5, D-10 → errata de spec (D-004 : [specs/T-001-errata.md](specs/T-001-errata.md)) ;
  - D-8, D-11 → T-007 (ne pas garder de référence à l'échantillon ; figer les issues à 3800 et 3900 N/m) ;
  - D-9 (Kp non borné) : documenté, non corrigé.

## D-002 — Documentation technique initiale (2026-11-12)

- Ajoute `README.md`, `docs/README.md`, `architecture.md`, `developpement.md`, `tests.md`, `CHANGELOG.md` et les ADR-001 à ADR-004. Couvre T-000 à T-002.
- Vérification de l'orchestrateur : 20 liens relatifs, 0 cassé ; scripts npm conformes à `package.json`.
- Commit : `1dc5f7e`.
- Statut : validé. Signalements : `LICENSE` absent à l'époque (ajouté depuis, `bf7fd65`) ; `npm run e2e` échoue sans configuration (→ T-010) ; `.nvmrc` = `22` alors que le minimum est 22.12 ; depcruise n'analyse que `src/`.

## T-004 — Noyau : contrôleur P, ascenseur, boucle, oracle (2026-11-12)

- Ajoute `src/sim/controllers/p.ts`, `src/sim/plants/elevator.ts`, `src/sim/loop.ts` et les tests `oracle`, `reference`, `determinism` (79 tests au total à cette date, couverture `src/sim` 100 %).
- Empreinte SHA-256 de la trace Kp = 2500 : `5f85e15aa78afeeb834bf30e651b062be643a3e763b2821d7d534bcbbb38a821`.
- Vérification de l'orchestrateur : réimplémentation Python sur Kp = 3000 et 3900 (non couverts par les tests), identique à tous les chiffres affichés.
- Commit : `beb6086`.
- Statut : validé. Points reportés :
  - coquille t_pic de la spec §5 (errata n° 1) ;
  - piège de `LoopSample` : `x` est l'état après le pas (voir [simulation.md](simulation.md#le-piège-de-loopsample)) ;
  - `reset()` réactive la boucle ; contrôleur désactivé = `update` non appelé (à revoir pour un futur PI) ;
  - marge faible du test σ à Kp = 4000 (4,24 % pour un seuil de 5 %) ;
  - hauteur de poutre et tolérance de marche laissées à T-007.

## T-003 — Noyau : horloge, saturation, RK4, enregistreur (2026-11-12)

- Ajoute `src/sim/{types,clock,saturation,integrators,signals}.ts` et leurs tests (34 tests), le script `test:cov` et `@vitest/coverage-v8` 5.1.0.
- Vérification de l'orchestrateur : `npm run test:cov` 100 % ; contre-épreuve masse-ressort-amortisseur (écart 1,5e-8) et horloge sur 6000 images irrégulières (12 000 pas pour 100,0 s).
- Commit : `beb6086`.
- Statut : validé. Choix acceptés, documentés dans [simulation.md](simulation.md) :
  - saturation : NaN propagé, drapeau faux ; bornes invalides → `RangeError` ;
  - horloge : accumulateur en pas, epsilon 1e-9 pas, plafond 0,25 s par image, fraction conservée au plafond ;
  - interfaces étendues : `reset()` de l'horloge, `buffer` et `clear()` de l'enregistreur.

## T-002 — Socle outillé (2026-11-12)

- Commit : `ff1bb60`.

- Ajoute `package.json` (versions épinglées), `package-lock.json`, `.nvmrc`, configurations TypeScript, Vite, Vitest, ESLint, Prettier et dependency-cruiser, `index.html`, bouchons `src/main.ts`, `src/sim/index.ts`, `src/render/index.ts` et un test fumée.
- `npm run check` : code 0. Bundle JS : 219,75 kB gzip. Une violation volontaire dans `src/sim` fait échouer les trois garde-fous.
- Statut : validé avec réserves.
  - E2 : `src/main.ts` exempté de `three-only-in-render` → T-008.
  - E3 : `docs/` et `orchestration/` exclus de Prettier (prose).
  - E5 : pas de script `test:cov` → T-003 (fait).
  - E7 : 10 vulnérabilités modérées dans la chaîne de lint (développement seulement).
  - E9 : comportement du renderer dans un navigateur non exécuté → T-008.
  - E11 : un processus en arrière-plan ne survit pas à un appel du shell de la VM.

## T-001 — Spécification de la tranche verticale (2026-11-12)

- Commit : `d57b05b`. Corrections ultérieures : [specs/T-001-errata.md](specs/T-001-errata.md).

- Ajoute `docs/specs/T-001-tranche-verticale.md` : versions des dépendances, architecture, noyau, modèle de l'ascenseur, niveau 1, rendu, tests, plan de tâches.
- Calculs de référence recalculés à la main par l'orchestrateur (Kp = 2500 N/m : e_ss = 0,1962 m, ζ = 0,566, dépassement 11,6 %).
- Statut : validé. Points à surveiller : parité JS des valeurs de référence (T-004), repli WebGL2 non exécuté (T-008).

## T-000 — Tâche pilote (2026-11-12)

- Commit : `e627a96`.

- Initialise le dépôt git (branche `main`, aucun commit), ajoute `.gitignore` et `.gitattributes` (fins de ligne LF).
- Statut : validé.
