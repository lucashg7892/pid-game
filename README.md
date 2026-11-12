# PID Game

Projet de jeu web éducatif destiné à enseigner les bases de l'automatique, jusqu'au contrôleur PID. Prévu : un bonhomme bâton dessiné au crayon traversera un monde de papier millimétré ; chaque obstacle sera un système dont le joueur règle le contrôleur.

_English version below._

## État actuel

**Rien n'est jouable.** Le dépôt contient le socle outillé, le noyau de simulation et les textes FR/EN, validés le 2026-11-12. Aucun de ces éléments n'est encore affiché dans le navigateur.

- Validé :
  - socle : npm, TypeScript, Vite, ESLint, Prettier, dependency-cruiser, Vitest, règles d'architecture (T-002) ;
  - noyau de simulation `src/sim` : horloge à pas fixe, RK4, saturation, enregistreur, contrôleur P, modèle de l'ascenseur, boucle fermée (T-003, T-004, T-004b) ;
  - validation indépendante du noyau par un oracle exact MATLAB, hors du site (T-005) ;
  - i18n FR/EN `src/i18n` : 89 clés par langue, interpolation, formatage des nombres (T-006) ;
  - 169 tests unitaires verts ; couverture de `src/sim` à 100 %.
- Prévu : logique du niveau 1 (T-007), rendu (T-008, T-009), interface et accessibilité (T-010), CI et GitHub Pages (T-011).

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

## Current status

**Nothing is playable yet.** The repository holds the tooling foundation, the simulation core and the French/English texts, validated on 2026-11-12. None of them is shown in the browser yet.

- Validated: tooling (T-002); simulation core `src/sim` with fixed-step clock, RK4, saturation, recorder, P controller, lift model and closed loop (T-003, T-004, T-004b); independent validation of the core against an exact MATLAB oracle, outside the site (T-005); French/English i18n `src/i18n` (T-006); 169 passing unit tests, 100% coverage of `src/sim`.
- Planned: level logic (T-007), rendering (T-008, T-009), UI and accessibility (T-010), CI and GitHub Pages deployment (T-011).

## Requirements

- Node.js **22.12.0 or later** (required by Vitest 5.1.0). `.nvmrc` says `22`: make sure you get at least 22.12.
- npm.

## Install and run

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
