# Défauts connus de la v0.1

À quoi sert cette page : donner à un contributeur la liste des défauts connus de la v0.1, K1 à K24, rangés par thème, avec l'endroit où ils se voient, leur gravité et, quand elle est évidente, une piste de correction. Aucun n'est bloquant. Source : `orchestration/DEFAUTS-CONNUS.md` (tenu par l'orchestrateur) et le rapport [validation/T-012-v0.1.md](validation/T-012-v0.1.md) (constats V-1 à V-10). État : commit `13e8b7e`. Depuis le commit `88ae23c` (celui du rapport T-012), huit défauts sont corrigés (K1, K2, K3, K16, K17, K19, K20, K21) et K22 l'est en partie ; K23 et K24 sont nés de T-015. Les défauts corrigés sont regroupés en fin de page.

Gravités : « majeur » gêne le joueur sans bloquer le niveau ; « mineur » est un détail visible ou une lacune de preuve ; « à juger » attend un test de jeu ; « information » ne demande pas de correction. Les pistes sont des suggestions du rédacteur ou du validateur, pas des décisions.

## Interface

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K9 | Boutons tactiles jamais essayés sur un vrai écran tactile | téléphone ou tablette | à vérifier | essai manuel sur appareil |
| K10 | Ancres de l'interface avec une image de retard : `ui.update()` est appelé avant `level.update` | `src/main.ts` ; étiquettes qui suivent la cabine | mineur | appeler `ui.update()` après `level.update(dt)` |
| K18 | Géométrie de l'interface recalculée seulement sur `resize` de la fenêtre, alors que le rendu suit le canvas par `ResizeObserver` | `src/main.ts` ; étiquettes décalées si le canvas change de taille seul | mineur | brancher la géométrie sur le même `ResizeObserver` |
| K23 | Aide ouverte pendant un trajet : les mesures (Temps, Erreur, Légende) transparaissent faiblement sous le papier translucide de l'aide ; le `z-index: 2` de `.ui-help` (T-015) met l'aide au-dessus des mesures sans les masquer | `src/ui/ui.css` ; aide ouverte pendant un trajet | mineur | papier de l'aide opaque, ou mesures masquées tant que l'aide est ouverte |
| K24 | Cliquer « Reprendre » alors que l'aide est ouverte relance le jeu derrière l'aide ; l'aide ne reprend pas à la fermeture | `src/ui/overlay.ts` ; pause par l'aide, puis bouton « Reprendre » | mineur | garder le jeu en pause tant que l'aide est ouverte |

## Rendu

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K4 | Embarquement et sortie du bonhomme non animés | lancement et victoire ; voir [jeu.md](jeu.md) | mineur | animer dans le rendu, la logique le place déjà au centre de la cabine |
| K5 | Portrait sur téléphone : scène minuscule (17 m de décor dans la largeur) | téléphone en portrait (une invite de rotation s'affiche) | mineur | cadrage propre au portrait, à concevoir |

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

## Publication

| # | Défaut | Où ça se voit | Gravité | Piste de correction |
|---|---|---|---|---|
| K14 | GitHub Pages impossible tant que le dépôt est privé (compte gratuit) | aucun site publié ; lien de la page de repli inaccessible au public | décision utilisateur | les 3 étapes de [developpement.md](developpement.md#déploiement-sur-github-pages) |
| K22 | `prefers-reduced-motion` lu une seule fois au démarrage (la version de `package.json` est corrigée, voir plus bas) | `src/render/session.ts`, `bootstrap.ts` | mineur | écouter l'événement `change` de la requête média |

## Corrigés depuis la validation

Chaque ligne donne la tâche qui a corrigé le défaut et le comportement actuel (valeurs relevées dans le code au commit `13e8b7e`).

| # | Défaut d'origine | Tâche | Correction |
|---|---|---|---|
| K1 | Signe moins affiché avec un trait d'union ASCII | P-005 | `formatNumber` remplace le « - » d'ICU par U+2212 (`MINUS`, `src/i18n/format.ts`) ; « −0,03 m », « Force : −102 N ». Testé par `tests/i18n/format.test.ts` |
| K2 | Portrait 390 px : étiquette de Kp masquée par l'invite de rotation | P-005 | barre du haut de 76 px en portrait (`TOP_BAR_PORTRAIT`), `ROTATE_BAR` = 48, `.ui-rotate { top: 80px }` ([interface.md](interface.md#petit-écran-en-portrait)) |
| K3 | Aucune touche ne referme le panneau de réglage sans lancer | P-005 | Échap en réglage : intention `closeTuning` ; hors réglage, Échap met en pause ([interface.md](interface.md#touches-qui-dépendent-de-la-phase)) |
| K16 | Perte de contexte GPU non gérée | T-014 | `renderer.onDeviceLost` : session arrêtée, interface retirée, page de repli `fallback.lost.*` ([rendu.md](rendu.md#échecs-en-cours-de-route-t-014)). Le chemin WebGPU `device.lost` est lu dans three mais non exercé (K8) |
| K17 | Exception après le démarrage du renderer non rattrapée | T-014 | même chemin, page `fallback.error.*` ; e2e avec `crashNextFrame()` |
| K19 | L'aide ne met pas en pause pendant un trajet | T-015 | pause à l'ouverture pendant un trajet, reprise à la fermeture seulement si l'aide avait mis en pause (`src/ui/help.ts`) ; limite restante : K24 |
| K20 | Saturation sans e2e ni capture | T-016 | `tests/e2e/saturation.spec.ts` et `docs/img/t016-saturation.png` |
| K21 | `aria-pressed` sur Pause ; aide sans `aria-modal` ni piège de focus ; focus non porté sur « Rejouer » | T-015 | `aria-pressed` retiré, `aria-modal="true"`, piège de focus, focus rendu à l'ouvreur, focus sur le bouton de l'issue ([interface.md](interface.md, section « Aide des commandes »)) |
| K22 (version) | `package.json` en version `0.0.0` | P-005 | version `0.1.0` ; la partie `prefers-reduced-motion` reste ouverte, plus haut |

Le constat V-10 de T-012 signalait aussi que le README annonçait encore l'intégration continue comme à venir alors que `ci.yml` existait : corrigé par T-013.
