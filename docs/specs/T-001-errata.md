# Errata de la spécification T-001

À quoi sert cette page : lister les points de la [spécification T-001](T-001-tranche-verticale.md) que les tâches T-004, T-005, T-004b, T-006, T-008, T-009 et T-010 ont corrigés ou précisés. La spec elle-même n'est pas modifiée. Quand la spec et le code divergent, le code fait foi.

Chaque point donne : ce que dit la spec, ce qui est vrai (points 1 à 10 : commit `c00e678` ; points 11 à 18 : commit `566a8a3` ; point 19 : commit `119519b`), et la source.

## 1. Instant du pic à dt = 1/120 s (coquille)

- **Spec §5** (ligne « Mesuré (dt = 1/120) ») : « tp_sim = 0,538 s vs 0,5388 s (T4) ».
- **Vrai** : 0,538 s est la valeur mesurée à **dt = 1/1000 s** (test T4). À dt = 1/120 s, le pic tombe à **0,5333 s** (64 pas × 1/120 s). Valeur continue : 0,5388 s.
- **Sources** : log T-004 ; rapport T-005 §C et défaut D-5 ; sortie de `tests/sim/oracle.test.ts` (« T3 Kp=2500 … tp_sim=0.5333 s », « T4 … tp_sim=0.5380 s »).

## 2. Effet du bloqueur d'ordre zéro « ≤ 2,5 points »

- **Spec §5** (T3) : « Mp_ana ≤ Mp_sim ≤ Mp_ana + 2,5 points (le bloqueur d'ordre zéro réduit l'amortissement effectif) », présenté sans limite de Kp.
- **Vrai** : l'écart ne reste ≤ 2,5 points que jusqu'à **Kp ≈ 5500 N/m** (+2,449 points). Il vaut +2,682 points à 6000 N/m et **+3,551 points à 8000 N/m**, maximum du curseur. Le test T3 n'est exact que parce qu'il s'arrête à Kp = 4000 (+1,756 point).
- **Sources** : rapport T-005 §C et défaut D-3 ; recalcul du rédacteur (boucle échantillonnée exacte). Tableau : [physique/ascenseur.md](../physique/ascenseur.md#effet-du-bloqueur-dordre-zéro).

## 3. Taux de décroissance « indépendant de Kp »

- **Spec §5** : « Taux de décroissance ζ·ωn = c/(2m) = 4 s⁻¹ indépendant de Kp ».
- **Vrai** : exact pour la boucle **continue**. La boucle simulée est échantillonnée : son taux réel σ = −ln(ρ)/dt **baisse** quand Kp augmente : 3,957 s⁻¹ à 1000 N/m (−1,1 %), 3,838 s⁻¹ à 3800 (−4,0 %), **3,660 s⁻¹ à 8000 (−8,5 %)**. Le message pédagogique reste vrai : Kp n'accélère pas la stabilisation. Le test « σ = c/(2m) à 5 % près » n'est valable que pour Kp ≤ 4000 N/m ; T-004b a ajouté un test à 8000 N/m contre la valeur exacte de la boucle échantillonnée (écart mesuré 0,013 %).
- **Sources** : rapport T-005 §D et défaut D-4 ; log T-004b ; `tests/sim/oracle.test.ts`.

## 4. Marge des valeurs de référence de jeu

- **Spec §5** : tableau des valeurs de référence à 6 décimales, tolérance 1e-6 m, « même algorithme ».
- **Vrai** : les valeurs sont **justes**, pas seulement reproductibles : écart à l'oracle exact ≤ 5,6e-7 m (T-005). Mais la marge sous la tolérance n'est que de 4,4e-7 m, dominée par l'arrondi à 6 décimales. Écart actuel du code aux valeurs : ≤ 4,80e-7 m. La recommandation de T-005 (9 décimales, tolérance 2e-7 m) n'a pas été appliquée : `tests/sim/reference.test.ts` est inchangé depuis T-004 (log T-004b).
- **Sources** : rapport T-005 §A–B et défaut D-10 ; sortie de `tests/sim/reference.test.ts`.

## 5. Textes clés du niveau (§6) enrichis par T-006

- **Spec §6** : textes courts, par exemple `level1.fail.noLift` : « Kp × 3 m ne compense pas le poids (490 N). Augmente Kp. »
- **Vrai** : les sept clés de §6 existent, mais leurs textes ont été enrichis. Ils donnent le poids exact (**490,5 N** = 50 kg × 9,81 m/s², et non 490 N) et expliquent le mécanisme physique de chaque échec :

| Clé | Ajout par rapport à la spec |
|---|---|
| `level1.kp.help` | exemple chiffré (Kp = 1000 N/m, 2 m d'écart → 2000 N) |
| `level1.fail.noLift` | poids exact 490,5 N ; écart maximal de 3 m au départ |
| `level1.fail.step` | tolérance de marche 0,25 m ; formule e = m·g/Kp ; garde le paramètre `{e}` |
| `level1.fail.bonk` | poutre à 3,30 m ; mot « dépassement » |
| `level1.saturation` | « c'est la saturation » |
| `level1.win` | raison physique : le moteur a besoin d'une erreur pour porter le poids |
| `level1.goal` | inchangé (typographie seulement) |

- **Sources** : log T-006 (« textes de la spec §6 enrichis ») ; `src/i18n/locales/fr.json` et `en.json` ; test « les nombres physiques cités sont ceux de la spec §5 ».

## 6. Interfaces du noyau étendues

- **Spec §4** : interfaces `PlantModel`, `Controller`, `Saturation`, `Integrator`, `LoopSample`, `ClosedLoopConfig`, `ClosedLoop`, `FixedStepClock`, `SignalRecorder`.
- **Vrai** : ces interfaces existent telles quelles dans `src/sim/types.ts`. Les fabriques renvoient des types étendus :

| Type étendu | Ajout | Tâche |
|---|---|---|
| `ResettableFixedStepClock` | `reset()` | T-003 |
| `CircularSignalRecorder` | `buffer` (lecture), `clear()` | T-003 |
| `SteppableClosedLoop` | `k`, `dt`, `x` (lecture) | T-004 |
| `ProportionalController` | `kp` (lecture) | T-004 |
| `SignalName` | type nommé pour `'r' \| 'y' \| 'e' \| 'uSat'` | T-003 |

S'y ajoutent les constantes et fabriques de l'ascenseur (`ELEVATOR_*`, `createElevator`, `createElevatorLoop`) et `SIGNAL_STRIDE`. Liste complète : [simulation.md](../simulation.md#exports-de-srcsimindexts).

- **Sources** : logs T-003 et T-004 ; `src/sim/index.ts`.

## 7. Pas maximal `MAX_SIM_DT`

- **Spec §4** : une seule constante de pas, `SIM_DT = 1/120 s`. Aucun pas maximal.
- **Vrai** : `MAX_SIM_DT = 1/30 s`. `createClosedLoop` (donc `createElevatorLoop`) lève `RangeError` si dt n'est pas dans ]0, 1/30]. Raison : à dt = 1 s, RK4 divergeait sans erreur (y = 3,7e20 m en 10 pas). À 1/30 s, la marge de gain reste 3,14 à Kp = 8000 N/m. L'horloge, elle, n'est pas bornée en dt.
- **Sources** : rapport T-005 défaut D-2 ; log T-004b ; `src/sim/clock.ts`. Détails : [simulation.md](../simulation.md#borne-max_sim_dt--130-s).

## 8. Erreurs levées

- **Spec §4–§5** : aucune règle sur les entrées invalides.
- **Vrai** : le code lève `RangeError` dans ces cas :

| Fonction | Cas refusé | Tâche |
|---|---|---|
| `createFixedStepClock` | dt non fini ou ≤ 0 ; plafond de pas non entier ou < 1 | T-003 |
| `createRk4`, `Integrator.step` | dimension non entière ou < 1 ; dimension de x ou du modèle différente | T-003 |
| `createSaturation`, `saturate` | borne NaN ; min > max | T-003 |
| `createSignalRecorder` | capacité non entière ou < 1 | T-003 |
| `forEach` de l'enregistreur | nom de signal inconnu (D-12) | T-004b |
| `createProportionalController` | Kp NaN, infini ou négatif | T-004 |
| `createElevator` | masse non finie ou ≤ 0 ; g non finie ; c non fini ou < 0 | T-004 |
| `createElevatorLoop` | consigne non finie (D-1) | T-004b |
| `createClosedLoop` | dt hors de ]0, 1/30] (D-2) ; x0 de mauvaise dimension, non fini, ou sous le sol (D-7) | T-004b |
| `ClosedLoop.step` | consigne lue non finie (D-1), avant toute modification | T-004b |

- **Sources** : code de `src/sim/` ; rapport T-005 §F ; log T-004b.

## 9. Drapeau `saturated` quand la commande vaut NaN

- **Spec §4**, étape 3 : `saturated = uSat !== uCmd`.
- **Vrai** : `isSaturated(uCmd, uSat)` renvoie **faux** si uCmd est NaN (la formule littérale donnerait vrai). NaN est propagé dans uSat, jamais masqué par une borne. Choix accepté en T-003.
- **Sources** : log T-003 ; `src/sim/saturation.ts` ; `tests/sim/saturation.test.ts`.

## 10. Détection de la langue

- **Spec §8** : « langue initiale = `?lang=` puis `navigator.language` (préfixe `fr` → FR, sinon EN) ».
- **Vrai** : `detectLocale` parcourt toute la liste `navigator.languages` et retient la première langue prise en charge (`['de', 'fr']` → `fr`). La comparaison porte sur la sous-étiquette entière, pas sur un préfixe de caractères (`frr` n'est pas du français).
- **Sources** : `src/i18n/detect.ts`, `src/i18n/catalogs.ts` ; `tests/i18n/detect.test.ts`.

## 11. Cadrage : 17 × 7 m au lieu de « ~12 m × 6,75 m »

- **Spec §7** : « cadrage fixe sur le niveau (~12 m × 6,75 m) avec adaptation au ratio ».
- **Vrai** : la zone toujours visible fait **17 m × 7 m** : x ∈ [−6,5 ; 10,5] m, y ∈ [−1,5 ; 5,5] m. Le décor seul mesure 16 m (`LEVEL_MAX_X − LEVEL_MIN_X`), que 12 m ne contiennent pas. L'adaptation au ratio garde la même échelle en x et en y ; le surplus montre plus de papier.
- **Sources** : log T-008 ; `src/render/camera.ts` ; `tests/render/camera.test.ts`. Détails : [rendu.md](../rendu.md#cadrage--zone-de-17--7-m).

## 12. Vue de face, sans plongée 2,5D

- **Spec §7** : « vue légèrement plongeante (2,5D : profondeur 0,5 m pour cabine/quais) ».
- **Vrai** : la caméra orthographique regarde de face, sans plongée ni profondeur dessinée. Choix accepté en T-008 et T-009.
- **Sources** : logs T-008 et T-009 ; `src/render/stage.ts`.

## 13. Poutre en deux corbeaux

- **Spec §6** : « poutre crayonnée à 3,30 m au-dessus de la cabine ».
- **Vrai** : la poutre est dessinée en deux corbeaux hachurés de 0,42 m fixés aux montants de la cage, à 3,30 m. La règle de choc, elle, porte sur toute la largeur (`y > 3,30 m`, `src/game`).
- **Sources** : log T-009 ; `src/render/pencil-style.ts` (`BEAM_STUB_LENGTH`).

## 14. Échelle de temps de la courbe

- **Spec §7** : « axe t horizontal sur le mur de la cage (échelle 0,4 m/s) ».
- **Vrai** : échelle à deux régimes : 1,2 m/s tant que le trajet dure au plus 3 s, puis la courbe entière est resserrée pour tenir dans les 3,6 m du plancher (échelle = 3,6 / t_fin, soit 0,24 m/s à 15 s). À 0,4 m/s, 15 s demanderaient 6 m, plus que la cage (4 m).
- **Sources** : log T-009 ; `src/render/curve.ts` ; `tests/render/curve.test.ts`. Détails : [rendu.md](../rendu.md#courbe-yt).

## 15. E (Entrée, Espace) lance le trajet en phase de réglage

- **Spec §6** : « interagir `E`/`Entrée`/`Espace` » ; le lancement passe par le bouton « Lancer ».
- **Vrai** : en approche, ces touches utilisent la console ; en réglage, elles **lancent** le trajet. Aucune touche ne refermait le panneau sans lancer à `566a8a3` (l'API `interact()` du niveau le permettait, le clavier ne l'utilisait pas) ; depuis P-005 (K3, 2026-11-13), Échap ferme le panneau (intention `closeTuning`). Les boutons tactiles font 56 × 56 px (spec : au moins 44 × 44).
- **Sources** : log T-010 ; `src/ui/keys.ts` ; `tests/ui/keys.test.ts`. Table complète : [interface.md](../interface.md#touches).

## 16. Clés i18n ajoutées

- **Spec §8** : clés de §6 et principe des locales, sans liste des textes d'interface.
- **Vrai** : 111 clés par langue au commit `566a8a3` (89 en T-006, 22 ajoutées en T-010 : bandeau d'aide `hud.hint.*`, étiquette `hud.kp.value`, `hud.readout.label`, noms des touches `controls.key.*`, `controls.help.close`, `app.rotateHint`).
- **Sources** : `src/i18n/locales/fr.json` et `en.json` ; log T-010. Liste : [i18n-accessibilite.md](../i18n-accessibilite.md#clés-ajoutées-par-t-010).

## 17. Titre du jeu

- **Spec** : titre de travail « L'ascenseur proportionnel » pour la tranche verticale ; aucun titre de jeu fixé.
- **Vrai** : titre provisoire « Huygens’s world » (décision D15, hommage à Christiaan Huygens). Clé `app.title` identique en FR et en EN, titre de l'onglet et du README.
- **Sources** : registre (D15) ; `src/i18n/locales/*.json` ; `index.html`.

## 18. Accessibilité : invite d'orientation en portrait

- **Spec §8** : pas de cas particulier pour les petits écrans en portrait.
- **Vrai** : sous 700 px de large en portrait, une invite propose de tourner l'appareil (`app.rotateHint`) et l'interface passe en disposition « bandes ». La scène reste entière mais petite (17 m dans la largeur).
- **Sources** : logs T-009 et T-010 ; `src/ui/ui.css`, `src/ui/layout.ts`.

## 19. Valeurs de jeu du niveau 1 changées par T-020 (2026-11-13)

- **Spec §5 et §6** : poutre à 3,30 m, tolérance de marche 0,25 m, durée maximale 15 s (1800 pas), Kp au chargement 1000 N/m, fenêtre de réussite [2000 ; 3800] N/m ; vocabulaire « quai » dans les textes français.
- **Vrai depuis T-020** (décisions D24 et D25 de l'utilisateur) : poutre `BEAM_HEIGHT` = 3,3626 m, tolérance `STEP_TOLERANCE` = 0,5 m, `TRIP_MAX_STEPS` = 720 (6 s), `KP_DEFAULT` = 500 N/m, fenêtre [1000 ; 5000] N/m ; les textes français disent « plateau d'arrivée » (T-019) et citent 0,5 m et 3,36 m. Le cadrage ne suit plus la poutre : `PLAY_ZONE_TOP` = 5,5 m. Les points 13 (poutre « à 3,30 m ») et 14 (échelle « 0,24 m/s à 15 s ») ci-dessus décrivaient l'état d'avant : la poutre est à 3,3626 m et l'échelle vaut 0,6 m/s à 6 s. Le point 16 cite des clés dont la valeur a changé (`level1.fail.step`, `level1.fail.bonk`).
- **Sources** : `orchestration/logs/T-020.md` ; `src/game/constants.ts`, `src/render/camera.ts` ; [jeu.md](../jeu.md#règles-dissue), [physique/ascenseur.md](../physique/ascenseur.md#fenêtre-de-réussite-1000--5000-nm).

## 20. Durée et Kp par défaut changés par T-022 (2026-11-13)

- **Point 19 et spec §5** : durée maximale 720 pas (6 s) depuis T-020, Kp au chargement 500 N/m, échelle de la courbe 0,6 m/s à 6 s.
- **Vrai depuis T-022** (décisions D27 et D28 de l'utilisateur) : `TRIP_MAX_STEPS` = 1200 (10 s) pour les deux niveaux, `KP_DEFAULT` = 2000 N/m (dans la fenêtre : un lancement sans réglage gagne au pas 262) ; l'échelle de la courbe vaut 0,36 m/s à 10 s. La poutre (3,3626 m), la tolérance du niveau 1 (0,5 m) et la fenêtre [1000 ; 5000] N/m ne changent pas ; victoire la plus lente du niveau 1 au pas 301.
- **Sources** : `orchestration/logs/T-022.md` ; `src/game/constants.ts`, `src/render/curve.ts` ; [jeu.md](../jeu.md#règles-dissue).
