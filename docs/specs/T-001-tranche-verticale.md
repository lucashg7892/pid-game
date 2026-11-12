# T-001 — Spécification de la tranche verticale v0.1 « L'ascenseur proportionnel »

Statut : proposition du concepteur (2026-11-12), à valider par l'orchestrateur.
Références : `orchestration/REGISTRE.md`, décisions D1 à D8.
Convention : « doit » = obligatoire et testé ; « devrait » = recommandé.

## 1. Objectifs et non-objectifs

Objectifs v0.1 :
- O1. Un niveau jouable de bout en bout dans un navigateur récent : arrivée du bonhomme, réglage de Kp, lancement de l'ascenseur, réussite ou échec, recommencer, écran de fin.
- O2. Faire *voir* trois phénomènes sur le papier millimétré : erreur statique due à la gravité (Kp trop faible), dépassement/oscillation (Kp trop grand), saturation de l'actionneur.
- O3. Poser des fondations réutilisables : noyau de simulation pur et testé, i18n FR/EN, rendu crayon, pipeline CI + GitHub Pages.
- O4. Qualité vérifiable : chaque affirmation physique est couverte par un test contre un oracle analytique ou des valeurs de référence.

Non-objectifs v0.1 : termes I et D, autres niveaux, éditeur de niveau, sauvegarde, sons, réglage de Kp *pendant* le trajet (voir Q2), moteur physique générique, manette, prise en charge des navigateurs sans WebGL2.

## 2. Dépendances (versions vérifiées le 2026-11-12)

Toutes les versions ci-dessous ont été obtenues par `npm view <paquet> version` (ou la variante indiquée) exécutée le 2026-11-12 sur la VM de l'utilisateur (Node v22.23.4, npm 10.9.9, sortie de `node -v` / `npm -v`). Elles doivent être **épinglées exactement** (sans `^`) dans `package.json` et figées par `package-lock.json`.

| Paquet | Version | Rôle | Source |
|---|---|---|---|
| three | 0.187.0 | rendu | `npm view three version` |
| @types/three | 0.187.0 | types | `npm view @types/three version` |
| vite | 8.3.8 | dev/build | `npm view vite version` |
| typescript | **6.0.3** (pas 7.0.2) | typage | `npm view typescript version` → 7.0.2 ; `npm view typescript-eslint peerDependencies` → `typescript ">=4.8.4 <6.1.0"` ; `npm view typescript@6.0.3 version` → 6.0.3 |
| vitest | 5.1.0 | tests unitaires | `npm view vitest version` ; peer `vite ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` ; engines `node ^22.12.0 \|\| ^24 \|\| >=26` |
| @types/node | 26.6.6 | types Node pour tests | `npm view @types/node version` |
| eslint | 10.14.0 | lint | `npm view eslint version` |
| @eslint/js | 10.0.1 | règles de base | `npm view @eslint/js version` |
| typescript-eslint | 8.72.2 | lint TS | `npm view typescript-eslint version` ; peer `eslint ^8.57 \|\| ^9 \|\| ^10` |
| dependency-cruiser | 18.7.2 | règles d'architecture | `npm view dependency-cruiser version` ; engines `node ^22\|\|^24\|\|>=26` |
| @playwright/test | 1.65.0 | e2e | `npm view @playwright/test version` |
| prettier | 3.10.1 | formatage | `npm view prettier version` |

Choix TypeScript : la 7.0.2 est `latest`, mais typescript-eslint 8.72.2 exige `<6.1.0` ; on prend donc 6.0.3, dernière 6.x publiée (liste `npm view typescript versions`). Migration vers 7 = tâche ultérieure dès que typescript-eslint l'accepte.
Node requis : `>=22.12.0` (contrainte de vitest), déclaré dans `engines` et `.nvmrc` (`22`).

**WebGPURenderer dans three 0.187.0** (vérifié dans l'archive `npm pack three@0.187.0`, hors dépôt) :
- `package.json` → `exports["./webgpu"] = "./build/three.webgpu.js"` ; `src/Three.WebGPU.js` ligne 4 : `export { default as WebGPURenderer } ...`. Import : `import * as THREE from 'three/webgpu'` (puis `new THREE.WebGPURenderer(...)`), TSL via `'three/tsl'`. Ne **jamais** mélanger `'three'` et `'three/webgpu'` dans le même graphe (double instance de classes).
- Repli : `src/renderers/webgpu/WebGPURenderer.js` l. 57-71 : sans option, le backend WebGPU est tenté et `getFallback()` crée un `WebGLBackend` (WebGL2) avec l'avertissement « WebGPU is not available, running under WebGL2 backend. » ; l'option `forceWebGL: true` impose WebGL2.
- Initialisation asynchrone obligatoire : `await renderer.init()` avant tout `render()` (`src/renderers/common/Renderer.js` l. 899 et 1823).
- Détection du backend effectif : `renderer.backend.isWebGPUBackend` / `isWebGLBackend` (WebGPUBackend.js l. 92, WebGLBackend.js l. 61).
- Paramètre d'URL `?renderer=webgl` → `forceWebGL: true` (tests e2e, débogage).

## 3. Arborescence et règles de dépendances

```
.github/workflows/ci.yml      lint, typecheck, test, build, e2e ; deploy.yml → Pages
docs/                          voir §10
public/                        favicon, police (si Q4 validée)
src/
  sim/      noyau pur : clock, signals, integrators, controllers, plants, loop
  game/     logique de niveau : état, règles victoire/échec, bonhomme (cinématique simple)
  i18n/     chargeur + locales/fr.json, locales/en.json
  render/   three/webgpu : bootstrap, papier, crayon, courbes, caméra
  ui/       DOM accessible : panneau Kp, boutons tactiles, messages, aria-live
  main.ts   composition (seul endroit qui connaît tout)
tests/
  sim/ game/ i18n/   unitaires Vitest (Node)
  e2e/               Playwright
index.html, vite.config.ts, tsconfig.json, tsconfig.sim.json, eslint.config.js,
.dependency-cruiser.cjs, playwright.config.ts, package.json, .nvmrc
```

Règles (flèche = « peut importer ») : `sim → ∅` ; `i18n → ∅` ; `game → sim` ; `render → sim, game` (lecture seule de types/instantanés) ; `ui → game, i18n` ; `main → tout`. Interdits : tout import de `three` hors `render/` ; `sim` et `game` sans DOM.
Application automatique :
1. dependency-cruiser : règles `forbidden` (`sim-is-pure`, `game-no-render`, `three-only-in-render`, `no-circular`) ; `npm run lint:arch` = `depcruise src --config .dependency-cruiser.cjs`, code ≠ 0 si violation.
2. `tsconfig.sim.json` couvre `src/sim/**` et `src/game/**` avec `"lib": ["ES2023"]` sans `DOM` et `"types": []` : toute référence à `window`, `document`, `performance` y échoue au typecheck.
3. ESLint dans `src/sim/**` : `no-restricted-properties` sur `Math.random`, `Date.now`, et `no-restricted-globals` sur `Date`, `performance`.

## 4. Noyau de simulation (`src/sim`)

Unités SI partout (m, s, kg, N). Le temps de simulation est un entier de pas `k` ; `t = k·dt` est dérivé (jamais accumulé en flottant).

```ts
export interface PlantModel {                       // système continu dx/dt = f(x,u)
  readonly stateSize: number;
  derivative(x: Readonly<Float64Array>, u: number, out: Float64Array): void;
  output(x: Readonly<Float64Array>): number;         // grandeur mesurée y
  constrain(x: Float64Array): void;                 // contraintes (contact sol)
}
export interface Controller { reset(): void; update(r: number, y: number, dt: number): number; }
export interface Saturation { readonly min: number; readonly max: number; } // N
export interface Integrator {
  step(m: PlantModel, x: Float64Array, u: number, dt: number): void;   // sans allocation
}
export interface LoopSample {
  k: number; t: number; r: number; y: number; e: number;
  uCmd: number; uSat: number; saturated: boolean; x: Readonly<Float64Array>;
}
export interface ClosedLoopConfig {
  plant: PlantModel; controller: Controller; saturation: Saturation;
  integrator: Integrator; dt: number; x0: Float64Array; setpoint: (t: number) => number;
}
export interface ClosedLoop { reset(): void; step(): LoopSample; readonly enabled: boolean; setEnabled(on: boolean): void; }
export interface FixedStepClock {               // accumulateur
  readonly dt: number;
  advance(frameSeconds: number): number;          // nb de pas à exécuter cette image
  readonly alpha: number;                         // reste/dt ∈ [0,1) pour interpoler
}
export interface SignalRecorder {               // tampon circulaire préalloué
  readonly capacity: number;
  push(s: LoopSample): void;
  forEach(name: 'r' | 'y' | 'e' | 'uSat', fn: (t: number, v: number) => void): void;
  readonly length: number;
}
```

Algorithme d'un pas (ordre normatif, nécessaire au déterminisme et aux valeurs de référence §5) :
1. `r = setpoint(t)`, `y = output(x)`, `e = r − y` ;
2. si boucle désactivée `uCmd = 0` sinon `uCmd = controller.update(r, y, dt)` ;
3. `uSat = min(max(uCmd, min), max)` ; `saturated = uSat !== uCmd` ;
4. RK4 classique avec `uSat` **maintenu constant pendant le pas** (bloqueur d'ordre zéro, comme un contrôleur numérique) ;
5. `constrain(x)` ; `k += 1`.

Intégrateur : RK4. Justification : ordre 4, erreur sur la dynamique continue négligeable à dt = 1/120 s (écart de e_ss < 1e-5 m mesuré, §5) ; Euler semi-implicite (ordre 1) suffit pour un jeu mais rendrait l'oracle analytique moins serré. Coût négligeable (2 états). Le seul écart à l'analytique est dû au bloqueur d'ordre zéro (retard ≈ dt/2), assumé et quantifié en §5.
Pas : **dt = 1/120 s** (ωn·dt ≤ 0,12 pour Kp ≤ 8000 N/m). Constante unique `SIM_DT` exportée.
Découplage affichage : boucle `requestAnimationFrame` → `clock.advance(min(frameDelta, 0.25))` → au plus `MAX_STEPS_PER_FRAME = 8` pas (le surplus est jeté pour éviter la spirale de la mort) → rendu interpolé `lerp(xPrev, x, alpha)`. Onglet masqué (`visibilitychange`) → pause. L'horloge ne lit jamais `performance.now()` elle-même : le temps lui est fourni (testable).
Déterminisme : `sim/` n'utilise que `+ − × ÷`, `Math.min/max/abs/sqrt` (correctement arrondis en IEEE-754) ; pas de `Math.exp/sin` dans la boucle, pas d'aléa (si besoin futur : PRNG mulberry32 à graine explicite), aucune allocation dans `step()`. Résultat : même séquence d'entrées ⇒ mêmes bits, indépendamment de la fréquence d'images.

## 5. Modèle physique de l'ascenseur

Cabine (bonhomme compris, monté avant le départ) de masse m, position verticale y (m, sol = 0), tirée par un moteur de force u, frottement visqueux des glissières c :

  m·ÿ = sat(u) − m·g − c·ẏ,   u = Kp·(r − y),   sat(u) ∈ [−Umax, +Umax],   contrainte y ≥ 0 (sol : si y < 0 alors y = 0, ẏ = max(ẏ, 0)).

| Symbole | Valeur | Unité | Rôle |
|---|---|---|---|
| m | 50 | kg | masse cabine + bonhomme |
| g | 9,81 | m/s² | pesanteur |
| c | 400 | N·s/m | frottement visqueux |
| Umax | 5000 | N | saturation moteur (≈ 10·m·g) |
| r | 3,00 | m | consigne = hauteur du quai d'arrivée |
| y0, ẏ0 | 0, 0 | m, m/s | cabine posée au sol |
| h_poutre | 3,30 | m | poutre au-dessus du quai : y > 3,30 ⇒ choc |
| tolérance marche | 0,25 | m | marche franchissable par le bonhomme |
| Kp (curseur) | 0 … 8000, pas 100 | N/m | défaut 1000 |

Formules de référence (régime linéaire : pas de contact sol après décollage, pas de saturation) :
- Décollage : il faut Kp·r > m·g ⇒ **Kp > m·g/r = 163,5 N/m**.
- Erreur statique : à l'équilibre ÿ = ẏ = 0 ⇒ **e_ss = m·g/Kp** [kg·m·s⁻² / (N·m⁻¹) = m] ; y_ss = r − e_ss.
- Pulsation propre : **ωn = √(Kp/m)** [√(N·m⁻¹·kg⁻¹) = s⁻¹].
- Amortissement : **ζ = c / (2·√(Kp·m))** [(kg·s⁻¹)/(kg·s⁻¹) = sans dimension].
- Dépassement (ζ < 1), relatif à l'amplitude y_ss − y0 : **Mp = exp(−ζπ/√(1−ζ²))** ; y_pic = y_ss + Mp·(y_ss − y0) ; instant du pic **tp = π/(ωn√(1−ζ²))**.
- Taux de décroissance ζ·ωn = c/(2m) = 4 s⁻¹ **indépendant de Kp** : temps de réponse à 2 % ≈ 4/(ζωn) = 1 s. Augmenter Kp réduit l'erreur mais augmente le dépassement sans accélérer la stabilisation : message pédagogique explicite.

Valeurs (script de vérification jetable hors dépôt, RK4 + bloqueur d'ordre zéro, sans saturation, T = 10 s) :

| Kp (N/m) | e_ss analytique | e_ss simulée (dt=1/120) | ζ | Mp analytique | Mp sim. dt=1/120 | Mp sim. dt=1/1000 |
|---|---|---|---|---|---|---|
| 1000 | 0,49050 m | 0,49050 m | 0,894 | 0,19 % | 0,25 % | 0,19 % |
| 2500 | 0,19620 m | 0,19620 m | 0,566 | 11,59 % | 12,58 % | 11,70 % |
| 4000 | 0,12262 m | 0,12262 m | 0,447 | 20,79 % | 22,54 % | 20,99 % |

Tolérances d'oracle (tests `tests/sim/oracle.test.ts`, saturation désactivée Umax = 1e12) :
- T1 e_ss à t = 10 s, dt = 1/120 : |e_sim − m·g/Kp| ≤ 1e-6 m pour Kp ∈ {500, 1000, 2500, 4000, 8000}.
- T2 Mp, dt = 1/1000 : |Mp_sim − Mp_ana| ≤ 0,5 point de % pour Kp ∈ {1000, 2500, 4000}.
- T3 Mp, dt = 1/120 : Mp_ana ≤ Mp_sim ≤ Mp_ana + 2,5 points (le bloqueur d'ordre zéro réduit l'amortissement effectif).
- T4 tp, dt = 1/1000 : |tp_sim − tp_ana| ≤ 0,01 s pour Kp = 2500.
- T5 Kp = 150 < 163,5 : y reste 0 sur 10 s.
- Mesuré (dt = 1/120) : écart T1 max 4,3e-7 m (Kp = 500, suramorti, pôle lent −1,55 s⁻¹) ; tp_sim = 0,538 s vs 0,5388 s (T4) ; RK4 sur ẋ = −x : 3,3e-7 (CA-2 de T-003).

Configuration de jeu (saturation ±5000 N active), valeurs de référence de non-régression (même algorithme, dt = 1/120, pas k) — tolérance 1e-6 m :

| Kp | y(k=60) | y(k=120) | y(k=240) | y(k=600) | y_max | pas saturés | issue |
|---|---|---|---|---|---|---|---|
| 1500 | 2,430138 | 2,747366 | 2,671735 | 2,673000 | 2,776872 | 0 | échec : marche 0,327 m |
| 2500 | 3,033662 | 2,784761 | 2,804005 | 2,803800 | 3,116315 | 23 | victoire au pas 291 (±1) |
| 3500 | 3,236641 | 2,782849 | 2,858821 | 2,859857 | 3,266902 | 30 | victoire au pas 278 (±1) |
| 4500 | 3,329140 | 2,825564 | 2,892738 | 2,891000 | 3,338958 | 34 | échec : choc poutre |

Fenêtre de réussite (balayage par 100 N/m) : **Kp ∈ [2000 ; 3800]** (borne basse analytique 1962 N/m = m·g/0,25 ; borne haute simulée : y_max = 3,294 m à 3800, 3,302 m à 3900). La saturation écrête le dépassement en jeu ; le tableau linéaire ci-dessus ne s'applique donc qu'à l'oracle sans saturation, ce que la doc doit dire.

## 6. Conception du niveau « Le vide »

Décor : quai de départ (y = 0) à gauche, vide de 4 m, cage d'ascenseur, quai d'arrivée à 3,00 m à droite, poutre crayonnée à 3,30 m au-dessus de la cabine, tableau de bord « console » sur le quai de départ, graphe tracé sur le mur de la cage.

Déroulé :
1. Le bonhomme entre par la gauche ; bulle : objectif.
2. Il atteint la console (zone d'interaction) : le panneau Kp s'ouvre (DOM, focus déplacé dessus).
3. Le joueur règle Kp et appuie « Lancer ». Le bonhomme monte dans la cabine (animation scriptée, hors sim), la consigne passe de 0 à r à k = 0 et la boucle s'active.
4. En temps réel : la cabine bouge, le crayon trace y(t) sur le mur ; la consigne r est la ligne pointillée prolongeant le quai ; e(t) est hachuré entre les deux ; une jauge u montre la force et rougit quand `saturated`.
5. Issue (évaluée par `game/`, mesurable sur `LoopSample`) :
   - **Victoire** : 120 pas consécutifs (1,0 s) avec |r − y| ≤ 0,25 m et |ẏ| ≤ 0,10 m/s, avant k = 1800 (15 s), sans jamais y > 3,30 m. Le bonhomme enjambe la marche et sort à droite.
   - **Choc** : y > 3,30 m ⇒ échec immédiat (le bonhomme se cogne, chapeau qui tombe).
   - **Trop faible** : k = 1800 sans victoire ⇒ échec ; si Kp ≤ 163,5, message dédié « ne décolle pas ».
6. Après victoire : le crayon annote la marche résiduelle avec une cote « e = 0,20 m » et la formule e = m·g/Kp ; écran de fin + teaser du terme I. Après échec : message ciblé, retour à l'étape 3 (cabine replacée au sol, `reset()`).

Textes clés (clés i18n, FR / EN) :
- `level1.goal` : « Rejoins le quai d'en face. L'ascenseur obéit à une règle : plus il est loin du quai, plus il tire fort. » / "Reach the far ledge. The lift follows one rule: the farther it is from the ledge, the harder it pulls."
- `level1.kp.help` : « Kp : force (N) par mètre d'écart. » / "Kp: force (N) per metre of error."
- `level1.fail.noLift` : « Kp × 3 m ne compense pas le poids (490 N). Augmente Kp. » / "Kp × 3 m can't beat the weight (490 N). Raise Kp."
- `level1.fail.step` : « Il manque {e} m : la marche est trop haute. Le poids exige une erreur pour que le moteur tire. » / "{e} m short: the step is too high. Gravity needs an error for the motor to pull."
- `level1.fail.bonk` : « Trop nerveux ! Kp grand = dépassement. Regarde la courbe passer au-dessus des pointillés. » / "Too twitchy! Large Kp = overshoot. See the curve cross the dashed line."
- `level1.saturation` : « Moteur à fond (5000 N) ! » / "Motor maxed out (5000 N)!"
- `level1.win` : « Passé ! Mais la cabine s'arrête toujours un peu sous le quai : e = m·g/Kp. Un contrôleur P seul ne l'annule jamais… » / "Made it! But the lift always stops a bit short: e = m·g/Kp. A P controller alone never removes it…"

Commandes : déplacement ←/→ ou `KeyA`/`KeyD` (`KeyboardEvent.code`, donc Q/D en AZERTY) ; interagir `E`/`Entrée`/`Espace` ; Kp : curseur `<input type="range" min=0 max=8000 step=100>` + champ numérique, `+`/`−` (±100), `PageUp`/`PageDown` (±1000) ; `R` recommencer ; `Échap` pause. Tactile : boutons ◀ ▶ « Action » en surimpression (≥ 44×44 px CSS), curseur natif. Souris : clic sur la console = interagir.

## 7. Rendu

- Caméra `OrthographicCamera`, vue légèrement plongeante (2,5D : profondeur 0,5 m pour cabine/quais), 1 unité monde = 1 m ; cadrage fixe sur le niveau (~12 m × 6,75 m) avec adaptation au ratio.
- Papier millimétré : un seul plan plein écran, matériau `MeshBasicNodeMaterial` dont le `colorNode` TSL calcule la grille procédurale (traits 1 mm = 0,1 m fins, 1 cm = 1 m plus marqués, couleur bleu-vert pâle sur crème) à partir des coordonnées monde, avec anti-crénelage par `fwidth`. TSL compile vers WGSL et GLSL : même code pour les deux backends.
- Trait de crayon : géométries « ruban » (bande de triangles) générées CPU, largeur monde 0,02–0,04 m, bords légèrement bruités par un bruit à graine fixe ; texture de grain gris graphite (256², générée au démarrage dans un `DataTexture`, aucune image externe) ; teinte graphite #3a3a3a, opacité 0,85. Effet « boiling » : la graine du bruit change 8 fois/s, désactivé si `prefers-reduced-motion`.
- Courbes temps réel : `SignalRecorder` (capacité 1800 échantillons = 15 s) → ruban dans un `BufferAttribute` **préalloué** (pas d'allocation par image), `setDrawRange` + `needsUpdate` sur la plage modifiée ; axe t horizontal sur le mur de la cage (échelle 0,4 m/s), axe y = hauteur réelle (la courbe y et la cabine sont alignées à la même hauteur : le graphe *est* le décor).
- Texte : DOM superposé (accessible, traduisible), police manuscrite optionnelle (Q4).
- Budget : 60 images/s sur GPU intégré, ≤ 50 appels de dessin, ≤ 30 000 triangles, 0 allocation par image dans la boucle de jeu, JS initial ≤ 400 ko gzip (à mesurer en T-002 et consigner ; non vérifié ici).

## 8. i18n, accessibilité, absence de GPU

- i18n : fichiers JSON plats `src/i18n/locales/{fr,en}.json`, clés en points, interpolation `{nom}` ; langue initiale = `?lang=` puis `navigator.language` (préfixe `fr` → FR, sinon EN), bouton de bascule, `<html lang>` mis à jour. Nombres via `Intl.NumberFormat` (virgule décimale en FR). Test de parité des clés FR/EN.
- Clavier : tout le niveau est jouable sans souris ; ordre de tabulation logique ; focus visible (contour 3 px).
- Contrastes : textes et contrôles DOM ≥ 4,5:1 (WCAG AA) sur le papier ; les courbes se distinguent aussi par le motif (plein / pointillé / hachures), pas seulement la couleur.
- Lecteurs d'écran : région `aria-live="polite"` annonçant lancement, saturation (une fois par trajet), issue et valeur de e ; le canvas porte `role="img"` + `aria-label` traduit.
- `prefers-reduced-motion` : pas de boiling, pas de secousse caméra, transitions instantanées.
- Sans WebGPU ni WebGL2 (échec de `renderer.init()` ou absence de `WebGL2RenderingContext`) : page HTML statique traduite expliquant le besoin, liens vers la doc ; aucune exception non gérée. Testé en e2e par un paramètre `?renderer=none` simulant l'échec.

## 9. Stratégie de test

Scripts npm (exacts) :
- `npm run typecheck` = `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit`
- `npm run lint` = `eslint . --max-warnings 0 && prettier --check . && depcruise src --config .dependency-cruiser.cjs`
- `npm run test` = `vitest run` (environnement `node`, couverture `src/sim` ≥ 95 % lignes via `npm run test:cov`)
- `npm run build` = `vite build` (base `/<nom-du-dépôt>/` pour Pages)
- `npm run e2e` = `playwright test` (après `npx playwright install chromium`)
- `npm run check` = enchaîne typecheck, lint, test, build.

Tests unitaires noyau : oracle T1-T5 (§5) ; valeurs de référence de jeu (§5, tolérance 1e-6 m) ; saturation (`uSat` ∈ [−5000, 5000], drapeau correct) ; contact sol ; horloge (frames de 1/30, 1/60, 1/144 s et à-coups de 0,5 s ⇒ nombre de pas attendu, plafond 8, `alpha` ∈ [0,1)).
Déterminisme : (a) deux exécutions de 1800 pas ⇒ traces `Float64Array` identiques bit à bit ; (b) même scénario découpé en images de 1/60 s et de 1/144 s ⇒ mêmes états aux mêmes k ; (c) empreinte SHA-256 de la trace Kp = 2500 figée dans le test.
Logique de jeu : victoire/choc/trop faible pour Kp ∈ {150, 1500, 2500, 3500, 4500} ; reset.
e2e minimal (Playwright, Chromium uniquement, `vite preview`) — un seul scénario, choisi parce qu'il traverse toutes les couches (DOM, i18n, rendu, sim, jeu) avec le chemin critique réel : charger `?renderer=webgl&lang=en`, aucune erreur console, avancer au clavier jusqu'à la console, saisir Kp = 2500, lancer, attendre ≤ 10 s le message de victoire dans la région `aria-live`. Plus un test `?renderer=none` ⇒ page de repli. WebGL2 est forcé car WebGPU n'est pas garanti en Chromium headless (non vérifié ici).
CI (`.github/workflows/ci.yml`) : Node 22, `npm ci`, `npm run check`, `npm run e2e` ; `deploy.yml` publie `dist/` sur Pages depuis `main`.

## 10. Plan de documentation technique

```
docs/
  README.md               index, comment lire la doc
  architecture.md         modules, règles de dépendances (§3), flux d'une image
  simulation.md           interfaces du noyau, algorithme de pas, déterminisme, dt
  physique/ascenseur.md   modèle, paramètres, formules, tableaux de §5
  rendu.md                pipeline WebGPU/WebGL2, style crayon, budget, mesures
  i18n-accessibilite.md   format des locales, règles a11y, procédure d'ajout de langue
  tests.md                commandes, oracle, tolérances, e2e
  developpement.md        prérequis, installation, scripts, déploiement Pages
  decisions/ADR-NNN-*.md  une ADR par choix structurant (TS 6.0.3, RK4, dt, DOM pour l'UI…)
  specs/                  spécifications de tâches (ce fichier)
  CHANGELOG.md            entrée par tâche validée
```
À chaque tâche validée, le rédacteur : met à jour les pages touchées par les fichiers modifiés (diff de la tâche), recopie les valeurs mesurées (pas devinées), ajoute l'entrée `CHANGELOG.md` (ID, date, résumé), crée l'ADR si un choix a été fait, vérifie que chaque commande citée s'exécute (`npm run …`) et que les liens relatifs sont valides. La doc ne contient jamais de valeur non sourcée par une commande ou un test.

## 11. Découpage en tâches

Règle commune : chaque tâche de réalisation est suivie d'une validation indépendante (rôle validateur) puis d'une tâche doc (rédacteur, fichiers `docs/**` sauf `docs/specs/`). CA vérifiés depuis la racine du dépôt.

**T-002 — Socle outillé** (réalisateur ; dépend de T-001)
Fichiers : `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.dependency-cruiser.cjs`, `index.html`, `src/main.ts` (bouchon), `src/sim/index.ts`, `src/render/index.ts` (bouchons), `tests/smoke.test.ts`.
CA : 1) `npm ci` code 0 ; 2) `node -e` lisant `package.json` affiche exactement les versions de §2, sans `^`/`~` ; 3) `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` codes 0 ; 4) un fichier temporaire `src/sim/_viol.ts` important `three` fait échouer `npm run lint` (code ≠ 0), puis est retiré ; 5) idem un usage de `document` dans `src/sim` fait échouer `npm run typecheck` ; 6) taille gzip de `dist/assets/*.js` consignée.

**T-003 — Noyau : horloge, saturation, RK4, enregistreur** (réalisateur ; dépend de T-002)
Fichiers : `src/sim/{clock,integrators,signals,saturation,types}.ts`, `tests/sim/{clock,integrators,signals}.test.ts`.
CA : 1) `npm run test -- tests/sim` code 0 ; 2) RK4 sur ẋ = −x, x0 = 1, dt = 0,1, 10 pas : |x − e^{−1}| ≤ 1e-6 ; 3) tests d'horloge de §9 présents et verts ; 4) `npm run test:cov` : `src/sim` ≥ 95 % lignes ; 5) `npm run check` code 0.

**T-004 — Noyau : contrôleur P, ascenseur, boucle + oracle** (réalisateur ; dépend de T-003)
Fichiers : `src/sim/{controllers/p,plants/elevator,loop}.ts`, `tests/sim/{oracle,reference,determinism}.test.ts`.
CA : 1) T1-T5 verts ; 2) valeurs de référence de §5 vertes (1e-6 m) ; 3) trois tests de déterminisme verts ; 4) `npm run check` code 0.

**T-005 — Validation indépendante du noyau** (validateur ; dépend de T-004)
Fichiers : `orchestration/logs/T-005.md` seulement. Recalcule l'oracle par un script propre hors dépôt et compare à `npm run test` ; CA : 1) écart max consigné ≤ tolérances §5 ; 2) `npm run check` code 0 ; 3) `git status --porcelain` ne montre que le log.

**T-006 — i18n** (réalisateur ; dépend de T-002)
Fichiers : `src/i18n/**`, `tests/i18n/**`. CA : 1) parité des clés FR/EN testée ; 2) toutes les clés de §6 présentes ; 3) interpolation et `Intl.NumberFormat` testés (`0,2` en FR, `0.2` en EN) ; 4) `npm run check` code 0.

**T-007 — Logique du niveau** (réalisateur ; dépend de T-004)
Fichiers : `src/game/**`, `tests/game/**`. CA : 1) issues pour Kp ∈ {150, 1500, 2500, 3500, 4500} = noLift/step/win/win/bonk ; 2) victoire de Kp = 2500 au pas 291 ± 1 ; 3) `reset` restaure l'état initial (égalité profonde) ; 4) `npm run check` code 0.

**T-008 — Rendu : bootstrap et papier** (réalisateur ; dépend de T-002)
Fichiers : `src/render/{bootstrap,paper,camera}.ts`, `src/main.ts`. CA : 1) `npm run check` code 0 ; 2) e2e temporaire : `?renderer=webgl` charge sans erreur console et `renderer.backend.isWebGLBackend` exposé en lecture via `document.body.dataset.backend === 'webgl'` ; 3) `?renderer=none` affiche la page de repli.

**T-009 — Rendu : crayon, niveau, courbes** (réalisateur ; dépend de T-007, T-008)
Fichiers : `src/render/**`. CA : 1) `npm run check` code 0 ; 2) aucune allocation par image : test Vitest du constructeur de ruban (même `ArrayBuffer` après 1000 mises à jour) ; 3) capture Playwright `docs/img/level1.png` produite.

**T-010 — UI, commandes, accessibilité, intégration** (réalisateur ; dépend de T-006, T-007, T-009)
Fichiers : `src/ui/**`, `src/main.ts`, `index.html`, `tests/e2e/**`, `playwright.config.ts`. CA : 1) `npm run e2e` code 0 (scénario §9) ; 2) test e2e sans dépendance supplémentaire : tous les contrôles ont un nom accessible (`getByRole` les trouve en FR et EN) ; 3) `npm run check` code 0.

**T-011 — CI et Pages** (réalisateur ; dépend de T-010)
Fichiers : `.github/workflows/{ci,deploy}.yml`, `vite.config.ts` (base). CA : 1) `npx --yes actionlint` (ou validation YAML `node -e`) code 0 ; 2) `npm run build` produit des chemins préfixés par la base ; 3) après push, `gh run list --limit 1` montre `success` (nécessite accord utilisateur).

**T-012 — Validation finale v0.1** (validateur) et **T-013 — Doc complète §10** (rédacteur) : CA = toutes les commandes de §9 codes 0, doc relue contre le code, liens valides.

## 12. Risques et questions ouvertes

- Q1. Nom du dépôt GitHub et compte (fixe la `base` Vite et l'URL Pages). Recommandation : `pid-game`, Pages via Actions.
- Q2. Kp verrouillé pendant le trajet (v0.1) ou réglable en direct ? Recommandation : verrouillé en v0.1 (issue reproductible, oracle simple) ; réglage en direct dans un « bac à sable » plus tard.
- Q3. Fenêtre de réussite Kp ∈ [2000 ; 3800] : assez large ? Recommandation : la garder (facteur ≈ 2, oblige à comprendre les deux défauts) et l'ajuster après test de jeu via h_poutre.
- Q4. Police manuscrite : en auto-héberger une sous licence OFL (≈ 30-60 ko) ou police système ? Recommandation : OFL auto-hébergée, licence copiée dans `public/fonts/`.
- Q5. Version de Node sur le PC Windows de l'utilisateur : inconnue ; vitest 5 exige ≥ 22.12. Recommandation : installer Node 22 LTS ou 24.
- Risque R1 : WebGPU/TSL évoluent vite (three publie souvent) ⇒ versions épinglées, montée de version = tâche dédiée avec e2e. R2 : le poids du bundle `three/webgpu` peut dépasser le budget ⇒ mesure dès T-002. R3 : comportement de `getFallback` en headless non vérifié ⇒ e2e forcé en WebGL2.
