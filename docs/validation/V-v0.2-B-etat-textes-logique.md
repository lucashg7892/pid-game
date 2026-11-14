# V-v0.2-B — Chasse aux bugs v0.2, partie B : état des niveaux, logique du niveau 2, entrées, textes, accessibilité, noyau

Validateur indépendant (n'a pas vu la réalisation, n'a modifié aucun fichier de `src/`, des tests, de la configuration, d'`orchestration/` ni le rapport A). Branche `migration`, commit examiné `f2680d1`, arbre propre au départ hormis le rapport A non commité. Date : 2026-11-14. Session locale Windows 11, Chromium de `playwright-core`, moteur `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, WebGL2 imposé (`?renderer=webgl`).

## Verdict : VALIDÉ AVEC RÉSERVES

Aucun défaut bloquant. La logique de jeu tient : aucune fuite d'état d'un niveau à l'autre, issues et pas d'issue du niveau 2 identiques à la référence sur toute la grille de Ki et aux points hors grille, indépendance au découpage en images et à la durée des pauses, déterminisme exact sur 20 rejeux, `iTerm` égal à l'intégrale du contrôleur à chaque pas, réglage verrouillé par tous les canaux pendant le trajet et la pause, aucune valeur NaN jusqu'à la boucle ou l'affichage, aucun texte brut ou mal formaté dans les deux langues. Réserves : 1 défaut majeur (le clavier contourne la suspension des commandes quand l'aide est ouverte) et 8 mineurs.

Les défauts A-01 à A-10 du rapport A ne sont pas répétés ici (A-06, annonces dans l'ancienne langue, revu au passage : constaté identique).

## 1. Périmètre et méthode

Code lu : `src/game/` (`elevator-level.ts`, `level.ts`, `level2.ts`, `outcome.ts`, `constants.ts`, `kp.ts`, `events.ts`), `src/ui/` (`view-model.ts`, `announce.ts`, `hints.ts`, `overlay.ts`, `input.ts`, `keys.ts`, `help.ts`, en partie `screens.ts`), `src/i18n/` (`catalogs.ts`, `translator.ts`, `interpolate.ts`, `params.ts`, `format.ts`, `locales/fr.json`, `locales/en.json`), `src/main.ts`, `src/sim/controllers/pi.ts`, `src/sim/plants/elevator.ts`, `src/sim/loop.ts`, `src/sim/clock.ts` ; `docs/jeu.md` et `docs/interface.md` pour les affirmations vérifiées ; `validation/data/pi_sweep_summary.csv` comme référence.

Commandes exécutées (codes de sortie relevés) :

| Commande | Code | Résultat |
| --- | --- | --- |
| `npm.cmd run check` | 0 | typecheck, lint, 47 fichiers et 649 tests Vitest verts, build |
| `powershell -NoProfile -Command "npm.cmd run e2e"` | 0 | 74 passed (55,8 s) ; 19 PNG de `docs/img/` réécrits puis restaurés par `git checkout -- docs/img` |
| `npx vite preview --host 127.0.0.1 --port 4196 --strictPort` | arrêté | serveur des essais (build de `npm run check`), arrêté par `taskkill` en fin de session |
| `npx vitest run tests/zz-chasse-b.test.ts --silent=false` | 0 | 7 tests jetables (noyau de jeu, API, découpages, déterminisme, annonces) ; fichier supprimé ensuite |
| `npx vitest run tests/zz-chasse-b2.test.ts --silent=false` | 0 | textes de l'issue `slow` du niveau 2 en FR et EN ; fichier supprimé ensuite |

Méthode : scripts Node jetables qui importent `playwright-core` contre le build servi sur le port 4196, en mode `?e2e=1` (crochet `window.__huygens`) ou en temps réel (clavier et souris seulement), et tests Vitest jetables sous `tests/zz-*.test.ts`. Copies dans `C:\Users\BANGER~1\AppData\Local\Temp\chasse-B\` : `grid.mjs` (attaque 2), `leak.mjs` (1), `numfield.mjs`, `numfield2.mjs`, `numfield3.mjs` (3), `states.mjs` (4), `a11y.mjs`, `helpkeys.mjs` (5), `lock.mjs`, `realpause.mjs` (2), `zz-chasse-b.test.ts`, `zz-chasse-b2.test.ts` (2, 3, 6). Aucun fichier jetable ne reste dans le dépôt.

« Exécuté » signifie mesuré par un de ces scripts ; « lu dans le source » est signalé comme tel.

## 2. Défauts

### B-01 — Aide ouverte : le clavier fait marcher, régler, lancer et recommencer derrière la fenêtre modale (majeur)

K24 est corrigé pour les clics et le tactile seulement. Les touches du jeu passent toujours quand l'aide (`role="dialog"`, `aria-modal="true"`, papier opaque) est ouverte : le joueur ne voit pas ce qu'il déclenche, et un trajet lancé ainsi se déroule jusqu'à l'issue derrière l'aide, sans la pause automatique de K19.

Reproduction (exécutée, `helpkeys.mjs`) : `http://127.0.0.1:4196/pid-game/?renderer=webgl&lang=fr&e2e=1&screen=level1` (puis `screen=level2`).

1. Approche : clic sur « ? », maintenir D, `advance(1)`, relâcher : le bonhomme passe de −5,5 m à −4,00 m, aide toujours visible.
2. Échap, aller à la console, ouvrir le réglage, clic sur « ? » (focus sur « Fermer l'aide ») ; touches `=`, Page préc., `-` : Kp passe de 2000 à 3000 (niveau 2 : Ki de 2000 à 3000).
3. Touche E, `advance(0.5)` : niveau 1 en `trip`, k = 60 ; niveau 2 en `outcome` (choc au pas 54), aide toujours visible.
4. Touche R : `tuning`, essai n° 2.

Sorties :

```text
level1 approach help open + D held 1s -> approach kp=2000 ki=0 walkerX=-4.00 k=0 attempt=1 help visible true
level1 help open after + PageUp - -> tuning kp=3000 ki=0 walkerX=-1.00 k=0 attempt=1
level1 help open after E + 0.5 s -> trip kp=3000 ki=0 walkerX=2.00 k=60 attempt=1 help visible true
level1 help open after R -> tuning kp=3000 ki=0 walkerX=-1.00 k=0 attempt=2
level2 help open after E + 0.5 s -> outcome kp=2500 ki=3000 walkerX=2.00 k=54 attempt=1 help visible true
```

Écart à la documentation : `docs/interface.md:263` (« tant que l'aide est ouverte, les commandes du niveau sont suspendues : … le réglage … n'agissent pas ; seule la fermeture de l'aide agit ») et `docs/defauts-connus.md:74` (« garde `commandsBlocked(helpOpen)` sur toutes les commandes du niveau »).

Cause : `src/ui/input.ts:59-118`, `onKeyDown` exécute toute intention sans consulter `commandsBlocked(ui.helpOpen)` ; `src/ui/keys.ts:162-199`, `keyToIntent` ne regarde `helpOpen` que pour Échap ; le test `tests/ui/keys.test.ts:188` fige même `launch` pour E avec l'aide ouverte. Une marche commencée avant l'ouverture de l'aide (clic sur « ? » pendant que D est tenue) continue aussi derrière l'aide (lu dans le source : `setHelp`, `src/ui/overlay.ts:661-687`, n'arrête pas la marche).

Correctif proposé : dans `keyToIntent`, après les modificateurs et Échap, si `helpOpen` : renvoyer `none` pour Tab et pour Entrée et Espace sur un bouton (activation native de « Fermer l'aide », piège de focus intact), `block` pour toute autre touche du jeu ; à l'ouverture de l'aide, arrêter la marche (`level.stop()` et remise à zéro de `left`/`right` de `bindKeyboard`).

Test de régression proposé : `tests/ui/keys.test.ts` : avec `helpOpen: true`, pour chaque phase et chaque focus, E, R, `+`, `-`, Page préc., Page suiv., ←, →, `KeyA`, `KeyD`, et Entrée ou Espace hors bouton → `block` ; Tab, et Entrée ou Espace sur un bouton → `none` ; remplacer l'assertion de la ligne 188. E2e `ui.spec.ts` : aide ouverte en réglage, E puis `advance(1)` → phase `tuning`, k = 0 ; `+` → Kp inchangé ; aide ouverte en approche, D maintenue → bonhomme immobile.

### B-02 — Champ numérique : la virgule décimale est ignorée, puis la valeur est ramenée en silence à la borne (mineur)

Chromium retire la virgule d'un `<input type="number">` ; le jeu reçoit un nombre dix fois plus grand et le borne à 8000 sans rien dire. Avec « Lancer » cliqué juste après la saisie, le trajet part aussitôt à la valeur bornée.

Reproduction (exécutée, `numfield2.mjs`, frappe réelle par `keyboard.type`, contextes `fr-FR` et `en-US`, résultat identique) : niveau 1 en réglage, Kp = 4000, champ numérique vidé puis saisie, validation par Entrée ou par clic sur « Lancer ».

| Saisie | `value` du champ | Kp appliqué | Validation par « Lancer » |
| --- | --- | --- | --- |
| `12,5` | `125` | 100 | trajet lancé à 100 |
| `1500,5` | `15005` | 8000 | trajet lancé à 8000 (saturation annoncée) |
| `2500,0` | `25000` | 8000 | trajet lancé à 8000 |
| `1,5e3` | `15e3` | 8000 | trajet lancé à 8000 |
| `2.500` | `2.500` | 0 | trajet lancé à 0 |

Les autres saisies essayées (`numfield.mjs`, validées par Entrée et par Tab) donnent une valeur cohérente partout (champ, curseur, grand nombre, étiquette du haut, `aria-valuetext`, valeur lancée) : vide, `abc`, `NaN`, `Infinity`, `1e999` (`badInput`) : valeur précédente rétablie ; `1e3` → 1000 ; `-5`, `-0`, `0.0001`, `1e-3` → 0 ; `9999999`, `8000.4` → 8000 ; `150` → 200 ; `149` → 100 ; `3050` → 3100 ; `2 500`, ` 3000 `, `+300`, `７０００` (pleine chasse) → valeur attendue. Même comportement au niveau 2 pour Ki.

Impact : une valeur au pas de 100 se tape sans virgule, d'où la gravité mineure ; mais un joueur français qui écrit « 2500,0 » obtient 8000 N/m et un choc, sans message.

Cause : `src/ui/overlay.ts:296-301` (`type = 'number'`) et `:751-762` (`commitNumber` accepte toute valeur finie ; `setTuning` la borne à [0 ; 8000], `src/game/kp.ts:12-17`).

Correctif proposé : champ `type="text"` avec `inputMode="decimal"` et analyse selon la langue (virgule ou point décimal, espaces ignorés) ; ou au minimum refuser une saisie hors de [0 ; 8000] (valeur précédente rétablie, contour d'erreur) au lieu de la borner en silence.

Test de régression proposé : e2e en `fr-FR` : saisir `2500,0` puis Entrée → Kp = 2500 (ou valeur inchangée avec message), jamais 8000.

### B-03 — Échap dans le champ numérique valide la saisie en refermant le réglage (mineur)

Reproduction (exécutée, `numfield3.mjs`, niveaux 1 et 2) : réglage ouvert, valeur 4000, focus dans le champ, saisie `6000` sans valider, Échap. Résultat : panneau refermé (phase `approach`) et 6000 **appliqué** (`{"phase":"approach","val":6000,"field":"6000",…}`). Échap est ailleurs un geste d'annulation ; ici il valide.

Cause : `src/ui/input.ts:110-111` (`closeTuning` → `level.interact()`), puis `src/ui/overlay.ts:601-603` (`releaseFocus(panel)` : le champ perd le focus, `change` part) et `:751-762` (`commitNumber` en phase `approach`, où `setTuning` est accepté, `src/game/elevator-level.ts:391`).

Correctif proposé : sur Échap avec le focus dans le champ, rétablir `numberInput.valueAsNumber = tunedNow()` avant de rendre le focus (ou ignorer le `change` qui suit un `closeTuning`).

Test de régression proposé : e2e : saisir `6000` dans le champ, Échap → phase `approach`, valeur inchangée (4000), champ à 4000 à la réouverture.

### B-04 — Pause à l'issue : « Rejouer le niveau » ou « Recommencer » reste visible, actif, focalisé et sans effet (mineur)

Reproduction (exécutée, `a11y.mjs`) : `?renderer=webgl&lang=fr&e2e=1&screen=level2`, Ki = 500, lancer, `advance(11)` (victoire, focus sur « Rejouer le niveau »), puis pause (Échap ou bouton « Pause »). Le panneau d'issue reste affiché, le bouton n'est ni masqué ni désactivé (`["Rejouer le niveau", disabled=false, visible=true]`) ; clic → `paused attempt=1` ; R → `paused attempt=1`. Le bandeau dit « Jeu en pause · Échap : reprendre », mais le bouton qui a le focus ne fait rien, sans retour.

Cause : `src/ui/view-model.ts:540-541` (l'issue reste visible en pause, phase effective `outcome`), `src/ui/overlay.ts:774-776` (aucun `enable` sur le bouton d'issue, alors que « Recommencer » du panneau est désactivé en pause, `:544`), `src/game/elevator-level.ts:450-451` (`restart` ignoré en pause).

Correctif proposé : `enable(outcomeButton, !vm.paused)`, comme pour le bouton du panneau ; ou bien reprendre puis recommencer au clic.

Test de régression proposé : e2e : issue, Pause → bouton d'issue `disabled` ; Reprendre → actif.

### B-05 — Annonce d'issue fausse (« 0,00 m ») si l'on recommence dans l'image où le trajet se termine (mineur, mécanisme reproduit hors navigateur)

L'annonce d'un événement est calculée au moment où la file est vidée, avec l'instantané de ce moment-là, pas celui de l'événement. En temps réel, la boucle met l'interface à jour **avant** d'avancer le niveau (`src/main.ts:379-383`) : l'événement `outcome` produit à l'image N n'est annoncé qu'à l'image N + 1. Si une frappe R (ou un clic sur « Recommencer ») arrive entre les deux, `restart()` remet `finalError` à `null` et `e` à 0, puis `ui.update()` vide la file : l'issue est annoncée avec 0,00 m.

Preuve (exécutée, `zz-chasse-b.test.ts`, même enchaînement que `Ui.update` : `level.drainEvents` puis `announcementFor(event, level.snapshot, tr)`), trajet terminé, `restart()`, puis vidage :

```text
race L2 step ["Moteur à fond ! … continue d’additionner l’erreur.","Échec : au bout de 10 s, la cabine est encore 0,00 m sous le plateau d’arrivée, plus loin que les 0,1 m permis.","Cabine replacée au sol. Règle Ki et relance."]
race L1 win ["Moteur à fond ! … c’est la saturation.","Réussi ! La cabine s’est stabilisée 0,00 m sous le plateau d’arrivée.","Cabine replacée au sol. Règle Kp et relance."]
```

(Valeurs justes : 0,20 m et 0,24 m.) Non reproduit dans le navigateur : la fenêtre dure une image (environ 16 ms) et le crochet `advance` met toujours l'interface à jour après avoir avancé le niveau. C'est donc une hypothèse pour le joueur, avec un mécanisme démontré.

Cause : `src/ui/announce.ts:55-70` (`s.finalError ?? s.e`, `s.kp` lus sur l'instantané courant), `src/ui/overlay.ts:645` ; l'événement (`src/game/events.ts:23-32`) ne porte pas l'erreur finale.

Correctif proposé : ajouter à `GameEvent` un champ numérique `value` (erreur finale pour `outcome`, sans allocation), lu par `announcementFor` ; ou vider la file dans `onFrame` juste après `level.update`.

Test de régression proposé : `tests/ui/announce.test.ts` : trajet terminé, `restart()`, puis vidage : l'annonce d'issue cite l'erreur finale du trajet, pas 0,00 m.

### B-06 — Bulle d'ouverture du niveau 1 : l'anglais n'a pas suivi la réécriture française de T-019 (mineur)

Comparaison phrase à phrase (exécutée sur les catalogues et sur l'écran, `states.mjs`) : `level1.goal` dit en français « Pour traverser, monte en ascenseur jusqu’au plateau d’en face, 3 m plus haut. Plus la cabine est loin de cette hauteur, plus le moteur tire fort. » et en anglais « Reach the far ledge. The lift follows one rule: the farther it is from the ledge, the harder it pulls. ». L'anglais ne dit ni de prendre l'ascenseur ni la hauteur de 3 m, que la version française (et `docs/interface.md:62`) donne comme l'objectif chiffré du niveau. `git log -G"level1.goal"` : T-019 (`c5c0235`) a changé `fr.json` seulement ; la phrase anglaise date de T-006 (`1ee1010`). Toutes les autres clés ont le même sens dans les deux langues.

Cause : `src/i18n/locales/en.json:22`.

Correctif proposé : « To get across, take the lift up to the far ledge, 3 m higher. The farther the lift is from that height, the harder the motor pulls. » (à valider par l'orchestrateur, texte visible).

Test de régression proposé : `tests/i18n/catalogs.test.ts` : chaque texte qui contient un nombre suivi d'une unité en français en contient un en anglais (même liste de nombres), pour attraper les traductions restées en arrière.

### B-07 — Treize clés de texte ne sont utilisées nulle part (mineur)

Recherche exécutée (script Node : chaque clé de `fr.json` cherchée entre guillemets dans `src/**/*.ts`) : `app.loading`, `app.language.current`, `app.error.generic`, `app.error.details`, `app.error.reload`, `level1.intro`, `level1.kp.unit`, `hud.curve.setpoint`, `hud.curve.position`, `hud.curve.error`, `hud.curve.force`, `a11y.skipToPanel`, `a11y.sceneState` (`app.error.details` et `a11y.sceneState` n'apparaissent que dans `src/i18n/params.ts:10` et `:34`). Aucune clé utilisée n'est absente (vérifié dans le même script ; le typage `MessageKey` le garantit aussi). Risque : `a11y.skipToPanel` (« Aller au réglage de Kp ») et `level1.kp.unit` citent Kp et seraient faux au niveau 2 si on les branchait tels quels ; le catalogue compte des textes que personne ne relit.

Correctif proposé : supprimer ces clés (et leurs entrées de `MESSAGE_PARAMS`) ou les marquer comme réservées dans la documentation de l'i18n.

Test de régression proposé : `tests/i18n/catalogs.test.ts` : toute clé de `fr.json` apparaît dans `src/` (liste d'exceptions explicite si certaines sont gardées en réserve).

### B-08 — L'aide des commandes ne dit nulle part comment lancer le trajet (mineur)

Lu dans les catalogues et vu à l'écran (aide ouverte en réglage, `states.mjs`) : la liste de l'aide dit « E, Entrée ou Espace : utiliser la console » et, au tactile, « Action pour utiliser la console » ; or en réglage ces mêmes touches et le bouton « Action » **lancent** le trajet (`src/ui/keys.ts:138-149`, `src/ui/overlay.ts:794-809`), ce que seul le bandeau du bas dit (« E ou Entrée : lancer »). Ni Échap pour reprendre ni le bouton « Menu » n'y figurent non plus. Même lacune en anglais.

Cause : `src/i18n/locales/fr.json:133` et `:139-140`, `en.json:133` et `:139-140`.

Correctif proposé : « E, Entrée ou Espace : utiliser la console, puis lancer » (« E, Enter or Space: use the console, then launch ») et « Action pour utiliser la console et lancer » (« Action to use the console and launch ») ; à valider (texte visible).

Test de régression proposé : test de catalogue : la ligne d'aide d'interaction cite le lancement dans les deux langues.

### B-09 — Documentation et commentaire périmés sur `iTerm` (mineur)

`docs/jeu.md:224` dit « 0 au niveau 1 et hors trajet », et le commentaire de `LevelSnapshot.iTerm` (`src/game/elevator-level.ts:94-98`) ajoute « Prévu pour de futurs affichages (non affiché pour l'instant) ». Mesuré : à l'issue et en pause à l'issue, `iTerm` garde la valeur du dernier pas (par exemple 379,17 N à Ki = 500, affichée « I : 379 N » et « Terme I : 379 N » dans le panneau d'issue, `states.mjs`) ; il n'est remis à 0 qu'au lancement et à `restart` ; la jauge l'affiche depuis T-024 (`docs/interface.md:127` le dit d'ailleurs : « la valeur reste affichée à l'issue »).

Correctif proposé : « 0 au niveau 1, avant le premier pas et après `restart` ; garde la valeur du dernier pas à l'issue » dans les deux endroits, et retirer « non affiché pour l'instant ».

Test de régression proposé : aucun (documentation) ; un test unitaire existant pourrait figer `iTerm` non nul à l'issue au niveau 2.

## 3. Attaques sans défaut

| Attaque | Ce qui a été fait | Mesures |
| --- | --- | --- |
| 1. Fuite d'état entre niveaux | 4 cycles par les vrais boutons du menu, alternés (1 puis 2, 2 puis 1) : approche, console, saisie dans le champ (Kp 5000 ou Ki 300), aide ouverte et fermée, lancement par E, trajet, puis Pause et « Menu » de la barre, ou issue et « Menu » de l'issue (`leak.mjs`) | à chaque entrée : `levelId` juste, phase `approach`, Kp 2000 (niveau 1) ou Kp 2500 et Ki 2000 (niveau 2), `iTerm` 0, essai 1, issue `null`, `saturationSeen` faux, k 0, cabine 0, bonhomme −5,5 m, tracé vide, région `aria-live` vide, bulle du bon niveau, bandeau « → / D : avancer vers la console », étiquette du haut, titre du panneau, libellé du champ, bornes du curseur 0 à 8000, grand nombre et unité du bon niveau, jauge I présente seulement au niveau 2 (étiquette visible en approche, valeur pendant le trajet), 4 lignes de légende (5 au niveau 2), légende fermée, issue et aide masquées. Pendant le trajet : annonces, bandeau (« Kp est verrouillé » ou « Ki est verrouillé ») et textes d'issue du niveau courant seulement |
| 1. État global (lu dans le source) | recherche de l'état de module mutable dans `src/game`, `src/ui`, `src/i18n`, `src/main.ts` | niveau, modèle de vue, interface, file d'événements, enregistreur, arbitre et boucle créés à chaque entrée (`createLevel1/2`, `createUi`, `createViewModelBuilder`) ; constantes figées (`ELEVATOR_PARAMS` gelé, `KEY_SYMBOLS` gelé, catalogues jamais réécrits) ; seul cache : formateurs `Intl` (`src/i18n/format.ts:37`), sans effet d'un niveau à l'autre |
| 2. Grille de Ki par le vrai niveau | Ki = 0 à 8000 par pas de 100 et 120, 128, 129, 130, 138, 139, 140, 840, 841, 842, 850, par le crochet `setKi`, `launch`, `advance(11)`, dans une seule page, en enchaînant `restart` (`grid.mjs`) | 0 écart d'issue ni de pas avec `pi_sweep_summary.csv` ; `step` 0 à 100, `win` 200 à 800, `bonk` 900 à 8000 ; les valeurs hors grille sont arrondies au pas de 100 (120 à 140 → 100, 840 à 842 → 800, 850 → 900), voulu : l'interface ne peut pas jouer un Ki hors grille |
| 2. Points hors grille | `createLevel2({ initialKi })`, seule porte d'un Ki hors grille (`zz-chasse-b.test.ts`) | 120 et 128 `step` 1200 ; 129, 130, 138 `slow` 1200 ; 139 `win` 1196 ; 140 `win` 1185 ; 840 et 841 `win` 298 ; 842 `bonk` 73 ; 850 `bonk` 72 : identiques à la référence. Au pas de 1, la borne de choc est entre 841 et 842 (la doc, au pas de 10, dit « 840 win, 850 bonk » : cohérent) |
| 2. Découpages et pauses | 8 découpages (1/60, 1/144, 1/30, 0,25 s, 1e9 s, `Infinity`, aléatoire de 0 à 0,3 s, mélange de 0, −1, NaN, 1e-12, 1/60, 0,1 et `Infinity`) et 4 pauses (aux pas 1, 37, 300, 700, chacune de 1000 images de 0,25 s, reprise à 1/50 s), pour Ki = 0, 100, 129, 200, 800, 840, 850, 2000 | un seul résultat par Ki, à l'identique bit à bit (issue, pas, erreur finale, `iTerm`, hauteur) ; en pause, `setTuning` et `adjustTuning` → `locked`, `launch` et `restart` → `ignored` |
| 2. Temps réel | Ki = 500, clavier et souris seulement, sans `e2e` : sans pause ; Échap tenue 0, 600 et 3000 ms ; `blur` de la fenêtre 1,5 s puis « Reprendre » ; aide ouverte 1 s ; R en plein trajet puis relance (`realpause.mjs`) | 7 fois sur 7 : « Niveau réussi ! », « Temps : 2,5 s », « Erreur : 0,05 m », « Terme I : 379 N », « e = 0,05 m » ; la perte de focus met en pause (« Reprendre », temps figé à 0,7 s) |
| 2. Verrou du réglage | niveaux 1 et 2, en trajet, en pause et à l'issue : `=`, `-`, Page préc., Page suiv., `NumpadAdd`, ↑, →, Début, Fin ; `fill` du champ ; clic sur + ; molette et clic sur le curseur et le champ ; crochets `setKp`, `setKi`, `adjustKp`, `adjustKi` (`lock.mjs`) | valeur et k inchangés partout ; champ, curseur, − et + `disabled` ; crochets `locked` (grandeur du niveau) ou `ignored` (autre grandeur) |
| 3. Entrées numériques | voir B-02 pour le tableau ; flèches ↑ et ↓ du champ au-delà de 0 et 8000 (valeur appliquée tout de suite, bornée) ; `+` et Page préc. au-delà de 8000, `-` et Page suiv. sous 0 (bornés) ; Début, Fin, → sur le curseur ; molette sur le champ focalisé (`numfield.mjs`, `numfield3.mjs`) | toujours cohérent après validation (champ, curseur, grand nombre, étiquette, `aria-valuetext`, valeur lancée) ; la molette change le champ (4200) avant validation, la valeur appliquée suit au départ du focus : état d'édition normal, toute voie de lancement (clic sur « Lancer », bouton tactile) fait d'abord partir le focus |
| 3. API directe | `createLevel1/2` avec `NaN`, ±`Infinity`, −1, 8001, −0,0001 ; `setKp`/`setKi` avec `NaN`, ±`Infinity`, −1, 8001, 9999999, 49,99, 50, 150, −50, 12,5, −0 ; `adjustKp` avec `NaN`, `Infinity`, ±1e308, ±50 ; `update` avec 0, −1, `NaN`, ±`Infinity`, 1e9, 1e-12 pendant un trajet | constructeurs : `RangeError` documentée ; non finis → `invalid`, valeur gardée ; hors bornes → borne ; aucun champ numérique non fini dans l'instantané après `update` (`theoreticalError` est fini au niveau 2) ; `Infinity` et 1e9 comptent pour 0,25 s (8 pas). Deux curiosités sans effet sur le jeu (API seulement) : `createLevel1({ initialKp: -0 })` garde −0 (affiché « 0 ») ; `adjustKp(50)` ajoute 100 et `adjustKp(-50)` ne fait rien (arrondi des demis vers +∞), l'interface n'utilisant que ± 100 et ± 1000 |
| 4. Textes, parcours complet | FR et EN, niveaux 1 et 2 : approche, console, réglage, réglage avec aide, puis pour 4 réglages par niveau (niveau 1 : 2000 victoire, 8000 choc, 500 trop court, 100 au sol ; niveau 2 : 500 victoire, 2000 choc, 0 trop court, 800 victoire) trajet à 0,05 s et 0,45 s (saturé), pause, pause avec aide, issue ; issue en pause ; titre ; menu (`states.mjs`, 104 états relevés) ; issue `slow` par l'API (`zz-chasse-b2.test.ts`) | dans tous les textes visibles, noms accessibles, `aria-valuetext`, régions `aria-live` et `document.title` : aucun `{`, `}`, `undefined`, `NaN`, `null`, `[object`, ni clé brute ; aucun point décimal en français ni virgule décimale en anglais ; aucun trait d'union devant un nombre (signe moins U+2212 : « −0,37 m », « −2799 N ») ; en français, U+00A0 avant « : » et U+202F avant « ! », « ; », « ? », jamais d'espace ordinaire ; en anglais, aucune espace avant la ponctuation ; U+00A0 entre nombre et unité (m, s, N, N/m, N/(m·s)) partout. Aucun texte du niveau 1 au niveau 2 (Kp, 0,5 m) ni l'inverse. Valeurs : 0,5 m, 0,1 m, 3,36 m (poutre 3,3626 m), 5000 N, 490,5 N (50 × 9,81), 10 s (1200 pas à 1/120 s), « de 0 à 8000, par pas de 100 » : conformes aux constantes. Issue `slow` : « Trop lent », message et annonce citant 10 s, dans les deux langues |
| 4. Clés | clés utilisées et absentes ; paramètres | aucune clé utilisée absente ; treize clés inutilisées (B-07) ; `MESSAGE_PARAMS` conforme (test existant) |
| 4. Langue et titres | `<html lang>`, `document.title`, `lang` du bouton de langue | `fr` ou `en` selon la langue, titre « Huygens’s world » dans les deux, libellé du bouton dans l'autre langue avec `lang` juste ; reste A-06 (annonces déjà écrites gardent l'ancienne langue, constaté de nouveau) |
| 5. Ordre de tabulation, niveau 2 (`a11y.mjs`) | Tab depuis le document à chaque phase | approche : « ? », langue, Pause ; réglage : −, curseur, +, champ, « Lancer », puis la barre ; trajet : « Recommencer », « Légende », puis la barre (quitter le document met en pause, voulu) ; pause : la barre avec « Menu » et « Reprendre », « Légende » ; issue : « Rejouer le niveau », « Menu », la barre, « Légende ». Aucun élément masqué, désactivé ou sous un ancêtre `hidden` ou `aria-hidden` n'est atteint |
| 5. Focus | après chaque événement | ouverture du réglage : curseur ; issue : « Rejouer le niveau » ; « Rejouer » : curseur ; ouverture de l'aide : « Fermer l'aide » ; fermeture par Échap : élément ouvreur ; langue : reste sur le bouton de langue ; « Menu » : entrée « Niveau 2 » du menu (voir A-05 pour le retour par le titre) |
| 5. Rôles et noms | instantané d'accessibilité (`ariaSnapshot`) du menu et du niveau 2 | menu : `main` « Levels », titre de niveau 1, liste nommée, boutons nommés, `status` « Level menu » ; niveau : `img` nommée (canvas), `banner`, bouton « Show controls », région « What to do now », `status` « Game messages » ; curseur nommé par le titre du panneau, avec `aria-valuetext` (« 2000 newtons par mètre-seconde ») ; champ nommé par son `label` ; − et + nommés « Diminuer Ki de 100 », « Augmenter Ki de 100 » |
| 5. Régions `aria-live` | contenu à chaque événement (`states.mjs`, `leak.mjs`, `realpause.mjs`) | une phrase par événement, du bon niveau et de la bonne langue : prêt, lancement (Kp, et Ki au niveau 2), première saturation une seule fois, pause, reprise, issue avec l'erreur, recommencer ; trois lignes au plus |
| 6. Déterminisme du PI par le jeu | 20 trajets de suite à Ki = 500 avec `restart` entre deux, boucle injectée qui garde une référence au contrôleur ; comparaison de `snapshot.iTerm` et `controller.integral` après chaque pas ; `restart` en plein trajet ; Ki = 0 contre la boucle P à Kp = 2500 (`zz-chasse-b.test.ts`) | 1 seul résultat sur 20 (`win`, pas 298, erreur finale 0,04620355912036711 m, `iTerm` 379,1739485467916 N) ; 0 écart `iTerm`/intégrale ; après `restart` (fin ou milieu de trajet) `iTerm` = 0 et intégrale = 0 ; une seule boucle créée (réutilisée : `reset()` remet bien l'intégrale à zéro) ; Ki = 0 : 0 écart bit à bit avec le P sur hauteur et force, même issue (`step`, pas 1200) |
| 6. Lecture de `pi.ts` et `createElevatorPiLoop` | ordre normatif, `reset`, `setEnabled`, `Object.assign` | ordre e, u = Kp·e + I (I d'avant), I ← I + Ki·dt·e conforme à la spec ; `reset()` de la boucle appelle `controller.reset()` (intégrale et terme P à 0) et réactive la boucle ; `setEnabled(false)` gèle l'intégrale sans la remettre à zéro, mais le jeu ne l'appelle jamais ; `Object.assign` garde les accesseurs `k` et `enabled` |
| 7. Documentation contre code | voir la liste ci-dessous | 6 affirmations conformes, 2 écarts (B-01, B-09) |

Affirmations vérifiées (attaque 7) :

1. `docs/jeu.md:117` : Kp = 2000 au chargement gagne au pas 262 avec une erreur finale de 0,245 m. Conforme (pas 262 ; écran « e = 0,24 m », formule « ≈ 0,25 m » ; mesurée 0,24468 m, théorique 0,24525 m).
2. `docs/jeu.md:134` et tableau `:136-152` : `KI_DEFAULT` = 2000 heurte la poutre au pas 57 ; 200 gagne au pas 733, 800 au pas 298 (−0,002991 m), 850 hors grille au pas 72 (−0,363562 m). Conforme (`grid.mjs`, `zz-chasse-b.test.ts`).
3. `docs/jeu.md:93` : en pause, l'horloge n'avance pas, aucun saut de temps à la reprise. Conforme (pauses de 0 à 3 s en temps réel et de 250 s en unitaire, même issue et même pas).
4. `docs/interface.md:213-214` et `:221` : Page préc. et Page suiv. font ± 1000 ; les touches de réglage n'agissent qu'en approche et en réglage ; R n'agit que pendant le trajet et à l'issue. Conforme (R reste sans effet en pause à l'issue : B-04).
5. `docs/interface.md:247` : la perte de focus de la fenêtre met en pause pendant un trajet. Conforme (`realpause.mjs`).
6. `docs/interface.md:141` : étiquette du haut « Kp = 2500 · Ki = 2000 », sans unités. Conforme.
7. `docs/interface.md:263` : commandes suspendues tant que l'aide est ouverte. **Écart** : vrai pour la souris et le tactile, faux pour le clavier (B-01).
8. `docs/jeu.md:224` : `iTerm` vaut 0 hors trajet. **Écart** : il garde sa valeur à l'issue (B-09).

## 4. Non exécuté

- Ki hors grille par l'interface : impossible par construction (le réglage arrondit au pas de 100) ; ils ont été joués par `createLevel2({ initialKi })` seulement. L'issue `slow` n'est donc jamais affichée à un joueur (K34, connu) ; ses textes ont été vérifiés par le modèle de vue et les annonces, pas à l'écran.
- B-05 dans le navigateur : la fenêtre d'une image n'a pas été provoquée en temps réel (mécanisme démontré en unitaire seulement).
- WebGPU réel, lecteur d'écran réel, vrai écran tactile, Firefox et Safari ; vraie répétition matérielle des touches.
- `prefers-reduced-motion` (K22, connu, exclu par la consigne).
- MATLAB : non relancé ; l'oracle du PI a été validé en T-023 et le noyau n'a pas changé depuis.

## 5. État final du dépôt

Fichiers jetables supprimés (`tests/zz-chasse-b.test.ts`, `tests/zz-chasse-b2.test.ts`) ; aucune spec Playwright jetable créée dans le dépôt ; PNG réécrits par l'e2e restaurés (`git checkout -- docs/img`) ; serveur de prévisualisation arrêté. `git status --short` après l'écriture de ce rapport :

```text
?? docs/validation/V-v0.2-A-cycle-de-vie.md
?? docs/validation/V-v0.2-B-etat-textes-logique.md
```
