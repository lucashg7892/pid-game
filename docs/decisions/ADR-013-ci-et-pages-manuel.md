# ADR-013 — CI à chaque push, déploiement Pages manuel tant que le dépôt est privé

## Contexte

La spec T-001 (§9 et §11) prévoit une CI (Node 22, `npm ci`, `npm run check`, `npm run e2e`) et un workflow qui publie `dist/` sur GitHub Pages depuis `main`. Le dépôt `pid-game` est privé (décision D17 du registre) : un compte GitHub gratuit ne publie pas de site Pages depuis un dépôt privé. Jusqu'ici, les tests e2e n'étaient exécutés que par l'orchestrateur ([ADR-012](ADR-012-tests-navigateur.md)).

## Décision

- `.github/workflows/ci.yml` tourne à chaque push sur `main` et à chaque pull request : `npm ci`, `npm run check`, installation de Chromium, `npm run e2e`. Une exécution plus récente sur la même branche annule la précédente.
- `.github/workflows/deploy.yml` est prêt mais se lance seulement à la main (`workflow_dispatch`).
- Quand le dépôt sera public : régler Pages sur « GitHub Actions », lancer le workflow, puis ajouter le déclencheur `push` sur `main` (étapes dans [developpement.md](../developpement.md#déploiement-sur-github-pages)).

## Alternatives écartées

| Option | Raison |
|---|---|
| déploiement à chaque push dès maintenant | échouerait à chaque push tant que le dépôt est privé |
| rendre le dépôt public tout de suite | décision réservée à l'utilisateur (D17) |

## Conséquences

- Les e2e pourront tourner sans l'orchestrateur, avec le Chromium de Playwright.
- Au commit `88ae23c`, aucun des deux workflows n'avait encore tourné (log `orchestration/logs/T-011-013.md`) : la première exécution de la CI se fera au prochain push.
- Aucun site public : défaut connu K14 ([defauts-connus.md](../defauts-connus.md)).

## Statut

Accepté (T-011 ; 2026-11-13).
