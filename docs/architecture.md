# Architecture

À quoi sert cette page : présenter les modules du code, qui a le droit d'importer qui, le déroulement d'une image et les garde-fous automatiques. État au commit `908a62e` (version 0.3.0, branche `v0.3-salle-de-controle`) : tous les modules sont validés, le jeu s'ouvre sur un écran titre puis un menu, deux niveaux sont jouables dans un navigateur, et la v0.3 a ajouté le pupitre de contrôle (`src/ui/pupitre`), le tableau d'école, le journal du trajet (`src/game/trip-log.ts`) et la maquette jetable `src/proto` (`?proto=c`).

## Modules

| Module | Rôle | État |
|---|---|---|
| `src/sim/` | noyau de simulation pur : pas fixe, déterministe, sans rendu ni DOM | **validé** (T-003, T-004, T-004b, T-005). Voir [simulation.md](simulation.md) |
| `src/app/` | état d'application pur : machine d'écrans (titre, menu, niveau), catalogue des niveaux, niveau suivant | **validé** (T-017abc ; T-036, N2, pour `nextLevel`). Voir ci-dessous et [ADR-015](decisions/ADR-015-etat-application-machine-ecrans.md) |
| `src/game/` | logique de niveau : sept phases (dont embarquement et sortie), victoire et échec, bonhomme, événements, journal du trajet ; machine commune aux niveaux 1 et 2 | **validé** (T-007 ; T-020 pour les valeurs du niveau 1 ; T-021b pour le niveau 2 ; T-037, N3, pour le poste, l'embarquement et la sortie ; T-041 et T-048, N3, pour les signaux et le journal du trajet). Voir [jeu.md](jeu.md) |
| `src/i18n/` | textes FR/EN, interpolation, formatage, détection de langue | **validé** (T-006, clés ajoutées en T-010). Voir [i18n-accessibilite.md](i18n-accessibilite.md) |
| `src/render/` | rendu three.js (`three/webgpu`, repli WebGL2) : papier, traits de crayon, bonhomme, courbe, jauge | **validé** (T-008, T-009 ; échecs en cours de route : T-014). Voir [rendu.md](rendu.md) |
| `src/ui/` | interface DOM accessible : bandeau d'aide, pupitre de contrôle (canvas 2D en surimpression, `src/ui/pupitre`), tableau d'école, mesures, issues, touches, annonces ; écrans titre et menu | **validé** (T-010 ; T-017d pour les écrans ; T-042 et T-053 pour le tableau ; T-049 à T-051 pour le pupitre, qui remplace le panneau de réglage). Voir [interface.md](interface.md), [pupitre.md](pupitre.md), [tableau-ecole.md](tableau-ecole.md) |
| `src/proto/` | maquettes jetables du pupitre (lot B) : seule la maquette C reste, lançable par `?proto=c` ; trajets de référence purs dans `src/proto/common` | **jetable** (T-043 à T-047, ménage T-054, D38). Hors du jeu : voir les règles `proto-isolated` et `proto-common-pure` ci-dessous et [pupitre.md](pupitre.md#maquette-conservée-protoc) |
| `src/main.ts` | point de composition : seul fichier qui connaît tous les modules ; monte et démonte les écrans | **validé** (T-010, T-017e), voir ci-dessous |

Fichiers :

```text
src/sim/     index.ts  types.ts  clock.ts  integrators.ts  saturation.ts  signals.ts  loop.ts
             controllers/p.ts  controllers/pi.ts  plants/elevator.ts
src/i18n/    index.ts  catalogs.ts  params.ts  interpolate.ts  format.ts  detect.ts  translator.ts
             locales/fr.json  locales/en.json
src/app/     index.ts  screens.ts  levels.ts
src/game/    index.ts  constants.ts  kp.ts  outcome.ts  walker.ts  events.ts  elevator-level.ts
             level.ts  level2.ts  trip-log.ts
src/render/  index.ts  bootstrap.ts  session.ts  stage.ts  camera.ts  options.ts  paper.ts
             pencil-style.ts  pencil-material.ts  stroke-batch.ts  noise.ts  patterns.ts
             walker-pose.ts  curve.ts  gauge.ts  level-display.ts  level-painter.ts  level-view.ts
src/ui/      index.ts  overlay.ts  view-model.ts  layout.ts  hints.ts  keys.ts  input.ts
             announce.ts  help.ts  screens.ts  screens-model.ts  screen-keys.ts  ui.css  screens.css
             board.ts  board-math.ts  board-forces.ts  board-forces-view.ts
             pupitre/ (21 fichiers : pupitre.ts, plan.ts, modele.ts, colonne.ts, reglage.ts, machine*.ts,
             courbes*.ts, curseur.ts, colonnes-trajet.ts, crayon.ts, index.ts…)
src/proto/   index.ts  contrat.ts  coque.ts  c/ (maquette C)  common/ (trajets de référence, lecteur, types)
src/main.ts
public/      favicon.svg  fonts/ (Patrick Hand, OFL.txt)
```

### Ce que fait `src/main.ts`

1. Crée le traducteur (`detectLocale(location.search, navigator.languages)`) et tient à jour `<html lang>` et le titre du document par un abonnement au traducteur (c'était le rôle de l'interface du niveau avant T-017) ; donne au canvas son nom accessible.
2. Démarre le rendu **une seule fois** (`startRendering`, papier seul) avec le choix lu dans `?renderer=` et un rappel `onFailure`. Si le démarrage échoue, affiche la page de repli traduite et s'arrête, sans passer par le titre. Si le rendu échoue plus tard (perte du contexte GPU, exception dans une image) ou si le montage d'un écran lève une exception, `handleFailure` démonte l'écran courant (`unmountCurrent`) et affiche une page de repli d'échec (voir [rendu.md](rendu.md#échecs-en-cours-de-route-t-014)).
3. Crée la machine d'application (`createAppMachine(LEVELS)`, `src/app`) et monte l'écran de son état : à chaque changement, il démonte l'écran précédent puis monte le suivant.
   - **titre** : `createTitleScreen` (bouton « Jouer » → `machine.play()`) ; canvas `aria-hidden` ;
   - **menu** : `createMenuScreen` (un niveau → `machine.openLevel(id)`, « Retour » ou Échap → `machine.back()`) ; le focus revient sur le niveau qu'on vient de quitter, mais seulement quand on vient d'un niveau (A-05 : la machine prévient l'abonné de l'écran précédent ; depuis le titre, le focus va sur « Niveau 1 ») ;
   - **niveau** : crée un niveau **neuf** (`createLevel1({ animations })` ou `createLevel2({ animations })`), l'attache au rendu (`session.attachLevel`), crée l'interface (`createUi`, avec l'action « Menu » → `machine.leaveLevel()` et, seulement si un niveau suivant existe (`nextLevelId(levelId) !== null`), l'action « Niveau suivant » `onNext` → `machine.nextLevel()`), branche le clavier (`bindKeyboard`) et la géométrie de l'écran. Au démontage : retrait dans l'ordre inverse (clavier, `ResizeObserver`, écouteur `resize`, `ui.destroy()`, conteneur `#ui`, `session.detachLevel()`), chaque retrait étant indépendant des autres.
4. **Animations du niveau** (T-037, T-038) : `wantedAnimations()` vaut `animationsSetting && !session.reducedMotion` ; `animationsSetting` est vrai en jeu normal et, en mode `?e2e=1`, seulement avec `&anim=1`. La valeur est donnée à chaque niveau créé, puis, à chaque image dans `onFrameEnd`, `level.setAnimations(...)` n'est rappelé que si elle a changé (préférence de mouvement réduit suivie en cours de partie).
5. Géométrie de l'écran pour l'interface (`UiGeometry`) : calculée à partir du cadrage du rendu, recalculée sur `resize` **et** par un `ResizeObserver` sur le canvas (K18, corrigé par T-017e), avec les ancres de la session (`session.anchors()`, dont `gaugeMax` et `gaugeWeight` et, depuis T-024, `iGauge` et `iGaugeVisible` pour la jauge du terme intégral du niveau 2 ; `main.ts` lit `iGaugeVisible` par un accesseur) : l'interface reçoit des nombres, sans importer le rendu.
6. Écrit dans `document.body.dataset` le backend (`backend`), et, après la première image, `drawCalls` et `triangles`.
7. **Maquettes** (lot B de la v0.3) : si l'URL contient `?proto=…`, `main.ts` charge `src/proto` par import dynamique (`lancerProto`) et monte la maquette à la place du jeu ; sans ce paramètre, rien de `src/proto` n'entre dans le chargement. Seule `?proto=c` existe depuis T-054.
8. **Ancres du chevalet** : la géométrie transmise à l'interface contient `boardTopLeft` et `boardBottomRight` (T-042), pour la zone cliquable du tableau d'école.

**Crochet de test** : seulement avec `?e2e=1` dans l'URL, `window.__huygens` expose la machine d'application (`app` : `state`, `play`, `openLevel`, `back`, `leaveLevel`, `nextLevel`), les commandes du niveau courant (`commands`, dont `setKp` et `setKi` : chacune renvoie `'ignored'` si le niveau ne règle pas cette grandeur, ou hors niveau ; depuis T-037, `skipAnimation` et `setAnimations(enabled)`), une copie de l'instantané, une avance déterministe du temps (`advance(secondes)`, par images fixes de 1/60 s), les compteurs de rendu, `detachLevel()` et `attachLevel()` (essai du cycle de vie de la vue) et `crashNextFrame()`, qui provoque une exception à l'image suivante (essai de la page de repli d'erreur). Dans ce mode, le temps réel ne fait plus avancer le niveau. Le paramètre `&screen=title|menu|level1|level2` choisit l'écran de départ (défaut `level1` : les e2e d'avant T-017 restent valables sans réécriture) ; il est ignoré sans `?e2e=1`. Dans ce mode, les animations du niveau sont **désactivées** (les e2e écrits avant elles restent valables) sauf avec `&anim=1`. Sans `?e2e=1`, `window.__huygens` n'existe pas (test e2e (h) de `level.spec.ts`) et le jeu s'ouvre sur le titre : les e2e qui n'utilisent pas `e2e=1` (par exemple `ui.spec.ts`) cliquent désormais « Jouer » puis le premier niveau.

## L'état d'application (`src/app`, T-017abc)

`src/app` est un module **pur** (règle `app-is-pure`, test `tests/app/units.test.ts`) qui tient l'écran courant. Il ne connaît que des identifiants de niveau (chaînes), ni textes, ni DOM, ni rendu. Exports (`src/app/index.ts`) : `LEVELS`, `nextLevelId`, `createAppMachine`, et les types `LevelEntry`, `ScreenId`, `AppState`, `AppResult`, `AppListener`, `AppMachine`.

- Catalogue (`levels.ts`) : `LEVELS` = `level1` et `level2`, tous deux jouables, dans l'ordre du menu. Les titres sont dans les catalogues i18n (`src/ui/screens-model.ts` associe un identifiant à une clé).
- Machine (`screens.ts`) : état `{ screen: 'title' | 'menu' | 'level', levelId }` (`levelId` n'est non nul que dans un niveau) ; commandes `play`, `openLevel(id)`, `back`, `leaveLevel`, `nextLevel` (T-036), qui renvoient `'ok'`, `'ignored'` (commande sans objet dans l'écran courant, état inchangé) ou `'invalid'` (identifiant inconnu ou non jouable) et ne lèvent jamais d'exception ; `subscribe(listener)` renvoie le désabonnement. Une commande reçue pendant une notification est exécutée après elle, dans l'ordre.

| Depuis | Commande | Vers |
|---|---|---|
| `title` | `play` | `menu` |
| `menu` | `openLevel(id)` jouable | `level` |
| `menu` | `back` | `title` |
| `level` | `leaveLevel` | `menu` |
| `level` (avec un suivant jouable) | `nextLevel` | `level` (le suivant, neuf) |

Échap n'est pas une commande de la machine dans un niveau : il garde son rôle de pause ou de fermeture du réglage ([interface.md](interface.md#touches-qui-dépendent-de-la-phase)). La pause et l'aide restent locales au niveau et à son interface. Justification et options écartées : [ADR-015](decisions/ADR-015-etat-application-machine-ecrans.md). Tests : `tests/app/machine.test.ts` (26 tests, 20 avant T-036) et `tests/app/units.test.ts` (1). `nextLevelId(levelId, levels = LEVELS)` renvoie le niveau jouable qui suit dans le catalogue, `null` pour le dernier ou un identifiant inconnu ; `nextLevel` répond `ignored` hors niveau et au dernier niveau ([ADR-015](decisions/ADR-015-etat-application-machine-ecrans.md#évolution-v03-lot-a-2026-11-15--la-commande-nextlevel)).

## Flux d'une image

```mermaid
flowchart TD
  K["clavier, souris, tactile : bindKeyboard et écouteurs de createUi"] -- "à tout moment" --> L["commandes du niveau : moveRight, setKp, launch..."]
  RAF["renderer.setAnimationLoop : nouvelle image, durée dt"] --> UP["onFrame : level.update(dt)"]
  UP --> P["session : view.paint(snapshot, signals) et computeAnchors"]
  P --> D["stage.render() : papier, lots de traits, passe de sortie"]
  D --> UI["onFrameEnd : ui.update() avec les ancres de l'image affichée"]
  L -. "lu à l'image suivante" .-> UP
```

Ordre réel (`src/main.ts`, `src/render/session.ts`) :

1. Les commandes du joueur arrivent par des écouteurs d'événements, entre deux images. Chaque commande est appliquée tout de suite au niveau, puis l'interface est mise à jour.
2. À chaque image, la boucle de three appelle `onFrame(dt)` : `main.ts` fait avancer le niveau (`level.update(dt)`, horloge à pas fixe du noyau) et renvoie la durée de l'image.
3. La session repeint les lots de traits d'après l'instantané (interpolé par `alpha`), recalcule les ancres et dessine.
4. La session appelle enfin `onFrameEnd` (option de `startRendering`, T-031) : `main.ts` y met à jour l'interface (`ui.update()`), qui se place d'après les ancres de l'image qui vient d'être dessinée.

Depuis T-031, l'interface est donc mise à jour **après** le dessin : les textes et les étiquettes reflètent l'image affichée, plus l'image précédente (K10, corrigé ; avant, `ui.update()` passait avant `level.update` et les ancres avaient une image de retard). Sur le titre et le menu, il n'y a pas de niveau : `onFrame` ne fait rien et la session ne dessine que le papier. À l'attache d'un niveau, la session calcule tout de suite les ancres du niveau qui entre (et `detach` les remet à zéro par `resetAnchors`) : la première image de l'interface ne lit plus celles du niveau précédent (A-07). Voir [rendu.md](rendu.md#cycle-de-vie-de-la-session-t-017).

## Qui peut importer qui

Tableau tiré de `.dependency-cruiser.cjs` (section `forbidden`). « oui » = aucune règle ne l'interdit.

| Depuis ↓ / vers → | `sim` | `game` | `i18n` | `app` | `render` | `ui` | `three` | autre paquet npm |
|---|---|---|---|---|---|---|---|---|
| `src/sim/` | oui | non | non | non | non | non | non | non |
| `src/game/` | oui | oui | non | non | non | non | non | non |
| `src/i18n/` | non | non | oui | non | non | non | non | non |
| `src/app/` | non | non | non | oui | non | non | non | non |
| `src/render/` | oui | oui | non | non | oui | non | oui | oui |
| `src/ui/` | non | oui | oui | oui | non | oui | non | oui |
| `src/main.ts` | oui | oui | oui | oui | oui | oui | non | oui |

Règles en vigueur (11 au commit `908a62e` ; 9 depuis T-017a, plus `proto-isolated` et `proto-common-pure` du lot B) :

| Règle | Ce qu'elle interdit |
|---|---|
| `sim-is-pure` | tout import depuis `src/sim/` vers autre chose que `src/sim/` (paquets npm compris) |
| `i18n-is-pure` | tout import depuis `src/i18n/` vers autre chose que `src/i18n/` |
| `app-is-pure` | tout import depuis `src/app/` vers autre chose que `src/app/` (la machine ne connaît que des identifiants de niveau : elle n'importe ni `game` ni `i18n`) |
| `game-no-render` | tout import depuis `src/game/` vers autre chose que `src/game/` ou `src/sim/` |
| `render-deps` | `src/render/` → `src/ui/`, `src/i18n/` ou `src/app/` (étendue à `app` par T-017a) |
| `ui-deps` | `src/ui/` → `src/sim/` ou `src/render/` |
| `proto-isolated` | tout import de `src/proto/` depuis `src/sim`, `game`, `i18n`, `render`, `ui` ou `app` : le jeu n'importe pas les maquettes (seuls `src/main.ts`, `src/proto` et `tests/` le peuvent) |
| `proto-common-pure` | tout import depuis `src/proto/common/` vers autre chose que `src/proto/common/` (ni rendu, ni ui, ni paquet externe ; le DOM est vérifié par `tests/proto/pur.test.ts`) |
| `three-only-in-render` | import de `three` hors de `src/render/` et de `src/proto/` (élargie par T-043 : la maquette C utilise three pour son post-traitement) |
| `no-circular` | toute dépendance circulaire |
| `not-to-unresolvable` | tout import que l'outil ne sait pas résoudre |

```mermaid
flowchart LR
  main["src/main.ts"] --> render["src/render"]
  main --> ui["src/ui"]
  main --> game["src/game"]
  main --> i18n["src/i18n"]
  main --> sim["src/sim"]
  main --> app["src/app"]
  render --> game
  render --> sim
  render --> three(["three"])
  ui --> game
  ui --> i18n
  ui --> app
  game --> sim
```

Flèche = « peut importer ». `sim`, `i18n` et `app` n'importent rien hors d'eux-mêmes. `src/proto` (hors du schéma) est importé par `src/main.ts` seulement et peut importer `three` ; son sous-dossier `common/` est pur.

### Exemption de `src/main.ts` levée (réserve E2)

Jusqu'à T-007, la règle `three-only-in-render` exemptait `src/main.ts`, dont le bouchon importait `three/webgpu` (réserve E2 du log T-002). T-008 a déplacé tout l'usage de three dans `src/render/` et retiré l'exemption : la règle porte maintenant sur `pathNot: '^src/render/'`. Le point de composition n'importe plus three.

## Les trois garde-fous du noyau pur

Ils protègent `src/sim/` (et, pour le deuxième, `src/game/` et `src/app/`). Les sorties ci-dessous ont été reproduites le 2026-11-12 dans une copie du dépôt hors du dossier projet, avec un fichier `src/sim/_viol.ts` contenant :

```ts
import { Vector3 } from 'three';
export const v = new Vector3(Math.random(), Date.now(), 0);
export const w = document.title;
```

L'orchestrateur a fait le même essai pendant la validation de T-002 (log T-002 : « depcruise code 2, eslint 2 erreurs, tsc sim en erreur »).

### 1. dependency-cruiser : pas d'import interdit

- Fichier : `.dependency-cruiser.cjs`.
- Commande : `npm run lint:arch` (aussi lancée en dernier par `npm run lint`).
- Règles touchées : `sim-is-pure`, `three-only-in-render`.
- Sortie (code de sortie 2) :

```text
  error three-only-in-render: src/sim/_viol.ts → node_modules/three/build/three.module.js
  error sim-is-pure: src/sim/_viol.ts → node_modules/three/build/three.module.js

x 2 dependency violations (2 errors, 0 warnings). 6 modules, 4 dependencies cruised.
```

(Chemin vers `node_modules` raccourci : la copie pointait vers le `node_modules` du projet.)

Sur le dépôt réel, au commit `908a62e` : 108 modules et 309 dépendances (relevé du rédacteur D-020, `npm.cmd run lint:arch`, code de sortie 0, aucune violation) ; au commit `3810193` (mêmes 67 modules à `02119f7`, `a308ada`, `08908b6` et `119519b` ; 179 dépendances à `02119f7`, 178 à `a308ada` : T-026 à T-033 n'ont ajouté aucun fichier de `src/`, et la seule nouvelle importation entre fichiers de `src/` est celle de `help.ts` par `keys.ts` ; `npm.cmd run lint:arch`, arbre propre, relevé par le rédacteur) :

```text
✔ no dependency violations found (67 modules, 180 dependencies cruised)
```

Le lot A n'a ajouté aucun fichier de `src/`. La dépendance de plus (180 au lieu de 179) vient, d'après la lecture du diff, de l'import de `src/game` par `src/ui/layout.ts` (`CONSOLE_POST_X`, `CONSOLE_X`, T-039) ; `keys.ts`, `help.ts` et `input.ts` importaient déjà `src/game` (des types, maintenant aussi `isRunningPhase` et `isSkippablePhase`). Le décompte par fichier n'a pas été refait au commit précédent. Les 67 modules : 65 fichiers de `src/` (`src/render` 19, `src/sim` 10, `src/i18n` 9 dont 2 JSON, `src/ui` 14 dont `ui.css` et `screens.css`, `src/game` 9, `src/app` 3, `src/main.ts`) et 2 fichiers de three (`three/build/three.webgpu.js` et `three/build/three.tsl.js`), importés par `src/render`. Évolution de la même commande : 21 modules à `c00e678`, 28 à `7bcd9ce`, 35 à la fin de T-008 (log T-008), 55 à `566a8a3`, 57 à `13e8b7e` (T-014 et T-015 ont ajouté `src/render/failure.ts` et `src/ui/help.ts`), 67 à `119519b` (T-017 : `src/app` 3 fichiers, `src/ui/screens.ts`, `screens-model.ts`, `screen-keys.ts`, `screens.css` ; T-021a : `src/sim/controllers/pi.ts` ; T-021b : `src/game/elevator-level.ts` et `level2.ts`). La sortie du test de violation ci-dessus (6 modules) date de la copie du socle T-002.

Limite : la commande analyse seulement `src/`. Les fichiers de `tests/` ne sont pas contrôlés.

### 2. TypeScript sans DOM

- Fichier : `tsconfig.sim.json`. Il étend `tsconfig.json`, couvre `src/sim/**/*.ts`, `src/game/**/*.ts` et `src/app/**/*.ts` (ajouté par T-017a), et remplace `lib` par `["ES2023"]` (sans `DOM`) et `types` par `[]`.
- Commande : `npm run typecheck` (deuxième passe, `tsc -p tsconfig.sim.json --noEmit`).
- Effet : `window`, `document` ou `performance` n'existent pas pour le compilateur dans ces dossiers.
- Sortie pour `document` (code de sortie 2) :

```text
src/sim/_viol.ts(3,18): error TS2584: Cannot find name 'document'. Do you need to change your target library? Try changing the 'lib' compiler option to include 'dom'.
```

L'import de `three` dans le même fichier provoque en plus 452 autres erreurs (376 dans `@types/three`, 76 dans `@types/webxr`, surtout `TS2304` : types DOM introuvables ; 453 erreurs au total) : c'est un deuxième signal du même problème.

### 3. ESLint : ni aléa ni horloge

- Fichier : `eslint.config.js`, bloc `files: ['src/sim/**/*.ts']`.
- Règles : `no-restricted-properties` sur `Math.random` et `Date.now` ; `no-restricted-globals` sur `Date` et `performance`.
- Commande : `npm run lint` (`eslint . --max-warnings 0`).
- Sortie (code de sortie 1) :

```text
  2:30  error  'Math.random' is restricted from being used. sim/ doit être déterministe : utiliser un PRNG à graine explicite  no-restricted-properties
  2:45  error  Unexpected use of 'Date'. sim/ ne lit jamais l'horloge : le temps est fourni par l'appelant                     no-restricted-globals
  2:45  error  'Date.now' is restricted from being used. sim/ ne lit jamais l'horloge : le temps est fourni par l'appelant     no-restricted-properties

✖ 3 problems (3 errors, 0 warnings)
```

Ces règles ne s'appliquent pas à `src/game/`, conformément à la spec T-001 §3. Pour `src/game/`, un test (`tests/game/units.test.ts`) lit les sources et refuse `Math.random`, `Date`, `performance`, `window` et `document`, et tout import hors de `src/game` et `src/sim` ; pour `src/app/`, `tests/app/units.test.ts` fait de même (aucun import hors de `src/app`).

Justification de ces choix : [ADR-003](decisions/ADR-003-noyau-pur.md).

## Écarts entre la configuration et la spec T-001 §3

La configuration fait foi. Écarts relevés :

- La spec cite 4 règles dependency-cruiser ; la configuration en a 11 (ajout de `i18n-is-pure`, `render-deps`, `ui-deps`, `not-to-unresolvable`, `app-is-pure` par T-017a, puis `proto-isolated` et `proto-common-pure` par le lot B).
- La spec dit `ui → game, i18n` ; la configuration autorise aussi `ui` à importer des paquets npm autres que `three`.
- La spec dit « tout import de `three` hors `render/` » est interdit : c'est le cas depuis T-008 ; l'exemption de `src/main.ts` (réserve E2) est levée.

## Intégration continue et publication

`.github/workflows/ci.yml` lance `npm run check` et les tests e2e à chaque push sur `main` et à chaque pull request : les garde-fous ci-dessus (typecheck, lint, dependency-cruiser) y tournent donc aussi. `.github/workflows/deploy.yml` publie `dist/` sur GitHub Pages, sur déclenchement manuel seulement (T-011, [ADR-013](decisions/ADR-013-ci-et-pages-manuel.md)). Détails : [tests.md](tests.md#intégration-continue) et [developpement.md](developpement.md#déploiement-sur-github-pages).
