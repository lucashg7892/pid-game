# Huygens’s world

_Dépôt `pid-game` · jeu web éducatif sur l'automatique et le contrôleur PID._

![Le niveau 1 : la cabine monte, sa hauteur se trace au crayon sur le mur de la cage](docs/img/t010-03-trajet.png)

Un bonhomme bâton dessiné au crayon traverse un monde de papier millimétré ; chaque obstacle est un système dont le joueur règle le contrôleur. Titre provisoire « Huygens’s world », en hommage à Christiaan Huygens.

_English version below._

## Jouer en ligne

**<https://lucashg7892.github.io/pid-game/>**, dans un navigateur récent (Chrome, Edge ou Firefox ; WebGPU ou WebGL2).

## Comment jouer

1. Sur l'écran titre, choisissez **Jouer**, puis un niveau dans le menu.
2. Marchez jusqu'à la console avec **→** (ou **D**), puis appuyez sur **E**.
3. Réglez le gain avec **+** et **−**, puis lancez l'ascenseur avec **E** ou **Entrée**.
4. Gain trop faible : la cabine s'arrête trop bas ; trop fort : elle heurte la poutre. **R** pour réessayer, **?** pour l'aide.

## État actuel

**Version 0.2.0** (2026-11-14) : écran titre, menu et deux niveaux jouables, en français et en anglais.

- **Niveau 1 : le vide.** Contrôleur proportionnel : on règle Kp.
- **Niveau 2 : la mémoire.** Contrôleur PI : Kp est fixé, on règle Ki.
- Noyau de simulation validé contre un oracle exact MATLAB, hors du site, pour les contrôleurs P et PI.
- 661 tests unitaires et 108 tests de bout en bout ; intégration continue à chaque push sur `main` ; site publié automatiquement depuis `main`.
- Limites : WebGPU réel n'est exercé par aucun test automatique ; commandes tactiles non essayées sur un vrai écran tactile ; affichage en portrait étroit perfectible. Liste complète : [docs/defauts-connus.md](docs/defauts-connus.md).

En préparation (v0.3) : pupitre de contrôle avec courbes et moteur du treuil en écorché, tableau d'école avec les équations, animations d'embarquement et de sortie, bouton « Niveau suivant ».

Le détail est dans [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Prérequis

- Node.js **22.12.0 ou plus récent** (`engines` de `package.json`). Vitest 5.1.0 l'exige.
- `.nvmrc` contient `22` : avec nvm, vérifiez que la version obtenue est au moins 22.12.
- npm (testé avec npm 10.9.9 et Node v22.23.4).

## Installation et lancement

Pas à pas sous Windows : [tutoriel « Lancer le projet sur son PC »](docs/tutoriel-lancer-en-local.md).

```sh
npm ci
npm run dev
```

Ouvrez l'adresse affichée par Vite (par défaut `http://localhost:5173/pid-game/`). Sous PowerShell, si `npm` est refusé, utilisez `npm.cmd`.

`node_modules/` contient des binaires natifs propres au système. S'il a été installé sous Linux, relancez `npm ci` sous Windows (et inversement).

## Scripts principaux

| Commande           | Effet                                                              |
| ------------------ | ------------------------------------------------------------------ |
| `npm run dev`      | serveur de développement Vite                                      |
| `npm run check`    | typecheck, lint, tests puis build ; à lancer avant toute livraison |
| `npm run test`     | tests unitaires Vitest                                             |
| `npm run test:cov` | tests unitaires et couverture de `src/sim`                         |
| `npm run e2e`      | tests de bout en bout (après `npx playwright install chromium`)    |
| `npm run build`    | build de production dans `dist/` (base `/pid-game/`)               |

Liste complète : [docs/developpement.md](docs/developpement.md).

## Documentation

Index : [docs/README.md](docs/README.md). Bilan de la version : [docs/bilan-v0.1.md](docs/bilan-v0.1.md). Défauts connus : [docs/defauts-connus.md](docs/defauts-connus.md). Pour commencer : [interface du joueur](docs/interface.md), [rendu au crayon](docs/rendu.md), [noyau de simulation](docs/simulation.md), [physique de l'ascenseur](docs/physique/ascenseur.md).

## Licence

MIT. Voir le fichier [LICENSE](LICENSE). Police Patrick Hand : SIL Open Font License 1.1 (`public/fonts/OFL.txt`).

---

# Huygens’s world (English)

_Repository `pid-game` · an educational web game about control theory and the PID controller._

A pencil-drawn stick figure walks across graph paper; each obstacle is a system whose controller the player tunes. Working title "Huygens’s world", a tribute to Christiaan Huygens.

## Play online

**<https://lucashg7892.github.io/pid-game/>**, in a recent browser (Chrome, Edge or Firefox; WebGPU or WebGL2).

## How to play

1. On the title screen, choose **Play**, then a level from the menu.
2. Walk to the console with **→** (or **D**), then press **E**.
3. Set the gain with **+** and **−**, then launch the lift with **E** or **Enter**.
4. Gain too low: the lift stops short; too high: it hits the beam. **R** to try again, **?** for help.

## Current status

**Version 0.2.0** (2026-11-14): title screen, menu and two playable levels, in French and English.

- **Level 1: The Gap.** Proportional controller: you tune Kp.
- **Level 2: Memory.** PI controller: Kp is fixed, you tune Ki.
- Simulation core checked against an exact MATLAB oracle, outside the site, for both the P and PI controllers.
- 661 unit tests and 108 end-to-end tests; continuous integration on every push to `main`; the site is deployed automatically from `main`.
- Limits: real WebGPU is not exercised by any automated test; touch controls not tried on a real touch screen; narrow portrait layout could be better. Full list of known issues (in French): [docs/defauts-connus.md](docs/defauts-connus.md).

Coming next (v0.3): a control desk with live charts and a cutaway of the winch motor, a classroom blackboard with the equations, boarding and exit animations, and a "Next level" button.

## Requirements

- Node.js **22.12.0 or later** (required by Vitest 5.1.0). `.nvmrc` says `22`: make sure you get at least 22.12.
- npm.

## Install and run

Step-by-step guide for Windows (in French): [docs/tutoriel-lancer-en-local.md](docs/tutoriel-lancer-en-local.md).

```sh
npm ci
npm run dev       # Vite dev server, then open http://localhost:5173/pid-game/
npm run check     # typecheck, lint, test, build
npm run test:cov  # unit tests with coverage of src/sim
```

On Windows PowerShell, if `npm` is blocked by the execution policy, use `npm.cmd`. End-to-end tests: `npx playwright install chromium`, then `npm run e2e`.

`node_modules/` contains platform-specific binaries: reinstall with `npm ci` when switching between Linux and Windows.

## Documentation

Technical documentation is in French: [docs/README.md](docs/README.md).

## License

MIT. See the [LICENSE](LICENSE) file. Patrick Hand font: SIL Open Font License 1.1.
