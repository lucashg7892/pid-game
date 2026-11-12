# ADR-003 — Noyau de simulation pur et ses trois garde-fous

## Contexte

Le jeu enseigne l'automatique : la simulation doit être juste, testable contre des formules analytiques et reproductible. Elle ne doit dépendre ni du rendu, ni de la cadence d'images, ni d'aléa (décision D6 du registre, spec T-001 §4). Une règle écrite seulement dans la doc finit par être violée.

## Décision

`src/sim/` est un noyau pur : il n'importe que lui-même, n'utilise pas le DOM, ne lit pas l'horloge, n'utilise pas d'aléa. Trois contrôles automatiques l'imposent :

| Garde-fou | Fichier | Ce qu'il bloque |
|---|---|---|
| dependency-cruiser | `.dependency-cruiser.cjs` (`sim-is-pure`, `three-only-in-render`) | tout import hors de `src/sim/`, dont `three` |
| TypeScript sans DOM | `tsconfig.sim.json` (`lib: ["ES2023"]`, `types: []`) | `window`, `document`, `performance` dans `src/sim` et `src/game` |
| ESLint | `eslint.config.js` (`no-restricted-properties`, `no-restricted-globals`) | `Math.random`, `Date`, `Date.now`, `performance` dans `src/sim` |

Messages d'erreur réels : [architecture.md](../architecture.md#les-trois-garde-fous-du-noyau-pur).

## Conséquences

- Le noyau se teste sous Node, sans navigateur.
- Le temps est fourni de l'extérieur à l'horloge ; un futur aléa passera par un PRNG à graine explicite.
- `npm run typecheck` et `npm run lint` échouent dès qu'une règle est violée (vérifié par l'orchestrateur, log T-002).
- Exception temporaire : `src/main.ts` peut importer `three` (réserve E2). Retrait Prévu (T-008).

## Statut

Accepté (T-001, T-002 ; 2026-11-12).
