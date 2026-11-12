# Journal des modifications

Une entrée par tâche validée, la plus récente en premier. Source : `orchestration/REGISTRE.md` et `orchestration/logs/`.

## T-002 — Socle outillé (2026-11-12)

- Ajoute `package.json` (versions épinglées), `package-lock.json`, `.nvmrc`, configurations TypeScript, Vite, Vitest, ESLint, Prettier et dependency-cruiser, `index.html`, bouchons `src/main.ts`, `src/sim/index.ts`, `src/render/index.ts` et un test fumée.
- `npm run check` : code 0. Bundle JS : 219,75 kB gzip. Une violation volontaire dans `src/sim` fait échouer les trois garde-fous.
- Statut : validé avec réserves.
  - E2 : `src/main.ts` exempté de `three-only-in-render` → T-008.
  - E3 : `docs/` et `orchestration/` exclus de Prettier (prose).
  - E5 : pas de script `test:cov` → T-003.
  - E7 : 10 vulnérabilités modérées dans la chaîne de lint (développement seulement).
  - E9 : comportement du renderer dans un navigateur non exécuté → T-008.
  - E11 : un processus en arrière-plan ne survit pas à un appel du shell de la VM.

## T-001 — Spécification de la tranche verticale (2026-11-12)

- Ajoute `docs/specs/T-001-tranche-verticale.md` : versions des dépendances, architecture, noyau, modèle de l'ascenseur, niveau 1, rendu, tests, plan de tâches.
- Calculs de référence recalculés à la main par l'orchestrateur (Kp = 2500 N/m : e_ss = 0,1962 m, ζ = 0,566, dépassement 11,6 %).
- Statut : validé. Points à surveiller : parité JS des valeurs de référence (T-004), repli WebGL2 non exécuté (T-008).

## T-000 — Tâche pilote (2026-11-12)

- Initialise le dépôt git (branche `main`, aucun commit), ajoute `.gitignore` et `.gitattributes` (fins de ligne LF).
- Statut : validé.
