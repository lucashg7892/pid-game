# ADR-006 — Validation par oracle exact MATLAB, hors du site

## Contexte

Les premières valeurs de référence venaient du même algorithme (RK4) que le code : elles détectaient une régression, pas une erreur de modèle. L'utilisateur dispose de MATLAB sur son PC, mais ne veut pas de MATLAB dans le site (décision D14 du registre).

## Décision

- Un validateur indépendant (T-005) recalcule le noyau avec un oracle **exact** : discrétisation par exponentielle de matrice (`expm`, Van Loan), contrôlée par la forme fermée (écart 2,7e-20), sans RK4.
- Les scripts MATLAB et les données vivent dans `validation/`, hors de `src/`. Rien n'est importé par le site. Seules les fonctions de base de MATLAB R2025a sont utilisées (aucune toolbox).
- Le résultat est reporté dans les tests TypeScript : `tests/sim/exact.test.ts` reprend la forme fermée de l'oracle (T-004b) et tourne avec `npm run test`, sans MATLAB.

## Conséquences

- Écart RK4 / exact ≤ 1,42e-7 m ; Kp critique 97 079 N/m ; fenêtre [2000 ; 3800] N/m confirmée, 0 désaccord sur 80 Kp ; 8 mutants tués (rapport [T-005](../validation/T-005-noyau.md)). La fenêtre [2000 ; 3800] N/m valait pour la poutre à 3,30 m, la tolérance de 0,25 m et 1800 pas ; **depuis T-020 (2026-11-13) elle est [1000 ; 5000] N/m** (poutre 3,3626 m, tolérance 0,5 m, 720 pas) et l'oracle, relancé, la confirme (à 720 pas ; depuis T-022, l'horizon est de 1200 pas, 10 s, D27, et l'oracle relancé donne encore la fenêtre [1000 ; 5000], « horizon 1200 pas (10.0 s) », 0 désaccord sur 80, log `orchestration/logs/T-022.md`) : « Kp in [1000 ; 5000], 41 valeurs, contiguë : true », 0 désaccord sur 80 issues (log `orchestration/logs/T-020.md`). Les valeurs de ce paragraphe d'avant T-020 restent celles du rapport T-005, qui n'est pas modifié.
- **Le contrôleur PI du niveau 2 est couvert depuis T-023** (N3, validé indépendamment ; K28 fermé) : `validation/matlab/t018_*.m` (8 fichiers, `t018_run_all.m`, dernière ligne « T018 : FIN SANS ERREUR ») propage en forme exacte la boucle PI discrète à trois états [y, ẏ, I] et la compare au noyau ; `tests/sim/pi-exact.test.ts` (22 tests, sans MATLAB) reprend cette propagation. 0 désaccord sur 113 valeurs de Ki ; pire écart 1,5e-7 m sur y, 1,524e-6 m/s sur ẏ et 2,144e-4 N sur I ; Ki critique échantillonné 18 310,30 N/(m·s) (log `orchestration/logs/T-023.md`). Voir [ADR-016](ADR-016-controleur-pi-sans-anti-windup.md).
- Relancer la validation demande MATLAB : `run('validation/matlab/t005_run_all.m')` pour le niveau 1, `run('validation/matlab/t018_run_all.m')` pour le niveau 2 (voir [validation/README.md](../../validation/README.md)). La CI ne la lance pas.
- Toute retouche de la physique (g, m, c, Umax, dt) ou des règles de jeu doit être suivie d'une relance de `t005_E.m`.

## Statut

Accepté (T-005 ; 2026-11-12). Étendu au contrôleur PI par T-023 (2026-11-14).
