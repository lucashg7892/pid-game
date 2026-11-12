# PID Game

Projet de jeu web éducatif destiné à enseigner les bases de l'automatique, jusqu'au contrôleur PID. Prévu : un bonhomme bâton dessiné au crayon traversera un monde de papier millimétré ; chaque obstacle sera un système dont le joueur règle le contrôleur.

Titre provisoire : « Huygens's world », en hommage à Christiaan Huygens. Le code affiche encore les anciens titres ; le changement est prévu avec l'interface (T-010).

_English version below._

## État actuel

**Rien n'est jouable ni affiché.** Le dépôt contient le socle outillé, le noyau de simulation, les textes FR/EN et la logique du niveau 1, validés le 2026-11-12. Aucun de ces éléments n'est encore affiché dans le navigateur : la page est blanche.

- Validé :
  - socle : npm, TypeScript, Vite, ESLint, Prettier, dependency-cruiser, Vitest, règles d'architecture (T-002) ;
  - noyau de simulation `src/sim` : horloge à pas fixe, RK4, saturation, enregistreur, contrôleur P, modèle de l'ascenseur, boucle fermée (T-003, T-004, T-004b) ;
  - validation indépendante du noyau par un oracle exact MATLAB, hors du site (T-005) ;
  - i18n FR/EN `src/i18n` : 89 clés par langue, interpolation, formatage des nombres (T-006) ;
  - logique du niveau 1 `src/game` : phases, réglage de Kp, règles de victoire et d'échec, événements (T-007) ;
  - 231 tests unitaires verts ; couverture de `src/sim` et de `src/game` à 100 %.
- Prévu : rendu (T-008, T-009), interface et accessibilité (T-010), CI et GitHub Pages (T-011).

Le détail est dans [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Prérequis

- Node.js **22.12.0 ou plus récent** (`engines` de `package.json`). Vitest 5.1.0 l'exige.
- `.nvmrc` contient `22` : avec nvm, vérifiez que la version obtenue est au moins 22.12.
- npm (testé avec npm 10.9.9 et Node v22.23.4).

## Installation

Pas à pas sous Windows : [tutoriel « Lancer le projet sur son PC »](docs/tutoriel-lancer-en-local.md).

```sh
npm ci
```

`node_modules/` contient des binaires natifs propres au système. S'il a été installé sous Linux, relancez `npm ci` sous Windows (et inversement).

## Scripts principaux

| Commande           | Effet                                                              |
| ------------------ | ------------------------------------------------------------------ |
| `npm run dev`      | serveur de développement Vite                                      |
| `npm run check`    | typecheck, lint, tests puis build ; à lancer avant toute livraison |
| `npm run test`     | tests unitaires Vitest                                             |
| `npm run test:cov` | tests unitaires et couverture de `src/sim`                         |
| `npm run build`    | build de production dans `dist/` (base `/pid-game/`)               |

Ne lancez pas `npm run e2e` avant T-010 : il n'y a pas encore de test de bout en bout. Liste complète : [docs/developpement.md](docs/developpement.md).

## Documentation

Index : [docs/README.md](docs/README.md). Pour commencer : [noyau de simulation](docs/simulation.md), [physique de l'ascenseur](docs/physique/ascenseur.md).

## Licence

MIT. Voir le fichier [LICENSE](LICENSE).

---

# PID Game (English)

A planned educational web game about control theory, up to the PID controller. Planned: a pencil-drawn stick figure will walk across graph paper; each obstacle will be a system whose controller the player tunes.

Working title: "Huygens's world", a tribute to Christiaan Huygens. The code still shows the old titles; the change is planned with the UI (T-010).

## Current status

**Nothing is playable or displayed yet.** The repository holds the tooling foundation, the simulation core, the French/English texts and the level 1 logic, validated on 2026-11-12. None of them is shown in the browser yet: the page is blank.

- Validated: tooling (T-002); simulation core `src/sim` with fixed-step clock, RK4, saturation, recorder, P controller, lift model and closed loop (T-003, T-004, T-004b); independent validation of the core against an exact MATLAB oracle, outside the site (T-005); French/English i18n `src/i18n` (T-006); level 1 logic `src/game` (T-007); 231 passing unit tests, 100% coverage of `src/sim` and `src/game`.
- Planned: rendering (T-008, T-009), UI and accessibility (T-010), CI and GitHub Pages deployment (T-011).

## Requirements

- Node.js **22.12.0 or later** (required by Vitest 5.1.0). `.nvmrc` says `22`: make sure you get at least 22.12.
- npm.

## Install and run

Step-by-step guide for Windows (in French): [docs/tutoriel-lancer-en-local.md](docs/tutoriel-lancer-en-local.md).

```sh
npm ci
npm run dev       # Vite dev server
npm run check     # typecheck, lint, test, build
npm run test:cov  # unit tests with coverage of src/sim
```

Do not run `npm run e2e` before T-010: there are no end-to-end tests yet.

`node_modules/` contains platform-specific binaries: reinstall with `npm ci` when switching between Linux and Windows.

## Documentation

Technical documentation is in French: [docs/README.md](docs/README.md).

## License

MIT. See the [LICENSE](LICENSE) file.
