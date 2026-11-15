# Chasse aux bugs v0.2 : compte rendu final

Date : 2026-11-14. Branche `migration`, sans push ni fusion. Commit examiné par les validateurs : `f2680d1`. Dernier commit de code : `02119f7`. Utilisateur absent : toutes les décisions ci-dessous ont été prises par l'orchestrateur.

## Tableau

| Tâche | Niveau | Commit | Résultat | Défauts trouvés et corrigés | Défauts ajoutés à la liste | Non exécuté |
|---|---|---|---|---|---|---|
| 1. K28 : oracle MATLAB du PI et `pi-exact.test.ts` | N3, validateur Opus | `badab42` (T-023, fait avant ce lot) | Déjà fait : 0 désaccord sur 113 Ki, noyau juste, rien à corriger. Plages de Ki à Kp = 2500 (grille de 100) : trop court 0 à 100, victoire 200 à 800, choc 900 à 8000, inchangées. Non refait ; MATLAB `t018_run_all` relancé ce soir : 0 sur 113, FIN SANS ERREUR. | aucun | aucun | mutation réelle de `pi.ts` |
| 2. Attaque A (cycle de vie, ressources, écouteurs, redimensionnement, échecs) et B (état des niveaux, logique du niveau 2, entrées, textes, accessibilité) | validateurs Opus, lecture seule | `7594048` (rapports `docs/validation/V-v0.2-A-cycle-de-vie.md` et `V-v0.2-B-etat-textes-logique.md`) | 3 majeurs, 16 mineurs, aucun bloquant. Aucune fuite (écouteurs, minuteries, objets GPU stables sur 30 à 300 cycles). Grille de Ki par le vrai niveau : 0 écart avec la référence. Textes : 104 états FR/EN sans accolade, NaN ni clé brute. | 19 défauts trouvés | voir étape 3 | WebGPU réel, vraie répétition clavier, tactile réel, lecteur d'écran, Firefox, Safari, restauration du contexte GPU |
| 3a. B-01 : aide ouverte, le clavier passait encore | N2 | `ea76b0b` (T-026) | Corrigé, tests unitaire et e2e qui échouent sans la correction | B-01 (majeur) | aucun | aucun |
| 3b. A-01 et A-03 : double activation qui saute un écran, Échap maintenue | N2 | `fa65836` (T-027) | Corrigé, 7 e2e dont 5 échouent sans la correction | A-01 (majeur), A-03 | aucun | double-clic à 1920×1080 et 390×844 |
| 3c. A-02 : boutons de l'issue hors de vue en paysage bas | N2 | `28b7e2c` (T-028) | Corrigé (pied collant), 16 e2e de régression, 12 échouent sans la correction | A-02 (majeur) | K39 (à 667×375 l'issue recouvre le bas de la cage) | test de non-recouvrement à 667×375 |
| 3d. Six mineurs rapides | N2 | `cb45961` (T-029) | Corrigés, 6 e2e et tests de catalogue qui échouent sans la correction | A-05, A-09, B-03, B-04, B-06, B-08 | aucun | aucun |
| 3e. Consignation des mineurs non corrigés, commentaire d'`iTerm` | N1 | `93cb47e` (P-011) | Fait | B-09 | K40 (A-04), K41 (A-06), K42 (A-08), K43 (A-10), K44 (B-02), K45 (B-05), K46 (B-07) | |
| 4a. K22 : `prefers-reduced-motion` suivi dynamiquement | N2 | `f90e01b` (T-030) | Corrigé, e2e et unitaire, écouteur retiré à l'arrêt (le test e2e échoue sans la correction) | K22 | aucun | WebGPU réel |
| 4b. K10 et A-07 : interface en retard d'une image, ancres du niveau précédent | N2 | `d0927e2` (T-031) | A-07 corrigé (test qui échoue sans la correction). K10 corrigé par construction (`onFrameEnd`) mais son test e2e n'est PAS démonstratif : il passe aussi sans la correction, le décalage d'environ 2 px par image n'existant qu'en temps réel | K10, A-07 | aucun | preuve d'échec de K10 |
| 4c. K27 : copyright traversé par la grille | N2 | `3b658eb` (T-032) | Corrigé (papier opaque), capture regardée, check et e2e verts | K27 | aucun | aucun |
| 4d. K35 : captures périmées | N1 | `02119f7` (T-033) | 22 captures régénérées et comparées pixel par pixel à leur version commitée ; seules 2 ont changé de contenu (`t017-titre-fr`, `t017-titre-portrait`) et sont commitées ; le reste (tremblé du crayon, fond opaque du pied des boutons) est restauré. Les autres captures périmées avaient déjà été refaites en T-025 (`0459420`). | K35 | aucun | |
| FIN. Documentation | N1 | commit D-018 (voir `git log`) | Doc, CHANGELOG, défauts connus (K1 à K46), index mis à jour ; 366 liens sans erreur ; nombres périmés balayés | B-09 (doc) | aucun | e2e non lancé par le rédacteur (lancé par l'orchestrateur) |

## Vérifications finales (orchestrateur, au dernier état)

- `npm.cmd run check` : code 0 (49 fichiers, 661 tests, 67 modules et 179 dépendances sans violation, build).
- `npm.cmd run test:cov` : code 0, noyau `src/sim` à 100 % (192/192 instructions, 102/102 branches, 38/38 fonctions, 178/178 lignes).
- `powershell -NoProfile -Command "npm.cmd run e2e"` : code 0, 108 tests (74 au début du lot).
- MATLAB `t005_run_all.m` : code 0, fenêtre [1000 ; 5000], 0 désaccord sur 80, FIN SANS ERREUR. `t018_run_all.m` : code 0, 0 désaccord sur 113, FIN SANS ERREUR.
- Aucune constante de jeu, fenêtre de Kp ou de Ki, valeur par défaut, ni `src/sim` modifiés dans ce lot : `git diff f2680d1..HEAD -- src/sim src/game/constants.ts` est vide.

## Décisions prises sans l'utilisateur

1. K28 déjà fait (T-023) : non refait. K30 et la plus grande part de K35 étaient déjà faits ; pour K35, seules 2 captures commitées après comparaison pixel par pixel.
2. Attaque confiée à deux validateurs Opus successifs (A puis B) plutôt qu'un seul, pour ne pas surcharger un contexte ni faire se chevaucher leurs exécutions dans le même arbre ; rapports commités tels quels.
3. Aucun bloquant ; les trois majeurs (B-01, A-01, A-02) sont corrigés en N2 (couche interface seulement, noyau et logique de jeu non touchés), chacun avec son commit et un test de régression vérifié en échec sans la correction.
4. A-01 : garde `event.detail > 1` et `repeat` plutôt que le drapeau `pointerdown` du rapport (qui laissait passer le second clic d'un vrai double-clic) ; un clic synthétique (`element.click()`, lecteur d'écran) reste accepté.
5. A-02 : pied de boutons collant ; à 667×375 un repli pose l'issue en bas sur 150 px et recouvre le bas de la cage (K39) plutôt que de laisser les boutons hors de vue.
6. Textes visibles tranchés seuls : B-06 (bulle anglaise du niveau 1 = le texte prévu en T-019) ; B-08 (l'aide dit « utiliser la console, puis lancer »).
7. B-03 : Échap annule la saisie du champ numérique ; B-04 : bouton d'issue désactivé en pause, focus rendu au bouton Pause.
8. B-02 (virgule dans le champ numérique) laissé en K44 : c'est un choix d'interface (analyser selon la langue ou refuser les valeurs hors bornes), non tranché.
9. K10 : corrigé par construction, le test e2e n'est qu'une garde de cohérence ; dit tel quel dans le CHANGELOG.
10. K27 corrigé par l'orchestrateur lui-même (CSS de quelques lignes) ; K22, K10 et les autres par agent.
11. Les correctifs T-026 à T-033 (N1 et N2) n'ont pas eu de validateur indépendant supplémentaire : vérifiés par l'orchestrateur (diff lu, `check`, e2e complet, captures regardées).
12. La suppression du dossier temporaire `.vitest/` (laissé à la racine par le rédacteur) m'a été refusée par les permissions et je ne l'ai pas contournée : j'ai ajouté `.vitest/` à `.gitignore` et `.prettierignore`. Le dossier est toujours sur le disque : à supprimer à la main (`Remove-Item -Recurse .vitest`).
13. La version reste 0.2.0 ; aucune ADR (aucun choix structurant).
14. Deux agents ont été interrompus par la limite d'usage (T-028 et la documentation D-016) : reprises depuis leur état sauvegardé, sans perte.

## Ce qui n'a pas pu être exécuté

WebGPU réel (K8) ; tactile réel (K9) ; lecteur d'écran réel ; Firefox et Safari ; vraie répétition clavier et vrai changement d'onglet (émulés) ; restauration du contexte GPU après perte ; B-05 dans le navigateur (reproduit en unitaire seulement) ; mutations réelles des constantes et de `pi.ts` ; preuve d'échec du test K10.
