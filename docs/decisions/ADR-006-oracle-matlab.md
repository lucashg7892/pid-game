# ADR-006 — Validation par oracle exact MATLAB, hors du site

## Contexte

Les premières valeurs de référence venaient du même algorithme (RK4) que le code : elles détectaient une régression, pas une erreur de modèle. L'utilisateur dispose de MATLAB sur son PC, mais ne veut pas de MATLAB dans le site (décision D14 du registre).

## Décision

- Un validateur indépendant (T-005) recalcule le noyau avec un oracle **exact** : discrétisation par exponentielle de matrice (`expm`, Van Loan), contrôlée par la forme fermée (écart 2,7e-20), sans RK4.
- Les scripts MATLAB et les données vivent dans `validation/`, hors de `src/`. Rien n'est importé par le site. Seules les fonctions de base de MATLAB R2025a sont utilisées (aucune toolbox).
- Le résultat est reporté dans les tests TypeScript : `tests/sim/exact.test.ts` reprend la forme fermée de l'oracle (T-004b) et tourne avec `npm run test`, sans MATLAB.

## Conséquences

- Écart RK4 / exact ≤ 1,42e-7 m ; Kp critique 97 079 N/m ; fenêtre [2000 ; 3800] N/m confirmée, 0 désaccord sur 80 Kp ; 8 mutants tués (rapport [T-005](../validation/T-005-noyau.md)).
- Relancer la validation demande MATLAB : `run('validation/matlab/t005_run_all.m')` (voir [validation/README.md](../../validation/README.md)). La CI ne la lance pas.
- Toute retouche de la physique (g, m, c, Umax, dt) ou des règles de jeu doit être suivie d'une relance de `t005_E.m`.

## Statut

Accepté (T-005 ; 2026-11-12).
