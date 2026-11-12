# ADR-002 — TypeScript 6.0.3 plutôt que 7.0.2

## Contexte

Le 2026-11-12, `npm view typescript version` renvoie 7.0.2 (`latest`). Le lint du projet repose sur typescript-eslint 8.72.2, dont la dépendance pair déclare `typescript ">=4.8.4 <6.1.0"` (`npm view typescript-eslint peerDependencies`, spec T-001 §2 ; confirmé par l'orchestrateur, log T-001).

## Décision

Épingler TypeScript 6.0.3, dernière version 6.x publiée.

## Conséquences

- typescript-eslint fonctionne dans sa plage supportée ; `npm run lint` et `npm run typecheck` passent (log T-002).
- Le projet n'a pas les apports de TypeScript 7.
- La migration vers 7 sera une tâche dédiée, dès qu'une version de typescript-eslint accepte TypeScript 7.

## Statut

Accepté (T-001 ; 2026-11-12).
