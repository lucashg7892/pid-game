# Développement

À quoi sert cette page : installer le projet, connaître chaque script npm et les conventions de code. État au commit `02119f7` pour le code ; intégration continue et déploiement au commit `88ae23c` (T-011). Pour un pas-à-pas sous Windows destiné à un non-développeur, voir le [tutoriel de lancement local](tutoriel-lancer-en-local.md).

## Prérequis

| Outil | Version | Source |
|---|---|---|
| Node.js | ≥ 22.12.0 | `engines.node` de `package.json` ; exigé par Vitest 5.1.0 (spec T-001 §2) |
| nvm (facultatif) | — | `.nvmrc` contient `22` |
| npm | fourni avec Node | versions utilisées sur la VM du projet : Node v22.23.4, npm 10.9.9 (`node -v`, `npm -v`) |

Attention : `.nvmrc` contient la constante `22` (version majeure seulement), alors que le minimum réel est 22.12.0 (`engines`). `nvm install` peut donc choisir une version 22 trop ancienne si elle est déjà installée. Vérifiez avec `node -v` : la valeur doit être ≥ v22.12.0.

La version de Node installée sur le PC Windows de l'utilisateur n'est pas connue (spec T-001 §12, Q5).

## Installation

```sh
npm ci
```

`npm ci` installe exactement les versions de `package-lock.json`.

`node_modules/` contient des binaires propres au système. Exemple : Vite 8 utilise Rolldown, installé ici sous forme de `@rolldown/binding-linux-x64-gnu`. Le `node_modules/` du dossier `PID_GAME` a été installé sous Linux et sert aux agents de développement : ne relancez pas `npm ci` sous Windows dans ce dossier. Pour travailler sous Windows, utilisez une copie : procédure complète dans le [tutoriel](tutoriel-lancer-en-local.md).

Pour les tests e2e, installez aussi Chromium pour Playwright : `npx playwright install chromium`. Si le téléchargement est impossible (réseau filtré) et qu'un Chrome est déjà installé, indiquez son chemin par la variable `PW_CHROME_PATH` (voir plus bas).

## Scripts npm

Commandes exactes de `package.json` au commit `02119f7` (11 scripts, inchangés depuis `7bcd9ce` ; la version du paquet est 0.2.0). Sous PowerShell, écrire `npm.cmd` et `npx.cmd`.

| Script | Commande | Usage |
|---|---|---|
| `npm run dev` | `vite` | serveur de développement avec rechargement à chaud |
| `npm run typecheck` | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit` | vérifie les types de tout le projet, puis de `src/sim`, `src/game` et `src/app` sans DOM |
| `npm run lint` | `eslint . --max-warnings 0 && prettier --check . && depcruise src --config .dependency-cruiser.cjs` | lint, formatage et règles d'architecture ; aucun avertissement toléré |
| `npm run lint:arch` | `depcruise src --config .dependency-cruiser.cjs` | règles d'architecture seules |
| `npm run format` | `prettier --write .` | reformate les fichiers (hors `docs/` et `orchestration/`, voir `.prettierignore`) |
| `npm run test` | `vitest run` | tests unitaires, une passe |
| `npm run test:cov` | `vitest run --coverage` | tests unitaires et couverture de `src/sim` ; échoue sous 95 % des lignes ou 90 % des branches (voir [tests.md](tests.md#couverture)) |
| `npm run build` | `vite build` | build de production dans `dist/` |
| `npm run preview` | `vite preview` | sert le contenu de `dist/` |
| `npm run e2e` | `playwright test` | tests de bout en bout (108 au commit `02119f7`, 74 à `a308ada`, 70 à `08908b6`, 69 à `119519b`, relevés par `npx.cmd playwright test --list`) dans Chromium, contre le build servi par `vite preview` ; construit le site avant (voir [tests.md](tests.md#tests-de-bout-en-bout-playwright)) |
| `npm run check` | `npm run typecheck && npm run lint && npm run test && npm run build` | vérification complète avant livraison |

### Tests de bout en bout et `PW_CHROME_PATH`

Depuis T-008, `playwright.config.ts` limite Playwright à `tests/e2e/` (l'ancien échec de D-002, où Playwright ramassait `tests/smoke.test.ts`, est corrigé). `npm run check` ne lance pas les tests e2e.

```sh
npx playwright install chromium   # une fois, sur un poste avec accès réseau
npm run e2e
```

Si la variable d'environnement `PW_CHROME_PATH` est définie et non vide, Playwright utilise cet exécutable au lieu de son Chromium (`launchOptions.executablePath`) :

```sh
PW_CHROME_PATH=/usr/bin/google-chrome npx playwright test
```

La VM des agents ne peut pas télécharger de navigateur : les tests e2e y sont écrits mais exécutés par l'orchestrateur dans son environnement, avec cette commande (Chrome for Testing 153, headless, SwiftShader). Voir [ADR-012](decisions/ADR-012-tests-navigateur.md).

Le script `test:cov` a été ajouté par T-003 avec le paquet `@vitest/coverage-v8` 5.1.0 (seule dépendance ajoutée, log T-003). `npm run check` ne le lance pas : lancez-le à part avant de livrer une modification de `src/sim`.

## Conventions de code

| Convention | Comment elle est appliquée |
|---|---|
| TypeScript strict | `tsconfig.json` : `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`, `verbatimModuleSyntax` |
| Pas de `any` | ESLint `tseslint.configs.strictTypeChecked` (dont `@typescript-eslint/no-explicit-any`) ; `--max-warnings 0` |
| Pas de contournement | aucune occurrence de `ts-ignore`, `eslint-disable` ou `skipLibCheck` (recherche de l'orchestrateur, log T-002) |
| Formatage | Prettier : guillemets simples, virgules finales, 100 colonnes, fins de ligne LF (`.prettierrc.json`) |
| Fins de ligne | LF partout (`.gitattributes` : `* text=auto eol=lf`) |
| Commentaires | JSDoc en français sur les exports. Convention suivie par le code existant, non vérifiée par un outil |
| Unités | SI partout (m, s, kg, N), noms et commentaires qui précisent l'unité (spec T-001 §4). Convention non vérifiée par un outil |
| Architecture | règles de dépendances et noyau pur : voir [architecture.md](architecture.md) |

Cible de compilation : ES2023 (`tsconfig.json` et `build.target` de `vite.config.ts`).

## Arborescence au commit `02119f7`

Liste tirée de `git ls-files`.

```text
.dependency-cruiser.cjs  eslint.config.js  index.html  package.json  package-lock.json
tsconfig.json  tsconfig.sim.json  vite.config.ts  vitest.config.ts  playwright.config.ts
LICENSE  README.md  .nvmrc  .prettierrc.json  .prettierignore  .gitignore  .gitattributes
public/        favicon.svg ; fonts/ : Patrick Hand (2 fichiers woff2) et OFL.txt
src/main.ts    point de composition
src/sim/       noyau de simulation (10 fichiers dont controllers/pi.ts), voir simulation.md
src/i18n/      i18n FR/EN (7 fichiers TypeScript + locales/fr.json, locales/en.json)
src/app/       état d'application : machine d'écrans et catalogue (3 fichiers), voir architecture.md
src/game/      logique des niveaux 1 et 2 (9 fichiers), voir jeu.md
src/render/    rendu au crayon (19 fichiers), voir rendu.md
src/ui/        interface et écrans titre et menu (12 fichiers TypeScript + ui.css + screens.css), voir interface.md
tests/smoke.test.ts  tests/sim/ (12 fichiers)  tests/i18n/ (6 fichiers)  tests/app/ (2 fichiers)
tests/game/    7 fichiers de test + helpers.ts (outils partagés)
tests/render/  13 fichiers de test
tests/ui/      8 fichiers de test + helpers.ts
tests/e2e/     10 fichiers .spec.ts + console.ts, overlay.ts, png.ts
docs/img/      35 captures PNG (voir README.md, section Captures)
validation/    oracle MATLAB de T-005 et de T-023 : matlab/ (9 scripts t005_*, 8 scripts t018_*), data/ (5 CSV), README.md
docs/  orchestration/
```

`dist/`, `node_modules/` et `coverage/` ne sont pas versionnés. Les sorties des tests e2e (`playwright-report/`, `test-results/`) sont aussi ignorées par git. Le dépôt git (branche `main`) avait 15 commits au commit `566a8a3` (`git rev-list --count 566a8a3`) ; la correspondance tâche → commit est dans [CHANGELOG.md](CHANGELOG.md#correspondance-tâche--commit). Depuis T-011 (commit `8736af7`), `.github/workflows/` contient `ci.yml` et `deploy.yml` (sections suivantes). Le dépôt a 18 commits au commit `88ae23c` (`git rev-list --count 88ae23c`) 39 au commit `119519b`, 47 au commit `a308ada` et 58 au commit `02119f7` (`git rev-list --count HEAD`, branche `migration`). `CLAUDE.md` à la racine donne les règles de travail du projet.

## Licence

MIT, titulaire lucashg7892 (décision D12 du registre). Texte dans `LICENSE` à la racine. Voir [ADR-008](decisions/ADR-008-licence-mit.md).

## Intégration continue

`.github/workflows/ci.yml` (T-011) : à chaque push sur `main` et à chaque pull request, GitHub Actions installe Node 22, lance `npm ci`, `npm run check`, installe Chromium (`npx playwright install --with-deps chromium`) puis lance `npm run e2e`. En cas d'échec, le rapport Playwright est déposé comme artefact pendant 14 jours. Détails : [tests.md](tests.md#intégration-continue). Au commit `88ae23c`, la CI n'avait encore jamais tourné sur GitHub (log `orchestration/logs/T-011-013.md`) : première exécution au prochain push.

## Déploiement sur GitHub Pages

Le site est publié sur **<https://lucashg7892.github.io/pid-game/>** (décision D39 du registre, 2026-11-19 : dépôt rendu public). `.github/workflows/deploy.yml` se lance à chaque push sur `main`, et à la main depuis Actions > Deploy > Run workflow. Il fait `npm ci`, `npm run build` (base `/pid-game/`), puis publie `dist/` avec `actions/upload-pages-artifact` et `actions/deploy-pages`. Avant D39, il était manuel (décision D17, [ADR-013](decisions/ADR-013-ci-et-pages-manuel.md)).

Ce qui est en place :

- Dépôt GitHub public : <https://github.com/lucashg7892/pid-game> (nom retenu par la décision D11 du registre).
- Remote `origin` du dossier local : `https://github.com/lucashg7892/pid-game.git` (`git remote -v`).
- `vite.config.ts` fixe `base: '/pid-game/'` : les URL du build sont préfixées par `/pid-game/`. Les tests e2e tournent déjà contre ce build, sous cette base.
- La page de repli (sans GPU) pointe vers `https://github.com/lucashg7892/pid-game#readme`, accessible au public depuis D39.
- Réglage GitHub nécessaire : Settings > Pages > Source : « GitHub Actions ».

Le site est servi sous le chemin `/pid-game/`, qui correspond à la base du build.

## Taille du bundle

| Commit | JavaScript | gzip | Source |
|---|---|---|---|
| socle T-002 | 812,66 kB | 219,75 kB | log T-002 |
| `566a8a3` | 885,25 kB | **246,57 kB** | `npx vite build` sur une extraction de `566a8a3` (rédacteur, 2026-11-13) |
| `119519b` | 907,32 kB | **252,72 kB** | `npm.cmd run build` (rédacteur, 2026-11-13, code de sortie 0) |
| `08908b6` | 907,79 kB | **252,84 kB** | `npm.cmd run build` (rédacteur, 2026-11-14, code de sortie 0) |
| `a308ada` | 909,76 kB | **253,52 kB** | `npm.cmd run build` (rédacteur, 2026-11-14, code de sortie 0 ; « 71 modules transformed ») |
| `02119f7` | 911,31 kB | **254,02 kB** | `npm.cmd run build` (rédacteur, 2026-11-14, code de sortie 0 ; « 71 modules transformed ») |

Un seul fichier JavaScript, dominé par `three/webgpu`. Feuille de style : 5,86 kB (2,09 kB gzip) à `566a8a3`, 7,30 kB (2,42 kB gzip) à `119519b` et `08908b6`, 7,51 kB (2,45 kB gzip) à `a308ada`, 7,70 kB (2,50 kB gzip) à `02119f7`. Polices : 23 944 et 20 112 octets, chargées à la demande. Vite affiche l'avertissement « Some chunks are larger than 500 kB after minification ». Budget visé par la spec T-001 §7 : 400 ko gzip pour le JS initial, respecté.
