# Développement

À quoi sert cette page : installer le projet, connaître chaque script npm et les conventions de code. État au commit `566a8a3` pour le code ; intégration continue et déploiement au commit `88ae23c` (T-011). Pour un pas-à-pas sous Windows destiné à un non-développeur, voir le [tutoriel de lancement local](tutoriel-lancer-en-local.md).

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

Commandes exactes de `package.json` au commit `7bcd9ce` (11 scripts).

| Script | Commande | Usage |
|---|---|---|
| `npm run dev` | `vite` | serveur de développement avec rechargement à chaud |
| `npm run typecheck` | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit` | vérifie les types de tout le projet, puis de `src/sim` et `src/game` sans DOM |
| `npm run lint` | `eslint . --max-warnings 0 && prettier --check . && depcruise src --config .dependency-cruiser.cjs` | lint, formatage et règles d'architecture ; aucun avertissement toléré |
| `npm run lint:arch` | `depcruise src --config .dependency-cruiser.cjs` | règles d'architecture seules |
| `npm run format` | `prettier --write .` | reformate les fichiers (hors `docs/` et `orchestration/`, voir `.prettierignore`) |
| `npm run test` | `vitest run` | tests unitaires, une passe |
| `npm run test:cov` | `vitest run --coverage` | tests unitaires et couverture de `src/sim` ; échoue sous 95 % des lignes ou 90 % des branches (voir [tests.md](tests.md#couverture)) |
| `npm run build` | `vite build` | build de production dans `dist/` |
| `npm run preview` | `vite preview` | sert le contenu de `dist/` |
| `npm run e2e` | `playwright test` | tests de bout en bout (28) dans Chromium, contre le build servi par `vite preview` ; construit le site avant (voir [tests.md](tests.md#tests-de-bout-en-bout-playwright)) |
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

## Arborescence au commit `566a8a3`

Liste tirée de `git ls-files`.

```text
.dependency-cruiser.cjs  eslint.config.js  index.html  package.json  package-lock.json
tsconfig.json  tsconfig.sim.json  vite.config.ts  vitest.config.ts  playwright.config.ts
LICENSE  README.md  .nvmrc  .prettierrc.json  .prettierignore  .gitignore  .gitattributes
public/        favicon.svg ; fonts/ : Patrick Hand (2 fichiers woff2) et OFL.txt
src/main.ts    point de composition
src/sim/       noyau de simulation (9 fichiers), voir simulation.md
src/i18n/      i18n FR/EN (7 fichiers TypeScript + locales/fr.json, locales/en.json)
src/game/      logique du niveau 1 (7 fichiers), voir jeu.md
src/render/    rendu au crayon (18 fichiers), voir rendu.md
src/ui/        interface (8 fichiers TypeScript + ui.css), voir interface.md
tests/smoke.test.ts  tests/sim/ (9 fichiers)  tests/i18n/ (5 fichiers)
tests/game/    6 fichiers de test + helpers.ts (outils partagés)
tests/render/  9 fichiers de test
tests/ui/      4 fichiers de test + helpers.ts
tests/e2e/     3 fichiers .spec.ts + console.ts, overlay.ts, png.ts
docs/img/      16 captures produites par les tests e2e
validation/    oracle MATLAB de T-005 : matlab/ (9 scripts), data/ (3 CSV), README.md
docs/  orchestration/
```

`dist/`, `node_modules/` et `coverage/` ne sont pas versionnés. Les sorties des tests e2e (`playwright-report/`, `test-results/`) sont aussi ignorées par git. Le dépôt git (branche `main`) a 15 commits au commit `566a8a3` (`git rev-list --count 566a8a3`) ; la correspondance tâche → commit est dans [CHANGELOG.md](CHANGELOG.md#correspondance-tâche--commit). Depuis T-011 (commit `8736af7`), `.github/workflows/` contient `ci.yml` et `deploy.yml` (sections suivantes). Le dépôt a 18 commits au commit `88ae23c` (`git rev-list --count 88ae23c`).

## Licence

MIT, titulaire lucashg7892 (décision D12 du registre). Texte dans `LICENSE` à la racine. Voir [ADR-008](decisions/ADR-008-licence-mit.md).

## Intégration continue

`.github/workflows/ci.yml` (T-011) : à chaque push sur `main` et à chaque pull request, GitHub Actions installe Node 22, lance `npm ci`, `npm run check`, installe Chromium (`npx playwright install --with-deps chromium`) puis lance `npm run e2e`. En cas d'échec, le rapport Playwright est déposé comme artefact pendant 14 jours. Détails : [tests.md](tests.md#intégration-continue). Au commit `88ae23c`, la CI n'avait encore jamais tourné sur GitHub (log `orchestration/logs/T-011-013.md`) : première exécution au prochain push.

## Déploiement sur GitHub Pages

Le déploiement est **prêt mais manuel** (décision D17 du registre, [ADR-013](decisions/ADR-013-ci-et-pages-manuel.md)). `.github/workflows/deploy.yml` se lance seulement depuis l'onglet Actions (`workflow_dispatch`). Il fait `npm ci`, `npm run build` (base `/pid-game/`), puis publie `dist/` avec `actions/upload-pages-artifact` et `actions/deploy-pages`. Il n'a jamais été lancé au commit `88ae23c`.

Ce qui est en place :

- Dépôt GitHub : <https://github.com/lucashg7892/pid-game> (nom retenu par la décision D11 du registre). Il est **privé** pour l'instant.
- Remote `origin` du dossier local : `https://github.com/lucashg7892/pid-game.git` (`git remote -v`).
- `vite.config.ts` fixe `base: '/pid-game/'` : les URL du build sont préfixées par `/pid-game/`. Les tests e2e tournent déjà contre ce build, sous cette base.
- La page de repli (sans GPU) pointe vers `https://github.com/lucashg7892/pid-game#readme` : ce lien ne fonctionnera pour le public qu'une fois le dépôt rendu public (réserve du log T-008).

GitHub Pages n'est pas disponible pour un dépôt privé avec un compte gratuit (défaut connu K14). Pour activer la publication, quand l'utilisateur décidera de rendre le dépôt public :

1. Rendre le dépôt public : Settings > General > Danger Zone > Change visibility.
2. Dans Settings > Pages, choisir la source « GitHub Actions ».
3. Lancer Actions > Deploy > Run workflow. Pour publier ensuite à chaque push sur `main`, ajouter sous `on:` de `deploy.yml`, au même niveau que `workflow_dispatch`, le déclencheur `push: branches: [main]` (commentaire en tête du fichier).

Le site sera alors servi sous le chemin `/pid-game/`, qui correspond à la base du build.

## Taille du bundle

| Commit | JavaScript | gzip | Source |
|---|---|---|---|
| socle T-002 | 812,66 kB | 219,75 kB | log T-002 |
| `566a8a3` | 885,25 kB | **246,57 kB** | `npx vite build` sur une extraction de `566a8a3` (rédacteur, 2026-11-13) |

Un seul fichier JavaScript, dominé par `three/webgpu`. Feuille de style : 5,86 kB (2,09 kB gzip). Polices : 23 944 et 20 112 octets, chargées à la demande. Vite affiche l'avertissement « Some chunks are larger than 500 kB after minification ». Budget visé par la spec T-001 §7 : 400 ko gzip pour le JS initial, respecté.
