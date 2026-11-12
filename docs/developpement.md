# Développement

À quoi sert cette page : installer le projet, connaître chaque script npm et les conventions de code. État au commit `7bcd9ce`. Pour un pas-à-pas sous Windows destiné à un non-développeur, voir le [tutoriel de lancement local](tutoriel-lancer-en-local.md).

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

Pour les tests e2e, il faudra aussi installer Chromium pour Playwright : `npx playwright install chromium`. Prévu (T-010).

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
| `npm run e2e` | `playwright test` | tests de bout en bout. Prévu (T-010) : pas encore de `playwright.config.ts` ni de test e2e. **Ne pas lancer avant T-010** |
| `npm run check` | `npm run typecheck && npm run lint && npm run test && npm run build` | vérification complète avant livraison |

Ne lancez pas `npm run e2e` avant T-010. Sans configuration, Playwright ramasse `tests/smoke.test.ts`, qui est un test Vitest, et échoue (constaté le 2026-11-12 avec `npx playwright test --list` dans une copie du dépôt : code de sortie 1, `TypeError: Cannot read properties of undefined (reading 'config')` à `tests/smoke.test.ts:4`, puis « No tests found »).

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

## Arborescence au commit `7bcd9ce`

Liste tirée de `git ls-files`.

```text
.dependency-cruiser.cjs  eslint.config.js  index.html  package.json  package-lock.json
tsconfig.json  tsconfig.sim.json  vite.config.ts  vitest.config.ts  LICENSE  README.md
.nvmrc  .prettierrc.json  .prettierignore  .gitignore  .gitattributes
src/main.ts  src/render/index.ts
src/sim/       noyau de simulation (9 fichiers), voir simulation.md
src/i18n/      i18n FR/EN (7 fichiers TypeScript + locales/fr.json, locales/en.json)
src/game/      logique du niveau 1 (7 fichiers), voir jeu.md
tests/smoke.test.ts  tests/sim/ (9 fichiers)  tests/i18n/ (5 fichiers)
tests/game/    6 fichiers de test + helpers.ts (outils partagés)
validation/    oracle MATLAB de T-005 : matlab/ (9 scripts), data/ (3 CSV), README.md
docs/  orchestration/
```

`dist/`, `node_modules/` et `coverage/` ne sont pas versionnés. Le dépôt git (branche `main`) a 11 commits au commit `7bcd9ce` (`git rev-list --count 7bcd9ce`) ; la correspondance tâche → commit est dans [CHANGELOG.md](CHANGELOG.md#correspondance-tâche--commit). `src/ui/`, `tests/e2e/` et `.github/workflows/` : Prévu (T-010, T-011).

## Licence

MIT, titulaire lucashg7892 (décision D12 du registre). Texte dans `LICENSE` à la racine. Voir [ADR-008](decisions/ADR-008-licence-mit.md).

## Déploiement sur GitHub Pages

Prévu (T-011). Ce qui est déjà en place :

- Dépôt GitHub : <https://github.com/lucashg7892/pid-game> (nom retenu par la décision D11 du registre). Il est **privé** pour l'instant.
- Remote `origin` du dossier local : `https://github.com/lucashg7892/pid-game.git` (`git remote -v`).
- `vite.config.ts` fixe `base: '/pid-game/'` : les URL du build sont préfixées par `/pid-game/`.

Ce qui reste à faire, Prévu (T-011) :

- workflows `.github/workflows/ci.yml` et `deploy.yml`, publication de `dist/` depuis `main` (spec T-001 §9 et §11) ;
- rendre le dépôt public avant la publication : GitHub Pages n'est pas disponible pour un dépôt privé avec un compte gratuit (il faudrait une offre payante). Décision de l'utilisateur.

## Taille du bundle

Mesure du socle, non refaite depuis : le log T-002 consigne 219,75 kB gzip pour le JavaScript du build (812,66 kB non compressé, mesure Vite du 2026-11-12 ; le bouchon `main.ts` importe déjà `three/webgpu`). Vite affiche l'avertissement « Some chunks are larger than 500 kB after minification ». Budget visé par la spec T-001 §7 : 400 ko gzip pour le JS initial.
