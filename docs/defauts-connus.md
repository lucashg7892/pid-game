# Défauts connus de la v0.1

À quoi sert cette page : donner à un contributeur la liste des défauts connus de la v0.1, K1 à K22, rangés par thème, avec l'endroit où ils se voient, leur gravité et, quand elle est évidente, une piste de correction. Aucun n'est bloquant. Source : `orchestration/DEFAUTS-CONNUS.md` (tenu par l'orchestrateur) et le rapport [validation/T-012-v0.1.md](validation/T-012-v0.1.md) (constats V-1 à V-10). État : commit `88ae23c`.

Gravités : « majeur » gêne le joueur sans bloquer le niveau ; « mineur » est un détail visible ou une lacune de preuve ; « à juger » attend un test de jeu ; « information » ne demande pas de correction. Les pistes sont des suggestions du rédacteur ou du validateur, pas des décisions.

## Interface

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K1 | Signe moins affiché avec un trait d'union ASCII (« -0,03 m », « Force : -102 N ») | cote d'erreur et lecture de la force ; capture `img/t010-03-trajet.png` | mineur | remplacer « - » par « − » (U+2212) en sortie de `tr.formatNumber` (`src/i18n`) |
| K2 | En portrait 390 px, l'étiquette permanente de Kp est en partie masquée par l'invite de rotation | téléphone tenu en portrait | mineur | décaler l'étiquette ou l'invite en portrait |
| K3 | Aucune touche ne referme le panneau de réglage sans lancer | phase de réglage, au clavier | mineur | exposer `interact()` en réglage (le niveau sait déjà refermer, T-012 §G) |
| K9 | Boutons tactiles jamais essayés sur un vrai écran tactile | téléphone ou tablette | à vérifier | essai manuel sur appareil |
| K10 | Ancres de l'interface avec une image de retard : `ui.update()` est appelé avant `level.update` | `src/main.ts` ; étiquettes qui suivent la cabine | mineur | appeler `ui.update()` après `level.update(dt)` |
| K18 | Géométrie de l'interface recalculée seulement sur `resize` de la fenêtre, alors que le rendu suit le canvas par `ResizeObserver` | `src/main.ts` ; étiquettes décalées si le canvas change de taille seul | mineur | brancher la géométrie sur le même `ResizeObserver` |
| K19 | Ouvrir l'aide « ? » pendant un trajet ne met pas en pause : le trajet et l'issue continuent derrière | `src/ui/overlay.ts` ; aide ouverte pendant un trajet | mineur, à juger | mettre en pause à l'ouverture de l'aide, ou le justifier au test de jeu |
| K21 | Bouton Pause : libellé et `aria-pressed` changent ensemble ; aide en `role="dialog"` sans `aria-modal` ni piège de focus ; à l'issue, le focus n'est pas porté sur « Rejouer » | `src/ui/overlay.ts` ; lecteur d'écran | mineur | nom fixe avec `aria-pressed` ; décider si l'aide est modale ; focus sur « Rejouer » à l'issue |

## Rendu

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K4 | Embarquement et sortie du bonhomme non animés | lancement et victoire ; voir [jeu.md](jeu.md) | mineur | animer dans le rendu, la logique le place déjà au centre de la cabine |
| K5 | Portrait sur téléphone : scène minuscule (17 m de décor dans la largeur) | téléphone en portrait (une invite de rotation s'affiche) | mineur | cadrage propre au portrait, à concevoir |
| K16 | Perte de contexte GPU non gérée : aucun écouteur `webglcontextlost` ni `device.lost` | `src/render/bootstrap.ts`, `session.ts` ; écran figé ou vide, sans message | **majeur**, non bloquant | écouter la perte, afficher un message traduit et relancer (recommandation 1 de T-012) |
| K17 | Une exception levée après le démarrage du renderer n'est pas rattrapée : pas de page de repli | `src/main.ts`, `session.ts` ; rejet non géré de `main()` | mineur | envelopper `main()` d'un repli vers la page sans GPU |

## Jeu

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K6 | L'échec « marche trop haute » n'est déclaré qu'au bout de 15 s (1800 pas) | Kp trop faible | à juger | raccourcir le délai si le test de jeu le demande |
| K7 | Borne haute de la fenêtre de réussite : 5,8 mm de marge à Kp = 3800 | [physique/ascenseur.md](physique/ascenseur.md) | à surveiller | ajuster la fenêtre après test de jeu (décision D9) |
| K15 | Références de jeu à 6 décimales : 4,4e-7 m de marge sous la tolérance de 1e-6 m | tests de référence de `src/sim` | mineur | stocker les références avec plus de décimales |

## Outillage et tests

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K8 | WebGPU réel jamais exercé par un test automatique (headless sans adaptateur : repli WebGL2) | tests e2e | limite d'outillage | essai manuel sur un vrai GPU, backend relevé |
| K11 | 10 vulnérabilités npm modérées dans la chaîne de lint (dépendances de développement seulement) | `npm audit` | à revoir | traiter à la montée de version des outils |
| K12 | Couverture Vitest de `src/ui` : 36,6 % ; les fichiers DOM ne sont couverts que par l'e2e | mesure du rédacteur D-010 ; `npm run test:cov` ne mesure que `src/sim` | information | préciser la commande qui produit ce chiffre |
| K13 | Contrastes et `prefers-reduced-motion` non testés en e2e | `tests/e2e/` | à vérifier | e2e avec mouvement réduit émulé et mesure de contraste |
| K20 | Saturation (jauge rouge, annonce) couverte par des tests unitaires seulement, sans e2e ni capture | objectif O2 de la spec | mineur | e2e de saturation et capture de référence (recommandation 2 de T-012) |

## Publication

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K14 | GitHub Pages impossible tant que le dépôt est privé (compte gratuit) | aucun site publié ; lien de la page de repli inaccessible au public | décision utilisateur | les 3 étapes de [developpement.md](developpement.md#déploiement-sur-github-pages) |
| K22 | `package.json` en version `0.0.0` pour une v0.1 ; `prefers-reduced-motion` lu une seule fois au démarrage | `package.json` ; `src/render/session.ts`, `bootstrap.ts` | mineur | passer à `0.1.0` ; écouter l'événement `change` de la requête média |

Le constat V-10 de T-012 signalait aussi que le README annonçait encore l'intégration continue comme à venir alors que `ci.yml` existait : corrigé par T-013.
