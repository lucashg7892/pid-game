# Développement

## Prérequis

| Outil | Version | Source |
|---|---|---|
| Node.js | ≥ 22.12.0 | `engines.node` de `package.json` ; exigé par Vitest 5.1.0 (spec T-001 §2) |
| nvm (facultatif) | — | `.nvmrc` contient `22` |
| npm | fourni avec Node | versions utilisées sur la VM du projet : Node v22.23.4, npm 10.9.9 (`node -v`, `npm -v`) |

Attention : `.nvmrc` indique seulement `22`. Une version 22 antérieure à 22.12.0 ne convient pas. Vérifiez avec `node -v`.

La version de Node installée sur le PC Windows de l'utilisateur n'est pas connue (spec T-001 §12, Q5).

## Installation

```sh
npm ci
```

`npm ci` installe exactement les versions de `package-lock.json`.

`node_modules/` contient des binaires propres au système. Exemple : Vite 8 utilise Rolldown, installé ici sous forme de `@rolldown/binding-linux-x64-gnu`. Le `node_modules/` actuel a été installé sous Linux. Sous Windows, relancez `npm ci` avant toute commande.

Pour les tests e2e, il faudra aussi installer Chromium pour Playwright : `npx playwright install chromium`. Prévu (T-010).

## Scripts npm

Commandes exactes de `package.json` dans le socle validé (T-002).

| Script | Commande | Usage |
|---|---|---|
| `npm run dev` | `vite` | serveur de développement avec rechargement à chaud |
| `npm run typecheck` | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sim.json --noEmit` | vérifie les types de tout le projet, puis de `src/sim` et `src/game` sans DOM |
| `npm run lint` | `eslint . --max-warnings 0 && prettier --check . && depcruise src --config .dependency-cruiser.cjs` | lint, formatage et règles d'architecture ; aucun avertissement toléré |
| `npm run lint:arch` | `depcruise src --config .dependency-cruiser.cjs` | règles d'architecture seules |
| `npm run format` | `prettier --write .` | reformate les fichiers (hors `docs/` et `orchestration/`, voir `.prettierignore`) |
| `npm run test` | `vitest run` | tests unitaires, une passe |
| `npm run build` | `vite build` | build de production dans `dist/` |
| `npm run preview` | `vite preview` | sert le contenu de `dist/` |
| `npm run e2e` | `playwright test` | tests de bout en bout. Prévu (T-010) : pas encore de `playwright.config.ts` ni de test e2e |
| `npm run check` | `npm run typecheck && npm run lint && npm run test && npm run build` | vérification complète avant livraison |

Ne lancez pas `npm run e2e` aujourd'hui. Sans configuration, Playwright ramasse `tests/smoke.test.ts`, qui est un test Vitest, et échoue (constaté le 2026-11-12 avec `npx playwright test --list` dans une copie du dépôt : code de sortie 1, `TypeError: Cannot read properties of undefined (reading 'config')` à `tests/smoke.test.ts:4`, puis « No tests found »).

Script `test:cov` (couverture de `src/sim`) : Prévu (T-003). Il ne fait pas partie du socle validé T-002 ; T-003, en cours, l'ajoute. Il sera documenté après validation. Le paquet `@vitest/coverage-v8` 5.1.0 figure dans `devDependencies`.

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

## Arborescence du socle validé (T-002)

```text
.dependency-cruiser.cjs  eslint.config.js  index.html  package.json  package-lock.json
tsconfig.json  tsconfig.sim.json  vite.config.ts  vitest.config.ts
.nvmrc  .prettierrc.json  .prettierignore  .gitignore  .gitattributes
src/main.ts  src/render/index.ts  src/sim/index.ts
tests/smoke.test.ts
docs/  orchestration/
```

`dist/` et `node_modules/` sont ignorés par git (`.gitignore`). Le dépôt git existe (branche `main`) mais n'a encore aucun commit.

## Déploiement sur GitHub Pages

Prévu (T-011). Ce qui est déjà en place :

- Nom du dépôt GitHub retenu : `pid-game` (décision D11 du registre).
- `vite.config.ts` fixe `base: '/pid-game/'` : les URL du build sont préfixées par `/pid-game/`.

Ce qui reste à faire : workflows `.github/workflows/ci.yml` et `deploy.yml`, publication de `dist/` depuis `main` (spec T-001 §9 et §11).

## Taille du bundle

Le log T-002 consigne 219,75 kB gzip pour le JavaScript du build (812,66 kB non compressé, mesure Vite du 2026-11-12 ; le bouchon `main.ts` importe déjà `three/webgpu`). Vite affiche l'avertissement « Some chunks are larger than 500 kB after minification ». Budget visé par la spec T-001 §7 : 400 ko gzip pour le JS initial.
