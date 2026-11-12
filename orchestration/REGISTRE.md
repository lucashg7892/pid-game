# Registre d'orchestration — PID_GAME

Tenu par l'orchestrateur. Les sous-agents ne modifient jamais ce fichier.

## 1. Décisions de design (validées par l'utilisateur, 2026-11-12)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Univers | Bonhomme bâton au crayon sur papier millimétré ; les courbes se tracent dans le décor |
| D2 | Gameplay | Plateforme ; chaque obstacle est un système dont il faut régler le contrôleur |
| D3 | Langue | Français + anglais, textes externalisés dès le départ |
| D4 | Portée v1 | Tranche verticale : un niveau complet (contrôleur P sur un ascenseur) |
| D5 | Technique | Three.js (WebGPURenderer, repli WebGL2), caméra orthographique 2,5D, Vite + TypeScript, GitHub Pages |
| D6 | Architecture | Noyau de simulation pur, pas fixe, déterministe, sans dépendance au rendu |
| D7 | Documentation | Sous-agent dédié ; doc technique mise à jour à chaque tâche validée |
| D8 | Progression pédagogique | boucle ouverte/fermée → P → 1er ordre → I (windup) → D (bruit) → PID → défi final |
| D9 | Niveau 1 | Kp verrouillé pendant le trajet ; fenêtre de réussite Kp ∈ [2000 ; 3800] N/m conservée, à ajuster après test de jeu |
| D10 | Police | Manuscrite sous licence OFL, auto-hébergée dans `public/fonts/` avec sa licence |
| D11 | Dépôt GitHub | `pid-game` (base Vite `/pid-game/`) |
| D12 | Licence | MIT ; titulaire = lucashg7892 |
| D13 | Git | Un commit par tâche validée, fait par l'orchestrateur ; auteur = lucashg7892 <lucashg7892@users.noreply.github.com> |
| D14 | MATLAB | Autorisé pour la validation uniquement ; rien de MATLAB dans le site |

## 2. Protocole

Rôles (sous-agents Claude Opus 5.5, jamais cumulés sur une même tâche) :
concepteur, réalisateur, validateur (n'a pas vu la réalisation), rédacteur de doc.

Ordre de mission : identifiant T-xxx, objectif, fichiers autorisés, critères
d'acceptation numérotés (CA-n), commandes de vérification imposées, interdits.

Certificat rendu par l'agent :
1. fichiers créés/modifiés + SHA-256 ;
2. commandes exécutées, code de sortie, fin de la sortie brute ;
3. chaque CA-n : PASS/FAIL + preuve ;
4. écarts et doutes déclarés.

Vérification par l'orchestrateur : recalcul des hash, relance des commandes.
Certificat non reproductible = échec. En cas d'échec, on corrige l'ordre de
mission et on consigne la leçon en section 4.

## 3. État des tâches

| ID | Rôle | Objet | Statut | Log |
|----|------|-------|--------|-----|
| T-000 | réalisateur | Pilote : git init, .gitignore, .gitattributes | VALIDÉ | logs/T-000.md |
| T-001 | concepteur | Spec de la tranche verticale | VALIDÉ | logs/T-001.md |
| T-002 | réalisateur | Socle outillé (npm, TS, Vite, lint, tests) | VALIDÉ (réserves) | logs/T-002.md |
| T-003 | réalisateur | Noyau : horloge, saturation, RK4, enregistreur | VALIDÉ | logs/T-003.md |
| T-004 | réalisateur | Noyau : contrôleur P, ascenseur, boucle, oracle | VALIDÉ | logs/T-004.md |
| T-005 | validateur | Validation indépendante du noyau (oracle exact MATLAB) | VALIDÉ (réserves) | logs/T-005.md |
| T-004b | réalisateur | Corrections issues de T-005 (D-1, D-2, D-6, D-7) | VALIDÉ | logs/T-004b.md |
| T-006 | réalisateur | i18n FR/EN | EN COURS | logs/T-006.md |
| D-002 | rédacteur | Doc technique initiale (README, docs/) | VALIDÉ | logs/D-002.md |

## 4. Leçons sur les consignes

- L1 (T-000) : toujours préciser aux sous-agents que le dépôt n'est accessible que par `device_bash` (`$HOME/mnt/PID_GAME`), jamais par leurs outils de fichiers locaux.
- L2 (T-001) : exiger de chaque agent qu'il distingue « lu dans le source » de « exécuté » ; reporter chaque fait non exécuté comme CA de la tâche suivante.
- L3 (T-002) : un CA de l'orchestrateur a contredit la spec (import three dans main.ts) ; relire la spec avant d'ajouter un CA maison.
- L4 (T-002) : pas de processus en arrière-plan dans device_bash ; commandes au premier plan, < 180 s.
- L5 (D-002) : ne pas lancer le rédacteur en parallèle d'un réalisateur : il lit un dépôt en mouvement. Le rédacteur passe après la validation, sur un état figé.
