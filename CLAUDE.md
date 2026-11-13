# PID_GAME — « Huygens’s world »

Jeu web éducatif sur l'automatique et le contrôleur PID : bonhomme bâton au crayon sur papier millimétré, three.js (WebGPU avec repli WebGL2), Vite + TypeScript. Dépôt GitHub `pid-game` (privé pour l'instant), licence MIT. Documentation en français dans `docs/` ; la page d'entrée est `docs/README.md`.

## Commandes

| Commande                        | Rôle                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run check`                 | typecheck + lint + tests unitaires + build : la barrière de qualité                       |
| `npm run lint:arch`             | règles de dépendances (dependency-cruiser)                                                |
| `npm test` / `npm run test:cov` | Vitest, avec ou sans couverture                                                           |
| `npm run e2e`                   | Playwright ; impossible dans la VM des agents (pas de navigateur), voir « Environnement » |

Sous PowerShell, écrire `npm.cmd`. Node ≥ 22.12 (`.nvmrc` : 22).

## Règles du code

- Le noyau `src/sim` est pur, déterministe, sans dépendance au rendu (ADR-003) ; `npm run lint:arch` le vérifie.
- Pile figée (ADR-001) : toute nouvelle dépendance ou montée de version majeure est une décision de l'utilisateur.
- Interdits : `ts-ignore`, `eslint-disable`, `skipLibCheck`. Rien de MATLAB dans le site ; MATLAB sert à la validation seulement (`validation/`, ADR-006).
- Textes visibles par le joueur : jamais en dur, toujours dans `src/i18n/locales/` (FR et EN, mêmes clés).
- Suivre le style existant ; Prettier fait foi.

## Travail en équipe

La session principale est l'orchestrateur : elle discute les choix avec l'utilisateur, découpe le travail en tâches (`T-xxx`, `D-xxx` pour la doc), les confie aux sous-agents de `.claude/agents/` (modèle Opus) et garde `orchestration/REGISTRE.md`. Les sous-agents ne touchent pas au registre.

Un ordre de mission tient en quelques lignes : objectif, fichiers concernés, comment savoir que c'est fini. Pas de grille de critères numérotés obligatoire.

**Les agents décident seuls** des détails d'implémentation, du nommage, du découpage des fichiers dans leur périmètre, des tests à ajouter et des petits défauts rencontrés en chemin (à noter dans `orchestration/DEFAUTS-CONNUS.md`). Devant un doute mineur, ils prennent l'option la plus raisonnable, la signalent en une ligne dans leur compte rendu et continuent.

**On demande à l'utilisateur** (via l'orchestrateur) pour : les choix de design, de pédagogie et de lore ; les valeurs de jeu (par exemple la fenêtre de Kp) ; un changement de périmètre ou de spec ; une dépendance nouvelle ; tout ce qui est public ou irréversible (push, dépôt public, Pages, suppression).

## Vérification proportionnée

Le niveau est annoncé au lancement de la tâche. En cas de doute, prendre le niveau du dessus ; un agent peut escalader, l'orchestrateur peut relever.

| Niveau      | Quand                                                                                                                                       | Vérification                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| N1 léger    | faute, doc seule, renommage, style, texte i18n sans logique                                                                                 | `npm run lint` et `npm run typecheck` (ou `check` si du code a bougé)                                            |
| N2 courant  | fonctionnalité ou correction localisée hors zones critiques                                                                                 | `npm run check` vert, tests ajoutés ou adaptés ; l'orchestrateur lit le diff et relance `npm run check` lui-même |
| N3 critique | noyau `src/sim`, physique de l'ascenseur, valeurs et tolérances de jeu, oracle MATLAB, CI et déploiement, retouche d'un rendu déjà approuvé | comme N2, plus un validateur indépendant qui n'a pas vu la réalisation, et un log `orchestration/logs/T-xxx.md`  |

**Modèles des sous-agents.** N1 et N2 : sous-agents en Sonnet. N3 : réalisateur et validateur en Opus. L'orchestrateur passe le modèle au lancement de chaque sous-agent selon le niveau annoncé ; l'utilisateur n'a pas à le préciser. Le validateur reste en Opus quel que soit le niveau, et un agent en difficulté sur une tâche N1 ou N2 peut demander à passer en Opus.

Compte rendu d'un agent : fichiers modifiés, commandes lancées avec leur code de sortie, doutes. Il dit nettement ce qu'il n'a pas pu exécuter plutôt que de le supposer réussi ; l'orchestrateur ne croit pas un « vert » qu'il n'a pas pu relancer sur un point à risque. Pour un rendu, l'orchestrateur regarde les captures même quand les tests passent.

## Documentation

La doc décrit le code réel, valeurs mesurées et jamais devinées. Le rédacteur passe après la validation, sur un état figé du dépôt (hash de commit donné dans l'ordre), jamais en parallèle d'un réalisateur. Une tâche N1 ne demande pas de mise à jour de la doc sauf si elle change un comportement décrit.

## Git

Un commit par tâche validée, fait par l'orchestrateur, au nom de lucashg7892 <lucashg7892@users.noreply.github.com>. Pas de push sans demande de l'utilisateur. Le clôturage d'une tâche suit le skill `cloturer-tache`.

## Environnement d'exécution

Ces points viennent de l'expérience de la v0.1 (leçons du registre) :

- Le dépôt n'est accessible aux agents que par `device_bash`, dans `$HOME/mnt/PID_GAME`, jamais par leurs outils de fichiers locaux.
- Commandes au premier plan, moins de 180 s, pas de processus en arrière-plan.
- Dans `device_bash`, un heredoc convertit les échappements `\uXXXX` en vrais caractères : écrire par script Python les fichiers qui en contiennent.
- Les agents ne peuvent pas télécharger de navigateur : les tests e2e tournent chez l'orchestrateur (Chrome for Testing) ou dans la CI GitHub.
- L'autorisation de suppression dans le dossier connecté expire à chaque session : la redemander avant de lancer un agent, sinon le build échoue (EPERM sur `dist/`).
