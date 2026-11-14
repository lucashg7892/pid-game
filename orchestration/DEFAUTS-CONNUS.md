# Défauts connus et idées reportées

Liste tenue par l'orchestrateur. Rien ici n'est bloquant pour la v0.1.

| # | Défaut | Origine | Gravité |
|---|--------|---------|---------|
| K1 | Signe moins affiché avec un trait d'union ASCII (« -0,03 m », « Force : -102 N ») | T-010 | mineur → corrigé (P-005) |
| K2 | Portrait 390 px : étiquette permanente de Kp en partie masquée par l'invite de rotation | T-010 | mineur → corrigé (P-005) |
| K3 | Aucune touche pour refermer le panneau de réglage sans lancer | T-010 | mineur → corrigé (P-005) |
| K4 | Embarquement et sortie du bonhomme non animés | T-009 | mineur |
| K5 | Portrait sur téléphone : scène minuscule (17 m de décor dans la largeur) | T-009 | mineur |
| K6 | Échec « marche trop haute » déclaré seulement au bout de 15 s | T-007 | corrigé (D24, T-020) : 6 s |
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
| K26 | En pause en portrait étroit (≤ 700 px), le titre et l'étiquette Kp de la barre du haut sont masqués par CSS pour que les quatre boutons (?, langue, Menu, Reprendre) tiennent ; choix « le plus simple » de T-017e, à valider côté design | T-017e | mineur |
| K27 | Écran titre : la mention de copyright est posée directement sur le papier millimétré (sans carte) ; une ligne de grille traverse le texte | T-017d | mineur |
| K28 | Oracle MATLAB du contrôleur PI et test d'oracle exact TypeScript (`tests/sim/pi-exact.test.ts`, spec T-018 §8) reportés : le PI n'est validé que par tests unitaires et de déterminisme | T-021a | à faire (N3) |
| K29 | Marge très faible aux bornes de choc de Ki à Kp = 2500 : Ki = 840 passe à 0,384 mm sous la poutre et Ki = 850 la heurte (pas de curseur de 100 : seuls 800 et 900 comptent) | T-021a | à surveiller (voir K7) |
| K30 | Niveau 2 : la jauge du terme intégral (valeur de I, repère m·g, graduation « demande ») est reportée ; le snapshot expose déjà `iTerm` | T-021b | à faire (spec T-018 §6) |
| K31 | Niveau 2 : annotations détaillées du windup, loupe de la bande de tolérance et courbe I(t) reportées | T-021b | à faire (spec T-018 §6, Q6) |
| K32 | Niveau 2 : avec `LEVEL2_ARRIVAL_TOLERANCE = STEP_TOLERANCE` = 0,5 m (décision de l'utilisateur) et Kp = 2500, Ki = 0 gagne (erreur statique 0,196 m) : mesuré par T-021a et T-021b, Ki gagnant de 0 à 800, choc de 900 à 8000 ; les issues « trop court » et « trop lent » ne sont atteignables pour aucun Ki ; `KI_DEFAULT` = 500 gagne sans réglage. Le niveau ne fait donc pas ressentir l'utilité de Ki. Correctif d'une ligne : `LEVEL2_ARRIVAL_TOLERANCE` à 0,10 m (mesuré : Ki gagnants 300 à 800, fins de temps 0 à 200) ; le défaut de Ki devrait alors sortir de la fenêtre | T-021a, T-021b | à décider (valeur de jeu) |
| K33 | Portrait 390 px, niveau 2 : le panneau de réglage défile en interne (231 px visibles pour 341 px de contenu) et « Lancer » n'est pas visible sans défiler (la touche Entrée et le bouton « Action » restent) | T-021b | mineur (voir K5, K25) |
