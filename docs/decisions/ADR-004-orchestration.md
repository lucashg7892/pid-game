# ADR-004 — Travail par orchestrateur, sous-agents et certificats

## Contexte

L'utilisateur veut que Claude pilote le projet, que les choix de design soient discutés avec lui, et que la réalisation soit faite par des sous-agents Claude Opus 5.5, avec une vérification par certificats.

## Décision

- Un orchestrateur découpe le travail en tâches numérotées (T-xxx ; D-xxx pour la doc) et tient `orchestration/REGISTRE.md`.
- Rôles distincts, jamais cumulés sur une tâche : concepteur, réalisateur, validateur (qui n'a pas vu la réalisation), rédacteur de doc.
- Chaque ordre de mission fixe l'objectif, les fichiers autorisés, des critères d'acceptation numérotés (CA-n), les commandes de vérification et les interdits.
- L'agent rend un certificat : fichiers et SHA-256 ; commandes, codes de sortie et fin de sortie brute ; chaque CA-n en PASS ou FAIL avec preuve ; écarts et doutes.
- L'orchestrateur recalcule les hash et relance les commandes. Un certificat non reproductible vaut échec. Chaque leçon tirée est consignée dans le registre.
- Le résultat de chaque vérification est consigné dans `orchestration/logs/T-xxx.md`.

## Conséquences

- Chaque affirmation de la doc peut renvoyer à un log ou à une commande.
- Une tâche peut être validée « avec réserves » ; les réserves sont reportées sur des tâches nommées (exemple : E2 → T-008).
- Le coût en temps est plus élevé qu'un développement direct.
- Le dépôt n'est accessible que par le shell de la VM de l'utilisateur ; les commandes y sont lancées au premier plan, en moins de 180 s (leçons L1 et L4 du registre).

## Statut

Accepté (2026-11-12).
