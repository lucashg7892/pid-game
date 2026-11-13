# Défauts connus et idées reportées

Liste tenue par l'orchestrateur. Rien ici n'est bloquant pour la v0.1.

| # | Défaut | Origine | Gravité |
|---|--------|---------|---------|
| K1 | Signe moins affiché avec un trait d'union ASCII (« -0,03 m », « Force : -102 N ») | T-010 | mineur |
| K2 | Portrait 390 px : étiquette permanente de Kp en partie masquée par l'invite de rotation | T-010 | mineur |
| K3 | Aucune touche pour refermer le panneau de réglage sans lancer | T-010 | mineur |
| K4 | Embarquement et sortie du bonhomme non animés | T-009 | mineur |
| K5 | Portrait sur téléphone : scène minuscule (17 m de décor dans la largeur) | T-009 | mineur |
| K6 | Échec « marche trop haute » déclaré seulement au bout de 15 s | T-007 | à juger au test de jeu |
| K7 | Borne haute de la fenêtre : 5,8 mm de marge à Kp = 3800 | T-005 (D-11) | à surveiller |
| K8 | WebGPU réel jamais exercé par un test automatique | T-008 | limite d'outillage |
| K9 | Boutons tactiles non essayés sur un vrai écran tactile | T-010 | à vérifier |
| K10 | Ancres de l'interface avec une image de retard (`ui.update()` avant `level.update`) | D-010 | mineur |
| K11 | 10 vulnérabilités npm modérées dans la chaîne de lint (dev seulement) | T-002 | à revoir à la montée de version |
| K12 | Couverture Vitest de src/ui : 36,6 % (fichiers DOM couverts par l'e2e seulement) | D-010 | information |
| K13 | Contrastes et `prefers-reduced-motion` non testés en e2e | D-010 | à vérifier |
| K14 | GitHub Pages impossible tant que le dépôt est privé (compte gratuit) | D17 | décision utilisateur |
| K15 | Références de jeu à 6 décimales : 4,4e-7 m de marge sous la tolérance de 1e-6 | T-005 (D-10) | mineur |
