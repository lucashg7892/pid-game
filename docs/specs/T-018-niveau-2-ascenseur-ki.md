# T-018 — Spécification du niveau 2 « L'ascenseur à action intégrale » (gain Ki)

Statut : proposition du concepteur (2026-11-13), à valider par l'utilisateur. Aucune valeur de jeu n'est fixée ici : celles qui apparaissent sont marquées « proposition à valider » et reprises en §11.
Références : `orchestration/REGISTRE.md` (D8 progression, D9 Kp verrouillé, D20 niveau 2 avec Ki, D21 pas de niveau 0, D22 écran titre et menu), `docs/specs/T-001-tranche-verticale.md` (§4 à §6, §9), [ADR-003](../decisions/ADR-003-noyau-pur.md), [ADR-005](../decisions/ADR-005-rk4-bloqueur.md), [ADR-006](../decisions/ADR-006-oracle-matlab.md), [ADR-009](../decisions/ADR-009-machine-a-etats.md), `docs/validation/T-005-noyau.md`, `validation/README.md`, spec d'écran titre et de menu T-017 (écrite en parallèle, non lue ici).
Convention : « doit » = obligatoire et testé ; « devrait » = recommandé. « Calcul à la main, à confirmer par simulation » = raisonnement sur le modèle réel du code, non exécuté : aucun résultat de simulation n'est inventé dans ce document.

## 1. Objectifs et non-objectifs

Objectifs :
- O1. Un second niveau jouable : même ascenseur, même décor et même consigne que le niveau 1, avec un contrôleur **PI** `u = Kp·e + Ki·∫e dt` dont le joueur règle Ki (D20).
- O2. Faire *voir* deux phénomènes : (a) l'action intégrale annule l'erreur statique m·g/Kp, que le niveau 1 annonce (`level1.win`, `level1.teaser` dans `src/i18n/locales/fr.json` : « Adieu la marche ! ») ; (b) le **windup** : pendant la saturation du moteur, l'intégrale continue de s'accumuler, et cette charge excessive fait dépasser le quai, voire heurter la poutre.
- O3. Ne rien casser au niveau 1 : mêmes issues, mêmes pas d'issue, même empreinte SHA-256 de trace (`tests/sim/determinism.test.ts`, ligne 18).
- O4. Garder le niveau vérifiable : chaque affirmation physique est recoupée par l'oracle MATLAB étendu (§8) et par un test TypeScript à forme fermée.

Non-objectifs : terme D, étape « premier ordre » (reportée, D20), niveau 0 d'enseignement (D21), sauvegarde, sons, réglage de Ki pendant le trajet (verrouillé, comme Kp en D9 : issue reproductible), nouvelle dépendance (aucune ; pile figée, ADR-001), anti-windup dans le contrôleur (question Q2, non tranchée), instabilité due à l'échantillonnage (non montrable avec ces valeurs, voir T-005 §D).

## 2. Arborescence et règles de dépendances

Les règles de la spec T-001 §3 ne changent pas : `sim → ∅`, `game → sim`, `render → sim, game`, `ui → game, i18n`, `main → tout`. Fichiers ajoutés ou modifiés (noms proposés) :

```
src/sim/controllers/pi.ts       nouveau : contrôleur PI discret (§3)
src/sim/plants/elevator.ts      ajout de createElevatorPiLoop (createElevatorLoop inchangé)
src/sim/index.ts                exports du PI
src/game/elevator-level.ts      nouveau : machine à états du niveau, extraite de level.ts et paramétrée
src/game/level.ts               createLevel1 = mince enveloppe de la machine paramétrée (comportement identique)
src/game/level2.ts              nouveau : createLevel2 (config du niveau 2)
src/game/constants.ts           constantes du niveau 2 (valeurs à fixer, §5)
src/game/outcome.ts             tolérance paramétrable, issues de fin de temps du niveau 2
src/render/gauge.ts, level-painter.ts, pencil-style.ts   jauge de l'intégrale, bande de tolérance, annotations (§6)
src/ui/**, src/i18n/locales/{fr,en}.json                 panneau Ki, textes level2.*, annonces (§7)
validation/matlab/t018_*.m, validation/data/pi_*.csv     oracle MATLAB étendu (§8)
tests/sim/pi*.test.ts, tests/game/level2*.test.ts, tests/e2e/level2*.spec.ts
```

Décision de structure : on **extrait** la machine à états de `src/game/level.ts` dans un module paramétré plutôt que de la copier, car `level.ts` code en dur `LEVEL1_SETPOINT`, `createElevatorLoop({ kp })` et l'arbitre `createOutcomeJudge()` à tolérance fixe (`STEP_TOLERANCE`) ; une copie doublerait la machine à cinq phases (ADR-009). Le prix est une retouche d'un module validé : d'où le niveau N3 de la tâche et la barrière « niveau 1 identique bit à bit » (§9). Le niveau 1 garde ses noms publics (`createLevel1`, `Level1`).

Le futur menu de niveaux (T-017, D22) choisit la fabrique à appeler ; cette spec n'en dépend que par l'interface « une fabrique de niveau par identifiant » (§10, dépendances).

## 3. Noyau de simulation

### 3.1 Contrôleur PI discret

Le contrat `Controller` de `src/sim/types.ts` (`reset(): void` ; `update(r, y, dt): number`) suffit tel quel : le PI a besoin de `r − y` et de `dt`, que `update` reçoit déjà. `loop.ts` appelle `controller.reset()` dans `reset()` (ligne 108) et `controller.update(r, y, dt)` à l'étape 2. **Aucun changement de `Controller`, `ClosedLoop`, `LoopSample` ni `createClosedLoop`** (vérifié dans le code) ; le contrôleur P (`controllers/p.ts`) et `createElevatorLoop` restent intacts, donc le niveau 1 ne bouge pas.

```ts
export interface ProportionalIntegralController extends Controller {
  readonly kp: number;            // N/m, fini, >= 0
  readonly ki: number;            // N/(m·s), fini, >= 0
  readonly integral: number;      // état intégral I (N), lecture seule
  readonly proportionalTerm: number; // Kp·e du dernier appel (N)
}
export function createProportionalIntegralController(kp: number, ki: number): ProportionalIntegralController;
```

Lois (discrétisation « rectangle à gauche », ordre normatif **dans** `update`) :
1. `e = r − y` ;
2. `u = Kp·e + I` avec `I` = valeur **avant** mise à jour ;
3. `I ← I + Ki·dt·e` ;
4. retourne `u`.

Justification (choix technique tranché) : avec l'intégrale stockée en newtons et mise à jour après usage, la boucle fermée non saturée est un système linéaire discret exact à trois états `[y, ẏ, I]` (§8), ce qui donne un oracle exact sans approximation de l'intégrale. Stocker `I` en newtons (et non `∫e dt` en m·s) rend le terme I directement comparable à la jauge de force et au repère du poids m·g.

Ordre des opérations dans la boucle (inchangé, spec T-001 §4) : mesure → `uCmd = controller.update(...)` (le PI met à jour son intégrale ici) → `uSat = saturate(uCmd)` → RK4 à `uSat` constant → `constrain` → `k += 1`. Conséquence assumée : **l'intégrale est mise à jour à partir de `e`, jamais de `uSat`** ; c'est précisément ce qui produit le windup (§4.3). Le contrôleur ne voit pas la saturation.

Initialisation et remise à zéro : `I = 0` à la création ; `reset()` remet `I = 0` et `proportionalTerm = 0`. Le niveau appelle `loop.reset()` au lancement et à `restart()` (`clearTrip`, `level.ts`) ; la boucle n'est reconstruite que si le gain a changé (`kp !== loopKp`, `level.ts` ligne 392) : le niveau 2 **doit** reconstruire aussi quand Ki change. Quand `setEnabled(false)`, `update` n'est pas appelé (loop.ts ligne 120) : l'intégrale est gelée, non remise à zéro ; le niveau n'utilise pas cette fonction, à documenter.

Validation d'entrée : `RangeError` si Kp ou Ki n'est pas fini ou est négatif (comme `createProportionalController`). Pas de borne haute dans le noyau (cf. D-9 de T-005) ; la borne est celle du curseur.

Équivalence avec le P : à `Ki = 0`, `I` reste 0 et `u = Kp·e + 0` est identique bit à bit à `Kp·e` ; un test le fige.

Assemblage : `createElevatorPiLoop({ kp, ki, maxForce?, dt?, setpoint?, params? })` renvoie `SteppableClosedLoop & { readonly controller: ProportionalIntegralController }` (même assemblage que `createElevatorLoop`, saturation ±`ELEVATOR_MAX_FORCE` = 5000 N, RK4, x0 = 0). Le niveau lit `controller.integral` et `controller.proportionalTerm` après chaque pas pour l'instantané (§5.4). Le tampon circulaire `SignalRecorder` (noms `r`, `y`, `e`, `uSat`, `SIGNAL_STRIDE = 5`) **n'est pas modifié** : l'historique de l'intégrale, s'il est utile au rendu (Q6), est tenu par `game/` dans un tampon préalloué séparé.

### 3.2 Anti-windup : point d'accroche seulement

Le choix est ouvert (Q2). Quel que soit le choix, le contrat reste compatible : la variante « conditional integration » se code dans `update` si le contrôleur reçoit la saturation à la création (il peut alors prédire `uCmd` hors bornes sans connaître `uSat`) ; la variante « back-calculation » demanderait une méthode optionnelle `observe?(uCmd, uSat, dt)` appelée par la boucle après l'étape 3, ajout rétrocompatible. Le présent découpage n'implémente **aucune** des deux, sauf décision contraire (§10, T-018b-bis).

## 4. Modèle physique

### 4.1 Rappels (inchangés ; `src/sim/plants/elevator.ts`)

m = 50 kg, g = 9,81 m/s², c = 400 N·s/m, Umax = `ELEVATOR_MAX_FORCE` = 5000 N (saturation symétrique ±Umax), r = 3 m, poids m·g = 490,5 N, dt = 1/120 s (`SIM_DT`), état `x = [y, ẏ]`, contact sol `y ≥ 0`. Constantes dérivées : a = c/m = 8 s⁻¹ ; force nette maximale Umax − m·g = 4509,5 N ; accélération initiale à pleine force 90,19 m/s² ; vitesse limite à pleine force (Umax − m·g)/c = 11,274 m/s (calculs à la main, exacts à l'arrondi près).

### 4.2 Boucle PI non saturée

`m·ÿ + c·ẏ + m·g = Kp·(r − y) + I`, `İ = Ki·(r − y)`. Équilibre : `e = 0`, `I = m·g = 490,5 N` (le terme I porte seul le poids ; il remplace l'erreur statique m·g/Kp du niveau 1). Dynamique continue en `Δy = y − r` : polynôme caractéristique

  s³ + (c/m)·s² + (Kp/m)·s + Ki/m = s³ + 8·s² + (Kp/50)·s + Ki/50.

- Critère de Routh : stable ssi `(c/m)·(Kp/m) > Ki/m`, soit **Ki < c·Kp/m = 8·Kp** (à Kp = 2500 N/m : 20 000 N/(m·s)). Calcul à la main, à confirmer par simulation et par l'oracle (le bloqueur d'ordre zéro réduit un peu cette borne ; l'oracle la donne exactement, §8).
- Pôle lent pour Ki petit : `s ≈ −Ki/Kp` (constante de temps `τ = Kp/Ki` : 2,5 s pour Ki = 1000 à Kp = 2500). Calcul à la main, à confirmer par simulation.
- Unité : `[Ki] = N/(m·s)` ; `∫e dt` en m·s ; le produit est en N.

Discret (exact, §8) : avec `Φ`, `Γ` de la discrétisation par bloqueur d'ordre zéro de l'ascenseur (`validation/matlab/t005_zoh.m`, forme fermée dans `tests/sim/exact.test.ts`), l'écart à l'équilibre `ξ = [y − r, ẏ, I − m·g]` suit `ξ(k+1) = M·ξ(k)` avec

  M = [[1 − Γ₁·Kp, Φ₁₂, Γ₁], [−Γ₂·Kp, Φ₂₂, Γ₂], [−Ki·dt, 0, 1]]

(établi à la main depuis `Φ₁₁ = 1`, `Φ₂₁ = 0`, à confirmer par l'oracle).

### 4.3 Saturation et windup sur ce modèle

Fait établi (test e2e T-016, `tests/e2e/saturation.spec.ts`, et `docs/jeu.md`) : l'erreur initiale vaut 3 m, donc `Kp·3 > 5000 N` dès Kp > 1666,7 N/m : **tout Kp de la fenêtre de victoire du niveau 1 [2000 ; 3800] sature le moteur à 5000 N dès le premier pas** (`uSat = 5000`, 23 pas saturés à Kp = 2500, 15 à 2000, 32 à 3800). Avec un PI, l'intégrale s'accumule donc **dès le départ**, pendant que la force est écrêtée.

Phase saturée (force constante `F = Umax − m·g`, partant de y = ẏ = 0) : `ẏ(t) = (F/c)·(1 − e^{−a·t})`, `y(t) = (F/c)·(t − (1 − e^{−a·t})/a)`. L'intégrale discrète vaut `I_k = Ki·dt·Σ_{j<k} (r − y_j)`.

Calcul à la main, à confirmer par simulation, pour Kp = 2500 et Ki = 0 (ce qui fixe la fin de la saturation par `Kp·e = 5000`, soit y = 1 m) :

| Grandeur | Valeur | Remarque |
|---|---|---|
| temps pour atteindre 3 m à pleine force | ≈ 0,39 s | borne basse du temps de montée |
| fin de saturation t* (y = 1 m) | ≈ 0,185 s (≈ 22 pas) | cohérent avec les 23 pas saturés mesurés (`jeu.md`) |
| vitesse à t* | ≈ 8,7 m/s | la cabine arrive lancée |
| aire d'erreur A* = ∫₀^{t*} e dt | ≈ 0,49 m·s | donc `I(t*) ≈ 0,49·Ki` : ≈ 490 N pour Ki = 1000, soit **le poids m·g** |
| aire d'erreur A_c jusqu'au passage de r (≈ 0,45 s) | de l'ordre de 0,7 m·s (estimation grossière : A* + triangle d'environ 0,25) | à mesurer |

Mécanisme (ce que le niveau doit faire comprendre) : à t*, l'intégrale a déjà « appris » une grande partie du poids ; mais l'erreur est encore de ~2 m, donc `I` continue de monter jusqu'au passage de r (`I(t_c) ≈ Ki·A_c`). Une fois r franchie (e < 0), `I` ne redescend qu'à la vitesse `Ki·|e|` : l'excédent `ΔI = I(t_c) − m·g` pousse la cabine vers le haut tant qu'il n'est pas déchargé, soit un dépassement d'ordre `ΔI/Kp` qui se décharge avec la constante `Kp/Ki`. Ce dépassement s'ajoute à celui de l'élan (y_max = 3,116 m à Kp = 2500 au niveau 1, `T-001 §5`).

Ordres de grandeur, Kp = 2500, A_c ≈ 0,7 m·s (**calcul à la main, à confirmer par simulation**) :

| Ki (N/(m·s)) | I(t_c) ≈ Ki·A_c | excédent ΔI = I − m·g | dépassement statique ≈ ΔI/Kp |
|---|---|---|---|
| 1000 | ≈ 700 N | ≈ 210 N | ≈ 0,08 m |
| 2000 | ≈ 1400 N | ≈ 910 N | ≈ 0,36 m, au-delà des 0,30 m de marge sous la poutre |

Seuil de choc heuristique : `Ki_choc ≈ (m·g + Kp·(h_poutre − r − Δ_élan)) / A_c`, avec Δ_élan = 0,116 m (dépassement du P seul à Kp = 2500) : ≈ 1360 N/(m·s) ; sans l'élan : ≈ 1770. Formule additive, donc grossière : elle donne l'ordre de grandeur (le millier), pas la valeur. **Conclusion à confirmer** : la borne haute utile de Ki (≈ 10³) est environ **dix fois sous la limite de stabilité** (8·Kp = 20 000) : c'est le windup, pas l'instabilité, qui fait heurter la poutre. C'est le point pédagogique central du niveau.

Borne basse : pour Ki petit, après le passage de r l'erreur résiduelle est `≈ ((m·g − Ki·A_c)/Kp)·e^{−Ki·(t − t_c)/Kp}` (pôle lent). Elle entre dans la tolérance ε à `t ≈ t_c + (Kp/Ki)·ln((m·g − Ki·A_c)/(Kp·ε))`, puis il faut tenir 1 s avant `TRIP_MAX_STEPS`. Exemple (ε = 0,10 m, Kp = 2500, Ki = 100) : environ 13 s + 1 s de tenue, donc au bord des 15 s. Calcul à la main, à confirmer par simulation : la borne basse de Ki se situe de l'ordre de 10² N/(m·s).

Fenêtre de Ki **conjecturée** pour Kp = 2500 et ε = 0,10 m : de l'ordre de 10² à quelques 10³ N/(m·s), soit un rapport supérieur à 10. **Aucune de ces bornes n'est une valeur de jeu** : elles se mesurent (§8, §10 T-018d) puis se fixent (Q3).

## 5. Conception du niveau

### 5.1 Décor et déroulé

Même décor, même cabine, même consigne r = 3 m et même poutre (`BEAM_HEIGHT` = 3,30 m, à confirmer en Q3) que le niveau 1 : le joueur reconnaît le lieu, seul le contrôleur change. Déroulé : approche, console, **réglage de Ki** (panneau), lancement, trajet, issue, recommencer ; mêmes phases, même machine à états (ADR-009). Le titre et l'habillage narratif sont des décisions de lore (Q4).

### 5.2 Critère de réussite et d'échec

Réutilisé du niveau 1 (`src/game/outcome.ts`, `constants.ts`), sauf la tolérance :
- **Choc** : `y > BEAM_HEIGHT` ⇒ échec immédiat (comparaison stricte, état après le pas).
- **Victoire** : `WIN_HOLD_STEPS` = 120 pas consécutifs (1,0 s) avec `|r − y| ≤ ε₂` et `|ẏ| ≤ SETTLE_SPEED_TOLERANCE` (0,10 m/s), avant `TRIP_MAX_STEPS` = 1800 (15 s ; durée à confirmer, Q7). **ε₂ est une valeur de jeu : Q3.**
- **Fin de temps** : échec ; l'issue précise est choisie par `classifyTimeout2` (proposition à valider, Q5) :
  - `step` (déjà existant) si Ki = 0 : le joueur n'a pas utilisé l'intégrale ; message : l'erreur statique m·g/Kp reste, ajoute Ki ;
  - `slow` (nouveau) si Ki > 0 et l'erreur n'a jamais changé de signe : l'intégrale n'a pas fini de charger, Ki trop faible ;
  - `oscillation` (nouveau) si l'erreur a changé de signe au moins deux fois sans entrer dans la tolérance : Ki trop fort (ou windup lent à décharger) ;
  - `noLift` du niveau 1 n'est pas produit au niveau 2 si Ki > 0 (l'intégrale finit par soulever la cabine) ; à Ki = 0 et Kp ≤ 163,5 N/m il reste valide.

### 5.3 La tolérance d'arrivée doit être plus stricte que l'erreur statique (raisonnement)

Faits du code : la tolérance actuelle est `STEP_TOLERANCE` = 0,25 m (`src/game/constants.ts` ligne 28) ; l'erreur statique P est `e_ss = m·g/Kp` (`CABIN_WEIGHT / kp`, `LEVEL1_SETPOINT`), soit 0,196 m à 2500 N/m (`jeu.md` : `finalError` 0,196407 m à la victoire), 0,245 m à 2000 et 0,129 m à 3800. Le niveau 1 se gagne parce que `e_ss ≤ 0,25` dès Kp ≥ 1962 N/m.

Raisonnement : le niveau 2 ne force l'usage de Ki que si **aucun Kp gagnable en P seul ne passe la tolérance**. Il faut donc `ε₂ < min(m·g/Kp)` sur les Kp qui ne heurtent pas la poutre en P seul : le plus grand est 3800 (3900 heurte, `jeu.md`), d'où `ε₂ < 0,1291 m` (490,5/3800) si Kp est réglable ; et `ε₂ < 0,1962 m` si Kp est fixé à 2500. Au-dessus de ces bornes, le niveau 2 se gagnerait comme le niveau 1 en ignorant Ki. Contraintes opposées : (i) plus ε₂ est petit, plus la montée lente de l'intégrale (borne basse de Ki, §4.3) est longue et plus la fenêtre se resserre ; (ii) la bande ±ε₂ doit rester lisible sur le papier : à l'échelle du rendu (1 mm de papier = 0,1 m, `T-001 §7` ; environ 75 px/m à 1280 px de large pour 17 m, à confirmer), ε₂ = 0,10 m fait 1 mm de papier et ~7 px, ε₂ = 0,05 m fait 0,5 mm et ~4 px.

Candidats (propositions à valider, Q3) : ε₂ ∈ {0,15 ; 0,10 ; 0,05} m. Recommandation : 0,10 m (de l'ordre de la moitié de l'erreur statique à Kp = 2500, aligné sur le trait fin du papier), à fixer après mesure de la fenêtre résultante.

### 5.4 Instantané et événements

`LevelSnapshot` reçoit des champs ajoutés (le niveau 1 les renseigne : `ki = 0`, `iTerm = 0`, `pTerm = Kp·e`) : `ki` (N/(m·s)), `iTerm` (N), `pTerm` (N), `uCmd` (N, force demandée avant saturation), `tolerance` (m), `hasIntegral` (booléen lu par le rendu et l'interface). Mêmes règles qu'ADR-009 : objet unique réécrit, aucune allocation par image. Événements : ceux du niveau 1 ; `firstSaturation` reste émis une fois par trajet. Aucun nouvel événement n'est prévu (Q6 : annonce du windup).

## 6. Rendu

Principe : réutiliser le crayon, la courbe y(t), l'erreur hachurée et la jauge de force (`src/render/gauge.ts`, `level-painter.ts`) ; ajouter le strict nécessaire. Toute proposition de style est à valider (Q6).

1. **L'aire hachurée est l'intégrale.** Le peintre trace déjà l'erreur e entre la courbe y(t) et la consigne en pointillés (`paintError`, lot `error`) : c'est géométriquement `∫e dt` (à l'échelle de temps près). Le niveau 2 le dit : légende « aire hachurée = ce que l'intégrale a additionné », et les aires sous la consigne (e > 0, l'intégrale monte) et au-dessus (e < 0, elle redescend) devraient se distinguer par l'angle de hachure ou la densité, pour montrer la décharge du windup. Le comportement de `paintError` quand la courbe croise r (polygone auto-sécant) est à confirmer dans `level-painter.ts` avant de promettre ce rendu.
2. **Jauge de l'intégrale** (proposition, recommandée) : une seconde jauge, à l'échelle de la première (0 à 5000 N, repère du poids m·g `GAUGE_WEIGHT_Y` partagé), remplie à `|iTerm|`. Le joueur voit le terme I monter vers le repère du poids et s'y stabiliser en cas de réussite, ou le dépasser nettement en cas de windup. Style : hachures croisées (la jauge de force utilise deux angles `GAUGE_HATCH_ANGLE`), pour que P et I se distinguent sans la couleur. Si `iTerm < 0`, afficher l'intensité avec un signe moins.
3. **La force demandée.** Pendant la saturation, la jauge de force est pleine et rouge (existant) ; ajouter une **graduation pointillée « demande »** hors échelle (flèche vers le haut au-dessus de 5000 N) et le nombre dans les mesures (« Demande : 7 200 N · Moteur : 5 000 N », via `uCmd`). C'est l'écart entre demande et moteur qui fait voir le windup.
4. **Bande de tolérance** : deux traits fins en pointillés à r ± ε₂ au niveau du quai d'arrivée, étendus sur la courbe. Lisibilité d'un ε de 4 à 7 px : voir R2 et Q6 (loupe).
5. **Annotations d'issue** (crayon, à l'issue seulement) : en cas de choc ou de dépassement avec windup, flèche vers le sommet de la courbe + étiquette « l'intégrale a trop chargé » ; en cas de victoire, cote de l'erreur finale (existant, `paintDimension`) qui vaut ≈ 0 : le texte remplace la cote (« e ≈ 0 »).
6. **Échelle de temps de la courbe.** `curveTimeScale` : 1,2 m/s jusqu'à 3 s, puis resserrement `3,6/tEnd` (0,24 m/s à 15 s, `src/render/curve.ts`). Les trajets du niveau 2 durent plus longtemps que ceux du niveau 1 (2 à 3 s) : le dépassement, qui se joue dans la première seconde, serait comprimé en 0,24 m. **Risque R3, question Q8.**
7. Budget : une jauge de plus, une bande et des annotations restent très en deçà du budget (12 400 triangles préalloués sur 30 000 ; 7 appels de dessin au plus, `docs/rendu.md`) ; à vérifier par le test de budget existant. Le rendu du niveau 1 **ne doit pas changer** : sinon la tâche devient N3 (« retouche d'un rendu déjà approuvé ») ; la barrière est une comparaison de capture du niveau 1 avant/après.

## 7. i18n et accessibilité

- Nouvelles clés `level2.*` dans `fr.json` et `en.json`, mêmes clés (test de parité existant). Aucun texte en dur. Clés minimales : `level2.title`, `level2.goal`, `level2.ki.label`, `level2.ki.help`, `level2.ki.unit`, `level2.ki.field`, `level2.ki.valueText`, `level2.ki.range`, `level2.ki.locked`, `level2.failTitle.{step,slow,oscillation,bonk}`, `level2.fail.{step,slow,oscillation,bonk}`, `level2.saturation`, `level2.winTitle`, `level2.win`, `level2.legend.integral`, `level2.demand`, `level2.annotation.windup`, `level2.teaser`. Les textes sont une décision pédagogique ; projets de formulation (propositions à valider) :
  - `level2.ki.help` : « Ki : l'intégrale additionne l'erreur au fil du temps ; Ki (N par mètre-seconde) règle la vitesse à laquelle elle pousse. » / "Ki: the integral adds up the error over time; Ki (N per metre-second) sets how fast it pushes."
  - `level2.fail.step` (Ki = 0) : « Sans Ki, la cabine s'arrête toujours sous le quai (e = m·g/Kp). Ajoute de l'intégrale. »
  - `level2.fail.bonk` : « L'intégrale a continué d'additionner pendant que le moteur était à fond : elle est trop chargée et la cabine dépasse. Baisse Ki. » / "The integral kept adding up while the motor was maxed out: it is overloaded, so the lift overshoots. Lower Ki."
  - `level2.win` : « Pile au quai ! L'intégrale a fini par porter seule le poids (490,5 N) : plus de marche. »
- Annonces `aria-live` (existantes : lancement, première saturation, issue, recommencer) : `hud.status.launch` doit citer Ki ; la première saturation annonce une variante niveau 2 (« Moteur à fond (5000 N), et l'intégrale continue de monter ») ; l'issue annonce l'erreur finale. Aucune annonce par image (le terme I change à chaque pas).
- Clavier : le panneau Ki reprend les commandes de Kp (curseur natif, champ numérique, + et −, Page préc./Page suiv.) ; Échap ferme le panneau (D23) ; le bandeau d'aide (`hints.ts`) suit la phase. Valeurs du pas et de la plage : Q3.
- La bande de tolérance, la jauge I et la graduation « demande » se distinguent par le motif (pointillé, hachures croisées, flèche), jamais par la seule couleur rouge ; contrastes ≥ 4,5:1 pour les nombres DOM.
- Le canvas garde `role="img"` et un nom traduit ; la légende dépliée au premier trajet décrit les cinq tracés (consigne, hauteur, aire d'erreur, force, intégrale).

## 8. Oracle MATLAB étendu (ADR-006)

MATLAB sert à la validation seulement : rien n'est importé par le site, aucune toolbox, scripts dans `validation/matlab/`, données dans `validation/data/`. **Les tolérances du niveau 1 (T-005) ne sont pas touchées.**

**Ce qui se calcule exactement.** Le contrôleur est lui-même discret (une somme) : seule la cabine demande une discrétisation, que `t005_zoh.m` (expm de Van Loan, contrôlée par forme fermée à 2,7e-20) fournit sans RK4. Donc :
- **Oracle pas à pas exact** : étendre `t005_oracle.m` en `t018_pi_oracle.m` : `u = Kp·e + I`, saturation ±5000 N, `x ← Φ·x + Γ·(uSat − m·g)`, `I ← I + Ki·dt·e`, contrainte de sol, maximum exact de y entre deux pas (comme `t005_oracle.m`). Indépendant de RK4 et de la boucle TypeScript.
- **Raisonnement par morceaux** (contrôle croisé, `t018_phases.m`) : *phase saturée* à force constante : forme fermée de §4.3, donc `y_j` exact et `I_k = Ki·dt·Σ e_j` en somme finie ; pas de sortie `k*` = premier k avec `Kp·e_k + I_k < Umax` ; *phase linéaire* à trois états : `ξ(k) = M^(k−k*)·ξ(k*)` (§4.2), avec `eig(M)` pour les pôles, la constante de temps lente et la limite de stabilité ; vérifier aussi une éventuelle re-saturation (haute ou basse) en fin de phase linéaire, cas du windup fort.
- **Stabilité échantillonnée** (`t018_stability.m`) : `Ki_crit(Kp, dt)` par rayon spectral de `M` = 1 (`fzero`), croisé par Jury sur le polynôme cubique ; comparé à la limite continue `c·Kp/m = 8·Kp`.

**Grandeurs à comparer (TS contre oracle), à chaque pas sur [0 ; 1800]** pour une grille de couples (Kp, Ki) : `y`, `ẏ`, `I`, `uCmd`, `uSat`, drapeau `saturated`, nombre de pas saturés, pas de sortie de saturation `k*`, `I(k*)`, `y_max` et son pas, issue du niveau (règles §5.2) et pas de l'issue, rayon spectral `ρ(M)`. Tolérances **proposées, à valider par le validateur après mesure** (le P garde 1e-6 m sur y) : |Δy| ≤ 1e-6 m ; |ΔI| ≤ 1e-3 N ; k*, pas saturés, issue et pas d'issue : égalité exacte ; |ρ_TS − ρ_oracle| sans objet (l'oracle est la référence) ; marge au choc et à ε₂ rapportée comme au §E de T-005 (rapport marge/écart numérique). Si l'écart mesuré est plus grand, le validateur le consigne et la tolérance est une décision (N3).

**Recouper la fenêtre de Ki.** (1) Balayer Ki pour le ou les Kp du niveau (Kp fixé : Q1) avec le pas du curseur (Q3), évaluer l'issue sur l'oracle exact, puis sur le code TS ; exiger 0 désaccord sur l'issue et le pas d'issue (comme T-005 §E). (2) Donner les bornes continues (basse : temps limite et tolérance ; haute : choc poutre) et les marges en millimètres de part et d'autre des bornes de la fenêtre retenue, pour éviter une borne qui bascule pour une raison numérique (leçon D-11 de T-005). (3) Rapprocher la borne haute de `Ki_crit` pour **vérifier la conjecture** du §4.3 (windup, pas instabilité, limite Ki). Ces deux bornes sont les entrées de la décision Q3.

**Fichiers** : `validation/matlab/t018_params.m` (recopie des paramètres, jamais lus dans le TS), `t018_pi_oracle.m`, `t018_phases.m`, `t018_stability.m`, `t018_window.m`, `t018_run_all.m` (dernière ligne « T018 : FIN SANS ERREUR », comme `t005_run_all.m`) ; `validation/data/pi_traj_dt120.csv` (trajectoires TS de quelques couples, 17 chiffres, convention de `validation/README.md` : ligne k = état après k pas), `pi_sweep_summary.csv` (balayage Ki : issue, pas, y_max, I_max, pas saturés). Le README de `validation/` est complété par le rédacteur. Report en TypeScript : `tests/sim/pi-exact.test.ts` reprend la forme fermée (`Math.exp` permis dans les tests, comme `exact.test.ts`) et tourne dans `npm test` sans MATLAB. La CI ne lance pas MATLAB (ADR-006) ; la disponibilité de MATLAB pour l'exécution (poste de l'utilisateur ou de l'orchestrateur) est à confirmer, les agents n'y ont pas forcément accès.

## 9. Stratégie de test

Unitaires (Vitest, Node) :
- PI : `Ki = 0` ≡ P bit à bit (y, ẏ, uCmd, uSat sur 1800 pas, Kp ∈ {150, 1500, 2500, 4500}) ; intégrale après n pas à erreur constante = `Ki·dt·e·n` à l'arrondi ; `reset()` remet `I = 0` ; `RangeError` sur Kp, Ki non finis ou négatifs ; aucune allocation dans `update`.
- Windup : à saturation maintenue, `I` croît de façon monotone et reste égale à `Ki·dt·Σ e_j` ; `uCmd > uSat` pendant la saturation et `I` dépasse m·g si Ki est assez grand (valeurs fixées après mesure).
- Convergence : pour Ki dans la fenêtre, `e → 0` (|e| < 1e-6 m après un temps long, saturation active), `I → m·g` à 1e-3 N près (tolérances proposées).
- Oracle exact TS (§8) ; déterminisme : deux exécutions identiques bit à bit, découpage en images de 1/60 s et de 1/144 s identique, empreinte SHA-256 d'une trace PI figée dans le test (nouvelle constante ; l'empreinte du P, ligne 18 de `determinism.test.ts`, doit rester inchangée).
- Non-régression du niveau 1 : `tests/game/*` et `tests/sim/*` existants passent **sans modification** après l'extraction de la machine à états (c'est le critère d'acceptation de T-018a).
- Logique du niveau 2 : issues par Ki (balayage figé après mesure, y compris les couples limites), `slow` et `oscillation`, `reset` à égalité profonde, indépendance des images (5 découpages, `tests/game/frames.test.ts` comme modèle), reconstruction de la boucle quand Ki change.
- i18n : parité FR/EN ; test de budget de rendu existant.

e2e (Playwright, `?renderer=webgl&e2e=1`, crochet `window.__huygens` à étendre avec `setKi`) : (a) Ki = 0 ⇒ échec `step` avec le message dédié ; (b) Ki dans la fenêtre ⇒ victoire, message `aria-live` ; (c) Ki fort ⇒ choc poutre ; (d) capture du windup à t ≈ 0,2 s : jauge de force rouge, jauge I montante, graduation « demande » ; (e) capture de l'issue de choc avec annotation ; (f) nom accessible des nouveaux contrôles en FR et EN ; (g) le niveau 1 reste identique (capture avant/après comparée). Les e2e ne tournent pas dans la VM des agents : l'orchestrateur les lance (Chrome for Testing) et **regarde les captures** même quand les tests passent (règle du projet pour un rendu).

## 10. Découpage en tâches

Règle commune : chaque tâche N3 reçoit un validateur indépendant qui n'a pas vu la réalisation et un log `orchestration/logs/T-xxx.md` ; la doc (D-xxx, N1) passe après validation, sur un état figé.

| Tâche | Contenu | Niveau | Dépend de |
|---|---|---|---|
| T-018a | Extraction de la machine à états (`elevator-level.ts`), tolérance et issues paramétrables ; `createLevel1` inchangé en comportement | N3 | — |
| T-018b | Contrôleur PI, `createElevatorPiLoop`, tests unitaires, déterminisme, test d'oracle exact TS | N3 | — |
| T-018b-bis | (seulement si Q2 ≠ « montrer par l'échec ») anti-windup dans le contrôleur | N3 | T-018b |
| T-018c | Oracle MATLAB étendu (`t018_*.m`, CSV), rapport de validation | N3 | T-018b |
| T-018d | Mesure de la fenêtre de Ki par balayage (script jetable, non commité, ou test) ; **l'utilisateur fixe ε₂, la plage et le pas de Ki** (Q3) ; constantes de niveau 2, `createLevel2`, issues figées | N3 | T-018a, T-018b, T-018c |
| T-018e | Textes i18n FR/EN `level2.*` (après décisions Q4 et Q5) | N2 | T-018d |
| T-018f | Rendu : jauge I, graduation « demande », bande de tolérance, annotations, légende ; niveau 1 pixel-identique | N2 (N3 si le rendu du niveau 1 change) | T-018d |
| T-018g | Interface : panneau Ki, bandeau, annonces, `view-model`, crochet de test | N2 | T-018d, T-018e |
| T-018h | e2e, captures à regarder, intégration `main.ts` | N2 | T-018f, T-018g, T-017 |
| D-0xx | Doc : `docs/jeu.md`, `simulation.md`, `physique/ascenseur.md`, `rendu.md`, `interface.md`, `validation/README.md`, `tests.md`, ADR-015 (contrôleur PI et windup), entrée CHANGELOG | N1 | T-018h validée |

Ordre : (T-018a ∥ T-018b) → T-018c → T-018d → (T-018e, T-018f) → T-018g → T-018h → D-0xx. T-018a et T-018b touchent des fichiers disjoints et peuvent se faire en parallèle.

Dépendances avec T-017 (écran titre et menu, D22) : un menu de niveaux existera ; le niveau 2 s'y inscrit par une fabrique de niveau identifiée. T-018h ne peut s'intégrer qu'une fois l'inscription de niveaux de T-017 disponible. Le niveau 1 doit aussi proposer « niveau suivant » après sa victoire (aujourd'hui `level1.comingSoon` et `level1.replay`) : retouche de l'écran de victoire du niveau 1, à coordonner avec T-017 ; l'accès libre ou débloqué au niveau 2 est la question Q9 (une progression débloquée suppose une sauvegarde, hors périmètre de la v0.1).

## 11. Risques et questions ouvertes

Questions pour l'utilisateur (option recommandée en premier ; rien n'est tranché).

- **Q1. Kp fixé ou réglable au niveau 2 ?**
  Options : (A) Kp fixé, affiché non modifiable ; (B) Kp réglable avec Ki ; (C) Kp réglable, mais préréglé.
  Recommandation : **A**. Un seul bouton à comprendre (Ki), une fenêtre à une dimension, un oracle plus simple, et la fenêtre de victoire du niveau 1 garantit déjà un Kp qui sature au départ (donc du windup). Si Kp est fixé, **sa valeur est une décision de jeu** : proposition 2500 N/m, parce que c'est l'exemple du niveau 1 (e = 0,20 m à l'écran de victoire) et que `e_ss = 0,196 m` est assez grand pour exiger ε₂ < 0,196 m ; elle sature 23 pas et laisse une marge de 0,184 m sous la poutre en P seul. Alternatives : 2000 (erreur 0,245 m, plus de marge à la poutre mais montée plus lente) ou 3000. B oblige à une fenêtre à deux dimensions et à ε₂ < 0,129 m pour interdire la victoire en P seul.
- **Q2. Anti-windup : le montrer par l'échec, ou l'implémenter dans le contrôleur ?**
  Options : (A) pas d'anti-windup au niveau 2 : le joueur subit le windup, voit la jauge I déborder et la cabine dépasser, et apprend en baissant Ki ; (B) anti-windup actif dans le contrôleur (conditional integration ou back-calculation) : plus de windup à montrer, la fenêtre de Ki s'élargit, la leçon est donnée plus tard ; (C) un interrupteur « anti-windup » pour le joueur, à comparer avant/après.
  Recommandation : **A**, car D8 place « I (windup) » avant les suivants et car le niveau est conçu pour que le windup apparaisse dès le départ (§4.3) ; C est une bonne suite pédagogique mais double le travail (T-018b-bis, oracle à deux variantes, rendu). Le §3.2 laisse la porte ouverte sans changer l'interface.
- **Q3. Valeurs de jeu : tolérance d'arrivée ε₂, fenêtre de Ki, plage et pas du curseur, hauteur de poutre.**
  À fixer **après mesure** (T-018c puis T-018d), pas avant. Raisonnement fourni au §5.3 (ε₂ < e_ss) et au §4.3 (bornes conjecturées de Ki ≈ 10² à quelques 10³ N/(m·s) pour Kp = 2500, non mesurées). Options pour ε₂ : 0,15 ; 0,10 ; 0,05 m. Recommandation : ε₂ = 0,10 m, plage et pas de Ki choisis pour que la fenêtre mesurée couvre au moins 8 pas de curseur, poutre maintenue à 3,30 m (changer la poutre change la borne haute de Ki ; la garder fait un niveau 2 directement comparable au niveau 1).
- **Q4. Justification narrative d'une tolérance plus stricte que celle du niveau 1 (lore) et titre du niveau.**
  Options : (A) justification courte dans le texte et la bande dessinée, sans nouvel acteur (seuil de quai ajusté) ; (B) un objet qui impose la précision (chariot à petites roues, verrou de quai), à dessiner ; (C) aucune justification (« précision demandée »).
  Recommandation : **A** (coût minimal, aucun nouveau dessin). Le titre est libre.
- **Q5. Issues de fin de temps `slow` et `oscillation` : les distinguer ou garder `step` pour tout ?**
  Recommandation : les distinguer, car le message guide le joueur dans la bonne direction (monter ou baisser Ki) ; le critère proposé (§5.2) est volontairement simple et à valider (par exemple « au moins deux changements de signe de l'erreur »).
- **Q6. Façon de montrer le terme I.**
  Options : (A) seconde jauge à l'échelle de la première, repère m·g partagé, graduation « demande » et aire hachurée légendée (§6) ; (B) jauge de force empilée P + I (une seule jauge, deux hachures) ; (C) courbe I(t) supplémentaire sur le mur de la cage. Et : faut-il une **loupe** dessinée (petit encart zoomé autour de r) pour rendre lisible une bande de ±0,10 m (7 px) ?
  Recommandation : **A**, sans C (encombrement, historique à stocker) ; loupe seulement si les captures de T-018f montrent la bande illisible. Faut-il une annonce `aria-live` dédiée au windup (nouvel événement) ? Recommandation : non (variante de `firstSaturation` suffisante).
- **Q7. Durée maximale du trajet : garder 15 s (1800 pas) ?**
  Recommandation : garder 1800 pas par défaut et décider après mesure (T-018d) ; la borne basse de Ki en dépend directement.
- **Q8. Lisibilité de la courbe sur les trajets longs** (R3). Options : (A) garder les deux régimes de `curveTimeScale` ; (B) échelle de temps plus large ou défilante au niveau 2 ; (C) rejeu ralenti de la première seconde à l'issue. Recommandation : **A** d'abord, puis capture à regarder ; passer à B si le dépassement est illisible.
- **Q9. Accès au niveau 2 depuis le menu (T-017) : libre ou débloqué par la victoire au niveau 1 ?** Recommandation : libre (aucune sauvegarde à créer, hors périmètre), avec une mention « suite du niveau 1 ».
- **Q10. Ki verrouillé pendant le trajet.** Prolongement de D9 (Kp verrouillé) ; recommandation : verrouillé aussi, pour la même raison (issue reproductible) ; à confirmer puisque D9 ne cite que Kp.

Risques :
- R1. Niveau 1 cassé par l'extraction de la machine à états. Parade : T-018a sans changement de comportement, tests existants inchangés, empreinte SHA-256 et comparaison de capture.
- R2. Une bande de ±0,10 m (7 px) ou ±0,05 m (4 px) peut être illisible. Parade : captures à regarder, loupe (Q6).
- R3. La courbe resserrée écrase le dépassement (§6, point 6).
- R4. Fenêtre de Ki étroite ou à bord mince : une retouche de g, m, c, Umax, dt ou de la poutre peut faire basculer une borne (D-11 de T-005). Parade : marges consignées par T-018c, `t018_window.m` à relancer après toute retouche de la physique (ADR-006).
- R5. Conjectures du §4.3 (A_c ≈ 0,7 m·s, bornes de Ki) non mesurées : toute valeur de jeu en dépend ; elles sont à remplacer par les mesures de T-018c et T-018d.
- R6. L'accès aux fichiers de `docs/physique/` n'a pas été relu pour cette spec ; les constantes citées viennent du code (`src/sim`, `src/game`) et de `docs/jeu.md`, `docs/rendu.md`, `docs/interface.md`, `docs/validation/T-005-noyau.md`.

## Écarts à la réalisation

Section ajoutée par le rédacteur après la réalisation, sur l'état du commit `119519b` (2026-11-13). Le reste de cette spec, rédigé par le concepteur au commit `8091429`, n'est pas modifié ; quand la spec et le code divergent, le code fait foi. Sources : le code et les tests du commit `119519b`, les logs `orchestration/logs/T-020.md` et `T-021a.md`, `orchestration/DEFAUTS-CONNUS.md`. Aucun log de T-021b n'a été lu par le rédacteur ; les mesures du niveau 2 citées ci-dessous viennent du log T-021a ou d'un script jetable du rédacteur (images de 1/30 s).

### Décisions de l'utilisateur qui priment sur la spec

| Sujet (spec) | Décision retenue | Écart avec la spec |
|---|---|---|
| Q1 : Kp fixé ou réglable | Kp **fixé à 2500 N/m** (`LEVEL2_KP`) | conforme à la recommandation A et à la valeur proposée |
| Q3 : plage et pas de Ki | **mêmes bornes et même pas que Kp** : 0 à 8000 N/(m·s), pas de 100 (`KI_MIN`, `KI_MAX`, `KI_STEP`) | la spec laissait la plage à fixer après mesure |
| Q3 : valeur initiale | `KI_DEFAULT` = `KP_DEFAULT` = 500 | non prévu par la spec |
| Q3 : tolérance d'arrivée ε₂ | **`LEVEL2_ARRIVAL_TOLERANCE` = `STEP_TOLERANCE` = 0,5 m** (constante propre au niveau, égale à celle du niveau 1) | la spec recommandait 0,10 m et exigeait ε₂ < e_ss (0,196 m à Kp = 2500, §5.3) : **non respecté, d'où K32** |
| Q7 : durée du trajet | 720 pas (6 s), comme le niveau 1 après T-020 (décision D24) | la spec proposait de garder 1800 pas |
| Q3 : poutre | `BEAM_HEIGHT` = 3,3626 m, la poutre du niveau 1 réglée par T-020 | la spec proposait de garder 3,30 m ; la poutre du niveau 1 a changé avant la réalisation du niveau 2 |
| Q2 : anti-windup | **aucun** (option A : le windup se montre par l'échec) | conforme à la recommandation ; voir [ADR-016](../decisions/ADR-016-controleur-pi-sans-anti-windup.md) |
| §6, Q6 : jauge de l'intégrale, annotations, loupe, courbe I(t) | **reportées** (K30, K31) ; l'instantané expose déjà `iTerm` | le rendu du niveau 2 est celui du niveau 1 |
| §8 : oracle MATLAB étendu, `tests/sim/pi-exact.test.ts` | **reportés** (K28) ; le PI n'est validé que par tests unitaires et de déterminisme | la spec demandait T-018c |
| Q9 : accès au niveau 2 | libre depuis le menu, sans sauvegarde | conforme à la recommandation |

### Tâches réellement faites

| Tâche de la spec | Réalisée sous le nom | Commit | Remarques |
|---|---|---|---|
| T-018b (PI, `createElevatorPiLoop`, tests, déterminisme) | **T-021a** (N3, validateur indépendant, verdict « validé, sans réserve ») | `99324fd` | `src/sim/controllers/pi.ts` ; `tests/sim/pi.test.ts` (14), `pi-determinism.test.ts` (4) ; **pas** de test d'oracle exact |
| T-018a (extraction de la machine à états), T-018d (constantes, `createLevel2`), T-018e (textes), T-018g (interface), T-018h (e2e, intégration) | **T-021b** (classée N2 dans le message du commit ; la spec classait T-018a et T-018d en N3) | `119519b` | `src/game/elevator-level.ts`, `level.ts` (enveloppe), `level2.ts` ; clés `level2.*` ; panneau de réglage commun ; menu à deux entrées ; `tests/e2e/level2.spec.ts` (11) |
| T-018c (oracle MATLAB), T-018f (rendu : jauge I, bande, annotations) | **non réalisées** | — | K28, K30, K31 |

### Écarts de conception

- **Titre** : « Niveau 2 : la mémoire » (`level2.title`), pas « L'ascenseur à action intégrale ».
- **Issues** : `step` (« trop court »), `slow` (« trop lent »), `bonk` et `win`. Pas d'issue `oscillation`. Le classement de fin de temps est plus simple que celui du §5.2 : `classifyTimeout2` renvoie `step` si |r − y| > tolérance au dernier pas, sinon `slow`, sans regarder Ki ni les changements de signe de l'erreur ; `noLift` n'est jamais produit.
- **Instantané** : seuls `levelId`, `ki` et `iTerm` ont été ajoutés (le niveau 1 renseigne `ki = 0`, `iTerm = 0`) ; `pTerm`, `uCmd`, `tolerance` et `hasIntegral` du §5.4 n'existent pas. `LevelSnapshot` n'a pas de champ tolérance : l'arbitre la porte.
- **Réglage** : l'interface lit `level.tuning` (`TuningSpec` : `param`, `min`, `max`, `step`) et appelle `setTuning` et `adjustTuning` ; `createLevel1` garde `setKp` et `adjustKp`, `createLevel2` ajoute `setKi` et `adjustKi`.
- **Retour au menu** : pas de bouton « niveau suivant » à la victoire du niveau 1 (§10) ; `level1.comingSoon` dit « Le niveau 2 t’attend dans le menu : merci d’avoir joué ! » et le bouton « Menu » du panneau d'issue (T-017e) ramène au menu.

### Valeurs mesurées (Kp = 2500, poutre 3,3626 m, 720 pas)

- Avec la tolérance de 0,5 m : Ki gagnants [0 ; 800], chocs [900 ; 8000], **aucune** fin de temps ; Ki = 840 gagne (pic 3,362216 m, marge 0,384 mm), Ki = 850 heurte (pic 3,365122 m) (log T-021a, K29). Ki = 0 gagne (erreur finale 0,196407 m) ; `KI_DEFAULT` = 500 gagne (erreur finale 0,046204 m, script du rédacteur).
- Avec une tolérance de 0,10 m (information, non retenue) : fins de temps [0 ; 200], gagnants [300 ; 800], chocs [900 ; 8000], et Ki = 0 ne gagne pas (log T-021a). C'est le correctif proposé en K32.
- Pas saturés au départ : 23 à Ki = 0, 25 à Ki = 800, 26 à 1000, 36 à 4000 ; intégrale maximale 582,1 N (Ki 800), 724,8 N (1000), 2829,8 N (4000) ; I tend vers m·g = 490,5 N (log T-021a).
- Les conjectures du §4.3 se vérifient en ordre de grandeur seulement : le seuil de choc heuristique (≈ 1360 N/(m·s), ou 1770 sans l'élan) est supérieur d'environ 60 % à celui mesuré (entre 840 et 850) ; la limite de stabilité Ki < c·Kp/m (§4.2) et le pôle lent n'ont pas été vérifiés (pas d'oracle, K28).
- Ki = 0 identique au P bit à bit sur 1800 pas pour Kp ∈ {0, 150, 1000, 2500, 4500, 8000} ; empreinte SHA-256 du PI (Kp = 2500, Ki = 1000) : `0d9d331a5a4a9df28a188dd71b599a3559bd47ccc04f6d4ab78b7db5b725744b` ; empreinte du P inchangée (log T-021a).

Documentation correspondante : [jeu.md](../jeu.md#niveau-2--arbitre-et-fin-de-temps), [physique/ascenseur.md](../physique/ascenseur.md#niveau-2--contrôleur-pi), [simulation.md](../simulation.md#contrôleur-pi-t-021a), [interface.md](../interface.md#niveau-2--la-mémoire-t-021b), [ADR-016](../decisions/ADR-016-controleur-pi-sans-anti-windup.md).
