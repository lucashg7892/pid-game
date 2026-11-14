# T-017 — Spécification de l'écran titre et du menu des niveaux

Statut : proposition du concepteur (2026-11-13), à valider par l'utilisateur (questions du §11) puis par l'orchestrateur. Aucune valeur de jeu n'est fixée ici.
Références : `orchestration/REGISTRE.md` (décisions D12, D15, D19, D20, D22, D23), [ADR-009](../decisions/ADR-009-machine-a-etats.md), [ADR-011](../decisions/ADR-011-interface-dom.md), [ADR-008](../decisions/ADR-008-licence-mit.md), [interface.md](../interface.md), [architecture.md](../architecture.md), [i18n-accessibilite.md](../i18n-accessibilite.md), [rendu.md](../rendu.md), [defauts-connus.md](../defauts-connus.md), `LICENSE`.
Convention : « doit » = obligatoire et testé ; « devrait » = recommandé ; « à confirmer » = déduit de la lecture du code, non vérifié (aucun code n'a été exécuté pour cette spec). Les faits tirés du code sont cités avec leur fichier. État du code lu : branche `migration`, commit `0db54c1`.

## 1. Objectifs et non-objectifs

Décision D22 : un écran titre avec un bouton « Jouer » et la mention de copyright, puis un menu avec la liste des niveaux. « Jouer » mène à la liste.

Objectifs :
- O1. Au chargement, quand un GPU est utilisable, le joueur arrive sur l'écran titre (et non plus directement dans le niveau 1). « Jouer » ouvre le menu ; le menu liste les niveaux ; choisir le niveau 1 lance le niveau actuel, inchangé.
- O2. Le joueur peut revenir du niveau au menu, et du menu au titre.
- O3. Titre et menu sont en français et en anglais (aucun texte en dur), jouables au clavier, à la souris et au toucher, accessibles aux lecteurs d'écran, lisibles en portrait, dans le style crayon sur papier millimétré.
- O4. La mention de copyright est identique au fichier `LICENSE` (§5) et un test le vérifie.
- O5. Corriger dans la même série de tâches les défauts K23, K24 et K18 de la couche interface (§7).

Non-objectifs :
- Aucune modification des règles, des valeurs ni du déroulé du niveau 1 (`src/sim`, `src/game` : intacts).
- Pas de niveau 2 : D20 (niveau avec Ki) est une autre tâche. Le menu peut le mentionner seulement si l'utilisateur le décide (Q4).
- Pas de nouvelle dépendance (ADR-001), pas de routeur, pas de gestion de l'historique du navigateur (Q7).
- Pas de progression ni de sauvegarde dans cette tâche, sauf réponse contraire à Q1 ; l'architecture doit les permettre plus tard (§3.5).
- Pas de son, pas de réglages (volume, graphismes).

## 2. Arborescence et règles de dépendances

Faits relevés : `.dependency-cruiser.cjs` contient 8 règles. `ui-deps` interdit `ui → sim, render` ; `render-deps` interdit `render → ui, i18n` ; `game-no-render` n'autorise que `game, sim` ; `sim-is-pure` et `i18n-is-pure` isolent leurs modules. Aucune règle n'interdit aujourd'hui `render → app` ou `ui → app` pour un module `app` qui n'existe pas encore (architecture.md, tableau « Qui peut importer qui »). `tsconfig.sim.json` n'inclut que `src/sim/**` et `src/game/**` (ligne 7).

Arborescence cible (les nouveaux fichiers sont marqués NOUVEAU) :

```
src/
  sim/ game/ i18n/ render/                  inchangés, sauf render/session.ts (§3.4) et i18n/locales (§6)
  app/                                      NOUVEAU : état d'application, pur
    index.ts  screens.ts  levels.ts         machine « écran courant », catalogue des niveaux
  ui/
    overlay.ts input.ts ...                 niveau : createUi gagne destroy() (§3.4, §7)
    screens.ts  screens-model.ts            NOUVEAU : DOM du titre et du menu, modèle de vue pur
    screens.css  screen-keys.ts             NOUVEAU : styles, intentions clavier pures
  main.ts                                   composition : monte et démonte les écrans (§3.3)
tests/
  app/ ui/ i18n/license.test.ts e2e/screens.spec.ts   NOUVEAUX
```

Règles (flèche = « peut importer »), à ajouter à `.dependency-cruiser.cjs` :
- `app → app` seulement : règle `app-is-pure` (`from ^src/app/`, `to pathNot ^src/app/`, `severity: error`), sur le modèle de `i18n-is-pure`. La machine ne connaît que des identifiants de niveau (chaînes) ; elle n'importe ni `game` ni `i18n`.
- `render-deps` étendue : `to path ^src/(ui|i18n|app)/` (le rendu ne connaît pas l'état d'application).
- `ui → app` : autorisé (types `ScreenId`, `LevelEntry`) ; `ui-deps` ne l'interdit pas et n'est pas modifiée. `game → app` est déjà refusé par `game-no-render`.
- `main → tout`, inchangé.
- `tsconfig.sim.json` : ajouter `src/app/**/*.ts` à `include` (pas de `DOM`, pas de `window`), pour la même garantie qu'en `game`.
- Test de lecture des sources, sur le modèle de `tests/game/units.test.ts` : `src/app` sans `Math.random`, `Date`, `performance`, `window`, `document`, et sans import hors `src/app`.

Décision (structure) : un module `app` plutôt que `src/game`, parce que `game` désigne la logique d'un niveau (ADR-009) et que l'écran courant n'est pas une phase de niveau.

## 3. Conception

### 3.1 Où vit l'état « écran courant » : deux options

Faits : le niveau est une machine à cinq phases, pure, dont `paused` fait partie (`createLevel1`, ADR-009) ; l'aide des commandes est un état local de l'interface (`helpOpen` dans `overlay.ts`, ADR-011, règles pures dans `help.ts`) ; `main.ts` crée un seul niveau et un seul rendu au démarrage et ne les détruit jamais (`main.ts` l. 249-295).

| Option | Description | Pour | Contre |
|---|---|---|---|
| A. Petite machine d'application pure, `src/app` | `{screen: 'title' \| 'menu' \| 'level', levelId}` ; commandes qui renvoient un résultat ; `main.ts` monte et démonte les écrans d'après les changements | testable sous Node sans navigateur ; règle de dépendances qui l'impose (`app-is-pure`) ; `Level1` et ADR-009 intacts ; extensible (sauvegarde, niveau 2) sans toucher au niveau | un module et une règle de plus |
| B. Un champ « écran » dans `main.ts` ou dans `ui` | variable locale et `if` dans la composition ou dans `overlay.ts` | aucun fichier de plus | non testable sous Node (DOM ou composition) ; `overlay.ts` (700 lignes) porterait aussi le titre et le menu ; la logique « retour au menu depuis le niveau » serait dispersée |

Recommandation : A. On ne met pas l'écran courant dans `Level1` (ADR-009 écarte la logique dans l'interface, et un niveau n'a pas à connaître le menu qui le contient).

Pause et aide restent où elles sont : la pause est la phase `paused` du niveau, l'aide est locale à l'interface du niveau (T-015, `help.ts`). Raison : toutes deux n'ont de sens que dans un niveau, sont déjà testées, et les remonter dans `app` obligerait à réécrire T-015 sans bénéfice. L'aide sur l'écran titre est une option de Q2, hors de cette tâche par défaut.

### 3.2 La machine `src/app`

```ts
export type ScreenId = 'title' | 'menu' | 'level';
export interface LevelEntry { readonly id: string; readonly playable: boolean; }   // catalogue, données pures
export interface AppState { readonly screen: ScreenId; readonly levelId: string | null; } // levelId non nul ssi screen === 'level'
export type AppResult = 'ok' | 'ignored' | 'invalid';                                // jamais d'exception (style CommandResult)
export interface AppMachine {
  readonly state: Readonly<AppState>;
  play(): AppResult;                 // title -> menu
  openLevel(id: string): AppResult;  // menu -> level ; 'invalid' si id inconnu ou non jouable
  back(): AppResult;                 // menu -> title ; ignoré ailleurs
  leaveLevel(): AppResult;           // level -> menu
  subscribe(listener: (state: Readonly<AppState>, previous: ScreenId) => void): () => void;
}
export function createAppMachine(levels: readonly LevelEntry[]): AppMachine;
```

Table de transitions (toute autre combinaison renvoie `ignored`, état inchangé) :

| Depuis | Commande | Vers |
|---|---|---|
| `title` | `play` | `menu` |
| `menu` | `openLevel(id)` jouable | `level(id)` |
| `menu` | `back` | `title` |
| `level` | `leaveLevel` | `menu` |

`back` n'agit pas dans un niveau : D23 et `keyToIntent` (`keys.ts` l. 162-170) donnent à Échap le rôle de pause ou de fermeture du réglage, ce que cette tâche ne change pas.

Abonnement par `subscribe` (comme `Translator.subscribe`, `src/i18n/translator.ts`) plutôt que par file d'événements (ADR-009) : cette machine n'a pas de boucle d'images, donc ni risque d'allocation par image ni écrêtage de file ; l'abonné est appelé après validation de l'état. Une commande reçue pendant une notification est exécutée après elle ; le réalisateur la teste.

Catalogue `levels.ts` : liste ordonnée `[{ id: 'level1', playable: true }]` (+ entrée « à venir » seulement si Q4 le décide). Les titres des niveaux ne sont pas dans `app` (pur de texte) : `ui` associe un identifiant à une clé i18n typée.

### 3.3 Composition (`main.ts`) et cycle de vie des écrans

`main.ts` garde le rôle d'unique endroit qui connaît tout. Il crée traducteur, machine et rendu, puis, à chaque état de la machine, monte l'écran correspondant et démonte le précédent :

| Écran | Monté | Démonté |
|---|---|---|
| `title` | `createTitleScreen({root, translator, onPlay})` | `destroy()` : DOM retiré, écouteurs retirés |
| `menu` | `createMenuScreen({root, translator, levels, onOpen, onBack})` | idem |
| `level` | `createLevel1()` neuf, `session.attachLevel(level)`, `createUi(...)`, `bindKeyboard(...)`, géométrie (K18) | `destroy()` de l'interface, retrait du clavier, `session.detachLevel()`, abandon du niveau |

Deux faits de code imposent un démontage complet de l'interface du niveau, absent aujourd'hui :
- `createUi` ajoute un écouteur `keydown` sur `document` (piège de focus de l'aide, `overlay.ts` l. 620-631), un abonné `tr.subscribe` (l. 635) et un écouteur de clic sur le canvas (l. 707) qu'elle ne retire jamais ; `Ui` n'expose pas de `destroy`. Recréer l'interface à chaque entrée dans un niveau les accumulerait.
- `bindKeyboard` renvoie déjà sa fonction de retrait (`input.ts` l. 153-158) ; elle doit être appelée en quittant le niveau, sinon Entrée, Espace, E et R restent interceptés (`SCROLL_CODES`, `keys.ts` l. 80-88) sur le menu.

Au retour au menu, le niveau est jeté : l'entrée suivante crée un `createLevel1()` neuf (état initial, déterministe, rien à nettoyer). Alternative « niveau conservé » : voir Q3.

La page de repli existante (`showFallback`, `main.ts` l. 116-154) reste en amont : le rendu démarre avant tout écran, et un échec au démarrage remplace la page comme aujourd'hui, avant le titre (§4.6). L'échec en cours de route (`handleFailure`, T-014) démonte l'écran courant par le même mécanisme de nettoyage (`cleanups`) puis affiche la page de repli.

Mode e2e (`?e2e=1`) : 29 occurrences de `goto` ou `e2e=1` dans 5 fichiers de `tests/e2e` supposent le niveau 1 immédiat. Décision (détail de test) : avec `?e2e=1`, un paramètre `screen` choisit l'écran de départ (`title`, `menu`, `level1`), par défaut `level1`, afin que les tests existants restent valides sans réécriture ; hors `?e2e=1`, le paramètre est ignoré. `window.__huygens` gagne un objet `app` (état, `play`, `openLevel`, `leaveLevel`, `back`) ; ses `commands` délèguent au niveau courant et renvoient `'ignored'` s'il n'y en a pas (à confirmer par le réalisateur).

### 3.4 Canvas, boucle de rendu et session de rendu

Faits : `startRendering(canvas, choice, {level?, onFrame, onFailure})` accepte l'absence de niveau (« absent : papier seul », `session.ts` l. 41) ; la vue du niveau n'est créée qu'au démarrage si `level` est fourni (l. 110) ; `session.stop()` arrête la boucle, libère la vue, la scène et le renderer (l. 170-180) ; la préférence `prefers-reduced-motion` est lue une fois (l. 108, défaut K22) ; `draw` appelle `onFrame` avant de peindre et de calculer les ancres (l. 123-137, 159-168).

Deux façons de gérer la session entre écrans :

| Option | Description | Coût / risque |
|---|---|---|
| S1. Une session pour toute l'application | démarrée au chargement papier seul ; `RenderSession.attachLevel(level)` crée la vue, `detachLevel()` la libère | ajoute deux méthodes à `session.ts` ; la vue du niveau est créée et détruite à chaud (`createLevelView` et `view.dispose()` existent ; leur emploi pendant que la boucle tourne est à confirmer) |
| S2. `stop()` puis `startRendering` à chaque entrée ou sortie | aucune modification du rendu | recrée le renderer (init asynchrone) et le contexte GPU sur le même canvas, ce que le code ne fait nulle part ; la réutilisation du canvas après `disposeRenderer` est à confirmer, et c'est exactement le terrain des défauts K8 et K16 |

Recommandation : S1. Elle ne touche que le cycle de vie de la vue ; le papier, le crayon et la boucle ne changent pas.

Pendant le titre et le menu : la boucle d'images reste active, en papier seul, sans niveau. Décision (technique) : on garde la boucle plutôt que d'ajouter un mode « dessin à la demande », parce que le redimensionnement, la perte de contexte et la reprise de l'onglet masqué passent déjà par elle, et que rien d'autre n'est ajouté. Coût attendu : papier 1 appel de dessin plus la passe de sortie 1, soit 2 appels, contre 4 à l'état initial du niveau (rendu.md, section « Lots et budget » ; 2 est déduit, à confirmer par `session.stats()`). Le coût par image, la consommation et l'effet sur batterie ne sont pas mesurés : le réalisateur relève les compteurs de dessin au titre et consigne si une mesure de temps d'image est possible dans l'environnement ; si elle montre un problème, l'option « dessin à la demande » devient une tâche à part.

Le crayon animé (« boiling ») ne s'applique qu'au niveau ; titre et menu n'en ont pas besoin. Si Q2 retient une illustration dessinée au crayon dans le canvas, elle relèverait du rendu (hors de cette tâche, avec `prefers-reduced-motion`, K22).

Le canvas est `role="img"` avec un nom décrivant le niveau (`a11y.canvas`, `index.html` et `overlay.ts` l. 375, 422 : `canvasLabel.set` à chaque mise à jour). Sur le titre et le menu, il ne montre que du papier : il doit être masqué aux lecteurs d'écran (`aria-hidden="true"`), et le nom du niveau rétabli par l'interface du niveau (retrait de `aria-hidden` à l'entrée dans le niveau).

Retour au menu : `detachLevel()` libère la vue du niveau ; la session et le canvas restent. Le niveau est abandonné (ramassé par le GC, aucune ressource GPU propre : à confirmer). Tests : trois allers-retours niveau - menu, puis un seul `#ui` de niveau, une seule modification de Kp par frappe (preuve qu'aucun écouteur ne s'est accumulé), `drawCalls` identiques à ceux d'une première entrée.

### 3.5 Progression et sauvegarde (si Q1 la retient)

Le module `app` reste pur : la sauvegarde passe par une interface injectée `{ getItem(k): string \| null; setItem(k, v): void }` ; `main.ts` y branche `window.localStorage`, protégé par `try/catch` (l'accès peut lever `SecurityError`, et `setItem` peut lever pour quota ou mode privé). Hors de cette tâche par défaut ; voir Q1.

## 4. Contenu et comportement des écrans

### 4.1 Style

Papier millimétré visible derrière (le canvas en papier seul) ; textes et boutons sur des morceaux de papier crème au contour crayon, comme le reste de l'interface (classes `ui-paper`, `ui-btn`, police Patrick Hand, variables `--ui-*` de `ui.css`). Le DOM de ces écrans est monté dans un conteneur de classe `ui` pour hériter des variables, de la règle `[hidden]`, du contour de focus de 3 px et de la règle `prefers-reduced-motion` (`ui.css` l. 445-453). Styles nouveaux dans `src/ui/screens.css`.

### 4.2 Écran titre

Contenu minimal (D22) : titre du jeu (`app.title`, « Huygens’s world », D15), bouton « Jouer », mention de copyright (§5). Éléments complémentaires : Q2 (la recommandation est : sous-titre `app.tagline`, déjà présent dans les deux catalogues et inutilisé dans le code lu, et bouton de langue).

Structure : `<main aria-labelledby>` contenant un `<h1>` (titre du jeu), le bouton « Jouer » (`.ui-btn.ui-primary`), puis un pied de page `<footer>` avec la mention de copyright. Au montage, le focus est sur « Jouer ».

### 4.3 Menu des niveaux

`<main aria-labelledby>` avec un `<h1>` (« Niveaux »), une liste `<ul>` de boutons (un `<li><button>` par niveau du catalogue), et un bouton « Retour » (vers le titre). Chaque entrée affiche au minimum le nom du niveau : le niveau 1 réutilise `level1.title` (« Niveau 1 : le vide »), sans doublon de clé. Texte d'état et libellés d'un niveau non jouable : Q4. Le niveau 1 est jouable ; ouvrir une entrée non jouable est impossible (bouton désactivé ou absent selon Q1 et Q4).

### 4.4 Clavier

Fonction pure `screenKeyToIntent({code, screen, focus, ctrlKey, altKey, metaKey})` dans `screen-keys.ts`, testée sous Node, sur le modèle de `keyToIntent` (Ctrl, Alt, Meta : aucune intention) :

| Écran | Touche | Intention |
|---|---|---|
| titre | Entrée, Espace sur « Jouer » | natif (activation du bouton) |
| titre | Échap | rien (`none`, pas de `preventDefault`) |
| menu | Entrée, Espace sur un niveau | natif (ouvre le niveau) |
| menu | ↑ / ↓ | `focusPrev` / `focusNext` entre les niveaux et « Retour », sans bouclage |
| menu | Échap | `back` (retour au titre) : recommandé, Q6 |
| menu, titre | Tab, Maj+Tab | natif, ordre du DOM |

Le clavier du niveau (`bindKeyboard`) n'est monté que sur l'écran `level` (§3.3). Dans un niveau, Échap garde son rôle (D23). Focus : titre sur « Jouer » ; menu sur le premier niveau jouable, ou, au retour d'un niveau, sur l'entrée du niveau qu'on vient de quitter ; contour de focus visible de 3 px (déjà dans `ui.css` l. 168-173, à étendre aux nouveaux sélecteurs si besoin).

### 4.5 Souris et toucher

Tout est un vrai `<button>` : clic, toucher, Entrée et Espace se comportent de la même façon, sans gestionnaire de pointeur particulier. Les boutons de ces écrans mesurent au moins 44 × 44 px CSS (spec T-001 §6) ; la règle `.ui-btn` actuelle donne 40 px (`ui.css` l. 142-143), donc ces écrans fixent leur propre minimum. Les boutons tactiles n'ont jamais été essayés sur un appareil réel (K9) : cette limite s'étend aux nouveaux écrans.

### 4.6 Sans GPU et en portrait

Sans GPU : le rendu démarre avant tout écran ; en cas d'échec (`unsupported`, `init-failed`, `disabled`), `showFallback` remplace la page comme aujourd'hui (canvas masqué, clés `fallback.*`, test `?renderer=none`), le titre n'est pas affiché. Raison : le joueur sans GPU ne peut de toute façon rien lancer ; il lit tout de suite l'explication. Option contraire (titre puis repli au clic sur « Jouer ») écartée : elle ajoute un état et un test pour rien. La page de repli ne porte pas la mention de copyright (Q5 le demande).

Portrait : titre et menu sont des mises en page de flux (colonne centrée, `max-height: 100dvh`, défilement vertical interne), sans la géométrie de la cage ni `UiGeometry` ; ils n'héritent donc pas des problèmes de K2 et K5. L'invite de rotation (`.ui-rotate`) appartient à l'interface du niveau : elle n'apparaît pas sur le titre ni sur le menu (elle ne se monte qu'avec `createUi`). À contrôler en e2e à 390 × 844 et 360 × 740 (taille la plus petite testée dans `tests/ui/layout.test.ts`).

## 5. La mention de copyright

Texte du fichier `LICENSE` à la racine, relu pour cette spec :

```
MIT License

Copyright (c) 2026 lucashg7892
```

La mention affichée reprend ces éléments sans rien ajouter : titulaire `lucashg7892`, année `2026`, licence MIT (ADR-008, décision D12).

Où le texte vit : deux clés dans `src/i18n/locales/fr.json` et `en.json`, nouveau préfixe `title.` :
- `title.copyright` : exactement la ligne `Copyright (c) 2026 lucashg7892`, identique en FR et en EN (nom propre et notice légale non traduits) ; à ajouter à `IDENTICAL_ALLOWED` dans `tests/i18n/catalogs.test.ts` avec sa raison (ce test exige que la liste des textes identiques corresponde exactement) ;
- `title.license` : « Licence MIT » en FR, « MIT License » en EN (première ligne de `LICENSE`).

Le symbole « © » à la place de « (c) » est un choix de présentation laissé à l'utilisateur (Q5) ; par défaut, la ligne est strictement celle de `LICENSE`.

Test `tests/i18n/license.test.ts` (Node, `readFileSync` comme `catalogs.test.ts` l. 50-52) :
1. lit `LICENSE` ; extrait par `/^Copyright \(c\) (\d{4}) (\S.*)$/m` la seule ligne de copyright ; échoue s'il n'y en a pas exactement une ;
2. vérifie `FR['title.copyright'] === ligne` et `EN['title.copyright'] === ligne` ;
3. vérifie `EN['title.license'] ===` première ligne de `LICENSE` (« MIT License ») et que `FR['title.license']` contient « MIT » ;
4. vérifie qu'aucune autre clé ne contient « Copyright » ni « © » (pas de seconde notice divergente).
Un changement d'année ou de titulaire dans `LICENSE` fait donc échouer le test tant que les catalogues ne suivent pas. L'e2e vérifie en plus que le texte est visible sur l'écran titre, en FR et en EN.

Remarque (à confirmer par l'utilisateur) : la licence MIT exige la notice dans les copies du logiciel ; elle n'exige pas qu'elle soit affichée dans l'interface. L'affichage est un choix de D22.

## 6. i18n et accessibilité

Clés (noms proposés ; textes FR et EN à rédiger par le réalisateur, relus par l'utilisateur pour tout ce qui est contenu de jeu ; la typographie suit les règles de i18n-accessibilite.md : apostrophe U+2019, U+00A0 avant « : » en FR, etc.) :

| Clé | Rôle |
|---|---|
| `title.play` | bouton « Jouer » / « Play » |
| `title.copyright`, `title.license` | §5 |
| `title.screenLabel` | nom accessible de l'écran titre (si le `<h1>` ne suffit pas) |
| `menu.title` | titre du menu (« Niveaux ») |
| `menu.back` | bouton de retour au titre |
| `menu.listLabel` | nom accessible de la liste |
| `menu.announce.title`, `menu.announce.menu` | annonce du changement d'écran |
| `controls.menu` | bouton de retour au menu depuis un niveau (selon Q3) |

Les préfixes `title.` et `menu.` sont à ajouter à `PREFIXES` de `tests/i18n/catalogs.test.ts` ; la liste des textes identiques passe de 5 à 6 entrées. Le nombre total de clés (115 au commit `13e8b7e`, i18n-accessibilite.md) sera recompté par le réalisateur. Le test de parité FR/EN et les tests typographiques s'appliquent sans changement. Les titres de niveaux réutilisent `level1.title`.

Accessibilité (« doit », testée en e2e FR et EN) :
- chaque écran est un `<main>` nommé par son titre ; un seul `<main>` visible à la fois ;
- tous les contrôles sont des boutons natifs avec un nom accessible ; Tab suit l'ordre visuel ; le focus visible est un contour de 3 px ;
- au changement d'écran, le focus est posé explicitement (§4.4) et une phrase est annoncée dans une région `aria-live="polite"` permanente, hors de l'interface du niveau (qui est détruite à la sortie) ; raison : le focus sur un bouton ne dit pas dans quel écran on se trouve. Un essai avec un vrai lecteur d'écran n'a pas été fait (comme pour le niveau, i18n-accessibilite.md) : à confirmer ;
- le canvas est `aria-hidden` hors d'un niveau (§3.4) ;
- `prefers-reduced-motion` : ces écrans n'ont aucune animation ni transition ; la règle de `ui.css` les désactive de toute façon pour les descendants de `.ui` ; un e2e avec `page.emulateMedia({ reducedMotion: 'reduce' })` vérifie qu'aucune transition ni animation n'est calculée sur les éléments des écrans (étend en partie K13 aux écrans) ;
- la langue : `<html lang>` et `document.title` sont aujourd'hui écrits par `overlay.ts` (l. 407-412) ; ils doivent passer dans `main.ts` (abonnement au traducteur) pour rester justes sur le titre et le menu, où l'interface du niveau n'existe pas. Le bouton de langue du titre (si retenu par Q2) réutilise `Translator.setLocale` et l'attribut `lang` de son libellé, comme celui du niveau.

## 7. Défauts de la couche interface : classement

Critère : même tâche si la correction touche des fichiers déjà modifiés par T-017 et reste de même nature ; à part sinon. Fichiers lus dans le code réel.

| # | Défaut | Fichiers réellement concernés | Décision | Raison |
|---|---|---|---|---|
| K24 | « Reprendre » relance le jeu derrière l'aide ouverte | `overlay.ts` : le clic de Pause appelle `level.resume()` sans regarder `helpOpen` (l. 638-640) ; le bouton tactile « Action » en phase `paused` fait de même (l. 698-699). `.ui-tools` et `.ui-touch` restent cliquables sous l'aide (`ui.css` l. 54-64) | **dans T-017** (tâche c) | `overlay.ts` est réécrit pour `destroy()` ; la correction tient à deux gestionnaires de ce fichier. Le comportement attendu : tant que l'aide est ouverte, ni Pause/Reprendre ni « Action » ne modifient le niveau ; la reprise se fait à la fermeture, par la règle existante `helpPauseDecision`. Piste : attribut `inert` sur le reste de l'interface pendant que le dialogue est ouvert (à confirmer pour les navigateurs visés), ou garde `helpOpen` dans les deux gestionnaires |
| K23 | Les mesures transparaissent sous l'aide | `ui.css` : `--ui-paper` vaut `rgb(251 247 236 / 96%)` (l. 33), `.ui-help` n'a qu'un `z-index: 2` (l. 382-385) | **dans T-017** (tâche c) | une règle CSS dans le fichier déjà modifié ; piste : fond opaque pour `.ui-help`, sans toucher au modèle de vue |
| K18 | Géométrie de l'interface recalculée seulement sur `resize` | `main.ts` : `measure` n'est branchée que sur `window` (l. 308-320), alors que le rendu suit le canvas par `ResizeObserver` (`render/bootstrap.ts`, non exposé) | **dans T-017** (tâche e) | `main.ts` est réécrit (la géométrie est désormais créée à chaque entrée dans un niveau) ; piste : `ResizeObserver` sur le canvas, côté `main.ts` (API DOM permise dans la composition), retiré à la sortie du niveau. Pas besoin de toucher `render` |
| K10 | Ancres de l'interface avec une image de retard | `main.ts` l. 282-286 (`refreshUi()` avant `level.update`), mais aussi `session.ts` l. 123-137 : les ancres sont calculées dans `draw`, après `onFrame` | **hors T-017** | échanger les deux lignes de `main.ts` ne corrigerait que les textes ; les ancres resteraient d'une image en arrière (déduit de la lecture, à confirmer), et un correctif complet touche `render` ; l'ordre « interface avant niveau » est décrit dans architecture.md et ADR-011 ; l'e2e `advance` suit déjà l'ordre inverse. Tâche N2 séparée, après T-017 |
| K21 | `aria-modal`, piège de focus, focus sur « Rejouer » | `overlay.ts`, `help.ts` | **déjà corrigé** (T-015) ; rien à faire | reste lié : l'écouteur `document` du piège de focus n'est jamais retiré (§3.3), résolu par `destroy()` de la tâche c ; à consigner dans `orchestration/DEFAUTS-CONNUS.md` par l'orchestrateur si elle n'était pas notée |
| K22 | `prefers-reduced-motion` lu une seule fois | `render/session.ts` l. 108, `bootstrap.ts` | **hors T-017** | `session.ts` est touché par la tâche b, mais elle est déjà de niveau N3 (retouche de rendu approuvé) ; y ajouter une écoute de changement mélangerait deux effets visibles. La session vivant désormais pour toute l'application, l'écart se voit un peu plus : tâche N2 séparée |
| K9 | Tactile jamais essayé sur appareil | — | hors périmètre | limite d'outillage ; s'étend aux nouveaux écrans, à consigner |
| K5 | Scène minuscule en portrait | `render/camera.ts` | hors T-017 | ne concerne pas le titre ni le menu (§4.6) ; reste ouvert pour le niveau |
| K13 | Contrastes et mouvement réduit non testés en e2e | `tests/e2e/` | **en partie** | le mouvement réduit est testé pour les nouveaux écrans seulement ; le contraste n'est pas mesuré |

## 8. Stratégie de test

Unitaires (Vitest, `npm test`) :
- `tests/app/machine.test.ts` : table de transitions complète (chaque couple état-commande, y compris les `ignored` et `invalid`), `levelId` nul hors niveau, désabonnement, commande reçue pendant une notification ;
- `tests/app/units.test.ts` : sources de `src/app` sans DOM, sans aléa, sans horloge, sans import hors `src/app` ;
- `tests/ui/screens-model.test.ts` : textes exacts du titre et du menu, FR et EN ; la ligne de copyright est celle de `title.copyright` ;
- `tests/ui/screen-keys.test.ts` : toutes les touches × écrans × focus (Échap au titre, ↑ ↓, Ctrl/Alt/Meta) ;
- `tests/ui/help.test.ts` étendu : règle de K24 si elle est exprimée par une fonction pure ;
- `tests/i18n/license.test.ts` (§5), `tests/i18n/catalogs.test.ts` mis à jour (préfixes, texte identique autorisé) ;
- garde-fou d'architecture : `npm run lint:arch` vert ; essai manuel par un fichier temporaire `src/app/_viol.ts` important `src/ui` (doit échouer), puis `src/render/_viol.ts` important `src/app` (doit échouer), retirés ensuite, comme T-002 CA 4.

e2e (Playwright, lancés par l'orchestrateur, impossibles dans la VM des agents) : `tests/e2e/screens.spec.ts`, FR et EN :
- (a) chargement sans paramètre d'écran : titre visible, focus sur « Jouer », copyright visible et égal à la ligne de `LICENSE` ;
- (b) parcours clavier seul : Entrée sur « Jouer », flèches, Entrée sur le niveau 1, jeu jusqu'à la victoire (réutilise l'aide de `tests/e2e/overlay.ts`), pause, retour au menu, Échap, retour au titre ;
- (c) parcours souris ; (d) parcours tactile émulé (`hasTouch`), en sachant que K9 reste ouvert ;
- (e) trois allers-retours niveau - menu : une seule interface de niveau, un seul effet par frappe, aucune erreur console, mêmes compteurs de dessin ;
- (f) mouvement réduit émulé ; (g) langue changée au titre, conservée au menu et dans le niveau ; (h) `?renderer=none` toujours sur la page de repli, sans titre ; (i) K24 : aide ouverte pendant un trajet, clic sur « Reprendre », l'instantané reste en pause ; K23 : capture de l'aide ouverte pendant un trajet ; K18 : changement de taille du canvas seul, étiquettes recalées (faisabilité à confirmer) ;
- les 29 usages de `goto` existants passent sans réécriture grâce à `screen=level1` par défaut en mode `?e2e=1` (§3.3) ; leur nombre de tests (28 verts à `566a8a3` d'après i18n-accessibilite.md, depuis augmenté) est à relever par l'orchestrateur avant et après.

Captures à regarder (nommées `docs/img/t017-*.png`, regardées par l'orchestrateur même quand les tests passent) : titre FR 1280 × 720 ; titre EN ; menu FR ; titre et menu en portrait 390 × 844 ; titre avec focus visible sur « Jouer » ; aide ouverte pendant un trajet (K23) ; niveau 1 après un aller-retour par le menu, comparé à une capture avant modification pour la non-régression du rendu (le test d'uniformité du papier de T-009c reste vert).

Avant/après, rendu : la tâche b change la durée de vie de la vue du niveau ; son critère est que la capture du niveau 1 (1280 × 720, état initial et victoire à Kp = 2500 N/m) soit identique pixel pour pixel à l'état actuel hors zones DOM (à confirmer : les tests e2e actuels ne comparent qu'une capture de référence du papier).

## 9. Découpage en tâches

Chaque tâche de réalisation est suivie de `npm run check` vert ; les e2e sont lancés par l'orchestrateur. Niveaux selon `CLAUDE.md` ; en cas de doute, le niveau du dessus.

| Tâche | Contenu | Fichiers | Niveau | Dépend de |
|---|---|---|---|---|
| T-017a | Module `src/app` (machine, catalogue), règle `app-is-pure`, extension de `render-deps`, `tsconfig.sim.json`, tests unitaires | `src/app/**`, `.dependency-cruiser.cjs`, `tsconfig.sim.json`, `tests/app/**` | N2 (garde-fous d'architecture : relever à N3 si l'orchestrateur le juge) | validation de la spec |
| T-017b | `RenderSession.attachLevel` / `detachLevel` ; papier seul sans niveau ; test de non-régression du niveau 1 | `src/render/session.ts`, `level-view.ts` si besoin, `tests/render/**`, e2e `render.spec.ts` | **N3** (retouche d'un rendu déjà approuvé) : validateur indépendant et `orchestration/logs/T-017b.md` | T-017a (aucun lien de code : peut se faire en parallèle) |
| T-017c | `Ui.destroy()`, K24, K23, déplacement de `<html lang>` et du titre du document vers `main.ts`, nom et `aria-hidden` du canvas | `src/ui/overlay.ts`, `ui.css`, `input.ts` si besoin, `help.ts`, `tests/ui/**`, e2e `ui.spec.ts` | N2 | — (fichiers disjoints de T-017b : parallèle possible) |
| T-017d | Écrans titre et menu : DOM, modèle de vue, clavier pur, CSS, clés i18n, test de copyright | `src/ui/screens*.ts`, `screen-keys.ts`, `screens.css`, `src/i18n/locales/*.json`, `tests/ui/**`, `tests/i18n/**` | N2 | T-017a, T-017c (même `ui.css`, séquence pour éviter les conflits) |
| T-017e | Composition : machine, montage des écrans, repli inchangé, K18, mode e2e `screen=`, bouton de retour au menu, e2e `screens.spec.ts`, captures | `src/main.ts`, `tests/e2e/**`, `index.html` si besoin | N2 | T-017a à d |
| V-017 | Revue des captures et validation indépendante de T-017b, e2e complets, `npm run check` | `orchestration/logs/` | N3 pour b, courant pour le reste | T-017e |
| D-0xx | Documentation (§10) sur état figé, ADR-015 « écran courant » | `docs/**` hors `docs/specs/` | N1 | V-017 |

Ordre : a, puis b et c (parallèles), d, e, validation, doc. Un commit par tâche validée, fait par l'orchestrateur.

## 10. Documentation à mettre à jour

À rédiger après validation, sur un état figé (hash de commit donné dans l'ordre) :
- `interface.md` : nouvelle section « Écrans titre et menu » (contenu, touches, focus, portrait, annonces), bouton de retour au menu, comportement de l'aide pendant la pause (K24) ;
- `architecture.md` : module `src/app` (tableau, arborescence, tableau « Qui peut importer qui », règles en vigueur 8 → 9, nombre de modules de `lint:arch` relevé par la commande), rôle de `main.ts` et flux (écran courant, montage et démontage) ;
- `i18n-accessibilite.md` : préfixes `title.` et `menu.`, nouveau compte de clés, liste des textes identiques (6), test de copyright, lignes de la partie 2 (écrans, canvas masqué, `aria-live` d'écran) ;
- `rendu.md` : cycle de vie de la session (`attachLevel`, `detachLevel`), papier seul au titre et au menu, appels de dessin relevés ;
- `defauts-connus.md` : K23, K24, K18 passent en corrigés ; K10 et K22 inchangés ; limites tactile et mouvement réduit étendues aux écrans ;
- `tests.md` : nouveaux tests unitaires et e2e, compte relevé ;
- `jeu.md` : le niveau est recréé à chaque entrée depuis le menu (selon Q3) ;
- ADR-015 « État d'application : machine d'écrans pure » (options A et B du §3.1, S1 et S2 du §3.4) ; mention de T-017 dans les « Conséquences » de l'ADR-011 (interface détruite et recréée) ; ADR-009 inchangée ;
- `docs/README.md` (index, lien vers la spec et l'ADR), `CHANGELOG.md` ;
- `orchestration/REGISTRE.md` : tâches T-017a à e (orchestrateur, pas le rédacteur ni le concepteur).
Les valeurs citées dans la doc (nombre de clés, de modules, d'appels de dessin) sont relevées par commande ou par test, jamais reprises de cette spec.

## 11. Risques et questions ouvertes

Risques :
- R1. Créer et détruire la vue du niveau à chaud (S1) : fuite de ressources GPU possible si `dispose` est incomplet ; à confirmer par le test des trois allers-retours et, si possible, les compteurs `renderer.info`.
- R2. Écouteurs accumulés si `destroy()` est incomplet (document, traducteur, canvas, fenêtre, `visibilitychange`) : test (e) du §8.
- R3. Bouton de retour au menu dans la barre du haut en portrait : la barre mesure déjà 76 px sur deux lignes à 390 px (`TOP_BAR_PORTRAIT`, historique de K2) ; un contrôle de plus peut recréer un défaut d'encombrement ; e2e de mesure à 390 px (selon Q3).
- R4. Les 29 occurrences de `goto` des e2e actuels : le paramètre `screen` par défaut à `level1` en mode e2e les protège, mais crée deux comportements de chargement (e2e et public) ; limité par le fait que le paramètre est ignoré hors `?e2e=1`.
- R5. Le coût de la boucle en papier seul n'est pas mesuré (§3.4).
- R6. Aucun test avec lecteur d'écran réel ni écran tactile réel (K9).
- R7. `localStorage` (si Q1) : indisponible ou corrompu ; géré par repli en mémoire (Q1).
- R8. Le dépôt est privé (D17) : la mention de copyright n'a pas d'incidence légale tant que le site n'est pas publié ; la publication reste une décision de l'utilisateur.

Questions ouvertes pour l'utilisateur (une option recommandée chacune, non tranchée) :

**Q1. Niveaux accessibles ou débloqués, et sauvegarde.**
- Option 1 : tous les niveaux jouables sont accessibles d'emblée, aucune sauvegarde.
- Option 2 : tous accessibles, avec une marque « réussi » mémorisée dans `localStorage`.
- Option 3 : déblocage progressif (le niveau n+1 s'ouvre après la réussite du niveau n), avec sauvegarde.
Si sauvegarde : clé unique versionnée (par exemple `pid-game:progress:v1`) contenant seulement la liste des identifiants de niveaux réussis (aucune donnée personnelle, aucun score ni Kp) ; la langue peut y figurer si tu le souhaites. Si `localStorage` est indisponible (accès qui lève, mode privé, quota) ou si le contenu est illisible : repli silencieux sur une progression en mémoire pour la session, sans message d'erreur, et le jeu reste jouable ; un contenu invalide est ignoré, pas supprimé. Recommandation : option 1. Raison : un seul niveau existe ; un déblocage ne serait ni testable ni utile avant le niveau 2 (D20), et la forme de la progression dépend de ta pédagogie ; l'architecture (§3.5) permet de l'ajouter ensuite sans toucher à la machine.

**Q2. Que montre l'écran titre en plus de « Jouer » et du copyright ?**
- Option 1 : rien d'autre (titre, bouton, copyright).
- Option 2 : titre, sous-titre existant `app.tagline` (« Les bases de l’automatique, au crayon sur papier millimétré »), bouton de langue, « Jouer », copyright.
- Option 3 : option 2 plus une illustration au crayon (bonhomme ou ascenseur) : travail de rendu à part, avec mouvement réduit.
- Option 4 : option 2 plus crédits (police Patrick Hand sous OFL, three.js, licence), version du jeu, accès à l'aide des commandes ; chaque ajout est une page ou un panneau de plus.
Recommandation : option 2. Raison : le joueur dont la langue est mal détectée (repli anglais, `detectLocale`) doit pouvoir changer avant de lire ; le sous-titre existe déjà dans les deux langues ; l'illustration et les crédits demandent du contenu que tu dois choisir et ne sont pas bloquants.

**Q3. Retour au menu depuis un niveau.**
Trois sous-questions.
- Où : (i) bouton « Menu » dans la barre du haut, toujours visible ; (ii) bouton seulement à la pause et dans le panneau d'issue ; (iii) les deux. Recommandation : (iii), car l'issue est le moment naturel de choisir « autre niveau » et la pause sert à sortir en cours de trajet ; le risque d'encombrement en portrait (R3) est contrôlé par un e2e.
- Confirmation avant de quitter un trajet en cours : oui ou non. Recommandation : non, car quitter se fait depuis la pause et la perte se limite à un trajet.
- État au retour : niveau jeté (nouvelle partie à la prochaine entrée) ou conservé (reprise là où on l'a quitté). Recommandation : jeté, car état simple, déterministe, sans mémoire cachée ; conserver impliquerait de garder une instance et de décider comment gérer la pause.
Échap dans un niveau garde son rôle actuel (D23) ; ce n'est pas rouvert ici.

**Q4. Que dit chaque entrée du menu ?**
- Contenu : (i) nom seul (« Niveau 1 : le vide », clé existante) ; (ii) numéro, nom et une courte étiquette du concept travaillé ; (iii) idem plus une vignette dessinée.
- Niveau 2 : (i) absent tant qu'il n'existe pas ; (ii) présent et désactivé avec une mention « bientôt », et une phrase de ta main sur ce qu'il apportera (D20).
Recommandation : contenu (i) et niveau 2 (ii) seulement si tu fournis le texte FR et EN. Sinon : un seul niveau listé. Raison : ces textes sont du contenu pédagogique et du lore qui t'appartiennent ; je n'en invente pas.

**Q5. Forme exacte de la mention de copyright.**
- (i) Reprise stricte de la ligne de `LICENSE` : « Copyright (c) 2026 lucashg7892 » plus « MIT License » (FR : « Licence MIT »).
- (ii) Même contenu avec le symbole « © » : « © 2026 lucashg7892 » ; le test de §5 vérifierait alors année et titulaire contre `LICENSE` plutôt que la ligne entière.
- Où : écran titre seulement, ou aussi menu, ou aussi page de repli. Lien vers le texte complet de la licence : oui ou non (le dépôt est privé, D17 ; un lien vers `LICENSE` ne serait accessible qu'après publication).
Recommandation : (i), titre seulement, sans lien. Raison : c'est le texte du fichier, vérifiable à l'identique, et D22 ne demande rien d'autre.

**Q6. Échap sur le titre et le menu.**
- Option 1 : titre : rien ; menu : retour au titre.
- Option 2 : Échap ne fait rien sur ces deux écrans (retour par le bouton « Retour » seulement).
Recommandation : option 1. Raison : cohérent avec D23 (Échap ferme ou recule) et utile au clavier ; aucune perte de données possible.

**Q7. Bouton « Précédent » du navigateur.**
- Option 1 : aucune gestion ; « Précédent » quitte le site, comme aujourd'hui (pas de routeur, pas de dépendance, ADR-001).
- Option 2 : l'écran courant est reflété dans l'historique (History API) pour que « Précédent » revienne au menu.
Recommandation : option 1. Raison : option 2 ajoute un état partagé avec l'URL, des cas limites (rechargement en plein niveau, liens profonds, mode e2e) et n'est pas demandé par D22 ; à reprendre si des joueurs en demandent.

Ce que la spec ne tranche pas non plus et laisse au réalisateur (décisions de détail, à signaler en une ligne dans son compte rendu) : noms de fichiers internes, structure interne du DOM des écrans, forme exacte du garde de K24 (`inert` ou garde), gestion d'une commande reçue pendant une notification de la machine.

## Écarts à la réalisation

Section ajoutée par le rédacteur après la réalisation, sur l'état du commit `119519b` (2026-11-13). Le reste de cette spec, rédigé par le concepteur au commit `0db54c1`, n'est pas modifié ; quand la spec et le code divergent, le code fait foi. Sources : le code et les tests du commit `119519b`, les commits `7e61f7d`, `6aef101` et `e9ce171`. Aucun log de T-017 n'a été lu par le rédacteur.

### Ce qui a été réalisé, sous quels noms

| Tâche de la spec | Réalisée sous le nom | Commit | Contenu réel |
|---|---|---|---|
| T-017a, T-017b, T-017c | **T-017abc** (classée N2 dans le message du commit ; la spec classait T-017b en N3, retouche d'un rendu approuvé) | `7e61f7d` | `src/app` (`index.ts`, `screens.ts`, `levels.ts`), règle `app-is-pure`, `render-deps` étendue à `app`, `tsconfig.sim.json` ; `RenderSession.attachLevel` et `detachLevel` ; `Ui.destroy()`, K23 (papier de l'aide opaque), K24 (`commandsBlocked`), `<html lang>` et titre du document déplacés vers `main.ts`, nom et `aria-hidden` du canvas |
| T-017d | **T-017d** | `6aef101` | `src/ui/screens.ts`, `screens-model.ts`, `screen-keys.ts`, `screens.css` ; clés `title.` (3) et `menu.` (5) ; `tests/i18n/license.test.ts` |
| T-017e | **T-017e** | `e9ce171` | composition dans `main.ts`, bouton « Menu », K18 (`ResizeObserver`), mode `?e2e=1&screen=`, `tests/e2e/screens.spec.ts`, captures `t017-*.png` |

### Écarts

- **Les e2e sans `e2e=1` passent désormais par le titre** : `open()` de `ui.spec.ts` clique « Jouer » puis le premier niveau. Avec `?e2e=1`, le paramètre `screen` (défaut `level1`) garde les autres tests valables sans réécriture, comme prévu au §3.3 ; il accepte en plus la valeur `level2` (ajoutée par T-021b).
- **Bouton de retour au menu** (Q3) : réalisé selon l'option (ii) : visible **en pause** (barre du haut) et dans le **panneau d'issue**, pas en permanence dans la barre du haut. Pas de confirmation ; niveau jeté au retour. En portrait étroit (≤ 700 px), le titre et l'étiquette Kp de la barre sont masqués par CSS en pause pour faire tenir les quatre boutons : le risque R3 a été traité ainsi (défaut K26, à valider côté design).
- **Écran titre** (Q2) : option 2 (titre, sous-titre `app.tagline`, bouton « Jouer », bouton de langue, copyright). Pas de `title.screenLabel` : le `<h1>` nomme l'écran. Le copyright est la ligne exacte de `LICENSE` (Q5 option i), sur le titre seulement, sans lien ; il est posé directement sur le papier et une ligne de grille le traverse (K27).
- **Menu** : nom du niveau seul (Q4 contenu i) ; le niveau 2 y est entré avec T-021b, jouable (la spec ne prévoyait qu'une entrée). Pas de sauvegarde ni de déblocage (Q1 option 1). Échap : titre, rien ; menu, retour (Q6 option 1). Pas de gestion du bouton « Précédent » (Q7 option 1).
- **Annonce d'écran** : chaque écran porte sa propre région `aria-live="polite"`, écrite 100 ms après le montage ; la spec prévoyait une région permanente hors de l'interface du niveau.
- **Clés** : 8 clés (`title.play`, `title.copyright`, `title.license`, `menu.title`, `menu.back`, `menu.listLabel`, `menu.announce.title`, `menu.announce.menu`) plus `controls.menu` (T-017e). La liste des textes identiques en FR et EN est passée de 5 à 9 entrées avec les tâches suivantes (`title.copyright`, `controls.menu`, `hud.gauge.max`, `hud.ki.tag`), pas de 5 à 6. Total de clés au commit `119519b` : 158 (115 au commit de la spec).
- **Tests prévus au §8 non réalisés** : l'e2e tactile émulé (`hasTouch`) et l'e2e en mouvement réduit émulé (K13 reste ouvert pour les écrans) ; la capture de l'aide ouverte pendant un trajet (K23) n'est pas dans `docs/img/` (`ui.spec.ts` (p) ne l'écrit que si la variable d'environnement `CAPTURE_DIR` est définie). Le test des allers-retours (e), le test de langue (g), le repli `?renderer=none` (h) et le repli après échec sur le menu existent (`screens.spec.ts` (d), (e), (f), (g)).
- **Défauts de la §7** : K23, K24 et K18 sont corrigés comme prévu ; K10 et K22 restent ouverts ; K9 s'étend aux nouveaux écrans.
- **Chiffres relevés au commit `119519b`** : `lint:arch` compte 67 modules (la spec n'en donnait pas), 9 règles (8 avant) ; `npm test` 586 tests ; `npx playwright test --list` 69 tests dans 7 fichiers.
- **Documentation** (§10) : réalisée par D-015 ; la spec demandait « jeu.md : le niveau est recréé à chaque entrée depuis le menu », fait ; ADR-015 créée.
