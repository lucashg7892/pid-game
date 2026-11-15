# ADR-009 — Niveau en machine à états pure, pilotée par le temps d'image

## Contexte

Le niveau 1 enchaîne marche, réglage, trajet, issue et pause (spec T-001 §6). Ses issues doivent être reproductibles et testables sous Node, sans navigateur, et identiques quelle que soit la cadence d'écran. Le rendu (T-008, T-009) et l'interface (T-010) doivent lire son état à chaque image sans allouer de mémoire (budget de la spec §7).

## Décision

- `createLevel1` renvoie une machine à états à cinq phases (`approach`, `tuning`, `trip`, `outcome`, `paused`), sans DOM ni aléa ni horloge murale (T-007). Depuis la v0.3 (lot A), elle en a sept : voir « Évolution v0.3 » plus bas.
- Le temps entre par une seule porte, `update(frameSeconds)`, convertie en pas fixes par l'horloge du noyau. Les commandes du joueur sont des méthodes qui renvoient un `CommandResult` au lieu de lever une exception.
- L'état est publié dans un **instantané unique réutilisé** (`LevelSnapshot`), réécrit après chaque mise à jour.
- Les moments discrets passent par une **file d'événements** circulaire de 32 emplacements, consommés une seule fois (`drainEvents`).

## Alternatives écartées

| Option | Raison |
|---|---|
| logique dans le rendu ou l'interface, pilotée par `requestAnimationFrame` | non testable sous Node ; issue dépendante de la cadence d'images |
| nouvel objet d'état à chaque image (style immuable) | allocations à chaque image, contraires au budget « 0 allocation par image » |
| rappels (`onWin`, `onBonk`…) appelés pendant `update` | du code de l'interface s'exécuterait au milieu d'un pas ; ordre et réentrance plus difficiles à garantir |
| lecture des transitions dans l'instantané seul | une issue ou une première saturation pourrait être manquée ou annoncée deux fois |

## Conséquences

- Issues et pas d'issue identiques bit à bit pour 5 découpages en images différents (`tests/game/frames.test.ts`), et identiques à l'oracle de T-005.
- Le rendu et l'interface ne doivent ni conserver l'instantané ni les objets d'événements : ils les lisent et copient ce qu'ils gardent.
- Au-delà de 32 événements non consommés, les plus anciens sont perdus ; l'interface doit appeler `drainEvents` à chaque image.
- `Level1` n'expose pas le compteur `dropped` de la file.
- Depuis T-021b (2026-11-13), la machine (à cinq phases à l'époque) est extraite dans `createElevatorLevel` (`src/game/elevator-level.ts`), paramétrée par un identifiant, un réglage, une boucle et un arbitre ; `createLevel1` et `createLevel2` n'en sont que des enveloppes. Les décisions ci-dessus (instantané unique, file d'événements, `CommandResult`) s'appliquent à l'identique aux deux niveaux ; l'écran courant n'est pas une phase du niveau : il vit dans `src/app` ([ADR-015](ADR-015-etat-application-machine-ecrans.md)).

## Évolution v0.3 (lot A, 2026-11-15)

Cette section s'ajoute à l'historique ci-dessus, qui reste vrai pour les points qu'elle ne modifie pas. Elle documente T-037 (N3, validateur indépendant, log `orchestration/logs/T-037.md`) et les décisions D31 et D32 du registre : poste au pupitre, embarquement et sortie du bonhomme (K4). État du commit `3810193`, branche `v0.3-salle-de-controle`, non fusionnée.

**Décision.** Le niveau passe de cinq à **sept phases** (`LevelPhase`, `src/game/elevator-level.ts`) : `approach`, `tuning`, **`boarding`**, `trip`, **`exit`**, `outcome`, `paused`. Les animations du bonhomme (marche vers le poste, embarquement, sortie) sont dans la machine, sur les pas fixes de l'horloge du noyau, jamais sur le temps réel ; le contrat d'origine de T-007 les laissait au rendu (K4). Le rendu et l'interface lisent de nouveaux champs de l'instantané : `walkerY`, `walkerPrevY`, `walkerAction` (`free`, `toPost`, `atPost`, `boarding`, `inCabin`, `exiting`, `stepping`, `arrived`), `exitStepProgress`, `animationStep`, `animations`, `atPost`.

- `tuning` : E (`interact()`) s'accepte de n'importe où sur le quai de départ ; le panneau s'ouvre tout de suite et le bonhomme rejoint à 1,5 m/s le poste `CONSOLE_POST_X` = −1,55 m (placé aussitôt sans animations).
- `boarding` : après `launch()`, le bonhomme marche du poste au centre de la cabine (`CABIN_CENTER_X`) ; réglage verrouillé, physique à l'arrêt, consigne à 0, k = 0. Le trajet démarre à k = 0 à la fin de la marche ; ces pas ne comptent pas dans les 1200 du trajet.
- `exit` : après une **victoire** seulement. L'issue est jugée au pas de victoire (`outcome`, `outcomeK`, `finalError` figés) mais n'est affichée qu'à la fin de la sortie : la cabine est figée, le bonhomme marche jusqu'à `EXIT_END_X` = 4,6 m, la hauteur de ses pieds passe de la hauteur finale de la cabine à r pendant le pas de `EXIT_STEP_MIN_X` = 3,8 m à `EXIT_STEP_MAX_X` = 4 m. L'événement `outcome` n'est émis qu'en entrant dans `outcome`. Les échecs ne changent pas : `trip` → `outcome` directement.
- Les animations se coupent par l'option `animations` de la fabrique et par `setAnimations(enabled)` ; la logique ne lit pas `prefers-reduced-motion`, c'est `main.ts` qui passe `animationsSetting && !session.reducedMotion`. Sans animations : poste aussitôt, trajet parti dès `launch()`, issue de victoire affichée au pas de victoire, bonhomme resté dans la cabine.
- `skipAnimation()` termine l'animation en cours (poste, embarquement, sortie) ; `ignored` ailleurs et en pause.

Transitions ajoutées ou modifiées :

| Depuis | Commande ou événement | Vers |
|---|---|---|
| `approach` | `interact()` (n'importe où sur le quai) | `tuning` |
| `tuning` | `interact()` | `approach` |
| `tuning` | `launch()`, animations actives | `boarding` |
| `tuning` | `launch()`, sans animations | `trip` (aussitôt) |
| `boarding` | fin de la marche, ou `skipAnimation()` | `trip` (k = 0) |
| `trip` | victoire jugée, animations actives | `exit` |
| `trip` | échec, ou victoire sans animations | `outcome` |
| `exit` | fin de la sortie, ou `skipAnimation()` | `outcome` |
| `boarding`, `trip`, `exit`, `outcome` | `restart()` | `tuning` (bonhomme au poste) |
| toute phase sauf `paused` | `pause()` | `paused` |
| `paused` | `resume()` | la phase d'avant |

Commandes par phase (`setTuning` sous le nom commun ; résultat `CommandResult`) :

| Commande | `approach` | `tuning` | `boarding` | `trip` | `exit` | `outcome` | `paused` |
|---|---|---|---|---|---|---|---|
| `moveLeft()`, `moveRight()`, `stop()` | accepted | ignored | ignored | ignored | ignored | ignored | ignored |
| `interact()` | accepted | accepted (referme) | ignored | ignored | ignored | ignored | ignored |
| `setTuning(v)`, `adjustTuning(d)` | accepted | accepted | locked | locked | locked | locked | locked |
| `launch()` | ignored | accepted | ignored | ignored | ignored | ignored | ignored |
| `restart()` | ignored | ignored | accepted | accepted | accepted | accepted | ignored |
| `skipAnimation()` | ignored | accepted pendant la marche vers le poste, sinon ignored | accepted | ignored | accepted | ignored | ignored |
| `pause()` | accepted | accepted | accepted | accepted | accepted | accepted | ignored |
| `resume()` | ignored | ignored | ignored | ignored | ignored | ignored | accepted |

`setAnimations(enabled)` ne renvoie rien et vaut à tout moment ; le désactiver termine aussitôt l'animation en cours, comme `skipAnimation()` (aussi en pause : la phase à reprendre suit).

**Conséquences, mesures du log T-037** (relevées par le réalisateur, recoupées par le validateur indépendant) :

- Le trajet est identique bit à bit avec et sans animations : issue, pas d'issue, `finalError`, y final, `iTerm`, pas saturés, courbe et événements, sur 197 réglages (Kp 0 à 8000 par 100 et 150, 163, 164 ; Ki 0 à 8000 par 100 et 120 à 140, 840 à 850) ; 985 essais avec 5 découpages en images, 200 avec pauses dans chaque action, 6741 avec `skipAnimation` à chaque pas, 8 scénarios `setAnimations`, `restart` depuis chaque phase.
- Durées à 1,5 m/s : entrée → poste 316 pas (2,63 s), embarquement depuis le poste 284 pas (2,37 s), sortie 208 pas (1,73 s) dont 16 pour le pas de 0,2 m. Sur les 52 réglages gagnants, la variation de `walkerY` pendant le pas vaut `finalError` exactement (49 erreurs positives, 3 négatives : le pas monte ou descend).
- `launch` est émis au début de l'embarquement, donc environ 2,4 s avant le départ réel du trajet : l'interface diffère son annonce ([interface.md](../interface.md#annonces-pour-lecteurs-décran)) ; la phrase de `src/game/events.ts` (« départ d'un trajet ») n'est plus exacte (K50).
- La file d'événements, l'instantané unique et `CommandResult` ne changent pas ; `isRunningPhase` (embarquement, trajet, sortie : mises en pause par la perte de focus et l'ouverture de l'aide) et `isSkippablePhase` (embarquement, sortie) sont exportés par `src/game/index.ts`.
- Non prouvé : la mesure de tas des allocations par pas dans `boarding` et `exit` n'a pas été faite (lecture du code et test d'allocation existant, `tests/game/allocation.test.ts`, plus 53 tests de `tests/game/animations.test.ts`) ; tactile réel non essayé.

Détails : [jeu.md](../jeu.md#phases-et-transitions).

## Statut

Accepté (T-007 ; 2026-11-12). Évolution v0.3 : D31 et D32, T-037 (2026-11-14), sur la branche `v0.3-salle-de-controle` non fusionnée.
