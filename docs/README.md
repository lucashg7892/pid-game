# Documentation technique de PID Game

Cette documentation décrit l'état réel du dépôt. Elle est rédigée en français.

## Pages

| Page | Contenu |
|---|---|
| [architecture.md](architecture.md) | modules, règles de dépendances, garde-fous automatiques |
| [developpement.md](developpement.md) | prérequis, installation, scripts npm, conventions de code, déploiement |
| [tests.md](tests.md) | tests existants et stratégie de test prévue |
| [CHANGELOG.md](CHANGELOG.md) | une entrée par tâche validée |
| [specs/T-001-tranche-verticale.md](specs/T-001-tranche-verticale.md) | spécification de la tranche verticale v0.1 (rédigée par le concepteur, non maintenue ici) |

### Décisions (ADR)

| ADR | Sujet |
|---|---|
| [ADR-001](decisions/ADR-001-pile-technique.md) | pile technique et versions épinglées |
| [ADR-002](decisions/ADR-002-typescript-6.md) | TypeScript 6.0.3 plutôt que 7.0.2 |
| [ADR-003](decisions/ADR-003-noyau-pur.md) | noyau de simulation pur et ses trois garde-fous |
| [ADR-004](decisions/ADR-004-orchestration.md) | travail par orchestrateur, sous-agents et certificats |

### Pages prévues

Ces pages n'existent pas encore. Elles viennent du plan de la spec T-001 §10.

| Page | Écrite après |
|---|---|
| `simulation.md` | Prévu (T-003, T-004) |
| `physique/ascenseur.md` | Prévu (T-004) |
| `i18n-accessibilite.md` | Prévu (T-006, T-010) |
| `rendu.md` | Prévu (T-008, T-009) |

## Convention « Validé / Prévu »

- Un texte au présent sans marque décrit ce qui existe dans le dépôt et a été validé par l'orchestrateur.
- **Prévu (T-0xx)** marque ce qui est spécifié mais pas encore réalisé. T-0xx est la tâche qui doit le réaliser.
- Chaque valeur chiffrée cite sa source : un fichier du dépôt, un log d'orchestration (`orchestration/logs/`) ou une commande exécutée.
- Quand le code et la spec divergent, la doc décrit le code et signale l'écart.

## Maintenance

Le projet avance par tâches numérotées (voir [ADR-004](decisions/ADR-004-orchestration.md)). Après chaque tâche validée, le rédacteur :

1. met à jour les pages touchées par les fichiers modifiés ;
2. recopie les valeurs mesurées, jamais devinées ;
3. ajoute une entrée dans [CHANGELOG.md](CHANGELOG.md) ;
4. crée une ADR si la tâche a tranché un choix structurant ;
5. vérifie que chaque commande citée existe dans `package.json` et que chaque lien relatif pointe vers un fichier existant.

Le rédacteur ne modifie ni le code, ni la configuration, ni `docs/specs/`, ni `orchestration/`.
