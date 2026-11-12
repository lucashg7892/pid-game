# PID Game

Projet de jeu web éducatif destiné à enseigner les bases de l'automatique, jusqu'au contrôleur PID. Prévu : un bonhomme bâton dessiné au crayon traversera un monde de papier millimétré ; chaque obstacle sera un système dont le joueur règle le contrôleur.

_English version below._

## État actuel

Le dépôt contient seulement le **socle outillé** (tâches T-000 à T-002, validées le 2026-11-12). Rien n'est jouable.

- Validé : configuration npm, TypeScript, Vite, ESLint, Prettier, dependency-cruiser, Vitest ; un test fumée ; les règles d'architecture.
- Prévu : noyau de simulation (T-003, T-004), i18n (T-006), logique du niveau 1 (T-007), rendu (T-008, T-009), interface (T-010), CI et GitHub Pages (T-011).

Le détail est dans [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Prérequis

- Node.js **22.12.0 ou plus récent** (`engines` de `package.json`). Vitest 5.1.0 l'exige.
- `.nvmrc` contient `22` : avec nvm, vérifiez que la version obtenue est au moins 22.12.
- npm (testé avec npm 10.9.9 et Node v22.23.4).

## Installation

```sh
npm ci
```

`node_modules/` contient des binaires natifs propres au système. S'il a été installé sous Linux, relancez `npm ci` sous Windows (et inversement).

## Scripts principaux

| Commande        | Effet                                                              |
| --------------- | ------------------------------------------------------------------ |
| `npm run dev`   | serveur de développement Vite                                      |
| `npm run check` | typecheck, lint, tests puis build ; à lancer avant toute livraison |
| `npm run test`  | tests unitaires Vitest                                             |
| `npm run build` | build de production dans `dist/` (base `/pid-game/`)               |

Liste complète : [docs/developpement.md](docs/developpement.md).

## Documentation

Index : [docs/README.md](docs/README.md). Architecture : [docs/architecture.md](docs/architecture.md).

## Licence

Non décidée. Le dépôt ne contient pas encore de fichier `LICENSE`.

---

# PID Game (English)

A planned educational web game about control theory, up to the PID controller. Planned: a pencil-drawn stick figure will walk across graph paper; each obstacle will be a system whose controller the player tunes.

## Current status

The repository holds only the **tooling foundation** (tasks T-000 to T-002, validated on 2026-11-12). Nothing is playable yet. Simulation core, i18n, level logic, rendering, UI, CI and GitHub Pages deployment are planned (T-003 to T-011).

## Requirements

- Node.js **22.12.0 or later** (required by Vitest 5.1.0). `.nvmrc` says `22`: make sure you get at least 22.12.
- npm.

## Install and run

```sh
npm ci
npm run dev     # Vite dev server
npm run check   # typecheck, lint, test, build
```

`node_modules/` contains platform-specific binaries: reinstall with `npm ci` when switching between Linux and Windows.

## Documentation

Technical documentation is in French: [docs/README.md](docs/README.md).

## License

Not decided yet. There is no `LICENSE` file.
