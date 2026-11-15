# ADR-015 — État d'application : machine d'écrans pure et session de rendu unique

## Contexte

Avant T-017, `src/main.ts` créait un seul niveau et un seul rendu au démarrage et ne les détruisait jamais. La décision D22 de l'utilisateur ajoute un écran titre (« Jouer », copyright) puis un menu des niveaux, et la décision D20 un second niveau : il faut donc un « écran courant », la possibilité de quitter un niveau pour revenir au menu, et un moyen de gérer le rendu entre les écrans. La spec [T-017](../specs/T-017-ecran-titre-et-menu.md) (§3.1 et §3.4) a posé deux questions : où vit l'état « écran courant » (options A et B), et que devient la session de rendu entre les écrans (options S1 et S2).

## Décision

- **Option A : une petite machine d'application pure, `src/app`.** Elle tient `{ screen: 'title' | 'menu' | 'level', levelId }` et expose `play`, `openLevel(id)`, `back`, `leaveLevel` (qui renvoient `ok`, `ignored` ou `invalid`, sans exception) et `subscribe`. Depuis la v0.3 (D33, T-036), une cinquième commande, `nextLevel`, passe d'un niveau au suivant jouable du catalogue : voir « Évolution v0.3 » plus bas. Elle ne connaît que des identifiants de niveau : ni DOM, ni rendu, ni textes. `main.ts` s'abonne et, à chaque changement, démonte l'écran précédent et monte le suivant. Une règle de dependency-cruiser (`app-is-pure`) et un test de lecture des sources (`tests/app/units.test.ts`) l'imposent ; `render-deps` est étendue pour interdire `render → app`.
- **Option S1 : une seule session de rendu pour toute l'application.** Elle démarre au chargement en papier seul ; `RenderSession.attachLevel(level)` crée la vue du niveau et `detachLevel()` la libère (T-017b).
- **Le niveau est jeté au retour au menu** : chaque entrée crée un niveau neuf (état initial, déterministe, rien à nettoyer). La pause et l'aide restent locales au niveau et à son interface (T-015).
- **L'interface du niveau est détruite et recréée** à chaque entrée (`Ui.destroy()`, T-017c, voir [ADR-011](ADR-011-interface-dom.md)).

## Alternatives écartées

| Option | Raison |
|---|---|
| B. Un champ « écran » dans `main.ts` ou dans `ui` (variable locale et `if`) | non testable sous Node (DOM ou composition) ; `overlay.ts` (environ 700 lignes) porterait aussi le titre et le menu ; la logique « retour au menu depuis le niveau » serait dispersée |
| écran courant dans `Level1` | l'[ADR-009](ADR-009-machine-a-etats.md) écarte la logique dans l'interface, et un niveau n'a pas à connaître le menu qui le contient ; l'écran n'est pas une phase de niveau |
| S2. Arrêter la session (`stop()`) puis rappeler `startRendering` à chaque entrée ou sortie | recrée le renderer (initialisation asynchrone) et le contexte GPU sur le même canvas, ce que le code ne fait nulle part ; la réutilisation du canvas après `disposeRenderer` n'était pas établie, et c'est le terrain des défauts K8 et K16 |
| niveau conservé au retour au menu | oblige à garder une instance et à décider comment gérer la pause ; état caché au lieu d'un état initial simple et déterministe |

## Conséquences

- La machine est testée sous Node sans navigateur : 26 tests dans `tests/app/machine.test.ts` (20 à l'origine ; table de transitions complète, abonnement, commande reçue pendant une notification ; +6 avec `nextLevel`, T-036) et 1 dans `tests/app/units.test.ts`.
- Une règle de dépendances de plus (9 au lieu de 8) et un module de plus (`src/app`, 3 fichiers) ; `tsconfig.sim.json` inclut `src/app/**` (sans `DOM`). `lint:arch` compte 67 modules au commit `119519b`.
- Le rendu garde un seul renderer et un seul canvas ; seule la vue du niveau est créée et détruite à chaud ([rendu.md](../rendu.md#cycle-de-vie-de-la-session-t-017)). Pendant le titre et le menu, la boucle d'images tourne en papier seul : le coût en images et en batterie n'a pas été mesuré (risque R5 de la spec).
- Chaque entrée dans un niveau recrée l'interface et le clavier : tout écouteur oublié s'accumulerait. L'e2e (d) de `screens.spec.ts` (trois allers-retours : une seule interface, un seul effet par frappe) et (q) de `ui.spec.ts` (attach, detach, attach) le contrôlent.
- `main.ts` reste le seul endroit qui connaît tous les modules ([architecture.md](../architecture.md#ce-que-fait-srcmaints)). En mode `?e2e=1`, le paramètre `screen=title|menu|level1|level2` choisit l'écran de départ (défaut `level1`) ; sans `e2e=1`, le jeu s'ouvre sur le titre.
- Ni progression ni sauvegarde, ni gestion du bouton « Précédent » du navigateur : l'architecture le permettrait plus tard sans toucher à la machine (spec T-017, §3.5, Q1 et Q7).
- Le retour au menu se fait sans confirmation et perd le trajet en cours (bouton « Menu » visible en pause et dans le panneau d'issue).

## Évolution v0.3 (lot A, 2026-11-15) : la commande `nextLevel`

Décision D33 du registre, tâche T-036 (N2, sans validateur indépendant). L'écran de réussite propose un bouton « Niveau suivant » à côté de « Rejouer » et de « Menu » ([interface.md](../interface.md#issue)). Côté `src/app` :

- `nextLevelId(levelId, levels = LEVELS)` (`levels.ts`, exportée par `src/app/index.ts`) renvoie l'identifiant du niveau jouable qui suit `levelId` dans le catalogue, ou `null` si `levelId` est inconnu ou dernier. Un niveau non jouable est sauté.
- `AppMachine.nextLevel()` : de l'écran `level` vers `level` avec le niveau suivant (neuf, comme à chaque entrée) ; `ignored` hors niveau ou s'il n'y a pas de suivant. Notification faite avec l'écran précédent `level`, comme les autres commandes. Deux commandes de suite ne sautent pas un niveau : le test vérifie que le niveau 2 ne mène pas à un troisième.

| Depuis | Commande | Vers |
|---|---|---|
| `level` (avec un suivant jouable) | `nextLevel` | `level` (le suivant, neuf) |
| `title`, `menu`, `level` sans suivant | `nextLevel` | inchangé (`ignored`) |

Le choix reste celui de la décision d'origine : l'interface du niveau est détruite et recréée, le niveau jeté. `main.ts` ne donne l'option `onNext` à `createUi` que si `nextLevelId(levelId)` n'est pas `null` : le bouton n'existe pas au dernier niveau. Le crochet de test expose `window.__huygens.app.nextLevel()`.

Détails : [architecture.md](../architecture.md), [interface.md](../interface.md), [jeu.md](../jeu.md).

## Statut

Acceptée (T-017abc ; 2026-11-13). Évolution v0.3 : D33, T-036 (2026-11-14), sur la branche `v0.3-salle-de-controle` non fusionnée.
