# Documentation technique de PID Game

À quoi sert cette page : servir d'index et expliquer comment lire la documentation. La documentation décrit l'état réel du commit `c00e678` (branche `main`). Elle est rédigée en français.

## Par où commencer

Pour comprendre le noyau en un quart d'heure : [simulation.md](simulation.md) (schéma d'un pas, piège de `LoopSample`), puis [physique/ascenseur.md](physique/ascenseur.md) (formules et valeurs du niveau 1).

## Pages

| Page | Contenu |
|---|---|
| [architecture.md](architecture.md) | modules, règles de dépendances, garde-fous automatiques |
| [simulation.md](simulation.md) | noyau de simulation : algorithme d'un pas, exports, horloge, RK4, saturation, déterminisme, procédures d'ajout |
| [physique/ascenseur.md](physique/ascenseur.md) | modèle de l'ascenseur, formules, valeurs mesurées, fenêtre de réussite, stabilité |
| [i18n-accessibilite.md](i18n-accessibilite.md) | i18n FR/EN (validé) ; accessibilité (Prévu T-010) |
| [tests.md](tests.md) | inventaire des tests, oracle, tolérances, couverture, validation MATLAB |
| [developpement.md](developpement.md) | prérequis, installation, scripts npm, conventions de code, déploiement |
| [CHANGELOG.md](CHANGELOG.md) | une entrée par tâche validée, correspondance tâche → commit |
| [validation/T-005-noyau.md](validation/T-005-noyau.md) | rapport de validation indépendante du noyau (rédigé par le validateur, non maintenu ici) |
| [specs/T-001-tranche-verticale.md](specs/T-001-tranche-verticale.md) | spécification de la tranche verticale v0.1 (rédigée par le concepteur, non maintenue ici) |
| [specs/T-001-errata.md](specs/T-001-errata.md) | corrections de la spécification établies depuis |

### Décisions (ADR)

| ADR | Sujet |
|---|---|
| [ADR-001](decisions/ADR-001-pile-technique.md) | pile technique et versions épinglées |
| [ADR-002](decisions/ADR-002-typescript-6.md) | TypeScript 6.0.3 plutôt que 7.0.2 |
| [ADR-003](decisions/ADR-003-noyau-pur.md) | noyau de simulation pur et ses trois garde-fous |
| [ADR-004](decisions/ADR-004-orchestration.md) | travail par orchestrateur, sous-agents et certificats |
| [ADR-005](decisions/ADR-005-rk4-bloqueur.md) | intégration RK4 à dt = 1/120 s avec bloqueur d'ordre zéro |
| [ADR-006](decisions/ADR-006-oracle-matlab.md) | validation par oracle exact MATLAB, hors du site |
| [ADR-007](decisions/ADR-007-i18n-maison.md) | i18n maison typée, sans bibliothèque |
| [ADR-008](decisions/ADR-008-licence-mit.md) | licence MIT |

### Pages prévues

Ces pages n'existent pas encore. `rendu.md` vient du plan de la spec T-001 §10 ; `jeu.md` est proposé par le rédacteur, la spec ne prévoyant pas de page pour la logique de jeu.

| Page | Écrite après |
|---|---|
| `jeu.md` (logique du niveau : états, règles de victoire et d'échec) | Prévu (T-007) |
| `rendu.md` | Prévu (T-008, T-009) |
| partie accessibilité de `i18n-accessibilite.md` | Prévu (T-010) |

## Convention « Validé / Prévu »

- Un texte au présent sans marque décrit ce qui existe dans le dépôt et a été validé par l'orchestrateur.
- **Prévu (T-0xx)** marque ce qui est spécifié mais pas encore réalisé. T-0xx est la tâche qui doit le réaliser.
- Chaque valeur chiffrée cite sa source : un fichier du dépôt, un log d'orchestration (`orchestration/logs/`), le rapport T-005 ou une commande exécutée.
- Quand le code et la spec divergent, la doc décrit le code et signale l'écart (voir [specs/T-001-errata.md](specs/T-001-errata.md)).

## Maintenance

Le projet avance par tâches numérotées (voir [ADR-004](decisions/ADR-004-orchestration.md)). Après chaque tâche validée, le rédacteur :

1. met à jour les pages touchées par les fichiers modifiés ;
2. recopie les valeurs mesurées, jamais devinées ;
3. ajoute une entrée dans [CHANGELOG.md](CHANGELOG.md) ;
4. crée une ADR si la tâche a tranché un choix structurant ;
5. vérifie que chaque commande citée existe dans `package.json`, que chaque lien relatif pointe vers un fichier existant et que chaque export cité existe.

Le rédacteur ne modifie ni le code, ni la configuration, ni la spec `docs/specs/T-001-tranche-verticale.md`, ni `docs/validation/`, ni `orchestration/`. Seul fichier qu'il écrit sous `docs/specs/` : les errata.
