# Défauts connus et idées reportées

Liste tenue par l'orchestrateur. Rien ici n'est bloquant pour la v0.1.

| # | Défaut | Origine | Gravité |
|---|--------|---------|---------|
| K1 | Signe moins affiché avec un trait d'union ASCII (« -0,03 m », « Force : -102 N ») | T-010 | mineur → corrigé (P-005) |
| K2 | Portrait 390 px : étiquette permanente de Kp en partie masquée par l'invite de rotation | T-010 | mineur → corrigé (P-005) |
| K3 | Aucune touche pour refermer le panneau de réglage sans lancer | T-010 | mineur → corrigé (P-005) |
| K4 | Embarquement et sortie du bonhomme non animés | T-009 | mineur |
| K5 | Portrait sur téléphone : scène minuscule (17 m de décor dans la largeur) | T-009 | mineur |
| K6 | Échec « marche trop haute » déclaré seulement au bout de 15 s | T-007 | corrigé (D24, T-020) : 6 s, puis 10 s (D27, T-022) |
| K7 | Bornes de la fenêtre : marge de 1,74 mm sous la poutre à Kp = 5000 et de 1,79 mm au-dessus à 5100 ; marge de tolérance de 9,5 mm à Kp = 1000 (cible [1000 ; 5000], D25) | T-020 (ex-K7 : 5,8 mm à Kp = 3800) | à surveiller |
| K8 | WebGPU réel jamais exercé par un test automatique | T-008 | limite d'outillage |
| K9 | Boutons tactiles non essayés sur un vrai écran tactile | T-010 | à vérifier |
| K10 | Ancres de l'interface avec une image de retard (`ui.update()` avant `level.update`) | D-010 | mineur |
| K11 | 10 vulnérabilités npm modérées dans la chaîne de lint (dev seulement) | T-002 | à revoir à la montée de version |
| K12 | Couverture Vitest de src/ui : 36,6 % (fichiers DOM couverts par l'e2e seulement) | D-010 | information |
| K13 | Contrastes et `prefers-reduced-motion` non testés en e2e | D-010 | à vérifier |
| K14 | GitHub Pages impossible tant que le dépôt est privé (compte gratuit) | D17 | décision utilisateur |
| K15 | Références de jeu à 6 décimales : 4,4e-7 m de marge sous la tolérance de 1e-6 | T-005 (D-10) | mineur ; revérifié en T-020 : écart noyau / exact 1,1e-7 m au pire, tolérances inchangées |
| K16 | Perte de contexte GPU non gérée (aucun écouteur `webglcontextlost` / `device.lost`) | T-012 (V-1) | majeur, non bloquant → corrigé (T-014) ; chemin WebGPU `device.lost` lu dans three mais non exercé (voir K8) |
| K17 | Exception après le démarrage du renderer non rattrapée (pas de page de repli) | T-012 (V-2) | mineur → corrigé (T-014) |
| K18 | Géométrie de l'interface recalculée seulement sur `resize` de la fenêtre | T-012 (V-3) | mineur → corrigé (T-017e, `ResizeObserver` sur le canvas) |
| K19 | Ouvrir l'aide pendant un trajet ne met pas en pause | T-012 (V-4) | mineur → corrigé (T-015) |
| K20 | Saturation (jauge rouge) couverte par des tests unitaires seulement, sans e2e ni capture | T-012 | mineur → corrigé (T-016) |
| K21 | Bouton Pause : libellé et `aria-pressed` changent ensemble ; aide en `role="dialog"` sans `aria-modal` ni piège de focus ; focus non porté sur « Rejouer » à l'issue | T-012 (V-5 à V-7) | mineur → corrigé (T-015) |
| K22 | `package.json` en version 0.0.0 ; `prefers-reduced-motion` lu seulement au démarrage | T-012 (V-8, V-10) | mineur → version corrigée (P-005) ; `prefers-reduced-motion` toujours lu au démarrage seulement |
| K23 | Aide ouverte pendant un trajet : les mesures (Temps, Erreur, Légende) transparaissent faiblement sous le papier translucide de l'aide (z-index ajouté en T-015 pour la lisibilité) | T-015 | mineur → corrigé (T-017abc, papier de l\'aide opaque) |
| K24 | Cliquer « Reprendre » alors que l'aide est ouverte relance le jeu derrière l'aide ; l'aide ne reprend pas à la fermeture | T-015 | mineur → corrigé (T-017abc, garde `commandsBlocked`) |
| K25 | Portrait 390 px en trajet : le panneau de mesures et le panneau Kp sont rognés en bas (défilement interne) et la dernière ligne de la légende (« Jauge ») n'est pas visible sans défiler ; vu sur les captures de T-019 | T-019 | mineur (voir K5) |
| K26 | En pause en portrait étroit (≤ 700 px), le titre et l'étiquette Kp de la barre du haut sont masqués par CSS pour que les quatre boutons (?, langue, Menu, Reprendre) tiennent ; choix « le plus simple » de T-017e, à valider côté design | T-017e | mineur ; reporté (D30 : le portrait étroit n'est pas prioritaire) |
| K27 | Écran titre : la mention de copyright est posée directement sur le papier millimétré (sans carte) ; une ligne de grille traverse le texte | T-017d | mineur |
| K28 | Oracle MATLAB du contrôleur PI et test d'oracle exact TypeScript (`tests/sim/pi-exact.test.ts`, spec T-018 §8) reportés : le PI n'est validé que par tests unitaires et de déterminisme | T-021a | corrigé (T-023) : oracle MATLAB `t018_*.m` et `tests/sim/pi-exact.test.ts`, 0 désaccord sur 113 Ki |
| K29 | Marge très faible aux bornes de choc de Ki à Kp = 2500 : Ki = 840 passe à 0,384 mm sous la poutre et Ki = 850 la heurte (pas de curseur de 100 : seuls 800 et 900 comptent) | T-021a | à surveiller (voir K7) |
| K30 | Niveau 2 : la jauge du terme intégral (valeur de I, repère m·g, graduation « demande ») est reportée ; le snapshot expose déjà `iTerm` | T-021b | corrigé (T-024) : jauge de I, échelle de la jauge de force, repère m·g, étiquettes et ligne de légende |
| K31 | Niveau 2 : annotations détaillées du windup, loupe de la bande de tolérance et courbe I(t) reportées | T-021b | à faire (spec T-018 §6, Q6) |
| K32 | Niveau 2 : avec la tolérance de 0,5 m, Ki = 0 gagnait et le défaut gagnait sans réglage | T-021a, T-021b | corrigé (D29, T-022) : tolérance 0,10 m ; grille de Ki : trop court 0 à 100, victoire 200 à 800, choc 900 à 8000 ; défaut Ki = 2000 : choc |
| K33 | Portrait 390 px, niveau 2 : le panneau de réglage défile en interne (231 px visibles pour 341 px de contenu) et « Lancer » n'est pas visible sans défiler (la touche Entrée et le bouton « Action » restent) | T-021b | mineur (voir K5, K25) |
| K34 | Niveau 2 : l'issue « trop lent » n'arrive sur aucun Ki de la grille de 100 (seulement Ki = 130, hors grille) ; l'oracle exact donne « trop lent » pour Ki de 128,38 à 138,59 (entiers 129 à 138) : `level2.fail.slow` et `hud.status.fail.slow` ne s'affichent jamais à un joueur ; « Il manque 0,10 m » apparaîtrait à Ki = 120 (e = 0,1046), valeur inatteignable au curseur ; victoire la plus lente hors grille à Ki = 140 (pas 1185 sur 1200) | T-022 | mineur |
| K35 | Captures du dépôt périmées : `t008-paper-1280x720`, `t009-01`, `t009-02`, `t010-01`, `t010-06` (Kp par défaut 500 : levier de la console, étiquette Kp), `t009-06-trop-court` (courbe sur 6 s), `t021-*` (Ki par défaut 500) | T-022 | corrigé (T-025) : t008-paper-1280x720, t009-01, t009-02, t009-06, t010-01, t010-06 et t021-niveau2-* régénérées ; t019-approche-fr et t019-portrait-fr refaites à la main (aucun test ne les écrit) ; t010-02, 03, 05 non touchées (tremblement du crayon seulement) |
| K36 | Portrait 390 px, niveau 1 : le titre « Force du moteur » touche l'étiquette « 5000 N max » d'environ 4 px (corrigé au niveau 2 seulement, par un décalage de 6 px) | T-024 | mineur |
| K37 | Portrait 390 px, niveau 1 : la cote chiffrée « e = 0,00 m » touche l'étiquette « poids » de 3 px (corrigé au niveau 2 seulement, par un décalage de 6 px) | T-024 | mineur |
| K38 | Niveau 2 en paysage : l'étiquette « Terme intégral I » monte à environ 54 px, presque la barre du haut (56 px) ; sans recouvrement à 1280×720, non testé sur des fenêtres paysage plus basses ; le panneau de mesures est plus étroit (environ 180 px) | T-024 | mineur |
| K39 | Paysage très bas (667×375 et fenêtres de même type, bande sous la scène de moins de 120 px) : le panneau d'issue, repli de T-028 pour garder ses boutons visibles (A-02), se pose en bas sur 150 px et recouvre le bas de la cage ; le test de non-recouvrement de `layout.test.ts` ne couvre pas cette taille | T-028 | mineur |
