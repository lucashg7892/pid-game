# ADR-014 — Protocole allégé : autonomie, vérification proportionnée, outils natifs

## Contexte

Le protocole de l'[ADR-004](ADR-004-orchestration.md) a bien servi pour la v0.1 : il a fait trouver des défauts réels et rendu chaque affirmation traçable. Il a un coût : ordres de mission à critères numérotés, certificats avec SHA-256 et sorties brutes, vérification systématique par l'orchestrateur, un log par tâche. Pour une tâche d'un quart d'heure, le suivi du protocole prenait plus de temps que le développement. L'utilisateur a demandé (2026-11-13) un système où les agents collaborent efficacement sans passer plus de temps à suivre le protocole qu'à développer, et a choisi de garder la configuration actuelle (sous-agents Claude Opus 5.5, pas de modèles locaux).

## Décision

Trois principes :

- **Autonomie.** Les agents tranchent seuls les détails d'implémentation et notent leurs doutes mineurs ; l'utilisateur est consulté pour le design, la pédagogie, les valeurs de jeu, le périmètre, les dépendances et tout ce qui est public ou irréversible.
- **Proportionnalité.** Trois niveaux de vérification : N1 léger (lint et typecheck), N2 courant (`npm run check` relancé par l'orchestrateur, lecture du diff), N3 critique (N2 plus un validateur indépendant et un log). Les zones N3 sont nommées : noyau `src/sim`, physique, valeurs de jeu, oracle MATLAB, CI et déploiement, retouche d'un rendu approuvé.
- **Simplicité.** Les règles vivent dans `CLAUDE.md` ; les rôles sont des sous-agents de `.claude/agents/` ; la clôture d'une tâche est un skill (`.claude/skills/cloturer-tache/`) ; les permissions sont dans `.claude/settings.json`. Le registre reste, avec une ligne par tâche N2 ou N3.

Ce qui est conservé de l'ADR-004 : l'orchestrateur, les rôles distincts (concepteur, réalisateur, validateur qui n'a pas vu la réalisation, rédacteur), la numérotation `T-xxx` et `D-xxx`, le registre, un commit par tâche validée.

Ce qui est remplacé : les critères d'acceptation numérotés obligatoires, les certificats avec SHA-256 et la relance systématique de toutes les commandes. La preuve d'un résultat reste « exécuté, avec son code de sortie » ; ce qui n'a pas pu être exécuté est déclaré comme tel.

## Alternatives écartées

| Option | Raison |
|---|---|
| garder le protocole de l'ADR-004 | coût de suivi disproportionné pour les petites tâches |
| hooks Claude Code qui exécutent et enregistrent les vérifications | une couche de plus à maintenir ; `npm run check` suffit comme preuve |
| agents locaux via Ollama | écarté par l'utilisateur après l'audit du 2026-11-13 : 16 Go de VRAM trop justes pour le modèle installé (27 milliards de paramètres) et raccordement à Opus non natif |

## Conséquences

- Les tâches N1 et N2 vont nettement plus vite ; seules les tâches N3 gardent un validateur et un log.
- Le risque est de sous-classer une tâche : la règle « en cas de doute, niveau supérieur » et l'escalade possible par l'agent ou l'orchestrateur le limitent.
- Les logs et certificats de T-000 à T-013 restent tels quels : ils décrivent la v0.1 au protocole de l'ADR-004.
- `CLAUDE.md` et `.claude/` sont chargés automatiquement par Claude Code lancé dans le dépôt ; dans la configuration actuelle (session pilotée depuis l'extérieur du dépôt), l'orchestrateur lit `CLAUDE.md` au début de la session et donne aux sous-agents le contenu du rôle correspondant.

## Statut

Accepté (2026-11-13). Remplace en partie l'[ADR-004](ADR-004-orchestration.md).
