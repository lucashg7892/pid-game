# Tests

À quoi sert cette page : dire quels tests existent au commit `566a8a3`, ce que chacun prouve, avec quelles tolérances, comment lancer les tests de bout en bout et comment relancer la validation indépendante. Seule la CI reste à venir (fin de page).

## Lancer les tests

```sh
npm run test       # vitest run : tous les tests unitaires (Node), une passe
npm run test:cov   # vitest run --coverage : idem + couverture de src/sim avec seuils
npm run check      # typecheck, lint, tests, build
npm run e2e        # playwright test : tests de bout en bout dans Chromium (voir plus bas)
```

Configuration (`vitest.config.ts`) : environnement `node`, fichiers `tests/**/*.test.ts`, exclusion de `tests/e2e/**`, `node_modules/**`, `dist/**`.

## Inventaire

Sortie de `npx vitest run` au commit `566a8a3`, sur une extraction propre du commit (`git archive 566a8a3`) : **34 fichiers, 426 tests, tous verts**. Les fichiers `tests/game/helpers.ts` et `tests/ui/helpers.ts` sont des modules d'outils partagés, pas des fichiers de test : Vitest ne les compte pas. S'y ajoutent 28 tests de bout en bout (Playwright), [plus bas](#tests-de-bout-en-bout-playwright).

| Fichier | Tests | Ce qu'il prouve |
|---|---|---|
| `tests/smoke.test.ts` | 1 | `SIM_DT` vaut exactement 1/120 s |
| `tests/render/camera.test.ts` | 17 | zone de 17 × 7 m entièrement visible et sans déformation pour 6 tailles d'écran ; valeurs de référence à 1280 × 720 ; portrait ; 7 tailles invalides sans NaN ; conversion monde → pixel |
| `tests/render/options.test.ts` | 25 | lecture de `?renderer=` (17 cas) ; plafond du rapport de pixels (8 cas) |
| `tests/render/stroke-batch.test.ts` | 21 | rubans : nombre de sommets, largeur constante, jointures, cas dégénérés sans NaN, épingle, épaisseur minimale à l'écran, effilement, débordement compté, tremblé déterministe et borné |
| `tests/render/level-painter.test.ts` | 14 | état initial ; trajets 2500, 4500, 1500 et 100 N/m sans débordement et sous le budget ; jauge rouge seulement saturée ; cote à la victoire ; boiling 8 fois par seconde, figé en mouvement réduit ; mêmes tableaux après 1000 mises à jour ; interpolation ; ancres |
| `tests/render/walker-pose.test.ts` | 13 | 7 attitudes : membres de longueur constante, pieds au sol, deux sens ; marche réglée sur la distance ; miroir ; poses debout, mains aux hanches, victoire, choc |
| `tests/render/noise.test.ts` | 9 | hachage déterministe et réparti ; bruit borné et continu ; graines ; boiling 8 Hz figé en mouvement réduit |
| `tests/render/patterns.test.ts` | 9 | hachures dans le polygone (convexe, concave, qui se recoupe), au pas régulier ; pointillés ; cas dégénérés ; sortie pleine |
| `tests/render/curve.test.ts` | 6 | échelle 1,2 m/s jusqu'à 3 s puis resserrée ; y fidèle aux échantillons ; 1 801 points sans débordement |
| `tests/render/gauge.test.ts` | 4 | 0 N en bas, 5000 N en haut ; remplissage \|uSat\| / 5000 ; 11 graduations ; repère du poids 490,5 N |
| `tests/ui/keys.test.ts` | 33 | 27 touches × 20 combinaisons de phase et de focus ; Ctrl, Alt, Meta ; répétition ; Échap ferme l'aide ; aucun défilement ; écarts de Kp ; marche par position physique |
| `tests/ui/view-model.test.ts` | 20 | textes exacts des 7 bandeaux en FR et EN ; panneau, mesures, légende, pause, aide ; messages d'issue avec e mesurée et e théorique ; étiquette Kp dans toutes les phases ; mémoïsation ; titre « Huygens’s world » |
| `tests/ui/layout.test.ts` | 20 | 13 tailles d'écran : aucun panneau ne coupe la cage, la console ni le bonhomme, ni ne sort de l'écran ; cas particuliers ; même objet réécrit ; zone de clic de la console |
| `tests/ui/announce.test.ts` | 4 | annonces de chaque événement en FR et EN, saturation une seule fois, valeur de e |
| `tests/game/units.test.ts` | 16 | géométrie (quais, vide de 4 m, poutre 3,30 m, consigne 3 m) ; arrondi de Kp (10 cas) ; seuil noLift calculé ; victoire au 120e pas consécutif ; choc strictement au-dessus de 3,30 m, victoire au pas 1800 prioritaire, NaN ; `place` du bonhomme ; imports limités à `src/game` et `src/sim`, ni aléa, ni horloge, ni DOM |
| `tests/game/outcomes.test.ts` | 19 | issues de la spec §11 ; pas d'issue exacts ; borne haute 3800/3900 figée (D-11) ; balayage 0 → 8000 ; erreur finale à la victoire ≈ m·g/Kp (1e-3 m) ; marche de 0,327 m à 1500 N/m |
| `tests/game/state-machine.test.ts` | 15 | état initial ; marche bornée ; zone de la console ; `initialKp` ; bornes et arrondi de Kp ; verrouillage pendant le trajet, l'issue et la pause ; commandes sans objet ; pause sans pas ni saut de temps ; bonhomme à bord ; `restart` (second trajet identique bit à bit) ; état figé après l'issue |
| `tests/game/frames.test.ts` | 5 | même issue, même pas, même erreur, même trace pour 5 découpages en images (Kp ∈ {1500, 2500, 3800, 3900}) ; image de 0,5 s |
| `tests/game/events.test.ts` | 5 | chaque événement une seule fois ; première saturation unique ; pas de saturation à 1500 N/m ; `tuningClosed` ; débordement de la file ; événement ajouté pendant la visite |
| `tests/game/allocation.test.ts` | 2 | instantané unique sur 1000 images ; muter l'échantillon ou l'état du noyau ne change pas l'instantané |
| `tests/sim/clock.test.ts` | 12 | constantes ; nombre de pas pour des images de 1/30, 1/60, 1/144 s ; à-coup de 0,5 s plafonné à 8 pas ; durées négatives, nulles ou NaN ; `reset` ; pas de dérive sur 1 h en images de 1/144 s ; paramètres invalides |
| `tests/sim/integrators.test.ts` | 7 | RK4 sur ẋ = −x, x0 = 1, dt = 0,1 s, 10 pas : \|x − e⁻¹\| ≤ 1e-6 ; ordre 4 (erreur divisée par ≈ 16 quand dt est divisé par 2) ; commande constante pendant le pas ; aucune allocation ; mêmes bits sur deux exécutions ; `constrain` non appliqué ; dimensions invalides |
| `tests/sim/saturation.test.ts` | 7 | écrêtage à ±5000 N et drapeau ; ±Infinity ; NaN propagé avec drapeau faux ; bornes égales ou infinies ; bornes invalides |
| `tests/sim/signals.test.ts` | 8 | tampon préalloué de `capacity × 5` ; ordre chronologique ; écrasement du plus ancien ; aucune réallocation ; `clear` ; capacité 1 ; capacité invalide ; nom de signal inconnu (D-12) |
| `tests/sim/loop.test.ts` | 22 | contrôleur P ; paramètres de l'ascenseur ; dérivée ; contact sol ; cohérence de `LoopSample` ; aucune allocation sur 1000 pas ; `reset` ; t = k·dt ; boucle désactivée ; saturation négative ; modèle quelconque accepté ; consigne non finie (D-1) ; `MAX_SIM_DT` (D-2) ; état initial invalide (D-7) |
| `tests/sim/oracle.test.ts` | 20 | oracle analytique T1 à T5 ; taux de décroissance c/(2m) à 5 % (Kp ≤ 4000) ; σ à Kp = 8000 contre la valeur exacte de la boucle échantillonnée (D-4) |
| `tests/sim/exact.test.ts` | 13 | trajectoire complète contre la solution exacte (D-6) ; propriétés de Φ et Γ ; ordre 4 ; Euler, RK2 et RK3 échouent |
| `tests/sim/reference.test.ts` | 5 | valeurs de référence de jeu (saturation ±5000 N) pour 4 Kp |
| `tests/sim/determinism.test.ts` | 4 | déterminisme (a), (b), (c) et trace non triviale |
| `tests/i18n/catalogs.test.ts` | 24 | structure des JSON ; convention de clés ; parité FR/EN ; paramètres identiques ; `MESSAGE_PARAMS` exact ; clés de la spec §6 ; nombres physiques cités ; typographie ; `isLocale`, `otherLocale`, `isMessageKey`, `matchLocale` |
| `tests/i18n/detect.test.ts` | 7 | priorité de `?lang=`, casse, région, valeur inconnue, paramètre répété, langues du navigateur, repli sur l'anglais |
| `tests/i18n/format.test.ts` | 13 | virgule ou point décimal ; arrondi ; décimales imposées ; groupement à 5 chiffres ; signe ; zéro négatif ; valeur non finie ; options invalides ; cache ; unités et `%` |
| `tests/i18n/interpolate.test.ts` | 11 | remplacement ; pas de double substitution ; paramètre manquant, hérité, en trop, non textuel ; accolades littérales ; gabarit mal formé ; `I18nError` ; `parseTemplate` |
| `tests/i18n/translator.test.ts` | 15 | traduction de chaque clé dans chaque langue ; erreurs ; catalogues injectés ; abonnés (notification, désabonnement, doublon, erreur groupée) ; formatage selon la langue |

Sous-totaux : `tests/sim/` 98 tests (9 fichiers), `tests/i18n/` 70 tests (5 fichiers), `tests/game/` 62 tests (6 fichiers), `tests/render/` 118 tests (9 fichiers), `tests/ui/` 77 tests (4 fichiers), test fumée 1.

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

- Kp ∈ {500, 1500, 2500, 3800, 3900, 8000}, 1200 pas, à **chaque** pas, sur y et sur ẏ.
- Tolérances : 5e-7 m sur y, 5e-6 m/s sur ẏ.
- Écarts mesurés : max 1,420e-7 m sur y et 2,311e-6 m/s sur ẏ (Kp = 8000).
- Ordre : à Kp = 2500, l'écart est divisé par 16,45 quand dt est divisé par 2.
- Mutants internes au test : Euler (écart sur y ≥ 3,7e-3 m), RK2 point milieu (≥ 8,5e-5 m) et RK3 de Kutta (≥ 1,4e-6 m) dépassent les tolérances pour chaque Kp.

## Valeurs de référence de jeu (`tests/sim/reference.test.ts`)

Quatre trajectoires de la configuration de jeu (saturation ±5000 N), comparées à des valeurs à 6 décimales : y aux pas 60, 120, 240, 600, y_max et nombre de pas saturés. Tolérance 1e-6 m. Écart mesuré : ≤ 4,80e-7 m (Kp = 3500). Tableau : [physique/ascenseur.md](physique/ascenseur.md#configuration-de-jeu-saturation-5000-n).

Ces valeurs viennent du même algorithme (script du concepteur). T-005 les a comparées à l'oracle exact : écart ≤ 5,6e-7 m. Elles sont donc justes, mais la marge sous la tolérance n'est que de 4,4e-7 m, dominée par l'arrondi à 6 décimales (errata n° 4).

## Déterminisme (`tests/sim/determinism.test.ts`)

Boucle de jeu Kp = 2500 N/m, 1800 pas. Trace = 4 valeurs par pas : y et ẏ après le pas, uCmd, uSat.

- (a) deux exécutions : traces identiques bit à bit (−0 et +0 distingués) ;
- (b) pilotage par l'horloge en images de 1/60 s puis de 1/144 s : mêmes états aux mêmes k ;
- (c) empreinte SHA-256 figée : `5f85e15aa78afeeb834bf30e651b062be643a3e763b2821d7d534bcbbb38a821` ;
- la trace n'est pas triviale : la cabine bouge et la saturation agit.

Détails : [simulation.md](simulation.md#déterminisme).

## Couverture

```sh
npm run test:cov
```

Périmètre : `src/sim/**/*.ts` seulement. Seuils (`vitest.config.ts`) : 95 % des lignes et 90 % des branches ; en dessous, la commande échoue. `src/i18n` n'est pas mesuré ; `src/game` ne l'est pas par ce script (voir plus bas).

Résultat au commit `566a8a3` (code de sortie 0) :

| Périmètre | Instructions | Branches | Fonctions | Lignes |
|---|---|---|---|---|
| `src/sim` (tous fichiers) | 100 % | 100 % | 100 % | 100 % |

`index.ts` et `types.ts` apparaissent à 0 % dans le détail : ils ne contiennent que des réexportations et des types, sans code exécuté. Ils ne font pas baisser le total.

### Couverture de `src/game`

`npm run test:cov` ne mesure pas `src/game`. Pour la mesurer, remplacer le périmètre en ligne de commande :

```sh
npx vitest run --coverage --coverage.include='src/game/**/*.ts'
```

Résultat au commit `566a8a3` (code de sortie 0) : 100 % des instructions, branches, fonctions et lignes pour `constants.ts`, `events.ts`, `kp.ts`, `level.ts`, `outcome.ts` et `walker.ts` ; `index.ts` à 0 % (réexportations seules). Les seuils de `vitest.config.ts` s'appliquent alors à `src/game`. Le log T-007 consigne aussi 100 %.

### Couverture de `src/render` et `src/ui`

Mesure faite par le rédacteur sur l'extraction de `566a8a3`, seuils désactivés :

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

Ajoutés par T-007 : 62 tests en 6 fichiers. Ils jouent le niveau par son API publique, comme le fera l'interface : marche jusqu'à la console, réglage de Kp, lancement, images successives jusqu'à l'issue (`tests/game/helpers.ts`, fonction `runTrip`). Règles et tableau des issues : [jeu.md](jeu.md#règles-dissue).

| Vérification | Valeur attendue | Fichier |
|---|---|---|
| issues de la spec §11 | 150 → `noLift`, 1500 → `step`, 2500 → `win`, 3500 → `win`, 4500 → `bonk` | `outcomes.test.ts` |
| pas d'issue exacts | 2500 → 291, 3500 → 278, 3800 → 273, 3900 → 63, 4500 → 58, 150 et 1500 → 1800 | `outcomes.test.ts` |
| balayage 0 → 8000 par 100 N/m | `0-100:noLift \| 200-1900:step \| 2000-3800:win \| 3900-8000:bonk` | `outcomes.test.ts` |
| erreur finale à la victoire | \|finalError − m·g/Kp\| ≤ 1e-3 m pour 2000, 2500, 3000, 3800 N/m | `outcomes.test.ts` |
| indépendance à la cadence d'images | bit à bit identique pour 1/30, 1/60, 1/144 s et deux découpages irréguliers (générateur mulberry32 à graine fixe) | `frames.test.ts` |
| `restart` | état du réglage restauré ; second trajet identique bit à bit | `state-machine.test.ts` |
| allocation | même objet instantané sur 1000 images, dans toutes les phases | `allocation.test.ts` |

La spec T-001 §11 demandait « victoire de Kp = 2500 au pas 291 ± 1 » ; le test exige 291 exactement. La recommandation D-11 de T-005 (figer 3800 et 3900 N/m) est appliquée.

## Validation indépendante MATLAB (T-005)

Un validateur qui n'avait pas écrit le code a recalculé le comportement du noyau avec un oracle **exact** (exponentielle de matrice, sans RK4), écrit en MATLAB. MATLAB sert seulement à la validation : rien n'est importé par le site ([ADR-006](decisions/ADR-006-oracle-matlab.md)).

- Rapport complet : [validation/T-005-noyau.md](validation/T-005-noyau.md).
- Scripts, données et mode d'emploi : [validation/README.md](../validation/README.md).

Relancer (MATLAB R2025a, sans toolbox), depuis la racine du dépôt :

```matlab
run('validation/matlab/t005_run_all.m')
```

La dernière ligne affichée doit être `T005 : FIN SANS ERREUR`. L'orchestrateur l'a relancé pendant la validation de T-005 et a retrouvé les mêmes chiffres (log T-005). Pour régénérer les CSV du code TypeScript, suivre la procédure du `validation/README.md` (test Vitest temporaire, à supprimer après usage).

Résultats principaux :

| Point | Résultat |
|---|---|
| écart RK4 / exact sur y, 12 Kp | ≤ 1,42e-7 m ; rapport ≈ 16,5 quand dt est divisé par 2 |
| formules du régime linéaire (boucle continue, `ode45`) | retrouvées à 1e-9 près |
| Kp critique à dt = 1/120 s | 97 079 N/m (trois méthodes) |
| fenêtre de jeu [2000 ; 3800] N/m | confirmée ; 0 désaccord TS/oracle sur 80 Kp |
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

Fichiers : `tests/e2e/render.spec.ts`, `level.spec.ts`, `ui.spec.ts` (outils : `console.ts`, `overlay.ts`, `png.ts`). Configuration : `playwright.config.ts`. Chromium seul, contre le **build de production** servi par `vite preview` sur `http://127.0.0.1:4173/pid-game/`, un test à la fois, aucune nouvelle tentative. Options de Chromium : `--use-angle=swiftshader` (rendu WebGL logiciel, sans GPU réel), `--enable-unsafe-swiftshader`, `--ignore-gpu-blocklist`.

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

**La VM des agents ne peut pas télécharger de navigateur** (403 « Connection blocked by network allowlist », log T-008). Les tests e2e sont donc exécutés par l'orchestrateur, dans son environnement, sur une copie du dépôt, avec la seconde commande : Google Chrome for Testing 153, headless, rendu logiciel SwiftShader, WebGL2 ([ADR-012](decisions/ADR-012-tests-navigateur.md)). Résultat consigné au commit `566a8a3` : **28 tests verts en 1,7 min** (log T-010). Le rédacteur n'a pas pu les exécuter ; il a seulement listé les tests.

### Inventaire

Sortie de `npx playwright test --list` au commit `566a8a3` : « Total: 28 tests in 3 files ».

| Fichier | Tests | Ce qu'ils vérifient |
|---|---|---|
| `render.spec.ts` | 10 | WebGL2 imposé : démarrage sans erreur console, papier dessiné, **4 appels de dessin**, triangles entre 1 000 et 30 000 ; portrait 390 × 844 : papier aligné sans déformation, lignes de mètre de même teinte ; uniformité des lignes de mètre à 1280 × 720, 1281 × 721 et 390 × 844 ; redimensionnement 1280 × 720 → 800 × 900 ; page de repli `?renderer=none` en FR et en EN ; mode automatique : backend constaté, sans exception |
| `level.spec.ts` | 6 | (a) bonhomme dessiné à l'état initial ; (b, c, d) console, trajet à 2500 N/m, victoire au pas 291 ; (e) 4500 N/m : choc au pas 58 ; (f, g) 1500 N/m : marche trop haute au pas 1800, courbe dans sa zone, budget ; (h) `window.__huygens` absent sans `?e2e=1` ; (i) portrait : victoire dessinée |
| `ui.spec.ts` | 12 | (a) partie complète au clavier réel en français (aide, marche, panneau, + × 15, Entrée, victoire, R) ; (b) en anglais, 4500 N/m (Page préc. × 3, + × 5), choc ; (c) bascule de langue pendant le réglage ; (d) accessibilité FR et EN ; (e) aucune touche ne fait défiler la page ; (f) perte de focus pendant un trajet : pause ; (f bis) en approche : arrêt sans pause ; (g) invite de rotation en portrait ; (h) police manuscrite servie depuis `/pid-game/fonts/` ; (i) aucun panneau ne recouvre la cage, la console ni le bonhomme, à 1280 × 720 et 390 × 844 |

Chaque test surveille la console du navigateur : toute erreur ou tout avertissement non listé fait échouer le test. Messages tolérés, avec leur raison dans `render.spec.ts` : « GL Driver Message … GPU stall due to ReadPixels » (SwiftShader) ; en mode automatique, « No available adapters. » et l'avertissement de three « WebGPU is not available, running under WebGL2 backend. ».

Le crochet `?e2e=1` (voir [architecture.md](architecture.md#ce-que-fait-srcmaints)) rend les scénarios déterministes : le temps n'avance que par `advance(secondes)`, par images fixes de 1/60 s.

### Tests de pixels

Plusieurs tests décodent la capture d'écran (`tests/e2e/png.ts`) et comptent des pixels :

- **présence** : pixels de graphite dans la boîte du bonhomme, et aucun dans une boîte témoin 2 m plus à droite (papier vierge) ;
- **position** : points de la courbe y(t) aux coordonnées attendues ; aucune trace de courbe hors de sa zone ;
- **aspect du papier** : teinte des lignes de mètre identique le long d'une ligne et d'une ligne à l'autre, et comparaison à la capture de référence de T-008.

Les tests d'aspect ont été ajoutés après l'incident de T-009b : les tests de position passaient alors que le papier était visiblement dégradé (voir [rendu.md](rendu.md#papier-millimétré)). Les tests produisent aussi les captures de `docs/img/`, que l'orchestrateur regarde à chaque exécution (leçon L9).

### Limites

- **WebGPU réel n'est exercé par aucun test** : en headless, aucun adaptateur n'est trouvé et three passe sur WebGL2. Le 2026-11-13, l'utilisateur a constaté sur son PC Windows que « tout fonctionne », sans relever le backend (D16).
- Rendu logiciel SwiftShader, pas un vrai GPU ; Chromium seul (ni Firefox ni Safari).
- Commandes tactiles non testées sur un écran tactile ; contrastes non mesurés ; mouvement réduit non testé en e2e.
- « Aucune allocation par image » : établi par construction et par l'identité des tableaux, sans mesure du tas.

## Prévu

### Intégration continue — Prévu (T-011)

Node 22, `npm ci`, `npm run check`, `npm run e2e`. Il faudra un Chromium dans l'environnement de CI.
