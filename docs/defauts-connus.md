# Défauts connus

À quoi sert cette page : donner à un contributeur la liste des défauts connus, K1 à K35, rangés par thème, avec l'endroit où ils se voient, leur gravité et, quand elle est évidente, une piste de correction. Aucun n'est bloquant. Source : `orchestration/DEFAUTS-CONNUS.md` (tenu par l'orchestrateur, recopié ici à l'état du commit `08908b6`) et le rapport [validation/T-012-v0.1.md](validation/T-012-v0.1.md) (constats V-1 à V-10). Depuis le commit `88ae23c` (celui du rapport T-012), treize défauts sont corrigés : K1, K2, K3, K16, K17, K19, K20, K21 (avant `13e8b7e`), puis K6 (T-020, puis T-022), K18, K23 et K24 (T-017), K32 (T-022) ; K22 l'est en partie. Les défauts K25 à K35 sont nés de T-017, T-019, T-021a, T-021b et T-022. Les défauts corrigés sont regroupés en fin de page. La page s'appelait « Défauts connus de la v0.1 » ; l'état de la v0.1 reste celui du commit `88ae23c` ([bilan-v0.1.md](bilan-v0.1.md)).

Gravités : « majeur » gêne le joueur sans bloquer le niveau ; « mineur » est un détail visible ou une lacune de preuve ; « à juger » attend un test de jeu ; « à surveiller » est une marge faible ; « à décider » attend une valeur de jeu de l'utilisateur ; « information » ne demande pas de correction. Les pistes sont des suggestions du rédacteur ou du validateur, pas des décisions.

## Interface

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K9 | Boutons tactiles jamais essayés sur un vrai écran tactile (limite étendue aux écrans titre et menu) | téléphone ou tablette | à vérifier | essai manuel sur appareil |
| K10 | Ancres de l'interface avec une image de retard : `ui.update()` est appelé avant `level.update` | `src/main.ts` (`onFrame`) ; étiquettes qui suivent la cabine | mineur | appeler `ui.update()` après `level.update(dt)` ; un correctif complet touche aussi `src/render/session.ts`, où les ancres sont calculées dans `draw` (spec T-017 §7) |
| K25 | Portrait 390 px en trajet : le panneau de mesures et le panneau Kp sont rognés en bas (défilement interne) et la dernière ligne de la légende (« Jauge ») n'est pas visible sans défiler ; vu sur les captures de T-019 | [interface.md](interface.md#petit-écran-en-portrait) | mineur (voir K5) | mise en page propre au portrait, à concevoir |
| K26 | En pause en portrait étroit (≤ 700 px), le titre et l'étiquette Kp de la barre du haut sont masqués par CSS pour que les quatre boutons (?, langue, Menu, Reprendre) tiennent ; choix « le plus simple » de T-017e | `src/ui/ui.css` (`.ui-top.is-paused`) | mineur ; reporté (D30 : le portrait étroit n'est pas prioritaire) | à valider côté design |
| K27 | Écran titre : la mention de copyright est posée directement sur le papier millimétré (sans carte) ; une ligne de grille traverse le texte | [interface.md](interface.md#écrans-titre-et-menu-t-017) | mineur | mettre la mention sur une carte de papier |
| K33 | Portrait 390 px, niveau 2 : le panneau de réglage défile en interne (231 px visibles pour 341 px de contenu) et « Lancer » n'est pas visible sans défiler (la touche Entrée et le bouton « Action » restent) | capture `t021-niveau2-portrait.png` | mineur (voir K5, K25) | idem K25 |

## Rendu

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K4 | Embarquement et sortie du bonhomme non animés | lancement et victoire ; voir [jeu.md](jeu.md) | mineur | animer dans le rendu, la logique le place déjà au centre de la cabine |
| K5 | Portrait sur téléphone : scène minuscule (17 m de décor dans la largeur) | téléphone en portrait (une invite de rotation s'affiche) | mineur | cadrage propre au portrait, à concevoir |

## Jeu

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K7 | Bornes de la fenêtre du niveau 1 : marge de 1,74 mm sous la poutre à Kp = 5000 et de 1,79 mm au-dessus à Kp = 5100 ; marge de tolérance de 9,5 mm à Kp = 1000 (cible [1000 ; 5000], décision D25). Avant T-020 : 5,8 mm à Kp = 3800 | [physique/ascenseur.md](physique/ascenseur.md#fenêtre-de-réussite-1000--5000-nm) | à surveiller | relancer `validation/matlab/t005_run_all.m` après toute retouche de la physique ou des règles ; ajuster après test de jeu |
| K15 | Références de jeu à 6 décimales : 4,4e-7 m de marge sous la tolérance de 1e-6 m ; revérifié en T-020 : écart noyau / exact 1,1e-7 m au pire, tolérances inchangées | tests de référence de `src/sim` | mineur | stocker les références avec plus de décimales |
| K29 | Marge très faible aux bornes de choc de Ki à Kp = 2500 : Ki = 840 passe à 0,384 mm sous la poutre et Ki = 850 la heurte (avec le curseur de 100, seuls 800 et 900 comptent) | niveau 2, [jeu.md](jeu.md#niveau-2--arbitre-et-fin-de-temps) | à surveiller (voir K7) | relancer la mesure après toute retouche |
| K30 | Niveau 2 : la jauge du terme intégral (valeur de I, repère m·g, graduation « demande ») est reportée ; l'instantané expose déjà `iTerm` | rendu et interface du niveau 2 | à faire (spec T-018 §6) | tâche de rendu |
| K31 | Niveau 2 : annotations détaillées du windup, loupe de la bande de tolérance et courbe I(t) reportées | rendu du niveau 2 | à faire (spec T-018 §6, Q6) | tâche de rendu |
| K34 | Niveau 2 : l'issue « trop lent » n'arrive sur aucun Ki de la grille de 100 (seulement Ki = 130, hors grille) : `level2.fail.slow` et `hud.status.fail.slow` ne s'affichent jamais à un joueur ; « Il manque 0,10 m » apparaîtrait à Ki = 120 (e = 0,1046), valeur inatteignable au curseur ; victoire la plus lente hors grille à Ki = 140 (pas 1185 sur 1200) | niveau 2 ; [jeu.md](jeu.md#niveau-2--arbitre-et-fin-de-temps) | mineur | pas de curseur plus fin, ou retouche de la tolérance (valeur de jeu, décision de l'utilisateur) |

## Outillage et tests

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K8 | WebGPU réel jamais exercé par un test automatique (headless sans adaptateur : repli WebGL2) | tests e2e | limite d'outillage | essai manuel sur un vrai GPU, backend relevé |
| K11 | 10 vulnérabilités npm modérées dans la chaîne de lint (dépendances de développement seulement) | `npm audit` | à revoir | traiter à la montée de version des outils |
| K12 | Couverture Vitest de `src/ui` : 36,6 % (mesure de D-010, non refaite depuis : `src/ui` a gagné des fichiers) ; les fichiers DOM ne sont couverts que par l'e2e | `npm run test:cov` ne mesure que `src/sim` ; commande dans [tests.md](tests.md#couverture) | information | préciser la commande qui produit ce chiffre |
| K13 | Contrastes et `prefers-reduced-motion` non testés en e2e (la spec T-017 prévoyait un test de mouvement réduit pour les nouveaux écrans : il n'existe pas) | `tests/e2e/` | à vérifier | e2e avec mouvement réduit émulé et mesure de contraste |
| K28 | Oracle MATLAB du contrôleur PI et test d'oracle exact TypeScript (`tests/sim/pi-exact.test.ts`, spec T-018 §8) reportés : le PI n'est validé que par tests unitaires et de déterminisme | [physique/ascenseur.md](physique/ascenseur.md#niveau-2--contrôleur-pi), [ADR-016](decisions/ADR-016-controleur-pi-sans-anti-windup.md) | à faire (N3) | étendre l'oracle (`t018_*.m`) et ajouter `pi-exact.test.ts` |

| K35 | Captures du dépôt périmées : `t008-paper-1280x720`, `t009-01`, `t009-02`, `t010-01`, `t010-06` (Kp par défaut 500 : levier de la console, étiquette Kp), `t009-06-trop-court` (courbe sur 6 s), `t021-*` (Ki par défaut 500) | `docs/img/` ; légendes de [interface.md](interface.md) et [rendu.md](rendu.md) | mineur | régénérer par l'e2e (`npm.cmd run e2e`), en ne gardant que les captures voulues |

## Publication

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K14 | GitHub Pages impossible tant que le dépôt est privé (compte gratuit) | aucun site publié ; lien de la page de repli inaccessible au public | décision utilisateur | les 3 étapes de [developpement.md](developpement.md#déploiement-sur-github-pages) |
| K22 | `prefers-reduced-motion` lu une seule fois au démarrage (la version de `package.json` est corrigée, voir plus bas) | `src/render/session.ts`, `bootstrap.ts` | mineur | écouter l'événement `change` de la requête média |

## Corrigés depuis la validation

Chaque ligne donne la tâche qui a corrigé le défaut et le comportement actuel (valeurs relevées dans le code ; commit `13e8b7e` pour K1 à K22, `119519b` pour les suivants, `08908b6` pour K6 et K32).

| # | Défaut d'origine | Tâche | Correction |
|---|---|---|---|
| K1 | Signe moins affiché avec un trait d'union ASCII | P-005 | `formatNumber` remplace le « - » d'ICU par U+2212 (`MINUS`, `src/i18n/format.ts`) ; « −0,03 m », « Force : −102 N ». Testé par `tests/i18n/format.test.ts` |
| K2 | Portrait 390 px : étiquette de Kp masquée par l'invite de rotation | P-005 | barre du haut de 76 px en portrait (`TOP_BAR_PORTRAIT`), `ROTATE_BAR` = 48, `.ui-rotate { top: 80px }` ([interface.md](interface.md#petit-écran-en-portrait)) |
| K3 | Aucune touche ne referme le panneau de réglage sans lancer | P-005 | Échap en réglage : intention `closeTuning` ; hors réglage, Échap met en pause ([interface.md](interface.md#touches-qui-dépendent-de-la-phase)) |
| K6 | L'échec « marche trop haute » n'était déclaré qu'au bout de 15 s (1800 pas) | T-020 (décision D24), puis T-022 (décision D27) | `TRIP_MAX_STEPS` = 1200 pas, soit 10 s ; 720 pas (6 s) de T-020 à T-021b ([jeu.md](jeu.md#règles-dissue)) |
| K32 | Niveau 2 : avec la tolérance de 0,5 m, Ki = 0 gagnait et le défaut de Ki (500) gagnait sans réglage | T-022 (décision D29) | `LEVEL2_ARRIVAL_TOLERANCE` = 0,10 m ; grille de Ki : trop court 0 à 100, victoire 200 à 800, choc 900 à 8000 ; au pas de 10 : trop court 0 à 120, trop lent 130, victoire 140 à 840, choc dès 850 ; `KI_DEFAULT` = 2000 heurte la poutre (pas 57) ; reste K34 ([jeu.md](jeu.md#niveau-2--arbitre-et-fin-de-temps), [ADR-016](decisions/ADR-016-controleur-pi-sans-anti-windup.md)) |
| K16 | Perte de contexte GPU non gérée | T-014 | `renderer.onDeviceLost` : session arrêtée, interface retirée, page de repli `fallback.lost.*` ([rendu.md](rendu.md#échecs-en-cours-de-route-t-014)). Le chemin WebGPU `device.lost` est lu dans three mais non exercé (K8) |
| K17 | Exception après le démarrage du renderer non rattrapée | T-014 | même chemin, page `fallback.error.*` ; e2e avec `crashNextFrame()` |
| K18 | Géométrie de l'interface recalculée seulement sur `resize` de la fenêtre | T-017e | `ResizeObserver` sur le canvas, dans `main.ts` (retiré à la sortie du niveau) ([architecture.md](architecture.md#ce-que-fait-srcmaints)) |
| K19 | L'aide ne met pas en pause pendant un trajet | T-015 | pause à l'ouverture pendant un trajet, reprise à la fermeture seulement si l'aide avait mis en pause (`src/ui/help.ts`) ; la limite restante, K24, est corrigée aussi |
| K20 | Saturation sans e2e ni capture | T-016 | `tests/e2e/saturation.spec.ts` et `docs/img/t016-saturation.png` |
| K21 | `aria-pressed` sur Pause ; aide sans `aria-modal` ni piège de focus ; focus non porté sur « Rejouer » | T-015 | `aria-pressed` retiré, `aria-modal="true"`, piège de focus, focus rendu à l'ouvreur, focus sur le bouton de l'issue ([interface.md](interface.md), section « Aide des commandes ») |
| K22 (version) | `package.json` en version `0.0.0` | P-005 | version `0.1.0` ; la partie `prefers-reduced-motion` reste ouverte, plus haut |
| K23 | Aide ouverte pendant un trajet : les mesures transparaissaient sous le papier translucide de l'aide | T-017abc | papier de l'aide opaque ; e2e (p) de `ui.spec.ts` |
| K24 | Cliquer « Reprendre » alors que l'aide est ouverte relançait le jeu derrière l'aide | T-017abc | garde `commandsBlocked(helpOpen)` (`src/ui/help.ts`) sur toutes les commandes du niveau ; l'aide reprend le jeu à sa fermeture si c'est elle qui l'avait mis en pause ; e2e (o) de `ui.spec.ts` |

Le constat V-10 de T-012 signalait aussi que le README annonçait encore l'intégration continue comme à venir alors que `ci.yml` existait : corrigé par T-013.
