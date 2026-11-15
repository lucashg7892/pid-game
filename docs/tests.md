# Tests

À quoi sert cette page : dire quels tests existent au commit `02119f7`, ce que chacun prouve, avec quelles tolérances, comment lancer les tests de bout en bout et comment relancer la validation indépendante. La fin de page décrit l'intégration continue (T-011).

## Lancer les tests

```sh
npm run test       # vitest run : tous les tests unitaires (Node), une passe
npm run test:cov   # vitest run --coverage : idem + couverture de src/sim avec seuils
npm run check      # typecheck, lint, tests, build
npm run e2e        # playwright test : tests de bout en bout dans Chromium (voir plus bas)
```

Configuration (`vitest.config.ts`) : environnement `node`, fichiers `tests/**/*.test.ts`, exclusion de `tests/e2e/**`, `node_modules/**`, `dist/**`.

## Inventaire

Sortie de `npm.cmd test` au commit `02119f7` (arbre propre, relevé par le rédacteur, code de sortie 0) : **49 fichiers, 661 tests, tous verts** (« Test Files  49 passed (49) », « Tests  661 passed (661) »). Au commit `a308ada`, il y en avait 47 fichiers et 649 tests : la chasse aux bugs de la v0.2 (T-026 à T-033) a ajouté `tests/render/reduced-motion.test.ts` (4 tests, T-030) et `tests/render/anchors-reset.test.ts` (1 test, T-031) et étendu `tests/ui/keys.test.ts` (34 → 37), `tests/ui/screen-keys.test.ts` (17 → 18), `tests/ui/layout.test.ts` (37 → 38) et `tests/i18n/catalogs.test.ts` (25 → 27) : 4 + 1 + 3 + 1 + 1 + 2 = 12 tests de plus. Au commit `08908b6`, il y en avait 45 fichiers et 602 tests ; à `119519b`, 45 fichiers et 586 tests ; au commit `13e8b7e`, 36 fichiers et 439 tests (34 et 426 à `566a8a3`). T-023 a ajouté `tests/sim/pi-exact.test.ts` (22 tests) ; T-024 a ajouté `tests/render/integral-gauge.test.ts` (6 tests) et étendu `tests/ui/layout.test.ts` (22 → 37) et `tests/ui/level2-view-model.test.ts` (21 → 25) : 22 + 6 + 15 + 4 = 47 tests de plus que les 602 de `08908b6`. Avant : T-022 avait étendu des fichiers existants (+16 tests : `level2.test.ts` 43 → 51, `outcomes.test.ts` 28 → 32, `level2-view-model.test.ts` 18 → 21, `catalogs.test.ts` 24 → 25) ; T-017 avait ajouté `tests/app/` (2 fichiers), `screen-keys.test.ts`, `screens-model.test.ts` et `license.test.ts` ; T-021a `pi.test.ts` et `pi-determinism.test.ts` ; T-021b `level2.test.ts` et `level2-view-model.test.ts`. Les fichiers `tests/game/helpers.ts` et `tests/ui/helpers.ts` sont des modules d'outils partagés, pas des fichiers de test : Vitest ne les compte pas. S'y ajoutent 108 tests de bout en bout (Playwright, 10 fichiers), [plus bas](#tests-de-bout-en-bout-playwright). Les nombres par fichier du tableau sont relevés par le rédacteur (sortie JSON de Vitest).

| Fichier | Tests | Ce qu'il prouve |
|---|---|---|
| `tests/smoke.test.ts` | 1 | `SIM_DT` vaut exactement 1/120 s |
| `tests/app/machine.test.ts` | 20 | machine d'écrans (`src/app`) : catalogue (niveaux 1 et 2 jouables, dans l'ordre), table de transitions complète (chaque couple écran-commande, y compris `ignored` et `invalid`), `levelId` non nul seulement dans un niveau, abonnement et désabonnement, commande reçue pendant une notification exécutée après elle |
| `tests/app/units.test.ts` | 1 | sources de `src/app` : ni aléa, ni horloge, ni DOM, aucun import hors `src/app` |
| `tests/render/camera.test.ts` | 17 | zone de 17 × 7 m (haut fixé à `PLAY_ZONE_TOP`) entièrement visible et sans déformation pour 6 tailles d'écran ; valeurs de référence à 1280 × 720 ; portrait ; 7 tailles invalides sans NaN ; conversion monde → pixel |
| `tests/render/options.test.ts` | 25 | lecture de `?renderer=` (17 cas) ; plafond du rapport de pixels (8 cas) |
| `tests/render/stroke-batch.test.ts` | 21 | rubans : nombre de sommets, largeur constante, jointures, cas dégénérés sans NaN, épingle, épaisseur minimale à l'écran, effilement, débordement compté, tremblé déterministe et borné |
| `tests/render/level-painter.test.ts` | 14 | état initial ; trajets 2500, 7000, 800 et 100 N/m (issues `win` au pas 291, `bonk` 56, `step` 1200, `noLift` 1200) sans débordement et sous le budget ; jauge rouge seulement saturée ; cote à la victoire ; boiling 8 fois par seconde, figé en mouvement réduit ; mêmes tableaux après 1000 mises à jour ; interpolation ; ancres |
| `tests/render/walker-pose.test.ts` | 13 | 7 attitudes : membres de longueur constante, pieds au sol, deux sens ; marche réglée sur la distance ; miroir ; poses debout, mains aux hanches, victoire, choc |
| `tests/render/noise.test.ts` | 9 | hachage déterministe et réparti ; bruit borné et continu ; graines ; boiling 8 Hz figé en mouvement réduit |
| `tests/render/patterns.test.ts` | 9 | hachures dans le polygone (convexe, concave, qui se recoupe), au pas régulier ; pointillés ; cas dégénérés ; sortie pleine |
| `tests/render/curve.test.ts` | 6 | échelle 1,2 m/s jusqu'à 3 s puis resserrée ; y fidèle aux échantillons ; 1201 points (`TRIP_MAX_STEPS` + 1) ; échelle 0,36 m/s à 10 s sans débordement |
| `tests/render/failure.test.ts` | 4 | garde-fou d'échec du rendu (`createFailureGuard`) : un seul signalement, plus aucun appel gardé après un échec, une exception devient un échec `error` |
| `tests/render/gauge.test.ts` | 4 | 0 N en bas, 5000 N en haut ; remplissage \|uSat\| / 5000 ; 11 graduations ; repère du poids 490,5 N |
| `tests/render/reduced-motion.test.ts` | 4 | suivi de « mouvement réduit » (T-030, K22) : `createReducedMotionWatcher` lit la valeur initiale puis suit les événements `change`, démarre à vrai si la préférence est déjà active, retire son écouteur une seule fois et ne suit plus ensuite, vaut faux sans `matchMedia` |
| `tests/render/anchors-reset.test.ts` | 1 | `resetAnchors` (T-031, A-07) remet toutes les ancres à zéro et masque les repères conditionnels (`errorDimensionVisible`, `iGaugeVisible`) |
| `tests/render/integral-gauge.test.ts` | 6 | jauge du terme intégral (T-024) : cadre dessiné dès l'approche au niveau 2 (décor) et absent au niveau 1 ; remplissage hachuré qui suit \|I\|, au graphite, jamais en rouge, valeur finale gardée ; aucun trait dans la bande de la jauge I au niveau 1 pendant le trajet ; valeur absolue tracée (même niveau pour I et −I, borné à la pleine échelle) ; ancres `iGauge` et `iGaugeVisible`, étiquettes d'échelle à droite de la jauge I au niveau 2 et à leur place au niveau 1 |
| `tests/ui/keys.test.ts` | 37 | 27 touches × 20 combinaisons de phase et de focus ; Ctrl, Alt, Meta ; répétition ; Échap ferme l'aide, ferme le réglage (`closeTuning`) sans lancer ni pause ; aucun défilement ; écarts de Kp ; marche par position physique ; depuis T-026 et T-027 : aide ouverte, aucune commande du jeu quels que soient la phase et le focus (B-01, K24) ; Entrée ou Espace maintenue sur un bouton, pas de clic synthétisé (A-01) ; Échap maintenue sans intention (A-03) |
| `tests/ui/view-model.test.ts` | 22 | textes exacts des 7 bandeaux en FR et EN ; panneau, mesures, légende, pause, aide ; messages d'issue avec e mesurée et e théorique ; étiquette Kp dans toutes les phases ; mémoïsation ; titre « Huygens’s world » |
| `tests/ui/layout.test.ts` | 38 | 13 tailles d'écran, au niveau 1 et (T-024) au niveau 2 : aucun panneau ne coupe la cage, la console ni le bonhomme, ni ne sort de l'écran ; cas particuliers ; même objet réécrit ; zone de clic de la console ; étiquettes de la jauge (« 5000 N max », « poids ») à droite de la jauge, mesures au-delà, bulle et mesures sous la légende en portrait ; niveau 2 : étiquette de la jauge I une rangée au-dessus de celle de la force, mesures plus à droite en paysage, deux rangées d'étiquettes réservées en portrait ; T-028 : à 667×375 (bandes sans place sous la scène), l'issue garde une hauteur utile dans l'écran (A-02) |
| `tests/ui/announce.test.ts` | 4 | annonces de chaque événement en FR et EN, saturation une seule fois, valeur de e (signe moins U+2212) |
| `tests/ui/help.test.ts` | 9 | règles pures de l'aide : `helpPauseDecision` (pause à l'ouverture pendant un trajet seulement, reprise à la fermeture seulement si l'aide avait mis en pause), `commandsBlocked` (commandes suspendues tant que l'aide est ouverte, K24) et `trapFocusIndex` (piège de focus) |
| `tests/ui/screen-keys.test.ts` | 18 | `screenKeyToIntent` : touches × écrans × focus (Échap au titre, ↑ ↓ et Échap au menu, sans bouclage, Ctrl, Alt, Meta, aucun rôle dans un niveau) ; Entrée ou Espace avec `repeat` : bloquées sur le titre et le menu, rien au niveau (A-01) |
| `tests/ui/screens-model.test.ts` | 8 | textes exacts du titre et du menu en FR et EN, suivi de la langue, une entrée par niveau du catalogue, nom de repli sans clé, clés de titre existantes, budget de 8 clés `title.` et `menu.` |
| `tests/ui/level2-view-model.test.ts` | 25 | modèle de vue du niveau 2 en FR et EN : réglage de Ki, Kp « fixé », étiquette Kp et Ki, bulle, issues (victoire, choc, « trop court » à Ki = 0 et « trop lent » à Ki = 130 avec le vrai niveau), annonce « trop court » propre au niveau 2 (`hud.status.fail.stepKi`), mémoïsation, bandeaux et annonces du niveau 2, niveau 1 inchangé ; jauge I (T-024) : légende et ligne de légende propres au niveau 2, valeur de I affichée en trajet (signée, arrondie, mémoïsée, vide au niveau 1) en FR et EN, le texte suit un changement de langue en trajet |
| `tests/game/units.test.ts` | 16 | géométrie (quais, vide de 4 m, poutre 3,3626 m, consigne 3 m) ; arrondi de Kp (10 cas) ; seuil noLift calculé ; victoire au 120e pas consécutif ; choc strictement au-dessus de 3,3626 m, victoire au pas 1200 prioritaire, NaN ; `place` du bonhomme ; imports limités à `src/game` et `src/sim`, ni aléa, ni horloge, ni DOM |
| `tests/game/outcomes.test.ts` | 32 | issues de la spec §11 (Kp = 7000 pour le choc depuis T-020) ; pas d'issue exacts ; borne haute 5000 / 5100 figée (T-020, anciennement 3800 / 3900, D-11) ; balayage 0 → 8000 : `0-100 noLift \| 200-900 step \| 1000-5000 win \| 5100-8000 bonk`, victoire la plus lente 301 pas (marge de 899 pas avant 1200) ; Kp par défaut 2000 dans la fenêtre : un lancement sans réglage gagne au pas 262 (D28) ; marges 1,74 mm (5000), 1,79 mm (5100), 9,5 mm de tolérance (1000) ; erreur finale à la victoire ≈ m·g/Kp (1e-3 m) ; marche de 0,613 m à 800 N/m |
| `tests/game/state-machine.test.ts` | 15 | état initial (Kp = 2000) ; marche bornée ; zone de la console ; `initialKp` ; bornes et arrondi de Kp ; verrouillage pendant le trajet, l'issue et la pause ; commandes sans objet ; pause sans pas ni saut de temps ; bonhomme à bord ; `restart` (second trajet identique bit à bit) ; état figé après l'issue |
| `tests/game/frames.test.ts` | 5 | même issue, même pas, même erreur, même trace pour 5 découpages en images (Kp ∈ {1500, 2500, 3800, 3900}) ; image de 0,5 s |
| `tests/game/events.test.ts` | 5 | chaque événement une seule fois ; première saturation unique ; pas de saturation à 1500 N/m ; `tuningClosed` ; débordement de la file ; événement ajouté pendant la visite |
| `tests/game/level2.test.ts` | 51 | niveau 2 (T-021b, adapté et étendu par T-022) : constantes (Kp 2500, Ki 0 à 8000 par 100, défaut 2000, tolérance 0,1 m, 10 s) ; réglage de Ki (arrondi, bornes, verrou) ; issues du vrai niveau 2 (Ki = 0 et 100 : trop court ; 200 à 800 gagnent ; 900, 1000, 2500, 5000, 8000 heurtent ; défaut 2000 : choc) ; balayage de Ki 0 → 8000 (`step`, victoire contiguë [200 ; 800], `bonk`), marges de la borne de choc (12,02 mm et 17,03 mm), pas de 10 hors grille (`step` ≤ 120, `slow` à 130, `win` de 140 à 840, `bonk` dès 850) ; le choc vient du windup (I dépasse le poids) ; « trop court » avec le vrai niveau, « trop lent » à Ki = 130 ; arbitres `classifyTimeout2` et `createOutcomeJudge2` ; `iTerm` ; `restart` ; boucle reconstruite quand Ki change ; 5 découpages en images ; Ki = 0 identique au niveau 1 à Kp = 2500 |
| `tests/game/allocation.test.ts` | 2 | instantané unique sur 1000 images ; muter l'échantillon ou l'état du noyau ne change pas l'instantané |
| `tests/sim/clock.test.ts` | 12 | constantes ; nombre de pas pour des images de 1/30, 1/60, 1/144 s ; à-coup de 0,5 s plafonné à 8 pas ; durées négatives, nulles ou NaN ; `reset` ; pas de dérive sur 1 h en images de 1/144 s ; paramètres invalides |
| `tests/sim/integrators.test.ts` | 7 | RK4 sur ẋ = −x, x0 = 1, dt = 0,1 s, 10 pas : \|x − e⁻¹\| ≤ 1e-6 ; ordre 4 (erreur divisée par ≈ 16 quand dt est divisé par 2) ; commande constante pendant le pas ; aucune allocation ; mêmes bits sur deux exécutions ; `constrain` non appliqué ; dimensions invalides |
| `tests/sim/saturation.test.ts` | 7 | écrêtage à ±5000 N et drapeau ; ±Infinity ; NaN propagé avec drapeau faux ; bornes égales ou infinies ; bornes invalides |
| `tests/sim/signals.test.ts` | 8 | tampon préalloué de `capacity × 5` ; ordre chronologique ; écrasement du plus ancien ; aucune réallocation ; `clear` ; capacité 1 ; capacité invalide ; nom de signal inconnu (D-12) |
| `tests/sim/loop.test.ts` | 22 | contrôleur P ; paramètres de l'ascenseur ; dérivée ; contact sol ; cohérence de `LoopSample` ; aucune allocation sur 1000 pas ; `reset` ; t = k·dt ; boucle désactivée ; saturation négative ; modèle quelconque accepté ; consigne non finie (D-1) ; `MAX_SIM_DT` (D-2) ; état initial invalide (D-7) |
| `tests/sim/oracle.test.ts` | 20 | oracle analytique T1 à T5 ; taux de décroissance c/(2m) à 5 % (Kp ≤ 4000) ; σ à Kp = 8000 contre la valeur exacte de la boucle échantillonnée (D-4) |
| `tests/sim/exact.test.ts` | 16 | trajectoire complète contre la solution exacte (D-6), pour 9 Kp : les 6 d'origine et 1000, 5000, 5100 (bornes de T-020) ; propriétés de Φ et Γ ; ordre 4 ; Euler, RK2 et RK3 échouent |
| `tests/sim/reference.test.ts` | 5 | valeurs de référence de jeu (saturation ±5000 N) pour 4 Kp |
| `tests/sim/determinism.test.ts` | 4 | déterminisme (a), (b), (c) et trace non triviale |
| `tests/sim/pi.test.ts` | 14 | contrôleur PI (T-021a) : lois discrètes (u = Kp·e + I avec I avant mise à jour), Ki = 0 identique au P bit à bit sur 1800 pas (Kp ∈ {0, 150, 1500, 2500, 4500}), I = Ki·dt·e·n à erreur constante, `reset`, `RangeError`, cohérence de `LoopSample`, aucune allocation, `setEnabled(false)`, options, convergence (Kp = 2500, Ki = 1000 : e → 0 et I → m·g), windup (I croît pendant la saturation) |
| `tests/sim/pi-exact.test.ts` | 22 | oracle exact du PI (T-023), sans MATLAB : voir [la section dédiée](#oracle-exact-du-pi-testssimpi-exacttestts) |
| `tests/sim/pi-determinism.test.ts` | 4 | déterminisme de la boucle PI : deux exécutions identiques bit à bit, images de 1/60 s puis 1/144 s, empreinte SHA-256 figée (Kp = 2500, Ki = 1000), trace non triviale |
| `tests/i18n/license.test.ts` | 5 | mention de copyright contre le fichier `LICENSE` : une seule ligne de copyright, `title.copyright` identique en FR et en EN, année et titulaire, `title.license`, aucune autre clé avec « copyright » ou « © » |
| `tests/i18n/catalogs.test.ts` | 27 | structure des JSON ; convention de clés (préfixes dont `title.`, `menu.`, `level2.`) ; parité FR/EN ; paramètres identiques (9 textes identiques autorisés) ; `MESSAGE_PARAMS` exact ; clés de la spec §6 ; nombres physiques cités (dont, au niveau 2, la durée de 10 s et la tolérance de 0,1 m égales aux constantes du jeu, T-022) ; typographie ; `isLocale`, `otherLocale`, `isMessageKey`, `matchLocale` ; T-029 : la bulle anglaise du niveau 1 cite l'ascenseur et la hauteur de 3 m comme la française (B-06), l'aide d'interaction cite le lancement au clavier et au tactile dans les deux langues (B-08) |
| `tests/i18n/detect.test.ts` | 7 | priorité de `?lang=`, casse, région, valeur inconnue, paramètre répété, langues du navigateur, repli sur l'anglais |
| `tests/i18n/format.test.ts` | 13 | virgule ou point décimal ; arrondi ; décimales imposées ; groupement à 5 chiffres ; signe (vrai signe moins U+2212, jamais « - ») ; zéro négatif ; valeur non finie ; options invalides ; cache ; unités et `%` |
| `tests/i18n/interpolate.test.ts` | 11 | remplacement ; pas de double substitution ; paramètre manquant, hérité, en trop, non textuel ; accolades littérales ; gabarit mal formé ; `I18nError` ; `parseTemplate` |
| `tests/i18n/translator.test.ts` | 15 | traduction de chaque clé dans chaque langue ; erreurs ; catalogues injectés ; abonnés (notification, désabonnement, doublon, erreur groupée) ; formatage selon la langue |

Sous-totaux : `tests/sim/` 141 tests (12 fichiers), `tests/i18n/` 78 tests (6 fichiers), `tests/game/` 126 tests (7 fichiers), `tests/render/` 133 tests (13 fichiers), `tests/ui/` 161 tests (8 fichiers), `tests/app/` 21 tests (2 fichiers), test fumée 1 ; total 661 (49 fichiers).

## Oracle analytique (`tests/sim/oracle.test.ts`)

Boucle de l'ascenseur sans saturation (Umax = 1e12 N), comparée aux formules du second ordre recalculées dans le test (aucune valeur attendue en dur). Formules : [physique/ascenseur.md](physique/ascenseur.md#formules-du-régime-linéaire).

| Test | Vérification | Tolérance | Écart mesuré (`src/sim` inchangé depuis `c00e678`) |
|---|---|---|---|
| T1 | e_ss à t = 10 s, dt = 1/120, Kp ∈ {500, 1000, 2500, 4000, 8000} | \|e_sim − m·g/Kp\| ≤ 1e-6 m | max 4,32e-7 m (Kp = 500) |
| T2 | Mp, dt = 1/1000, Kp ∈ {1000, 2500, 4000} | ≤ 0,5 point de % | max 0,2049 point (Kp = 4000) |
| T3 | Mp, dt = 1/120, mêmes Kp | Mp_ana ≤ Mp_sim ≤ Mp_ana + 2,5 points | +0,068 / +0,989 / +1,756 point |
| T4 | t_pic, dt = 1/1000, Kp = 2500 | ≤ 0,01 s | 0,0008 s (0,5380 contre 0,5388 s) |
| T5 | Kp = 150 < 163,5 N/m | y = 0 et ẏ = 0 pendant 10 s | exact |
| σ | taux de décroissance, Kp ∈ {1000, 2500, 4000}, dt ∈ {1/120, 1/1000} | \|σ − c/(2m)\| / (c/(2m)) ≤ 5 % | max 4,24 % (Kp = 4000, dt = 1/120) |
| D-4 | σ à Kp = 8000, dt = 1/120, contre σ exact de la boucle échantillonnée | ≤ 1 % | 0,013 % |

Limites connues (rapport T-005 §G) : T1 ne voit pas l'intégrateur (l'équilibre est un point fixe de tout schéma cohérent) ; T2 et T4, à dt = 1/1000, passent aussi avec Euler et RK2. La tolérance de T3 n'est valable que jusqu'à Kp ≈ 5500 N/m, celle de σ que jusqu'à Kp = 4000 N/m (voir [physique/ascenseur.md](physique/ascenseur.md#effet-du-bloqueur-dordre-zéro)). C'est pourquoi le test de trajectoire exacte a été ajouté.

## Test de trajectoire exacte (`tests/sim/exact.test.ts`)

Ajouté en T-004b (défaut D-6 de T-005). Il compare la boucle de jeu (RK4, dt = 1/120 s, saturation ±5000 N, contact sol) à la solution exacte du système échantillonné, calculée en forme fermée dans le test :

```text
x(k+1) = Φ·x(k) + Γ·f(k),   f(k) = sat(Kp·(r − y(k))) − m·g,   puis contrainte de sol
```

- Kp ∈ {500, 1500, 2500, 3800, 3900, 8000} plus, depuis T-020, {1000, 5000, 5100} (bornes de la fenêtre), 1200 pas, à **chaque** pas, sur y et sur ẏ.
- Tolérances : 5e-7 m sur y, 5e-6 m/s sur ẏ.
- Écarts mesurés : max 1,420e-7 m sur y et 2,311e-6 m/s sur ẏ (Kp = 8000, relevé de T-004b) ; T-020 consigne 1,112e-7 m au pire pour l'écart noyau / solution exacte aux bornes de la fenêtre, tolérances inchangées.
- Ordre : à Kp = 2500, l'écart est divisé par 16,45 quand dt est divisé par 2.
- Mutants internes au test : Euler (écart sur y ≥ 3,7e-3 m), RK2 point milieu (≥ 8,5e-5 m) et RK3 de Kutta (≥ 1,4e-6 m) dépassent les tolérances pour chaque Kp.

## Oracle exact du PI (`tests/sim/pi-exact.test.ts`)

Ajouté en T-023 (N3, validateur indépendant, K28 corrigé). Le test (22 tests, sans MATLAB) propage en TypeScript la solution exacte de la boucle PI discrète à trois états [y, ẏ, I] (forme exacte du pas, contact au sol, saturation, bloqueur d'ordre zéro, I mis à jour après usage) et la compare, pas à pas, à `createElevatorPiLoop` (RK4, dt = 1/120 s) ; il rejoue aussi les règles d'issue du niveau 2 par l'arbitre de `src/game` (dépendance voulue : le test cassera si l'issue « trop lent » entre Ki = 129 et 138 disparaît ; `STEPS` = 1200 est codé en dur, remarques du validateur). Côté MATLAB : `validation/matlab/t018_*.m`, dont `t018_run_all.m` se termine par « T018 : FIN SANS ERREUR ». Source des mesures : `orchestration/logs/T-023.md`.

- Tolérances du test : y 1e-6 m, ẏ 1e-5 m/s, I 1e-3 N, u 3,5e-3 N (alignées sur la spec T-018 §8 après la réserve R1 du validateur : elles étaient plus larges que le critère MATLAB).
- Écarts mesurés (113 valeurs de Ki : grille de 100 et points fins de 120 à 140 et de 840 à 850) : 0 désaccord noyau / exact sur les issues, pas d'issue, pas saturés et pas du pic ; pire écart y 1,5e-7 m, ẏ 1,524e-6 m/s, I 2,144e-4 N (Ki = 8000), erreur de RK4 d'ordre 4.
- Bornes exactes de Ki (Kp = 2500, tolérance 0,10 m, 1200 pas) : step → slow 128,3759 ; première victoire 138,5864 ; choc 841,3209 (841,0670 avec y entre deux pas). Marge de 0,384 mm à Ki = 840, soit 9 300 fois l'écart numérique (K29).
- Ki critique de la boucle échantillonnée : 18 310,30 N/(m·s) (rayon spectral et critère de Jury), soit 0,9155 fois la limite continue 8·Kp = 20 000.
- Mutants détectés par le test : ordre de u et de I inversé, intégration conditionnelle, rétrocalcul, trapèzes. Non exécuté par le validateur : une mutation réelle de `pi.ts`.
- Régénération : les CSV `validation/data/pi_traj_dt120.csv` et `pi_sweep_summary.csv` sont régénérés à l'octet près par le script du `validation/README.md`.

## Valeurs de référence de jeu (`tests/sim/reference.test.ts`)

Quatre trajectoires de la configuration de jeu (saturation ±5000 N), comparées à des valeurs à 6 décimales : y aux pas 60, 120, 240, 600, y_max et nombre de pas saturés. Tolérance 1e-6 m. Écart mesuré : ≤ 4,80e-7 m (Kp = 3500). Tableau : [physique/ascenseur.md](physique/ascenseur.md#configuration-de-jeu-saturation-5000-n).

Ces valeurs viennent du même algorithme (script du concepteur). T-005 les a comparées à l'oracle exact : écart ≤ 5,6e-7 m. Elles sont donc justes, mais la marge sous la tolérance n'est que de 4,4e-7 m, dominée par l'arrondi à 6 décimales (errata n° 4).

## Déterminisme (`tests/sim/determinism.test.ts`)

Boucle de jeu Kp = 2500 N/m, 1800 pas. Trace = 4 valeurs par pas : y et ẏ après le pas, uCmd, uSat.

- (a) deux exécutions : traces identiques bit à bit (−0 et +0 distingués) ;
- (b) pilotage par l'horloge en images de 1/60 s puis de 1/144 s : mêmes états aux mêmes k ;
- (c) empreinte SHA-256 figée : `5f85e15aa78afeeb834bf30e651b062be643a3e763b2821d7d534bcbbb38a821` (inchangée à `119519b`) ;
- la trace n'est pas triviale : la cabine bouge et la saturation agit.

Le PI a son empreinte (`pi-determinism.test.ts`, Kp = 2500, Ki = 1000 : `0d9d331a5a4a9df28a188dd71b599a3559bd47ccc04f6d4ab78b7db5b725744b`). Détails : [simulation.md](simulation.md#déterminisme).

## Couverture

```sh
npm run test:cov
```

Périmètre : `src/sim/**/*.ts` seulement. Seuils (`vitest.config.ts`) : 95 % des lignes et 90 % des branches ; en dessous, la commande échoue. `src/i18n` n'est pas mesuré ; `src/game` ne l'est pas par ce script (voir plus bas).

Résultat au commit `02119f7` (`npm.cmd run test:cov`, code de sortie 0, 661 tests ; mêmes nombres à `a308ada`, `08908b6` et `119519b`, relevé par le rédacteur ; 100 % aussi à `566a8a3`) :

| Périmètre | Instructions | Branches | Fonctions | Lignes |
|---|---|---|---|---|
| `src/sim` (tous fichiers, `controllers/pi.ts` compris) | 100 % (192/192) | 100 % (102/102) | 100 % (38/38) | 100 % (178/178) |

`index.ts` et `types.ts` apparaissent à 0 % dans le détail : ils ne contiennent que des réexportations et des types, sans code exécuté. Ils ne font pas baisser le total.

### Couverture de `src/game`

`npm run test:cov` ne mesure pas `src/game`. Pour la mesurer, remplacer le périmètre en ligne de commande :

```sh
npx vitest run --coverage --coverage.include='src/game/**/*.ts'
```

Résultat au commit `08908b6` (code de sortie 0, relevé par le rédacteur ; mêmes nombres à `119519b`) : 100 % des instructions (318/318), des branches (107/107), des fonctions (63/63) et des lignes (298/298), « 8 files fully covered » : `constants.ts`, `elevator-level.ts`, `events.ts`, `kp.ts`, `level.ts`, `level2.ts`, `outcome.ts` et `walker.ts` ; `index.ts` à 0 % (réexportations seules). Les seuils de `vitest.config.ts` s'appliquent alors à `src/game`. Le log T-007 consignait aussi 100 %.

### Couverture de `src/app`

Même commande avec `--coverage.include='src/app/**/*.ts'` (au commit `119519b`, relevé par le rédacteur) : `screens.ts` à 92,3 % des instructions, 77,77 % des branches, 100 % des fonctions, 92,15 % des lignes (lignes 85, 94, 107 et 116 non couvertes) ; le total est 92,3 % des lignes et 77,77 % des branches, donc **sous les seuils de 95 % et 90 %** si ce périmètre était mesuré seul (la commande échoue alors, ce qui n'arrive pas avec `npm run test:cov`, qui ne mesure que `src/sim`). `levels.ts` et `index.ts` ne contiennent que des données et des réexportations.

### Couverture de `src/render` et `src/ui`

Mesure faite par le rédacteur sur l'extraction de `566a8a3`, seuils désactivés (non refaite au commit `119519b` : `src/render` a peu changé, mais `src/ui` a gagné `screens.ts`, `screens-model.ts` et `screen-keys.ts`, dont seuls `screens-model.ts` et `screen-keys.ts` sont des fichiers purs testés sous Node) :

```sh
npx vitest run --coverage --coverage.include='src/render/**/*.ts' --coverage.include='src/ui/**/*.ts' --coverage.thresholds.lines=0 --coverage.thresholds.branches=0
```

| Fichiers | Lignes couvertes |
|---|---|
| fichiers purs de `src/render` : `curve`, `gauge`, `level-display`, `noise`, `options`, `pencil-style`, `stroke-batch` | 100 % |
| `level-painter.ts`, `patterns.ts`, `walker-pose.ts`, `camera.ts` | 98,36 %, 100 %, 95,55 %, 77,27 % (la partie non couverte de `camera.ts` est `applyFrame`, qui touche la caméra three) |
| fichiers purs de `src/ui` : `announce`, `hints`, `keys`, `view-model` | 100 % |
| `layout.ts` | 96,87 % |
| fichiers three ou DOM : `bootstrap`, `session`, `stage`, `paper`, `pencil-material`, `level-view`, `overlay`, `input` | 0 % : ils ne s'exécutent que dans un navigateur, couverts par les tests e2e |

Total : 76,24 % des lignes pour `src/render`, 36,57 % pour `src/ui`. Le log T-010 consigne 98,9 % pour les seuls fichiers purs de `src/ui`.

## Logique de jeu (`tests/game/`)

Ajoutés par T-007 (62 tests en 6 fichiers), étendus par T-020, T-021b et T-022 : 126 tests en 7 fichiers (114 à `119519b`). Ils jouent le niveau par son API publique, comme le fera l'interface : marche jusqu'à la console, réglage, lancement, images successives jusqu'à l'issue (`tests/game/helpers.ts`, fonction `runTrip`). Règles et tableau des issues : [jeu.md](jeu.md#règles-dissue).

| Vérification | Valeur attendue | Fichier |
|---|---|---|
| issues de la spec §11 | 150 → `noLift`, 800 → `step`, `KP_DEFAULT` (2000), 2500, 3500 et 4500 → `win`, 7000 → `bonk` (500 → `step` jusqu'à T-021b) | `outcomes.test.ts` |
| pas d'issue exacts | 1000 → 267, 2500 → 291, 3500 → 278, 3800 → 273, 4000 → 301, 5000 → 293, 5100 → 61 (`bonk`), 7000 → 56 (`bonk`), 2000 → 262 (défaut, D28), 100, 150, 200, 800 et 900 → 1200 (720 jusqu'à T-021b) | `outcomes.test.ts` |
| balayage 0 → 8000 par 100 N/m | `0-100:noLift \| 200-900:step \| 1000-5000:win \| 5100-8000:bonk` ; victoire la plus lente 301 pas | `outcomes.test.ts` |
| marges de la fenêtre | pics 3,360855 m (5000) et 3,364391 m (5100) à 6 décimales ; 1,74 mm sous la poutre, 1,79 mm au-dessus ; 9,5 mm de tolérance à 1000 | `outcomes.test.ts` |
| erreur finale à la victoire | \|finalError − m·g/Kp\| ≤ 1e-3 m pour 2000, 2500, 3000, 3800 N/m | `outcomes.test.ts` |
| indépendance à la cadence d'images | bit à bit identique pour 1/30, 1/60, 1/144 s et deux découpages irréguliers (générateur mulberry32 à graine fixe) ; niveau 2 : 5 découpages | `frames.test.ts`, `level2.test.ts` |
| `restart` | état du réglage restauré ; second trajet identique bit à bit | `state-machine.test.ts`, `level2.test.ts` |
| allocation | même objet instantané sur 1000 images, dans toutes les phases | `allocation.test.ts` |
| niveau 2 | Ki gagnants 0 à 800, chocs 900 à 8000 | `level2.test.ts` |

La spec T-001 §11 demandait « victoire de Kp = 2500 au pas 291 ± 1 » ; le test exige 291 exactement. La recommandation D-11 de T-005 (figer les deux Kp qui encadrent la borne haute) est appliquée à 5000 et 5100 depuis T-020 (3800 et 3900 avant). Le test CA-7 de l'erreur de la marche à 800 N/m (`toBeCloseTo(0.613125, 6)`) a été resserré par l'orchestrateur après la réserve R1 du validateur de T-020.

## Validation indépendante MATLAB (T-005, relancée par T-020)

Un validateur qui n'avait pas écrit le code a recalculé le comportement du noyau avec un oracle **exact** (exponentielle de matrice, sans RK4), écrit en MATLAB. MATLAB sert seulement à la validation : rien n'est importé par le site ([ADR-006](decisions/ADR-006-oracle-matlab.md)).

- Rapport complet : [validation/T-005-noyau.md](validation/T-005-noyau.md).
- Scripts, données et mode d'emploi : [validation/README.md](../validation/README.md).

Relancer (MATLAB R2025a, sans toolbox), depuis la racine du dépôt :

```matlab
run('validation/matlab/t005_run_all.m')
```

La dernière ligne affichée doit être `T005 : FIN SANS ERREUR`. L'orchestrateur l'a relancé pendant la validation de T-005 et a retrouvé les mêmes chiffres (log T-005). T-020 a relancé l'oracle après le changement des valeurs de jeu et adapté `t005_params.m`, `t005_E.m` et `t005_issue.m` ; `validation/data/ts_sweep_summary.csv` a été régénéré. Le contrôleur PI a son propre oracle depuis T-023 (`run('validation/matlab/t018_run_all.m')`, dernière ligne « T018 : FIN SANS ERREUR » ; voir [la section dédiée](#oracle-exact-du-pi-testssimpi-exacttestts)) ; `t005_run_all.m` ne couvre que le niveau 1. Pour régénérer les CSV du code TypeScript, suivre la procédure du `validation/README.md` (test Vitest temporaire, à supprimer après usage).

Résultats principaux :

| Point | Résultat |
|---|---|
| écart RK4 / exact sur y, 12 Kp | ≤ 1,42e-7 m ; rapport ≈ 16,5 quand dt est divisé par 2 |
| formules du régime linéaire (boucle continue, `ode45`) | retrouvées à 1e-9 près |
| Kp critique à dt = 1/120 s | 97 079 N/m (trois méthodes) |
| fenêtre de jeu [2000 ; 3800] N/m (T-005, réglage d'origine) | confirmée ; 0 désaccord TS/oracle sur 80 Kp |
| fenêtre de jeu [1000 ; 5000] N/m (T-020 puis T-022 ; poutre 3,3626 m, tolérance 0,5 m ; 720 pas, puis 1200 pas, 10 s, depuis T-022) | confirmée : « Kp in [1000 ; 5000] », 0 désaccord TS/oracle sur 80 issues, « T005 : FIN SANS ERREUR » (MATLAB R2025a ; à T-020 : « 41 valeurs, contiguë : true », log T-020 ; à T-022 : « horizon 1200 pas (10.0 s) », log T-022) |
| attaques (40 cas) | 2 défauts mineurs (consigne non validée, dt non borné), corrigés en T-004b |

### Analyse de mutation de T-005

Le validateur a créé 8 copies du noyau, chacune avec une seule erreur volontaire, et lancé les 78 tests du noyau de l'époque sur chacune. Les 8 mutants ont été tués.

| Mutant | Tests en échec | Détecté par |
|---|---|---|
| M1 RK4 → Euler explicite | 19 / 78 | tests RK4, références, SHA-256, T3 (Kp = 4000), T5, propriété σ ; T1, T2, T4 passent |
| M2 RK4 → RK2 point milieu | 9 / 78 | tests RK4, références, SHA-256 ; tous les tests d'oracle passent |
| M3 `constrain` supprimé | 3 / 78 | contact sol, chute libre, T5 |
| M4 intégration avec uCmd (sans saturation) | 6 / 78 | références, SHA-256, cohérence de `LoopSample` |
| M5 sol : ẏ = 0 au lieu de max(ẏ, 0) | 1 / 78 | test unitaire de `constrain` seulement |
| M6 t = (k+1)·dt | 2 / 78 | cohérence de `LoopSample`, consigne en k·dt |
| M7 g = 9,80665 | 11 / 78 | T1, dérivée, références, SHA-256 |
| M8 poids de k3 = 2,0001 | 9 / 78 | tests RK4, références, SHA-256 |

Conséquence : M2 montrait qu'aucun test d'oracle ne voyait l'ordre de l'intégrateur. T-004b a ajouté `tests/sim/exact.test.ts`, qui fait échouer Euler, RK2 et RK3. Cette analyse n'a pas été refaite sur la suite actuelle (98 tests du noyau).

## Tests de bout en bout (Playwright)

Fichiers : `tests/e2e/render.spec.ts`, `level.spec.ts`, `ui.spec.ts`, `failure.spec.ts`, `saturation.spec.ts` (outils : `console.ts`, `overlay.ts`, `png.ts`). Configuration : `playwright.config.ts`. Chromium seul, contre le **build de production** servi par `vite preview` sur `http://127.0.0.1:4173/pid-game/`, un test à la fois, aucune nouvelle tentative. Options de Chromium : `--use-angle=swiftshader` (rendu WebGL logiciel, sans GPU réel), `--enable-unsafe-swiftshader`, `--ignore-gpu-blocklist`.

### Comment les lancer

Sur un poste de développeur (accès réseau) :

```sh
npx playwright install chromium
npm run e2e
```

Avec un Chrome déjà installé (réseau filtré) : la variable `PW_CHROME_PATH` remplace le Chromium de Playwright.

```sh
PW_CHROME_PATH=/usr/bin/google-chrome npx playwright test
```

**La VM des agents ne peut pas télécharger de navigateur** (403 « Connection blocked by network allowlist », log T-008). Les tests e2e sont donc exécutés par l'orchestrateur, dans son environnement, sur une copie du dépôt, avec la seconde commande : Google Chrome for Testing 153, headless, rendu logiciel SwiftShader, WebGL2 ([ADR-012](decisions/ADR-012-tests-navigateur.md)). Résultats consignés : **28 tests verts en 1,7 min** au commit `566a8a3` (log T-010) ; **41 verts** à la fin de T-020 (log T-020) ; **58 verts** à la fin de T-021a (log T-021a). Le registre note « `check` et e2e complet verts » pour T-032 (`3b658eb`, orchestrateur) ; le rédacteur de D-018 n'a pas relancé cet e2e (108 tests au commit `02119f7`). Les tests ajoutés ensuite (T-017d, T-017e, T-021b, T-022, T-024, T-026 à T-031) sont décrits d'après leur code : le rédacteur n'a exécuté **aucun** test e2e (il réécrirait les PNG de `docs/img/`), il a seulement listé les tests.

### Inventaire

Sortie de `npx.cmd playwright test --list` au commit `02119f7` : « Total: 108 tests in 10 files » (74 tests dans 7 fichiers au commit `a308ada`, 70 au commit `08908b6`, 69 au commit `119519b`, 39 tests dans 5 fichiers au commit `13e8b7e`, 28 dans 3 fichiers à `566a8a3`). Les tests marqués « FR et EN » comptent pour deux.

| Fichier | Tests | Ce qu'ils vérifient |
|---|---|---|
| `render.spec.ts` | 10 | WebGL2 imposé : démarrage sans erreur console, papier dessiné, **4 appels de dessin**, triangles entre 1 000 et 30 000 ; portrait 390 × 844 : papier aligné sans déformation, lignes de mètre de même teinte ; uniformité des lignes de mètre à 1280 × 720, 1281 × 721 et 390 × 844 ; redimensionnement 1280 × 720 → 800 × 900 ; page de repli `?renderer=none` en FR et en EN ; mode automatique : backend constaté, sans exception |
| `level.spec.ts` | 8 | (a) bonhomme dessiné à l'état initial ; (b, c, d) console, trajet à 2500 N/m, victoire au pas 291 ; (e) 7000 N/m : choc au pas 56 (4500 avant T-020) ; (f, g) 800 N/m : marche trop haute au pas 1200 (10 s ; l'essai n'est pas fini à 9,9 s), 1201 points de courbe dans leur zone, budget, capture `t022-niveau1-trop-court.png` (720 pas, 721 points jusqu'à T-021b ; 1500 N/m au pas 1800 avant T-020) ; (h) `window.__huygens` absent sans `?e2e=1` ; (i) portrait : victoire dessinée ; (j) T-020 : poutre dessinée à `BEAM_HEIGHT`, 5000 N/m gagne au pas 293 sous la poutre, 5100 N/m la heurte au pas 61 (captures `t020-poutre-fr.png`, `t020-choc-fr.png`) ; (k) T-020 : portrait 390 × 844, la poutre reste dans le cadre et dessinée |
| `level2.spec.ts` | 16 | niveau 2 (T-021b, adapté et étendu par T-022 : Ki par défaut 2000) : (a) FR et EN : menu à deux entrées, niveau 2 au clavier, victoire à Ki = 800 (atteint depuis le défaut 2000) ; (b) FR et EN : réglage à la souris (curseur, champ, − et +), choc à Ki = 2500 ; (c) FR et EN : Ki verrouillé pendant le trajet (clavier, souris, crochet), retour au menu ; (d) FR et EN : niveau 1 inchangé derrière le menu à deux entrées ; (e) issues du vrai niveau 2 par le crochet (défaut 2000 : choc ; Ki = 0 et 100 : trop court ; 200 et 800 : victoire ; 900 et 5000 : choc) ; (f) portrait 390 × 844 : étiquette Kp et Ki sans recouvrement ; (g) 1280 × 720 : aucun recouvrement du réglage, du trajet et de l'issue ; cinq captures `t021-*.png` ; (h) T-022 : Ki = 0, le P seul reste « trop court » au bout de 10 s (tolérance 0,1 m), capture `t022-niveau2-trop-court.png` ; (i) T-024, FR et EN : jauge du terme intégral I (étiquettes, valeur, remplissage hachuré, sans recouvrement), capture `t024-niveau2-jauge-i.png` ; (j) T-024 : portrait 390 × 844, jauge I en trajet et à l'issue, étiquettes sans recouvrement, capture `t024-niveau2-jauge-i-portrait.png` ; (k) T-024 : au niveau 1, aucune jauge I (ni étiquette ni trait dans sa bande) |
| `ui.spec.ts` | 37 | (a) partie complète au clavier réel en français (aide, marche, panneau, + × 5 depuis 2000 N/m, Entrée, victoire, R ; étiquettes de la jauge) ; (b) en anglais, 7000 N/m (Page préc. × 4, + × 10), choc ; (c) bascule de langue pendant le réglage ; (d) accessibilité FR et EN ; (e) aucune touche ne fait défiler la page ; (f) perte de focus pendant un trajet : pause ; (f bis) en approche : arrêt sans pause ; (g) invite de rotation en portrait ; (h) police manuscrite servie depuis `/pid-game/fonts/` ; (i) aucun panneau ni étiquette de la jauge ne recouvre la cage, la console ni le bonhomme, à 1280 × 720 et 390 × 844 ; (j) aide ouverte pendant un trajet : pause, reprise à la fermeture (bouton et Échap) ; (k) pause du joueur puis aide : la fermeture de l'aide ne reprend pas ; (l) hors trajet, l'aide ne change pas la phase ; (m) aide modale : focus dedans, Tab piégé, focus rendu à l'ouvreur ; (n) bouton Pause sans `aria-pressed`, focus sur « Rejouer » à l'issue ; (o) K24 : « Reprendre » ne relance pas le jeu derrière l'aide ; (p) K23 : l'aide est opaque ; (q) cycle de vie de la vue : attach, detach, attach sans fuite ni erreur ; (r) T-026 (B-01) : aide ouverte, `+`, Page préc., Page suiv., `-`, `e` et `r` ne commandent plus le jeu, et le commandent après la fermeture ; (r) T-028 (A-02), 16 tests : issue `win` ou `bonk`, niveau 1 ou 2, à 1024×600, 844×390, 740×360 et 667×375, « Rejouer » et « Menu » visibles et cliquables. Sans `?e2e=1`, le test passe d'abord par le titre (« Jouer », puis le premier niveau) |
| `screens.spec.ts` | 21 | écrans titre et menu (T-017) : (a) FR et EN : chargement sur le titre, focus sur « Jouer », copyright égal à la ligne de `LICENSE` ; (b) FR et EN : parcours au clavier seul (victoire, pause, « Menu », Échap) ; (c) FR et EN : parcours à la souris, retour au menu depuis l'issue, puis « Retour » ; (d) trois allers-retours niveau → menu → niveau : une seule interface, un seul effet par frappe, niveau neuf ; (e) la langue choisie au titre est conservée ; (f) `?renderer=none` : page de repli, sans titre ni menu ; (g) échec du rendu sur le menu : écran démonté, page de repli ; (h) portrait 390 × 844 et 360 × 740 : boutons d'au moins 44 px ; (i) en pause, « Menu » reste dans l'écran sans chevaucher les autres boutons, à 1280 × 720, 390 × 844 et 360 × 740 ; captures `t017-*.png` ; (j) T-027 (A-01, A-03), 6 tests : double-clic sur « Jouer », Entrée maintenue sur « Jouer », Espace et Entrée sans répétition, clic unique et clic synthétique, double-clic sur « Retour », Entrée maintenue sur « Menu » en pause, Échap maintenue dans un niveau : une intention, un écran ; (k) double tape tactile (émulé) sur « Jouer » : le menu, aucun niveau |
| `mineurs-t029.spec.ts` | 6 | T-029 : A-05, du titre, le focus du menu est sur « Niveau 1 » et non sur le dernier niveau joué ; A-09, 800×200, titre et menu, le haut de la carte est atteignable (2 tests) ; B-03, niveaux 1 et 2, Échap dans le champ numérique annule la saisie (2 tests) ; B-04, à l'issue, la pause désactive « Rejouer le niveau » et la reprise le réactive |
| `k10-a07.spec.ts` | 2 | T-031 : K10, en marchant, la bulle suit la tête du bonhomme de l'image affichée (garde de cohérence : elle passe aussi sans la correction, le décalage de 2 px par image n'existant qu'en temps réel, pas avec `advance`) ; A-07, à l'entrée de chaque niveau, la bulle ne passe pas par la position du précédent (échoue sans la correction) |
| `reduced-motion.spec.ts` | 2 | T-030 : le tremblé suit la préférence « mouvement réduit » changée en cours de partie (`reducedMotion()` du crochet) ; l'écouteur de la requête média est retiré à l'arrêt de la session, sans fuite sur des cycles attach / detach |
| `failure.spec.ts` | 4 | WebGL2 imposé, en FR et en EN : perte du contexte (`WEBGL_lose_context`) puis exception provoquée par `crashNextFrame()` ; dans les deux cas la page de repli traduite (`#fallback`, `data-kind` valant `context-lost` ou `error`) remplace le jeu, canvas masqué, `#ui` retiré, aucun bouton. Le chemin WebGPU (`device.lost`) n'est pas exercé |
| `saturation.spec.ts` | 2 | (a) Kp = 2500 : jauge rouge à 0,1 s (au moins 500 pixels de crayon rouge), sans rouge à 0,5 s ; (b) Kp = 4500 : texte « Saturé », annonce `level1.saturation`, capture `docs/img/t016-saturation.png`, texte disparu à 0,4 s |

Chaque test surveille la console du navigateur : toute erreur ou tout avertissement non listé fait échouer le test. Messages tolérés, avec leur raison dans `render.spec.ts` : « GL Driver Message … GPU stall due to ReadPixels » (SwiftShader) ; en mode automatique, « No available adapters. » et l'avertissement de three « WebGPU is not available, running under WebGL2 backend. ».

Le crochet `?e2e=1` (voir [architecture.md](architecture.md#ce-que-fait-srcmaints)) rend les scénarios déterministes : le temps n'avance que par `advance(secondes)`, par images fixes de 1/60 s.

### Tests de pixels

Plusieurs tests décodent la capture d'écran (`tests/e2e/png.ts`) et comptent des pixels :

- **présence** : pixels de graphite dans la boîte du bonhomme, et aucun dans une boîte témoin 2 m plus à droite (papier vierge) ;
- **position** : points de la courbe y(t) aux coordonnées attendues ; aucune trace de courbe hors de sa zone ;
- **jauge rouge** (T-016) : `saturation.spec.ts` compte les pixels de crayon rouge (r ≥ 120, r − g ≥ 60, r − b ≥ 60) dans le rectangle monde de la jauge : au moins 500 à 0,1 s à Kp = 2500, aucun à 0,5 s ;
- **poutre** (T-020) : `level.spec.ts` (j) et (k) cherchent le bord bas de la poutre dans la capture (rangée de pixels attendue à une ou quatre rangées près) et vérifient que la poutre est dessinée à `BEAM_HEIGHT` ;
- **aspect du papier** : teinte des lignes de mètre identique le long d'une ligne et d'une ligne à l'autre, et comparaison à la capture de référence de T-008.

Les tests d'aspect ont été ajoutés après l'incident de T-009b : les tests de position passaient alors que le papier était visiblement dégradé (voir [rendu.md](rendu.md#papier-millimétré)). Les tests produisent aussi les captures de `docs/img/`, que l'orchestrateur regarde à chaque exécution (leçon L9).

### Limites

- **WebGPU réel n'est exercé par aucun test** : en headless, aucun adaptateur n'est trouvé et three passe sur WebGL2. Le 2026-11-13, l'utilisateur a constaté sur son PC Windows que « tout fonctionne », sans relever le backend (D16).
- Rendu logiciel SwiftShader, pas un vrai GPU ; Chromium seul (ni Firefox ni Safari).
- Commandes tactiles non testées sur un écran tactile ; contrastes non mesurés ; le suivi dynamique de « mouvement réduit » est testé en e2e (`reduced-motion.spec.ts`, T-030), mais ni les écrans titre et menu avec mouvement réduit, ni les contrastes.
- « Aucune allocation par image » : établi par construction et par l'identité des tableaux, sans mesure du tas.

## Intégration continue

Le workflow `.github/workflows/ci.yml` (T-011, commit `8736af7`) lance les tests sur GitHub Actions. Décision : [ADR-013](decisions/ADR-013-ci-et-pages-manuel.md).

- Déclencheurs : chaque push sur `main` et chaque pull request. Une nouvelle exécution sur la même branche ou la même PR annule la précédente.
- Machine : `ubuntu-latest`, 30 min au plus, droits en lecture seule.
- Étapes : récupération du dépôt ; Node 22 avec cache npm ; `npm ci` ; `npm run check` (typecheck, lint, tests unitaires, build) ; `npx playwright install --with-deps chromium` ; `npm run e2e`.
- En cas d'échec, les dossiers `playwright-report/` et `test-results/` sont déposés comme artefact `playwright-results`, gardé 14 jours.

La CI ne lance pas la validation MATLAB ([ADR-006](decisions/ADR-006-oracle-matlab.md)).

**Au commit `88ae23c`, la CI n'avait encore jamais tourné sur GitHub** : sa première exécution aura lieu au prochain push de l'utilisateur (log `orchestration/logs/T-011-013.md`). Le fichier a été contrôlé hors ligne : YAML valide, `actionlint` 1.7.12 sans message (même log). Ce sera aussi la première exécution des tests e2e avec le Chromium de Playwright plutôt que Chrome for Testing.
