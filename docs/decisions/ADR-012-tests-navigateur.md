# ADR-012 — Tests navigateur hors de la VM des agents, et captures de référence

## Contexte

Le rendu et l'interface ne se vérifient vraiment que dans un navigateur. La VM des agents ne peut pas télécharger de navigateur : `npx playwright install` y échoue (« Connection blocked by network allowlist », log T-008). Les tests de pixels écrits en T-009 passaient alors qu'une régression du papier était visible (log T-009).

## Décision

- Les tests e2e Playwright (`tests/e2e/`, `playwright.config.ts`) sont écrits par les agents, mais **exécutés par l'orchestrateur** dans son environnement, sur une copie du dépôt, avec un Chrome déjà installé : `PW_CHROME_PATH=/usr/bin/google-chrome npx playwright test` (Google Chrome for Testing 153, headless, rendu logiciel SwiftShader, WebGL2).
- La variable `PW_CHROME_PATH` remplace le Chromium de Playwright par un exécutable donné. Sans elle, un poste de développeur fait `npx playwright install chromium` puis `npm run e2e`.
- Les tests produisent des **captures** (`docs/img/*.png`). L'orchestrateur les regarde même quand tous les tests passent ; toute retouche d'un rendu approuvé est comparée à la capture de référence (leçon L9). Un test compare le papier à la capture de T-008.
- Un agent qui n'a pas pu exécuter un test le déclare « NON EXÉCUTÉ » (leçon L8).

## Alternatives écartées

| Option | Raison |
|---|---|
| tests de pixels seuls, sans regarder les captures | ont laissé passer la régression de T-009b |
| comparaison automatique pixel à pixel de toute la scène | fragile : le « boiling », le rendu logiciel et les polices font varier les pixels |
| attendre la CI GitHub (T-011) | pas encore en place ; aucun retour pendant T-008 à T-010 |

## Conséquences

- 28 tests e2e verts à `566a8a3` (log T-010) ; le rédacteur et les agents ne peuvent pas les relancer.
- WebGPU réel n'est exercé par aucun test (pas d'adaptateur en headless) ; seul l'essai de l'utilisateur l'a peut-être utilisé.
- La comparaison visuelle reste humaine : elle dépend de l'attention de l'orchestrateur.

## Statut

Accepté (T-008 à T-010 ; 2026-11-13).
