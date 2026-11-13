# ADR-001 — Pile technique et versions épinglées

## Contexte

Le jeu tourne dans le navigateur et doit être publié sur GitHub Pages (décisions D5 et D11 du registre). Il faut un moteur de rendu web récent, un outil de build, des tests et des contrôles automatiques. Three.js et son `WebGPURenderer` évoluent vite (risque R1 de la spec T-001).

## Décision

Three.js avec `WebGPURenderer` (repli WebGL2), Vite, TypeScript, Vitest, Playwright, ESLint, Prettier, dependency-cruiser. Toutes les versions sont épinglées sans `^` ni `~` et figées par `package-lock.json` :

| Paquet | Version |
|---|---|
| three, @types/three | 0.187.0 |
| vite | 8.3.8 |
| typescript | 6.0.3 (voir [ADR-002](ADR-002-typescript-6.md)) |
| vitest, @vitest/coverage-v8 | 5.1.0 |
| @playwright/test | 1.65.0 |
| eslint | 10.14.0 |
| @eslint/js | 10.0.1 |
| typescript-eslint | 8.72.2 |
| dependency-cruiser | 18.7.2 |
| prettier | 3.10.1 |
| @types/node | 26.6.6 |

Node ≥ 22.12.0 (exigence de Vitest 5.1.0).

## Conséquences

- Builds reproductibles : `npm ci` installe les mêmes versions partout.
- Une montée de version est une tâche dédiée, validée par les tests e2e.
- `npm audit` signale 10 vulnérabilités modérées dans la chaîne de lint (outils de développement seulement) ; à réexaminer à la prochaine montée de version (réserve E7, log T-002).
- `@vitest/coverage-v8` n'est pas dans la liste de la spec T-001 §2 ; il est présent dans `package.json` pour le script de couverture `test:cov`, ajouté en T-003.

## Statut

Accepté (T-001, T-002 ; 2026-11-12).
