# ADR-005 — Intégration RK4 à dt = 1/120 s avec bloqueur d'ordre zéro

## Contexte

Le noyau doit simuler l'ascenseur assez juste pour être comparé à des formules de cours, de façon déterministe, sans coût notable (2 états). La commande d'un contrôleur numérique est calculée à des instants discrets (spec T-001 §4).

## Décision

- Pas fixe `SIM_DT = 1/120` s ; ωn·dt ≤ 0,105 pour Kp ≤ 8000 N/m.
- Intégrateur Runge-Kutta classique d'ordre 4 (`createRk4`), sans allocation par pas.
- Commande maintenue constante pendant le pas (bloqueur d'ordre zéro). La boucle simulée est donc une boucle échantillonnée, comme un vrai contrôleur numérique.
- Pas maximal `MAX_SIM_DT = 1/30` s (T-004b).

## Alternatives écartées

| Option | Raison |
|---|---|
| Euler semi-implicite (ordre 1) | suffisant pour un jeu, mais écart à la solution exacte ≥ 3,7e-3 m sur y (mutant Euler de `tests/sim/exact.test.ts`) contre 1,42e-7 m pour RK4 : l'oracle ne pourrait plus être serré |
| discrétisation exacte (Φ, Γ par exponentielle de matrice) | exacte pour ce modèle linéaire, mais propre à chaque modèle et demande `Math.exp`, exclu de la boucle pour le déterminisme ; reste l'oracle de validation (ADR-006) |

## Conséquences

- Écart RK4 / exact ≤ 1,42e-7 m sur y et 2,311e-6 m/s sur ẏ (Kp = 8000) ; divisé par ≈ 16,5 quand dt est divisé par 2 (T-005, `exact.test.ts`).
- Le bloqueur ajoute du dépassement : +0,99 point à Kp = 2500, +3,55 points à 8000 ; σ baisse de 8,5 % à 8000 (T-005).
- Boucle stable jusqu'à Kp = 97 079 N/m à 1/120 s, 12 fois le maximum du curseur (T-005).
- Un nouveau modèle plus rapide doit revérifier stabilité et précision jusqu'à `MAX_SIM_DT`.

Détails : [simulation.md](../simulation.md), [physique/ascenseur.md](../physique/ascenseur.md).

## Statut

Accepté (T-001, T-003, T-004, T-004b ; 2026-11-12).
