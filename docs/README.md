# Documentation technique de Huygens’s world (dépôt `pid-game`)

À quoi sert cette page : servir d'index et expliquer comment lire la documentation. La documentation décrit l'état réel du commit `3810193` (branche `v0.3-salle-de-controle`, lot A de la v0.3, **non fusionnée** ; `package.json` reste en 0.2.0 et la v0.3 n'est pas publiée) pour les pages que la passe D-019 a touchées ; les pages qu'elle n'a pas touchées (`simulation.md`, `physique/ascenseur.md`, `bilan-v0.1.md`) décrivent un code qui n'a pas changé depuis `02119f7` (le noyau `src/sim` est inchangé). Jusqu'à `02119f7` (branche `migration`, version 0.2.0) : la v0.1 a été validée avec réserves au commit `88ae23c` (rapport T-012) ; depuis, les tâches P-005 à T-025 ont corrigé des défauts connus et ajouté un écran titre, un menu, des valeurs de jeu réglées pour le niveau 1 (T-020), un second niveau, « La mémoire » (contrôleur PI, T-021a et T-021b), un trajet de 10 s, un Kp par défaut de 2000 et une tolérance de 0,10 m au niveau 2 (T-022), l'oracle MATLAB du contrôleur PI (T-023) et la jauge du terme intégral (T-024). Une chasse aux bugs (deux validateurs indépendants, commit examiné `f2680d1`, rapports [A](validation/V-v0.2-A-cycle-de-vie.md) et [B](validation/V-v0.2-B-etat-textes-logique.md)) a trouvé 3 défauts majeurs et 16 mineurs, aucun bloquant ; les tâches T-026 à T-033 en ont corrigé une partie (entrée D-018 du CHANGELOG). Le lot A de la v0.3 « salle de contrôle » (T-036 à T-040) ajoute le bouton « Niveau suivant » (D33), le poste du bonhomme au pupitre, son embarquement et sa sortie animés (D31, D32, K4 corrigé), le rendu de ses poses, un panneau de réglage stable et une annonce de lancement différée ; seule T-037 (N3) a eu un validateur indépendant (entrée D-019 du CHANGELOG, qui dit aussi ce qui n'est pas prouvé). La v0.2 n'a pas de rapport de validation finale : quatre tâches N3 (T-020, T-021a, T-022, T-023) ont chacune été validées indépendamment, les autres sont vérifiées par l'orchestrateur (voir le [CHANGELOG](CHANGELOG.md), section « Versions »). Les pages mises à jour par la dernière passe (entrée D-019 du CHANGELOG) citent `3810193` ; celles que D-019 n'a pas touchées citent encore leur commit d'origine (`02119f7` pour la passe D-018, `a308ada` pour D-017), dont le code qu'elles décrivent n'a pas changé. La page [bilan-v0.1.md](bilan-v0.1.md) reste celle de la v0.1 (état `88ae23c`). Elle est rédigée en français.

## Par où commencer

Pour lancer le projet sur un PC Windows, sans être développeur : [tutoriel-lancer-en-local.md](tutoriel-lancer-en-local.md).

Pour comprendre le noyau en un quart d'heure : [simulation.md](simulation.md) (schéma d'un pas, piège de `LoopSample`, contrôleur PI et son oracle exact), puis [physique/ascenseur.md](physique/ascenseur.md) (formules et valeurs des niveaux 1 et 2), puis [jeu.md](jeu.md) (phases du niveau et règles d'issue).

Pour un tour d'horizon de la version : [bilan-v0.1.md](bilan-v0.1.md), puis [defauts-connus.md](defauts-connus.md).

Pour comprendre ce qui est affiché : [rendu.md](rendu.md) (dessin au crayon) et [interface.md](interface.md) (écrans titre et menu, textes, touches, accessibilité).

## Pages

| Page | Contenu |
|---|---|
| [bilan-v0.1.md](bilan-v0.1.md) | bilan de la v0.1 : contenu, chiffres clés, méthode, leçons, suite du parcours (état `88ae23c`, avec des mentions datées) |
| [defauts-connus.md](defauts-connus.md) | défauts connus K1 à K50, par thème, avec gravité et piste de correction ; défauts corrigés (dont K4, K48 et K49 du lot A) |
| [architecture.md](architecture.md) | modules (dont `src/app`), règles de dépendances, rôle de `main.ts`, flux d'une image, garde-fous automatiques |
| [simulation.md](simulation.md) | noyau de simulation : algorithme d'un pas, exports, horloge, RK4, saturation, contrôleur PI, déterminisme, procédures d'ajout |
| [physique/ascenseur.md](physique/ascenseur.md) | modèle de l'ascenseur, formules, valeurs mesurées, fenêtre de réussite [1000 ; 5000], stabilité, boucle PI du niveau 2 |
| [jeu.md](jeu.md) | logique des niveaux 1 et 2 : sept phases (poste, embarquement, sortie), commandes par phase, règles d'issue, valeurs de jeu, instantané, événements, géométrie, contrats pour le rendu et l'interface |
| [rendu.md](rendu.md) | rendu au crayon : démarrage WebGPU/WebGL2, cycle de vie de la session, cadrage, papier millimétré, traits, lots et budget, courbe, bonhomme (poses par action, hauteur des pieds, mouvement réduit), jauge de force, jauge du terme intégral, mesures |
| [interface.md](interface.md) | interface du joueur : écrans titre et menu, phases (réglage, embarquement, sortie, issue avec « Niveau suivant »), bandeau d'aide, panneau de réglage, jauge du terme intégral, niveau 2, table des touches, annonces (dont celle de lancement différée), disposition, police |
| [i18n-accessibilite.md](i18n-accessibilite.md) | i18n FR/EN (164 clés par langue) et accessibilité |
| [tests.md](tests.md) | inventaire des tests unitaires et e2e, oracle (dont l'oracle exact du PI), tolérances, couverture, tests de pixels, validation MATLAB, intégration continue |
| [developpement.md](developpement.md) | prérequis, installation, scripts npm, conventions de code, intégration continue, déploiement |
| [tutoriel-lancer-en-local.md](tutoriel-lancer-en-local.md) | pas à pas Windows/PowerShell : copie, installation, lancement, jouer, tests, validation MATLAB, dépannage (dont `npm.cmd`) |
| [CHANGELOG.md](CHANGELOG.md) | une entrée par tâche validée, correspondance tâche → commit |
| [validation/T-005-noyau.md](validation/T-005-noyau.md) | rapport de validation indépendante du noyau (rédigé par le validateur, non maintenu ici) |
| [validation/T-012-v0.1.md](validation/T-012-v0.1.md) | rapport de validation finale de la v0.1, verdict « validée avec réserves » (rédigé par le validateur, non maintenu ici) |
| [validation/V-v0.2-A-cycle-de-vie.md](validation/V-v0.2-A-cycle-de-vie.md) | chasse aux bugs de la v0.2, partie A (cycle de vie, ressources, écouteurs, redimensionnement) : verdict « validé avec réserves », commit examiné `f2680d1` (rédigé par le validateur, non maintenu ici) |
| [validation/V-v0.2-B-etat-textes-logique.md](validation/V-v0.2-B-etat-textes-logique.md) | chasse aux bugs de la v0.2, partie B (état des niveaux, logique du niveau 2, entrées, textes, accessibilité) : verdict « validé avec réserves », commit examiné `f2680d1` (rédigé par le validateur, non maintenu ici) |
| [specs/T-001-tranche-verticale.md](specs/T-001-tranche-verticale.md) | spécification de la tranche verticale v0.1 (rédigée par le concepteur, non maintenue ici) |
| [specs/T-001-errata.md](specs/T-001-errata.md) | corrections de la spécification établies depuis |
| [specs/T-017-ecran-titre-et-menu.md](specs/T-017-ecran-titre-et-menu.md) | spécification de l'écran titre et du menu des niveaux (rédigée par le concepteur ; seule la section finale « Écarts à la réalisation » est ajoutée ici) |
| [specs/T-018-niveau-2-ascenseur-ki.md](specs/T-018-niveau-2-ascenseur-ki.md) | spécification du niveau 2 avec Ki (rédigée par le concepteur ; seule la section finale « Écarts à la réalisation » est ajoutée ici) |

### Décisions (ADR)

| ADR | Sujet |
|---|---|
| [ADR-001](decisions/ADR-001-pile-technique.md) | pile technique et versions épinglées |
| [ADR-002](decisions/ADR-002-typescript-6.md) | TypeScript 6.0.3 plutôt que 7.0.2 |
| [ADR-003](decisions/ADR-003-noyau-pur.md) | noyau de simulation pur et ses trois garde-fous |
| [ADR-004](decisions/ADR-004-orchestration.md) | travail par orchestrateur, sous-agents et certificats (remplacé en partie par l'ADR-014) |
| [ADR-005](decisions/ADR-005-rk4-bloqueur.md) | intégration RK4 à dt = 1/120 s avec bloqueur d'ordre zéro |
| [ADR-006](decisions/ADR-006-oracle-matlab.md) | validation par oracle exact MATLAB, hors du site (niveau 1, puis contrôleur PI en T-023) |
| [ADR-007](decisions/ADR-007-i18n-maison.md) | i18n maison typée, sans bibliothèque |
| [ADR-008](decisions/ADR-008-licence-mit.md) | licence MIT |
| [ADR-009](decisions/ADR-009-machine-a-etats.md) | niveau en machine à états pure, instantané réutilisé et file d'événements ; évolution v0.3 : sept phases, embarquement et sortie |
| [ADR-010](decisions/ADR-010-rendu-crayon.md) | rendu au crayon par rubans CPU préalloués et matériaux TSL |
| [ADR-011](decisions/ADR-011-interface-dom.md) | interface en DOM superposé, pilotée par un modèle de vue pur |
| [ADR-012](decisions/ADR-012-tests-navigateur.md) | tests navigateur hors de la VM des agents, captures de référence |
| [ADR-013](decisions/ADR-013-ci-et-pages-manuel.md) | CI à chaque push, déploiement Pages manuel tant que le dépôt est privé |
| [ADR-014](decisions/ADR-014-protocole-allege.md) | protocole allégé : autonomie, vérification proportionnée, outils natifs de Claude Code |
| [ADR-015](decisions/ADR-015-etat-application-machine-ecrans.md) | état d'application : machine d'écrans pure (`src/app`), session de rendu unique, niveau jeté au retour au menu ; évolution v0.3 : commande `nextLevel` |
| [ADR-016](decisions/ADR-016-controleur-pi-sans-anti-windup.md) | contrôleur PI sans anti-windup, validé par tests puis par l'oracle exact de T-023, tolérance du niveau 2 |

### Captures

Les images de `img/` sont produites par les tests e2e (T-008 à T-010, T-016, T-017, T-020, T-021b, T-022, T-024, T-038), dans Chrome headless avec rendu logiciel ; `t019-*.png` est produit par un script ponctuel (aucun test ne l'écrit) et a été refait au commit `a308ada`, puis par T-040. T-033 a refait `t017-titre-fr` et `t017-titre-portrait` après la correction de K27 (mention de copyright sur fond opaque). T-025 a régénéré les captures périmées par le Kp par défaut de 2000 et le trajet de 10 s de T-022 (K35 corrigé) : `t008-paper-1280x720`, `t009-01`, `t009-02`, `t009-06`, `t010-01`, `t010-06` et `t021-niveau2-*`. Les captures `t009-05` et `t010-05` viennent de tests dont le réglage a changé depuis et n'ont pas été régénérées (`t010-02` l'a été par T-040) : les pages qui les intègrent le disent dans leur légende. T-038 a ajouté cinq captures du lot A : `t038-poste-niveau1`, `t038-embarquement`, `t038-sortie-pas-niveau1`, `t038-sortie-arrivee-niveau1` et `t038-sortie-niveau2` (écrites par `v03-rendu.spec.ts`). T-040 a refait douze PNG que le lot A avait périmés (K49) : `t009-02-console`, `t010-01-aide`, `t010-02-panneau`, `t010-06-portrait`, `t017-issue-menu`, `t019-approche-fr`, `t019-portrait-fr`, `t020-poutre-fr`, `t021-niveau2-portrait`, `t021-niveau2-reglage`, `t038-embarquement` et `t038-poste-niveau1`. Les deux captures de T-022 (`t022-niveau1-trop-court.png`, `t022-niveau2-trop-court.png`) et les deux de T-024 (`t024-niveau2-jauge-i.png`, `t024-niveau2-jauge-i-portrait.png`) sont à jour. Elles servent de référence visuelle : l'orchestrateur les regarde à chaque exécution (leçon L9). Les pages les intègrent par des liens relatifs.

### Pages prévues

Aucune. Toutes les pages du plan de la spec T-001 §10 existent ; les pages que la spec T-017 §10 demandait (écrans titre et menu, `src/app`, ADR) sont réalisées dans `interface.md`, `architecture.md` et l'ADR-015. L'intégration continue et la publication sont décrites dans [developpement.md](developpement.md#intégration-continue) et [tests.md](tests.md#intégration-continue) ; elles ne justifient pas une page à part.

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
