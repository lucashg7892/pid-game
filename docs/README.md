# Documentation technique de Huygens’s world (dépôt `pid-game`)

À quoi sert cette page : servir d'index et expliquer comment lire la documentation. La documentation décrit l'état réel du commit `13e8b7e` (branche `migration`) : la v0.1 a été validée avec réserves au commit `88ae23c` (rapport T-012) et le niveau 1 est jouable. Depuis, P-005, T-014, T-015 et T-016 ont corrigé huit défauts connus et modifié le code ; les pages mises à jour (voir le [CHANGELOG](CHANGELOG.md), entrée D-014) citent `13e8b7e`, les autres citent encore `566a8a3`, dont le code qu'elles décrivent n'a pas changé. Elle est rédigée en français.

## Par où commencer

Pour lancer le projet sur un PC Windows, sans être développeur : [tutoriel-lancer-en-local.md](tutoriel-lancer-en-local.md).

Pour comprendre le noyau en un quart d'heure : [simulation.md](simulation.md) (schéma d'un pas, piège de `LoopSample`), puis [physique/ascenseur.md](physique/ascenseur.md) (formules et valeurs du niveau 1), puis [jeu.md](jeu.md) (phases du niveau et règles d'issue).

Pour un tour d'horizon de la version : [bilan-v0.1.md](bilan-v0.1.md), puis [defauts-connus.md](defauts-connus.md).

Pour comprendre ce qui est affiché : [rendu.md](rendu.md) (dessin au crayon) et [interface.md](interface.md) (textes, touches, accessibilité).

## Pages

| Page | Contenu |
|---|---|
| [bilan-v0.1.md](bilan-v0.1.md) | bilan de la v0.1 : contenu, chiffres clés, méthode, leçons, suite du parcours |
| [defauts-connus.md](defauts-connus.md) | défauts connus K1 à K24, par thème, avec gravité et piste de correction |
| [architecture.md](architecture.md) | modules, règles de dépendances, flux d'une image, garde-fous automatiques |
| [simulation.md](simulation.md) | noyau de simulation : algorithme d'un pas, exports, horloge, RK4, saturation, déterminisme, procédures d'ajout |
| [physique/ascenseur.md](physique/ascenseur.md) | modèle de l'ascenseur, formules, valeurs mesurées, fenêtre de réussite, stabilité |
| [jeu.md](jeu.md) | logique du niveau 1 : phases, commandes, règles d'issue, instantané, événements, géométrie, contrats pour le rendu et l'interface |
| [rendu.md](rendu.md) | rendu au crayon : démarrage WebGPU/WebGL2, cadrage, papier millimétré, traits, lots et budget, courbe, bonhomme, jauge, mesures |
| [interface.md](interface.md) | interface du joueur : phases, bandeau d'aide, panneau Kp, table des touches, annonces, disposition, police |
| [i18n-accessibilite.md](i18n-accessibilite.md) | i18n FR/EN et accessibilité (validés) |
| [tests.md](tests.md) | inventaire des tests unitaires et e2e, oracle, tolérances, couverture, tests de pixels, validation MATLAB, intégration continue |
| [developpement.md](developpement.md) | prérequis, installation, scripts npm, conventions de code, intégration continue, déploiement |
| [tutoriel-lancer-en-local.md](tutoriel-lancer-en-local.md) | pas à pas Windows/PowerShell : copie, installation, lancement, jouer, tests, validation MATLAB, dépannage (dont `npm.cmd`) |
| [CHANGELOG.md](CHANGELOG.md) | une entrée par tâche validée, correspondance tâche → commit |
| [validation/T-005-noyau.md](validation/T-005-noyau.md) | rapport de validation indépendante du noyau (rédigé par le validateur, non maintenu ici) |
| [validation/T-012-v0.1.md](validation/T-012-v0.1.md) | rapport de validation finale de la v0.1, verdict « validée avec réserves » (rédigé par le validateur, non maintenu ici) |
| [specs/T-001-tranche-verticale.md](specs/T-001-tranche-verticale.md) | spécification de la tranche verticale v0.1 (rédigée par le concepteur, non maintenue ici) |
| [specs/T-001-errata.md](specs/T-001-errata.md) | corrections de la spécification établies depuis |

### Décisions (ADR)

| ADR | Sujet |
|---|---|
| [ADR-001](decisions/ADR-001-pile-technique.md) | pile technique et versions épinglées |
| [ADR-002](decisions/ADR-002-typescript-6.md) | TypeScript 6.0.3 plutôt que 7.0.2 |
| [ADR-003](decisions/ADR-003-noyau-pur.md) | noyau de simulation pur et ses trois garde-fous |
| [ADR-004](decisions/ADR-004-orchestration.md) | travail par orchestrateur, sous-agents et certificats (remplacé en partie par l'ADR-014) |
| [ADR-005](decisions/ADR-005-rk4-bloqueur.md) | intégration RK4 à dt = 1/120 s avec bloqueur d'ordre zéro |
| [ADR-006](decisions/ADR-006-oracle-matlab.md) | validation par oracle exact MATLAB, hors du site |
| [ADR-007](decisions/ADR-007-i18n-maison.md) | i18n maison typée, sans bibliothèque |
| [ADR-008](decisions/ADR-008-licence-mit.md) | licence MIT |
| [ADR-009](decisions/ADR-009-machine-a-etats.md) | niveau en machine à états pure, instantané réutilisé et file d'événements |
| [ADR-010](decisions/ADR-010-rendu-crayon.md) | rendu au crayon par rubans CPU préalloués et matériaux TSL |
| [ADR-011](decisions/ADR-011-interface-dom.md) | interface en DOM superposé, pilotée par un modèle de vue pur |
| [ADR-012](decisions/ADR-012-tests-navigateur.md) | tests navigateur hors de la VM des agents, captures de référence |
| [ADR-013](decisions/ADR-013-ci-et-pages-manuel.md) | CI à chaque push, déploiement Pages manuel tant que le dépôt est privé |
| [ADR-014](decisions/ADR-014-protocole-allege.md) | protocole allégé : autonomie, vérification proportionnée, outils natifs de Claude Code |

### Captures

Les images de `img/` sont produites par les tests e2e (T-008 à T-010, T-016), dans Chrome headless avec rendu logiciel. Elles servent de référence visuelle : l'orchestrateur les regarde à chaque exécution (leçon L9). Les pages les intègrent par des liens relatifs.

### Pages prévues

Aucune. Toutes les pages du plan de la spec T-001 §10 existent. L'intégration continue et la publication sont décrites dans [developpement.md](developpement.md#intégration-continue) et [tests.md](tests.md#intégration-continue) ; elles ne justifient pas une page à part.

## Titre du jeu

Titre provisoire décidé par l'utilisateur : « Huygens’s world », en hommage à Christiaan Huygens (décision D15 du registre). Depuis T-010, c'est la valeur de la clé `app.title` en français et en anglais, et le titre de l'onglet (`index.html`). Le dépôt garde le nom `pid-game`.

## Convention « Validé / Prévu »

- Un texte au présent sans marque décrit ce qui existe dans le dépôt et a été validé par l'orchestrateur.
- **Prévu (T-0xx)** marque ce qui est spécifié mais pas encore réalisé. T-0xx est la tâche qui doit le réaliser.
- Chaque valeur chiffrée cite sa source : un fichier du dépôt, un log d'orchestration (`orchestration/logs/`), le rapport T-005 ou une commande exécutée.
- Quand le code et la spec divergent, la doc décrit le code et signale l'écart (voir [specs/T-001-errata.md](specs/T-001-errata.md)).

## Maintenance

Le projet avance par tâches numérotées (voir [ADR-004](decisions/ADR-004-orchestration.md) et [ADR-014](decisions/ADR-014-protocole-allege.md) ; les règles courantes sont dans `CLAUDE.md`). Après chaque tâche validée qui change un comportement décrit ici, le rédacteur :

1. met à jour les pages touchées par les fichiers modifiés ;
2. recopie les valeurs mesurées, jamais devinées ;
3. ajoute une entrée dans [CHANGELOG.md](CHANGELOG.md) ;
4. crée une ADR si la tâche a tranché un choix structurant ;
5. vérifie que chaque commande citée existe dans `package.json`, que chaque lien relatif pointe vers un fichier existant et que chaque export cité existe.

Le rédacteur ne modifie ni le code, ni la configuration, ni la spec `docs/specs/T-001-tranche-verticale.md`, ni `docs/validation/`, ni `orchestration/`. Seul fichier qu'il écrit sous `docs/specs/` : les errata.
