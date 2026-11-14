# Rendu au crayon (`src/render`)

À quoi sert cette page : expliquer comment le jeu dessine la scène : démarrage du moteur graphique, cadrage, papier millimétré, traits de crayon, bonhomme, courbe et jauge, budget de dessin. Elle décrit le commit `a308ada` (rendu validé en T-008 et T-009 ; échecs en cours de route ajoutés par T-014 ; cadrage fixé et ancres de la jauge par T-019 et T-020 ; session de rendu réutilisable entre les écrans par T-017 ; trajet de 10 s et courbe sur 1201 points par T-022 ; jauge du terme intégral au niveau 2 par T-024). Les textes posés par-dessus la scène sont dans [interface.md](interface.md).

![Le niveau 1 en cours de trajet, 1280 × 720 (capture e2e de T-010)](img/t010-03-trajet.png)

## Vue d'ensemble

`src/render` est le seul module qui importe three.js (`three/webgpu` et `three/tsl`, règle `three-only-in-render`). Il lit l'instantané du niveau (`level.snapshot`) et l'enregistreur de signaux (`level.signals`) à chaque image ; il ne les modifie jamais et n'en garde aucune référence.

Le point de composition (`src/main.ts`) démarre le rendu une seule fois : `startRendering(canvas, choice, { onFrame, onFailure })`, sans niveau (papier seul). Elle renvoie une session (`RenderSession`) ou un échec, sans jamais lever d'exception. Les échecs survenus après le démarrage passent par `onFailure` (voir « Échecs en cours de route »). L'option `level` existe encore (niveau dessiné dès le départ), mais `main.ts` ne l'utilise plus depuis T-017.

### Cycle de vie de la session (T-017)

La session vit pour toute l'application. Sur l'écran titre et sur le menu, elle ne dessine que le papier ; à l'entrée dans un niveau, `main.ts` appelle `session.attachLevel(level)`, qui crée la vue du niveau (`createLevelView`) et la dessine à chaque image ; au retour au menu, `session.detachLevel()` libère la vue (`view.dispose()`) et la session revient au papier seul. Un niveau déjà attaché est détaché d'abord ; les deux appels sont sans effet après `stop()`. Raison du choix (une session unique plutôt qu'un arrêt et un redémarrage du rendu à chaque écran) : [ADR-015](decisions/ADR-015-etat-application-machine-ecrans.md). `session.stop()` détache aussi le niveau avant de libérer la scène et le renderer.

Le test e2e du cycle de vie (`ui.spec.ts`, (q)) enchaîne attach, detach, attach sans erreur ni fuite d'écouteur ; les `drawCalls` en papier seul n'ont pas été relevés par le rédacteur.

### Fichiers purs et fichiers three

Sur les 19 fichiers du module (inchangés en nombre depuis `13e8b7e`), 13 n'importent pas three (dont `index.ts`) et `camera.ts` n'en importe qu'un type : ils se testent sous Node, sans navigateur (`tests/render/`, 122 tests).

| Fichier | three ? | Rôle |
|---|---|---|
| `options.ts` | non | `parseRendererChoice` (`?renderer=`), `capPixelRatio` (plafond 2) |
| `camera.ts` | type seulement | cadrage `computeFrame`, conversions monde → pixel ; `applyFrame` touche la caméra |
| `pencil-style.ts` | non | charte crayon : couleurs, épaisseurs, tremblé, mise en page du décor, proportions du bonhomme |
| `noise.ts` | non | hachage et bruit à graine (`hash01`, `valueNoise`, `boilSeed`) |
| `stroke-batch.ts` | non | `StrokeBatch` : polylignes → rubans de triangles dans des tableaux préalloués |
| `patterns.ts` | non | hachures (`hatchPolygon`) et pointillés (`dashLine`) |
| `walker-pose.ts` | non | articulations du bonhomme pour chaque attitude |
| `curve.ts` | non | échelle de temps de la courbe y(t), tampon de points |
| `gauge.ts` | non | graduations et remplissage de la jauge de force |
| `level-display.ts` | non | phase effective, interpolation, attitude, ancres écran pour l'interface |
| `level-painter.ts` | non | `LevelPainter` : remplit les 5 lots de traits à chaque image |
| `failure.ts` | non | `createFailureGuard` : un seul signalement d'échec, plus aucun appel gardé ensuite |
| `session.ts` | non (passe par les fichiers three) | `startRendering` : assemble tout, boucle d'images, branche `renderer.onDeviceLost` et le garde-fou ; `attachLevel` et `detachLevel` (T-017) |
| `bootstrap.ts` | oui | `bootRenderer`, boucle `setAnimationLoop`, suivi de taille, mouvement réduit |
| `stage.ts` | oui | scène, caméra orthographique, papier |
| `paper.ts` | oui | matériau TSL du papier millimétré |
| `pencil-material.ts` | oui | matériau TSL du trait de crayon |
| `level-view.ts` | oui | un mesh par lot, attributs qui enveloppent les tableaux du lot |

## Démarrage et choix du moteur

`bootRenderer` (fichier `bootstrap.ts`) crée un `WebGPURenderer` de three 0.187.0, sans anticrénelage matériel (`antialias: false`), puis attend `renderer.init()`.

| URL | Comportement |
|---|---|
| sans paramètre, ou `?renderer=auto` | WebGPU si le navigateur le fournit ; sinon three bascule seul sur WebGL2 |
| `?renderer=webgl` | WebGL2 imposé (`forceWebGL: true`) |
| `?renderer=none` | absence de GPU simulée : page de repli (tests) |

La valeur est lue sans tenir compte de la casse ni des espaces ; une valeur inconnue (`webgpu`, `webgl2`…) donne `auto`. Le backend obtenu est écrit dans `document.body.dataset.backend` (`webgpu`, `webgl` ou `none`).

Échecs possibles, tous rendus comme une valeur (`BootFailureReason`) : `disabled` (`?renderer=none`), `unsupported` (ni WebGPU ni WebGL2 annoncés), `init-failed` (`init()` a échoué). Dans les trois cas, `main.ts` cache le canvas et affiche la page de repli traduite (clés `fallback.`), avec un lien vers le dépôt GitHub.

![Page de repli en français (capture e2e de T-008)](img/t008-fallback-fr.png)

### Échecs en cours de route (T-014)

Deux échecs peuvent survenir après le démarrage (`RenderFailureKind`, fichier `failure.ts`) :

- `context-lost` : perte du contexte WebGL (`webglcontextlost`) ou du périphérique WebGPU (`device.lost`). `session.ts` affecte `renderer.onDeviceLost`, que three appelle pour les deux backends ; la valeur transmise est `info.api` suivi de `info.message`.
- `error` : exception levée dans le rappel `onFrame` ou dans le dessin (le rappel de la boucle et `renderNow` passent par `FailureGuard.guard`), ou, dans `main.ts`, pendant la création de l'interface après le démarrage.

`createFailureGuard(onFailure)` ne signale que le premier échec ; ensuite `guard` n'appelle plus rien. Au premier échec, `session.ts` arrête la session (boucle, observation de taille, vue, scène, renderer libéré ; `stop()` reste sans danger s'il est rappelé) puis appelle `onFailure({ kind, detail })`. `detail` est un message technique, écrit dans la console (`Huygens’s world : <kind> : <detail>`), jamais montré au joueur.

Côté `main.ts` (`handleFailure`, une seule fois) : l'écran courant est démonté (`unmountCurrent` : interface du niveau détruite par `ui.destroy()`, `#ui` retiré, écouteurs `resize` et clavier retirés, ou écran titre ou menu retiré), puis `showFallback` remplace le jeu par `showFailurePage` : un `<main id="fallback">` avec l'attribut `data-kind` (`context-lost` ou `error`), un titre, une explication invitant à recharger la page (la progression du niveau est perdue) et le lien vers la documentation. Clés `fallback.lost.title`, `fallback.lost.explanation`, `fallback.error.title`, `fallback.error.explanation` (FR et EN). Le canvas est caché et `body.dataset.backend` vaut `none`.

Vérifié par `tests/render/failure.test.ts` et `tests/e2e/failure.spec.ts` (perte du contexte par `WEBGL_lose_context`, et exception provoquée par le crochet `window.__huygens.crashNextFrame()` du mode `?e2e=1`), en FR et en EN. Le chemin WebGPU `device.lost` est lu dans three mais n'est exercé par aucun test (voir K8 dans [defauts-connus.md](defauts-connus.md)).

**Ce qui a été exercé.** Les tests e2e tournent dans Chrome headless avec le rendu logiciel SwiftShader : WebGL2 imposé, repli FR et EN, et mode automatique. En mode automatique, aucun adaptateur WebGPU n'est trouvé (« No available adapters. ») et three passe sur WebGL2 (log T-008). **WebGPU réel n'a été exercé par aucun test automatique.** Le 2026-11-13, l'utilisateur a constaté sur son PC Windows que « tout fonctionne » (décision D16, log T-010), sans relever quel backend était actif.

## Boucle d'images

`createFrameLoop` s'appuie sur `renderer.setAnimationLoop`. À chaque image, il calcule le temps écoulé depuis l'image précédente (0 à la première) et appelle le rappel `onFrame` de `main.ts`. Celui-ci met à jour l'interface, puis fait avancer le niveau (`level.update`). La session repeint ensuite le niveau et dessine. Ordre complet : [architecture.md](architecture.md#flux-dune-image).

Le temps n'est pas plafonné ici : l'horloge à pas fixe du noyau s'en charge (0,25 s et 8 pas au plus par image, voir [simulation.md](simulation.md#horloge-à-pas-fixe)).

La taille du canvas est suivie par un `ResizeObserver` et par l'événement `resize` (le zoom du navigateur change le rapport de pixels). Le rapport de pixels est plafonné à 2 (`MAX_PIXEL_RATIO`).

## Cadrage : zone de 17 × 7 m

La caméra est orthographique, vue de face, 1 unité = 1 m. La zone de jeu `PLAY_ZONE` est toujours entièrement visible :

```text
x ∈ [−6,5 ; 10,5] m   (décor de −6 à 10 m, plus 0,5 m de marge de chaque côté)
y ∈ [−1,5 ; 5,5] m    (1,5 m sous le sol ; haut fixé à 5,5 m, soit environ 2,1 m au-dessus de la poutre à 3,3626 m)
```

Depuis T-020, le haut de la zone est une constante, `PLAY_ZONE_TOP` = 5,5 m : il ne suit plus la poutre. Avant T-020, il valait `BEAM_HEIGHT + PLAY_ZONE_ABOVE_BEAM` (3,3 + 2,2 = 5,5 m) ; la constante `PLAY_ZONE_ABOVE_BEAM` n'existe plus. Ainsi, régler la hauteur de la poutre ne déplace pas le cadrage : la zone reste 17 × 7 m et `computeFrame` est inchangé (75,3 px/m à 1280 × 720).

`computeFrame(largeurPx, hauteurPx)` est une fonction pure. Elle garde la même échelle en x et en y (pas de déformation) :

```text
pixelsParMètre = min(largeurPx / 17, hauteurPx / 7)
```

Le surplus d'écran, réparti également des deux côtés, montre plus de papier. Exemples : 75,3 px/m à 1280 × 720 ; à 390 × 844 (portrait), la largeur limite et la scène devient très petite (22,9 px/m). Une taille nulle ou invalide renvoie exactement la zone, sans NaN.

**Écart à la spec.** La spec T-001 §7 prévoyait « ~12 m × 6,75 m » et une vue « légèrement plongeante (2,5D) ». 12 m ne contiennent pas les 16 m du décor : la zone est élargie à 17 m. La vue est de face, sans plongée (log T-008). Voir les [errata](specs/T-001-errata.md).

## Papier millimétré

Un seul plan couvre tout le champ de la caméra (avec 2 % de débord). Sa couleur est calculée par un matériau à nœuds TSL (`paper.ts`), compilé en WGSL pour WebGPU et en GLSL pour WebGL2 : un seul code pour les deux backends.

La grille est en coordonnées **monde** : une ligne de mètre passe par chaque entier (x = 0, x = 4, y = 3…). On lit donc les hauteurs directement sur la feuille.

| Famille | Pas | Épaisseur | Couleur | Opacité |
|---|---|---|---|---|
| « millimètre » | 0,1 m | 0,006 m | `#86b9b2` | 0,6 |
| demi-centimètre | 0,5 m | 0,012 m | `#5f9f99` | 0,6 |
| « centimètre » | 1 m | 0,022 m | `#3d8580` | 0,8 |

Papier `#f7f0de`, grain discret (± 1,5 %) par cellules de 1 cm, sans texture ni image.

![Papier seul, 1280 × 720 (capture de référence de T-008, régénérée par T-025 : K35 corrigé)](img/t008-paper-1280x720.png)

**Anticrénelage.** La distance au trait le plus proche est convertie en pixels par `fwidth` (dérivée écran). Un trait plus fin qu'un pixel est dessiné sur un pixel avec une intensité réduite d'autant. Anti-moiré : une famille s'estompe quand son pas à l'écran tombe sous 6 px et disparaît sous 2,5 px.

**Régime « un seul pixel ».** Sur petit écran, les traits de mètre font moins d'un pixel (0,50 px en portrait 390 px). Selon sa position sous-pixel, un trait tombait alors tantôt sur un pixel plein (bleu-vert), tantôt sur deux pixels à moitié (teinte brunâtre) : la grille paraissait irrégulière. Sous ce seuil, chaque trait est posé sur un seul pixel entier, sa position étant quantifiée au 1/16 de pixel pour que le choix soit stable.

Ce régime s'applique **seulement** quand le trait de mètre fait moins d'un pixel (fondu de 0,7 à 1,0 px). Au-dessus, le calcul est exactement celui de T-008.

**Incident T-009b/c (log T-009).** Une première version activait ce régime jusqu'à 1,66 px, donc aussi au format bureau 1280 × 720. Les lignes de mètre y devenaient pâles et inégales, avec une demi-ligne forte au centre de l'écran : une ligne posée pile sur une frontière de pixels (640,0 ; 360,0) était tranchée de façon non déterministe. Les tests de pixels de l'époque vérifiaient la position des traits, pas leur aspect : l'orchestrateur a vu la régression sur les captures (leçon L9 du registre). Correctif T-009c : seuil ramené sous 1 px et quantification. Trois tests e2e d'uniformité des lignes ont été ajoutés (1280 × 720, 1281 × 721, 390 × 844), dont une comparaison à la capture de référence de T-008.

## Trait de crayon

Tout le niveau (décor, cabine, bonhomme, courbe, jauge) est fait de traits. Chaque trait est une polyligne transformée en **ruban** de triangles par le CPU (`StrokeBatch`, fichier `stroke-batch.ts`) :

- 6 sommets par segment (deux triangles), jointures en onglet limitées à 3 demi-largeurs, segments nuls ignorés, demi-tours sans NaN ;
- tableaux **préalloués** à la création, réécrits en place à chaque image ; `level-view.ts` les enveloppe dans des `BufferAttribute` sans copie ;
- tremblé de position et d'épaisseur à **graine** (`noise.ts`, arithmétique entière 32 bits : même graine, même dessin sur toute machine), extrémités effilées ;
- épaisseur minimale de 1,25 px à l'écran et frange d'anticrénelage d'1 px.

**Charte** (`pencil-style.ts`) : toutes les constantes de style sont regroupées dans ce fichier. Graphite `#3a3a3a` à 85 % d'opacité ; crayon rouge `#c23a2b`, seule couleur, réservé à la jauge saturée. Chaque élément a son style (épaisseur, encre, tremblé) : sol 0,04 m, contour 0,03 m, bonhomme 0,042 m, plancher de la cabine 0,045 m (le trait le plus appuyé : il porte la mesure y), courbe 0,03 m **sans tremblé** (elle reste fidèle aux mesures). Les positions qui comptent pour les règles (quais, cage, poutre, console) viennent de `src/game` ; la charte ne fixe que des choix de dessin.

**Matériau** (`pencil-material.ts`, TSL) : opacité = opacité du crayon × encre du sommet × couverture du bord × grain du graphite.

- **Pas de MSAA.** Le bord est adouci au shader : la coordonnée transversale vaut −1 et +1 sur les bords du ruban, `fwidth` donne une rampe d'un pixel. Coût mémoire nul et même rendu sur les deux backends.
- **Correction d'opacité.** WebGPURenderer mélange les couleurs en espace linéaire ; un gris à 85 % y paraît bien plus pâle qu'au crayon. L'opacité voulue (mélange sRGB, comme sur une feuille) est convertie : `a' = (P^γ − (P + (C − P)·a)^γ) / (P^γ − C^γ)`, avec P et C les teintes moyennes du papier et de la mine et γ = 2,2.

**« Boiling ».** La graine du tremblé change 8 fois par seconde (64 graines en boucle) : le dessin frémit comme une animation image par image. Avec `prefers-reduced-motion: reduce`, la graine reste à 0 : le dessin est immobile.

## Lots et budget de dessin

Le peintre (`level-painter.ts`) répartit les traits en 5 lots, un par matériau et par fréquence de mise à jour. Chaque lot non vide coûte un appel de dessin.

| Lot | Contenu | Mis à jour | Capacité (sommets) |
|---|---|---|---|
| `decor` | quais, cage, poutre, poulies, moteur, cadre de la jauge de force (et, au niveau 2, de la jauge I), pupitre, axe des temps | quand la graine du boiling ou la taille d'un pixel change | 12 000 |
| `error` | hachures de l'erreur e entre la courbe et la consigne | à chaque image (trajet) | 8 000 |
| `curve` | courbe y(t), graduations de seconde | à chaque image (trajet) | 12 000 |
| `actors` | cabine, câbles, levier, consigne pointillée, bonhomme, cote, jauge (et, au niveau 2, remplissage de la jauge I) | à chaque image | 4 000 |
| `red` | jauge saturée, au crayon rouge | à chaque image | 1 200 |

Total préalloué : 37 200 sommets, soit 12 400 triangles au plus, sous le budget de 30 000 triangles de la spec §7 même lots pleins.

**Appels de dessin.**

| Situation | Appels | Détail |
|---|---|---|
| état initial | **4** (testé, e2e) | papier 1 + `decor` 1 + `actors` 1 + passe de sortie 1 ; `error`, `curve` et `red` vides, donc masqués |
| maximum | **7** | papier 1 + 5 lots + passe de sortie 1 |

La passe de sortie est ajoutée par WebGPURenderer : un triangle plein écran convertit la cible de travail linéaire vers l'espace sRGB du canvas (`stage.ts`, log T-008).

**Pourquoi `forceSinglePass`.** Les matériaux du crayon sont transparents et `DoubleSide` (rubans d'orientation quelconque). Sans `forceSinglePass = true`, three dessine un tel objet deux fois (faces arrière puis faces avant) : T-009 mesurait 6 appels à l'état initial au lieu de 4 (log T-009, `Renderer.js` l. 3986 de three).

**Triangles**, comptés sous Node par le rédacteur avec `LevelPainter` au commit `119519b` (1280 × 720, images de 1/60 s, script jetable hors dépôt ; 2 640 et 3 506 au total avant T-020, la poutre ayant changé de hauteur) ; s'y ajoutent 2 triangles de papier et 1 de la passe de sortie :

| Situation | `decor` | `error` | `curve` | `actors` | `red` | Total des lots |
|---|---|---|---|---|---|---|
| état initial | 2 266 | 0 | 0 | 372 | 0 | 2 638 |
| victoire à Kp = 2500 N/m | 2 266 | 222 | 588 | 428 | 0 | 3 504 |

Les tests e2e vérifient seulement « plus de 1 000 triangles et au plus 30 000 » à l'état initial, et « au plus 50 appels, au plus 30 000 triangles » pendant un trajet. Le compte exact relevé par le GPU n'est pas consigné dans les logs.

**Aucune allocation par image** : établie par construction et par l'identité des tableaux après 1 000 mises à jour (`tests/render/level-painter.test.ts`), sans mesure du tas (réserve des logs T-009 et T-010).

## Décor

Vue de face : quai de départ hachuré à gauche, cage d'ascenseur avec poulies et tambour du moteur, quai d'arrivée hachuré à 3 m, jauge de force à droite de la cage, console à levier sur le quai de départ. Le levier de la console s'incline avec Kp (0,7 rad de part et d'autre de la verticale, de 0 au maximum).

La poutre est dessinée en **deux corbeaux** hachurés de 0,42 m de long, fixés aux montants de la cage, à `BEAM_HEIGHT` = 3,3626 m (3,30 m avant T-020 ; le peintre lit la constante de `src/game`). Le choc reste jugé sur toute la largeur (règle `y > 3,3626 m` de `src/game`). La spec décrivait une poutre « au-dessus de la cabine » ; choix accepté en T-009.

![Choc contre la poutre, 1280 × 720 (capture e2e de T-020 : Kp = 5100 N/m, choc au pas 61 ; interface visible)](img/t020-choc-fr.png)

![Victoire de justesse à Kp = 5000 N/m : le plancher passe 1,74 mm sous la poutre (capture e2e de T-020)](img/t020-poutre-fr.png)

![Choc à l'ancien réglage : Kp = 4500 N/m, capture de T-009 non régénérée ; le test (e) de level.spec.ts joue maintenant Kp = 7000 N/m et une poutre à 3,3626 m](img/t009-05-choc.png)

## Courbe y(t)

La courbe est tracée sur le mur de la cage. L'axe vertical est la **hauteur réelle** : la pointe de la courbe touche le plancher de la cabine. L'axe des temps part du bord gauche du plancher (x = 0,2 m) vers la droite, sur 3,6 m au plus (la largeur du plancher).

Échelle de temps à deux régimes (`curveTimeScale`, fichier `curve.ts`) :

```text
échelle (m/s) = 1,2                si t_fin ≤ 3 s
              = 3,6 / t_fin        sinon (la courbe entière est resserrée)
x(t) = 0,2 + t × échelle
```

Raison (log T-009, chiffres mis à jour par T-020 puis T-022, d'après le commentaire de `src/render/curve.ts`) : les issues qui s'apprennent sur la forme de la courbe sont courtes au niveau 1 (choc avant 0,53 s, victoire vers 2,2 à 2,5 s) et se lisent en grand. Les trajets qui vont au bout des 10 s (`TRIP_MAX_STEPS` = 1200 pas : marche trop haute, cabine au sol, niveau 2 « trop court ») n'ont qu'une montée puis un palier ou une lente approche, lisibles même resserrés : 3,6 / 10 = 0,36 m/s à 10 s, un trait de seconde tous les 0,36 m (0,6 m/s à 6 s de T-020 à T-021b ; 0,24 m/s à 15 s avant T-020). L'échelle fixe de la spec (0,4 m/s) donnerait 4 m pour 10 s, plus que le plancher (2,4 m pour 6 s, 6 m pour 15 s).

La consigne r est en pointillés (tirets de 0,12 m, vides de 0,08 m) ; l'erreur e est hachurée entre la courbe et la consigne, avec un angle différent des hachures du décor. À la victoire, une cote d'atelier mesure la marche résiduelle.

Les points viennent de `level.signals` (valeurs **avant** chaque pas) ; la pointe est interpolée jusqu'à la position affichée de la cabine. Capacité : `CURVE_CAPACITY` = `TRIP_MAX_STEPS` + 1 = 1201 points (721 de T-020 à T-021b, 1 801 avant T-020).

## Bonhomme

Le bonhomme bâton a un chapeau melon. `walker-pose.ts` calcule ses 13 articulations pour 7 attitudes, choisies par `choosePose` d'après la phase :

| Phase | Attitude |
|---|---|
| approche, à l'arrêt | `stand` (debout, jambes tendues) |
| approche, en marche | `walk` |
| réglage | `reach` (main sur le levier) |
| trajet | `stand`, au centre de la cabine |
| victoire | `cheer` (bras levés) |
| choc | `bonk` (assis, chapeau tombé) |
| marche trop haute | `akimbo` (mains sur les hanches) |
| cabine au sol | `shrug` (haussement d'épaules) |

En pause, l'attitude est celle de la phase qui reprendra.

Cinématique : jambes en cinématique inverse (hanche et pied imposés, genou calculé), buste et bras en cinématique directe. Les longueurs des membres sont donc identiques dans toutes les attitudes (testé). La marche suit la **distance parcourue** (un cycle de deux pas par 1,1 m), pas le temps : à l'arrêt, les jambes ne bougent pas, et le pied d'appui reste au sol.

L'embarquement dans la cabine et la sortie après la victoire ne sont pas animés : le bonhomme apparaît directement au centre de la cabine (réserve des logs T-009 et T-010).

## Jauge de force

À droite de la cage : échelle de 0 N (en bas) à 5000 N (en haut), graduations tous les 500 N (principales tous les 1000 N), repère du poids m·g = 490,5 N. Le remplissage hachuré montre |uSat| : la force peut être négative quand le moteur freine un dépassement, la jauge en montre l'intensité. Quand la commande est écrêtée, le remplissage passe au crayon rouge.

**Étiquettes permanentes (T-019).** Trois textes DOM, de l'interface (`src/ui`), sont posés à côté de la jauge dès l'approche : la légende « Force du moteur » au-dessus du cadre, « 5000 N max » au niveau du haut de l'échelle et « poids » au niveau du repère m·g (clés `hud.gauge.title`, `hud.gauge.max`, `hud.gauge.weight`). Dès le lancement du trajet, la légende cède la place à « Force : … N ». Ces étiquettes sont `aria-hidden` : le panneau des mesures et le nom de la jauge disent la même chose aux lecteurs d'écran. Le rendu ne calcule que les deux ancres d'écran correspondantes (voir ci-dessous) ; le détail est dans [interface.md](interface.md#étiquettes-de-la-jauge-de-force-t-019).

![Approche, 1280 × 720 : bulle d'ouverture réécrite et étiquettes de la jauge (capture de T-019, refaite au commit `a308ada` : l'étiquette de Kp affiche 2000 N/m)](img/t019-approche-fr.png)

## Jauge du terme intégral (niveau 2)

T-024 (K30) ajoute au niveau 2 une seconde jauge, à droite de la jauge de force et du petit poids de son repère. Elle est dessinée par `LevelPainter` (`level-painter.ts`), qui factorise le dessin de la première :

- **Cadre et graduations** : `gaugeFrame(minX, maxX)` dessine, dans le lot `decor`, le cadre de 0 à 5000 N, les graduations tous les 500 N, le repère m·g en pointillés et le petit poids ; la jauge de force l'appelle avec `GAUGE_MIN_X` et `GAUGE_MAX_X`, la jauge I avec `GAUGE_I_MIN_X` = 6 m et `GAUGE_I_MAX_X` = 6,42 m (`pencil-style.ts`). Même échelle et mêmes ordonnées que la jauge de force. Le cadre de la jauge I est dessiné **en dernier** du décor, pour que le décor du niveau 1 reste identique (graines des traits précédents stables) ; le décor est redessiné quand le niveau change (`decorIntegral`).
- **Remplissage** : `fillGauge(batch, minX, maxX, niveau)`, partagé avec la jauge de force, hachure à |I| (`forceToGaugeY(s.iTerm)` : la fonction prend la valeur absolue et borne à la pleine échelle) pendant le trajet et à l'issue, dans le lot `actors`, **jamais en rouge** (le terme I n'est pas saturé). Choix du réalisateur : montrer l'intensité, comme la jauge de force.
- **Étiquettes** : « Terme intégral I » puis « I : … N », « 5000 N max » et « poids » sont des textes DOM de `src/ui` ([interface.md](interface.md#jauge-du-terme-intégral-i-niveau-2-t-024)). Au niveau 2, « 5000 N max » et « poids » passent à droite de la jauge I : `GAUGE_I_LABEL_X` = `GAUGE_I_MAX_X` + 0,2 m, au lieu de `GAUGE_LABEL_X`.
- **Budget** : la jauge I ajoute des traits au lot `decor` et au lot `actors` du niveau 2 ; le niveau 1 n'en reçoit aucun (test `tests/render/integral-gauge.test.ts`, 6 tests : cadre au niveau 2 seulement, remplissage qui suit |I|, aucun trait dans la bande au niveau 1, valeur absolue). Les nombres de triangles du tableau ci-dessus (niveau 1) n'ont pas été remesurés pour le niveau 2 ; le test de budget e2e existant s'applique.

## Interpolation et ancres pour l'interface

`computeDisplay` applique le contrat de [jeu.md](jeu.md#contrats-pour-le-rendu-et-linterface) : cabine à `lerp(cabinPrevY, cabinY, alpha)` pendant le trajet, figée à l'issue ; bonhomme à `lerp(walkerPrevX, walkerX, alpha)` sur le quai.

`computeAnchors` calcule, à chaque image, la position en pixels CSS des éléments que l'interface annote : dessus du pupitre de la console, centre du plancher de la cabine, milieu de la cote d'erreur, haut de la tête du bonhomme, haut de la jauge, et, depuis T-019, le bord gauche de l'échelle de la jauge au niveau du haut (`gaugeMax`, étiquette « 5000 N max ») et du repère du poids (`gaugeWeight`, étiquette « poids »), à `GAUGE_LABEL_X` = `GAUGE_MAX_X` + 0,2 m. Depuis T-024, `iGauge` (milieu du bord haut de la jauge I, étiquette « Terme intégral I » puis « I : … N ») et `iGaugeVisible` (vrai au niveau 2) complètent les ancres ; au niveau 2, `gaugeMax` et `gaugeWeight` se placent à `GAUGE_I_LABEL_X` = `GAUGE_I_MAX_X` + 0,2 m. `main.ts` copie `iGauge` et lit `iGaugeVisible` par un accesseur, car la valeur change d'une image à l'autre. Ces ancres sont un objet réutilisé, réécrit à chaque image (`session.anchors()`). `main.ts` les transmet à `src/ui` sous forme de données, car `src/ui` n'a pas le droit d'importer `src/render`.

## Mesures

| Grandeur | Valeur | Source |
|---|---|---|
| JavaScript du build | 909,76 kB, **253,52 kB gzip** (un seul fichier) ; 907,79 kB et 252,84 kB à `08908b6` ; 907,32 kB et 252,72 kB à `119519b` ; 885,25 kB et 246,57 kB à `566a8a3` | `npm.cmd run build` au commit `a308ada` (rédacteur, code de sortie 0) |
| CSS du build | 7,51 kB, 2,45 kB gzip ; 7,30 kB et 2,42 kB à `08908b6` ; 5,86 kB et 2,09 kB à `566a8a3` | idem |
| budget JS initial | 400 ko gzip | spec T-001 §7 |
| polices | 23 944 + 20 112 octets (woff2) | `public/fonts/` |
| appels de dessin | 4 à l'état initial (e2e), 7 au plus | `render.spec.ts`, `level-view.ts` |
| triangles des lots | 2 638 à l'état initial ; 3 504 à la victoire (Kp = 2500 N/m) | script du rédacteur, commit `119519b` (niveau 1 ; le peintre n'a changé depuis qu'en commentaire jusqu'à T-022, puis T-024 a ajouté la jauge I au niveau 2 seulement, voir plus haut) |

Vite affiche l'avertissement « Some chunks are larger than 500 kB after minification » : three/webgpu fait l'essentiel du fichier. Aucun découpage n'est fait.

## Exports de `src/render/index.ts`

Liste complète au commit `119519b`, comptée par script (86 noms : 58 exports nommés plus les 28 de `paper.ts` ; `PLAY_ZONE_TOP` a remplacé `PLAY_ZONE_ABOVE_BEAM`, le total n'a pas changé). Les fichiers internes (`level-painter.ts`, `stroke-batch.ts`, `noise.ts`, `patterns.ts`, `pencil-style.ts`, `pencil-material.ts`, `level-view.ts`, `walker-pose.ts`, `gauge.ts`) ne sont pas réexportés : seuls les tests les importent directement.

| Fichier | Valeurs | Types |
|---|---|---|
| `session.ts` | `startRendering` (la session expose `attachLevel`, `detachLevel`, `anchors`, `stats`, `trace`, `renderNow`, `stop`) | `LevelSource`, `RenderSession`, `RenderStats`, `StartOptions`, `StartResult` |
| `failure.ts` | `createFailureGuard` | `FailureGuard`, `RenderFailure`, `RenderFailureKind` |
| `bootstrap.ts` | `bootRenderer`, `createFrameLoop`, `detectBackend`, `disposeRenderer`, `hasGraphicsApi`, `observeCanvasSize`, `prefersReducedMotion` | `Backend`, `BootFailureReason`, `BootResult`, `FrameLoop` |
| `options.ts` | `parseRendererChoice`, `capPixelRatio`, `MAX_PIXEL_RATIO` | `RendererChoice` |
| `camera.ts` | `computeFrame`, `applyFrame`, `worldXToPixel`, `worldYToPixel`, `PLAY_ZONE`, `PLAY_ZONE_MARGIN_X` (0,5 m), `PLAY_ZONE_BELOW_GROUND` (1,5 m), `PLAY_ZONE_TOP` (5,5 m) | `Frame`, `WorldRect` |
| `stage.ts` | `createPaperStage`, `CAMERA_Z` (10 m), `CAMERA_NEAR` (0,1 m), `CAMERA_FAR` (100 m) | `PaperStage` |
| `paper.ts` (`export *`) | `createPaper`, `createPaperMaterial`, `fitPaperToFrame`, `PAPER_COLOR`, `PAPER_Z`, `PAPER_OVERSCAN`, `GRAIN_CELL`, `GRAIN_AMPLITUDE`, `GRID_FINE_STEP`, `GRID_HALF_STEP`, `GRID_MAJOR_STEP`, `GRID_FINE_WIDTH`, `GRID_HALF_WIDTH`, `GRID_MAJOR_WIDTH`, `GRID_FINE_COLOR`, `GRID_HALF_COLOR`, `GRID_MAJOR_COLOR`, `GRID_FINE_OPACITY`, `GRID_HALF_OPACITY`, `GRID_MAJOR_OPACITY`, `GRID_FINE_MIN_ENERGY`, `GRID_HALF_MIN_ENERGY`, `GRID_MAJOR_MIN_ENERGY`, `GRID_FADE_START_PX`, `GRID_FADE_END_PX`, `GRID_SNAP_START_PX`, `GRID_SNAP_END_PX`, `GRID_SNAP_QUANTUM` | — |
| `level-display.ts` | `computeDisplay`, `createDisplay`, `choosePose`, `effectivePhase`, `computeAnchors`, `createAnchors`, `CONSOLE_ANCHOR_Y`, `WALKER_HEAD_TOP` | `LevelDisplay`, `LevelAnchors`, `ScreenPoint` |
| `curve.ts` | `curveTimeScale`, `curveX`, `CURVE_ORIGIN_X` (0,2 m), `CURVE_SPAN` (3,6 m), `CURVE_MAX_SPEED` (1,2 m/s), `CURVE_FULL_SPEED_SECONDS` (3 s), `CURVE_CAPACITY` (1201 ; 721 de T-020 à T-021b ; 1 801 avant T-020) | — |

Valeurs des constantes du papier : tableau de la section « Papier millimétré » (pas, épaisseurs, couleurs, opacités) ; `GRID_*_MIN_ENERGY` (0 ; 0,4 ; 1) est l'intensité minimale gardée par un trait plus fin qu'un pixel ; `GRAIN_CELL` = 0,01 m, `GRAIN_AMPLITUDE` = 0,03 ; `PAPER_Z` = −1 m ; `PAPER_OVERSCAN` = 0,02.

## Tests

Tests Vitest de `tests/render/` (128) et tests e2e de `tests/e2e/render.spec.ts`, `level.spec.ts`, `level2.spec.ts`, `failure.spec.ts`, `saturation.spec.ts` et `ui.spec.ts` : voir [tests.md](tests.md). Justification des choix : [ADR-010](decisions/ADR-010-rendu-crayon.md).
