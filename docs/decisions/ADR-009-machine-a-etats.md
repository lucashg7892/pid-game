# ADR-009 — Niveau en machine à états pure, pilotée par le temps d'image

## Contexte

Le niveau 1 enchaîne marche, réglage, trajet, issue et pause (spec T-001 §6). Ses issues doivent être reproductibles et testables sous Node, sans navigateur, et identiques quelle que soit la cadence d'écran. Le rendu (T-008, T-009) et l'interface (T-010) doivent lire son état à chaque image sans allouer de mémoire (budget de la spec §7).

## Décision

- `createLevel1` renvoie une machine à états à cinq phases (`approach`, `tuning`, `trip`, `outcome`, `paused`), sans DOM ni aléa ni horloge murale (T-007).
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
- Depuis T-021b (2026-11-13), la machine à cinq phases est extraite dans `createElevatorLevel` (`src/game/elevator-level.ts`), paramétrée par un identifiant, un réglage, une boucle et un arbitre ; `createLevel1` et `createLevel2` n'en sont que des enveloppes. Les décisions ci-dessus (instantané unique, file d'événements, `CommandResult`) s'appliquent à l'identique aux deux niveaux ; l'écran courant n'est pas une phase du niveau : il vit dans `src/app` ([ADR-015](ADR-015-etat-application-machine-ecrans.md)).

Détails : [jeu.md](../jeu.md).

## Statut

Accepté (T-007 ; 2026-11-12).
