# V-v0.2-A — Chasse aux bugs v0.2, partie A : cycle de vie, ressources, écouteurs, redimensionnement, enchaînements

Validateur indépendant (n'a pas vu la réalisation, n'a modifié aucun fichier de `src/`, des tests, de la configuration ni d'`orchestration/`). Branche `migration`, commit examiné `f2680d1`, arbre propre au départ. Date : 2026-11-14. Session locale Windows 11, Chromium de Playwright 1.65 (`playwright-core`), moteur `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, WebGL2 imposé (`?renderer=webgl`) sauf mention contraire.

## Verdict : VALIDÉ AVEC RÉSERVES

Aucun défaut bloquant. Le cycle de vie tient : aucune fuite d'écouteur, de minuterie, de `ResizeObserver`, d'objet GPU ni d'objet JS sur 30 à 300 allers-retours, l'état est neuf à chaque entrée dans un niveau, et les échecs (perte de contexte, exception) aboutissent à une page de repli propre sans écouteur restant. Réserves : 2 défauts majeurs (activation « fantôme » d'un écran à l'autre, actions de l'issue invisibles en paysage bas) et 8 mineurs, détaillés ci-dessous.

## 1. Périmètre et méthode

Code lu : `src/main.ts`, `src/app/` (machine d'écrans, catalogue), `src/ui/overlay.ts`, `screens.ts`, `screens-model.ts`, `screen-keys.ts`, `input.ts`, `keys.ts`, `help.ts`, `layout.ts` (en partie), `src/render/session.ts`, `failure.ts`, `level-view.ts`, `bootstrap.ts`, `src/game/elevator-level.ts`, `level.ts`, `level2.ts`, `events.ts`, la spec T-017 et l'ADR-015.

Commandes exécutées (codes de sortie relevés) :

| Commande | Code | Résultat |
| --- | --- | --- |
| `npm.cmd run check` | 0 | typecheck, lint, 47 fichiers et 649 tests Vitest verts, build (JS 909,76 kB, 253,52 kB gzip) |
| `powershell -NoProfile -Command "npm.cmd run e2e"` | 0 | **74 passed** (55,8 s) ; 17 PNG de `docs/img/` réécrits puis restaurés par `git checkout -- docs/img` |
| `npx vite preview --host 127.0.0.1 --port 4197 --strictPort` | arrêté | serveur des essais, arrêté par `taskkill` en fin de session |

Méthode : scripts Node jetables qui importent `playwright-core` contre le build servi sur le port 4197 (copies dans `C:\Users\BANGER~1\AppData\Local\Temp\chasse-A\`, aucun fichier jetable dans le dépôt). Un script d'instrumentation commun (`harness.mjs`, injecté par `page.addInitScript`) compte :

- les écouteurs vivants sur `document`, `window` et le canvas (`EventTarget.prototype.addEventListener` / `removeEventListener` enveloppés), recoupés par CDP `DOMDebugger.getEventListeners` ;
- les `setTimeout` en attente, les `requestAnimationFrame` en attente, les cibles observées par `ResizeObserver` ;
- les objets WebGL2 vivants (`create*` − `delete*` pour Buffer, Texture, Program, Shader, VertexArray, Framebuffer, Renderbuffer) ;
- la mémoire (`HeapProfiler.collectGarbage` puis `Performance.getMetrics`), et des instantanés de tas comparés par constructeur (`HeapProfiler.takeHeapSnapshot`).

Le temps réel (sans `?e2e=1`) a été piloté au clavier et à la souris seulement ; le mode `?e2e=1` par `window.__huygens`.

## 2. Défauts

### A-01 — Activation « fantôme » : une seconde activation traverse vers l'écran suivant (majeur)

Une seule intention du joueur (double-clic, double tape, touche Entrée maintenue) active deux écrans de suite, parce que l'écran suivant monte sous le même pointeur ou reçoit le focus pendant que la touche se répète.

Reproductions (toutes reproduites) :

1. Double-clic sur « Jouer » : `http://127.0.0.1:4197/pid-game/?renderer=webgl`, double-clic dans le haut du bouton (8 px sous son bord). Résultat : **le niveau 1 s'ouvre, le menu est sauté**. Mesuré à 1280×720, 844×390 et 1920×1080 (à 390×844, le second clic tombe entre deux boutons du menu et rien ne se passe). À 1280×720, « Jouer » occupe y = 335 à 383 et « Niveau 1 » du menu y = 310 à 358. Script `dbl.mjs`.
2. Double tape tactile (contexte `hasTouch`, `isMobile`, 844×390), même endroit : niveau 1 ouvert. Script `touch.mjs`.
3. Entrée maintenue sur « Jouer » (`keyboard.down('Enter')` deux fois, la seconde avec `repeat`) : première frappe → menu, focus sur « Niveau 1 » ; **première répétition → niveau 1**. Script `keys1.mjs`, sorties `A1 after Enter down menu` puis `A repeat 0 level`.
4. Entrée maintenue sur « Menu » (pause, niveau 1) : menu, puis à la première répétition **retour dans un niveau 1 neuf**. Sorties `F enter on Menu menu` puis `F repeat 0 level`.
5. Double-clic sur « Retour » du menu : titre, et **la langue bascule en anglais** (le second clic touche le bouton de langue du titre). Mesuré : 1280×720 au haut du bouton, 390×844 en trois points sur trois, 844×390 au haut du bouton (`dbl2.mjs`, sorties `title lang=en`).

Cause probable : les boutons de navigation acceptent toute activation sans garde, `src/ui/screens.ts:164` (« Jouer »), `:207-209` (niveaux), `:214` (« Retour »), `:165-167` (langue) et `src/ui/overlay.ts:740-741` (« Menu »). Chrome synthétise un `click` à chaque `keydown` Entrée sur un bouton, répétitions comprises ; `screenKeyToIntent` (`src/ui/screen-keys.ts:50-58`) laisse Entrée native sans regarder `repeat`, et `keyToIntent` (`src/ui/keys.ts:176-179`) aussi quand le focus est sur un bouton.

Correctif proposé : (a) sur les écrans titre et menu, et sur les boutons « Menu » du niveau, appeler `preventDefault` sur un `keydown` Entrée ou Espace avec `event.repeat` (le clic n'est alors plus synthétisé) ; (b) n'accepter un clic de navigation que si le `pointerdown` correspondant a eu lieu sur l'écran courant (drapeau armé par un `pointerdown` reçu après le montage), ce qui couvre double-clic et double tape sans délai arbitraire.

Test de régression proposé : e2e `screens.spec.ts` : double-clic en haut de « Jouer » → menu ; `keyboard.down('Enter')` deux fois sur « Jouer » → menu ; double-clic sur « Retour » → titre et langue inchangée ; Entrée maintenue sur « Menu » en pause → menu ; unitaire `screen-keys.test.ts` : Entrée avec `repeat` → `block`.

### A-02 — Actions de l'issue hors de vue en paysage bas, focus posé sur un bouton invisible (majeur)

Reproduction : `?renderer=webgl&lang=fr&e2e=1&screen=level1`, fenêtre 844×390 (l'orientation que l'invite de rotation recommande sur téléphone), aller à la console, lancer, `advance(11)` (victoire). Le panneau d'issue montre 154 px de 377 px de contenu (`scrollTop/scrollHeight/clientHeight` = 0/377/154) ; « Rejouer le niveau » et « Menu » sont à y = 387 à 427, hors du panneau et hors de la fenêtre ; le focus est pourtant posé sur « Rejouer ». Mesures (`outc.mjs`, `overlap.mjs`, `shot1024.mjs`) :

| Fenêtre | Niveau | Boutons de l'issue |
| --- | --- | --- |
| 1024×600 | 1 | « Rejouer » à 385-425 pour un panneau 56-412 : coupé ; « Menu » coupé |
| 844×390 | 1 et 2 | tous deux sous le pli du panneau |
| 740×360 | 1 et 2 | tous deux sous le pli |
| 667×375 | 1 et 2 | tous deux sous le pli |
| 390×844 | 1 | sous le pli (déjà de la famille de K25 et K33) |

Captures de travail (hors dépôt) : `outcome-844x390.png`, `outcome-740x360.png`, `outcome-1024x600.png` dans le dossier temporaire ; on y lit le titre et le début du message, rien des boutons. Au clavier, le bandeau « R : réessayer » reste ; au toucher, le bouton « Action » relance, mais « Menu » n'est accessible qu'en faisant défiler le panneau ou par Pause puis Menu.

Cause probable : `src/ui/layout.ts:244` et `:358` (hauteur maximale du panneau = sol − barre du haut, contenu plus haut : défilement interne, boutons en fin de contenu) ; `src/ui/overlay.ts:607`, `outcomeButton.focus({ preventScroll: true })` empêche même de ramener le bouton focalisé dans la partie visible.

Correctif proposé : sortir les boutons de la zone qui défile (pied de panneau `position: sticky; bottom: 0` ou conteneur séparé) ; à défaut, `scrollIntoView({ block: 'nearest' })` du bouton dans le panneau au moment du focus.

Test de régression proposé : e2e à 1024×600, 844×390 et 740×360, niveaux 1 et 2, pour chaque issue : les rectangles de « Rejouer » et « Menu » sont entièrement dans le rectangle visible du panneau et dans la fenêtre, et `document.elementFromPoint` au centre de chacun renvoie le bouton.

### A-03 — Échap maintenue dans un niveau fait clignoter pause et reprise (mineur)

Reproduction (`keys1.mjs`, `esctuning.mjs`) : `?renderer=webgl&e2e=1&screen=level1`, maintenir Échap (`keyboard.down('Escape')` répété). Approche : `paused → approach → paused → approach → paused → approach`. Réglage : `tuning → approach → paused → approach → paused → approach` (la première frappe ferme le réglage, les répétitions basculent la pause). Au menu, la même touche maintenue reste sans effet après le retour au titre (garde `!event.repeat`, `src/ui/screens.ts:258`), ce qui confirme que `repeat` est bien transmis.

Cause : `src/ui/keys.ts:162-170`, Échap ignore `input.repeat` (R, E, Entrée et Espace le regardent, l. 139 et 194).

Correctif proposé : `if (code === 'Escape' && input.repeat) return 'block';` avant les autres règles d'Échap.

Test de régression proposé : `tests/ui/keys.test.ts` : Échap avec `repeat: true` → `block` dans chaque phase et avec l'aide ouverte.

### A-04 — Machine d'écrans : commande reçue pendant une notification, réponse fausse et commande périmée exécutée plus tard (mineur, latent)

Reproduction (`reentry.mjs`, mode e2e, écran titre) : un écouteur `focusin` posé sur `document` appelle, pendant la notification déclenchée par `play()` (le menu pose son focus au montage), `play()`, `leaveLevel()` et `openLevel('nope')`. Sortie :

```text
play() -> ok            (pendant la notification ; sera ignorée)
leaveLevel() -> ok      (pendant la notification ; reste en file)
openLevel(nope) -> ok   (identifiant invalide, répond pourtant ok)
openLevel(level1) -> ok
state after openLevel: {"screen":"menu","levelId":null} #ui=0 #screens=1
```

Le joueur qui choisit le niveau 1 est ramené aussitôt au menu par le `leaveLevel` mis en file bien avant. Aucun chemin de l'interface actuelle n'émet de commande synchrone pendant une notification : défaut latent de la machine pure, contraire à son contrat (résultat `ok`, `ignored` ou `invalid` fidèle à l'effet).

Cause : `src/app/screens.ts:59-60` n'exécute qu'une commande en attente par notification (si elle est ignorée, les suivantes restent dans `pending`) ; `:70-73` répond `ok` à toute commande mise en file.

Correctif proposé : vider la file à la fin de `notify` (boucle tant que `pending` n'est pas vide, en abandonnant les commandes devenues sans objet), et répondre `ignored` (ou un nouveau résultat `queued`) plutôt que `ok`.

Test de régression proposé : `tests/app/machine.test.ts` : un abonné appelle `play()` puis `leaveLevel()` à la première notification ; ensuite `openLevel('level1')` doit laisser l'état sur `level` ; et `openLevel('nope')` pendant une notification ne répond pas `ok`.

### A-05 — Focus du menu sur le dernier niveau joué même en venant du titre (mineur, écart à la spec)

Reproduction (`stale.mjs`) : niveau 2 → Menu → Retour → Jouer : le focus est sur « Niveau 2 : la mémoire ». La spec T-017 §4.4 demande « menu sur le premier niveau jouable, ou, au retour d'un niveau, sur l'entrée du niveau qu'on vient de quitter ». Conséquence avec A-01 : Entrée maintenue sur « Jouer » ouvre alors le niveau 2.

Cause : `src/main.ts:403`, `:434` et `:523` : `lastLevelId` n'est jamais oublié.

Correctif proposé : passer `focusLevelId` seulement si l'écran précédent est `level` (l'abonné reçoit déjà `previous`, `src/app/screens.ts:21`), ou remettre `lastLevelId` à `undefined` au montage du titre.

Test de régression proposé : e2e : niveau 2 → Menu → Retour → Jouer : focus sur « Niveau 1 ».

### A-06 — Annonces et libellés restés dans l'ancienne langue après la bascule (mineur)

Reproduction (`lang.mjs`, recherche dans tout le DOM des fragments propres au français des catalogues, après bascule vers l'anglais) : aucun mélange avant la bascule ; après :

- région `aria-live` du niveau : les 1 à 3 annonces déjà faites restent en français (« Prêt. Règle Kp… », « Lancement avec Kp = 2000 N/m… », « Moteur à fond ! … », « Jeu en pause. », « Réussi ! … ») dans un document passé en `lang="en"` ; mesuré dans chaque état des deux niveaux (réglage : 1 ligne ; trajet, pause, issue : 3) ;
- écran titre : la région d'annonce garde « Écran titre » ; si la bascule a lieu dans les 100 ms qui suivent le montage, l'annonce est même écrite dans l'ancienne langue (lu dans le source, non chronométré) ;
- canvas : `aria-label` reste « Scène du jeu : … » en français au titre et au menu (masqué par `aria-hidden`, donc sans effet pour un lecteur d'écran ; mis à jour dès l'entrée dans un niveau).

Le reste est juste partout : `<html lang>`, `document.title`, noms accessibles, textes du titre, du menu et des deux niveaux dans toutes les phases, aide ouverte comprise.

Cause : `src/ui/overlay.ts:440-447` (lignes d'annonce sans attribut `lang`, conservées à la bascule, `:729-731`) ; `src/ui/screens.ts:106-121` et `:162` (annonce écrite une fois) ; `src/main.ts:341` (libellé du canvas posé une fois).

Correctif proposé : à la bascule, vider les régions d'annonce (ou poser `lang` sur chaque ligne) et réécrire l'annonce d'écran dans la nouvelle langue ; abonner le libellé du canvas au traducteur dans `main.ts`.

Test de régression proposé : e2e de langue (`screens.spec.ts` (g)) étendu : après bascule, aucun fragment propre à l'autre langue dans `#ui`, `#screens` et les attributs `aria-label` du document.

### A-07 — Première image d'un niveau placée avec les ancres du niveau précédent (mineur, parent de K10)

Reproduction (`stale.mjs`) : niveau 2, trajet à 0,6 s, `leaveLevel()`, `openLevel('level1')`. La bulle d'ouverture est posée à `left: 157px; bottom: 611px` (position de la tête du bonhomme dans la cabine du niveau 2) au montage, et encore après la première image ; elle saute à `left: 12px; bottom: 357px` à l'image suivante. Le joueur voit donc la bulle à un endroit faux pendant une image à chaque entrée dans un niveau (à la toute première entrée, avec des ancres jamais calculées : lu dans le source, non mesuré).

Cause : un seul objet d'ancres par session (`src/render/session.ts:117`), passé tel quel au nouveau niveau (`src/main.ts:476`) ; la boucle met l'interface à jour avant de dessiner (`src/main.ts:379`), donc avec les ancres de l'image précédente, qui est celle de l'ancien niveau. K10 décrit le retard d'une image ; ici, il s'agit d'ancres d'un autre niveau.

Correctif proposé : calculer les ancres du nouveau niveau dès `attachLevel` (un `computeAnchors` sans dessin), ou dessiner une image (`renderNow(0)`) avant le premier `refreshUi` dans `mountLevel`.

Test de régression proposé : e2e : quitter le niveau 2 en trajet, ouvrir le niveau 1, lire le style de `.ui-bubble` sans attendre d'image : identique à celui obtenu après deux images.

### A-08 — Paysage bas : les étiquettes de la jauge recouvrent les boutons de la barre du haut (mineur, étend K36 à K38)

Reproduction (`overlap.mjs`, `hit.mjs`) : niveau 1 ou 2, recouvrements mesurés entre étiquettes visibles et boutons de la barre du haut (aucun à 1280×720 ni à 1024×600) :

| Fenêtre | Recouvrements |
| --- | --- |
| 844×390 | « 5000 N max » sur « ? » (38×19 px, niveau 1) ; sur « ? » et « English » (30×19 et 31×19 px, niveau 2) |
| 740×360 | « Force du moteur » ou « Force : … N » sur « ? » (30×18 px) ; « 5000 N max » sur « ? » et « English » |
| 667×375 | « Force … » sur « ? » (40×20 px) et « English » ; niveau 2 : « Terme intégral I » ou « I : 1406 N » sur « ? » (40×12 px) et « English » (39×12 px) |

À 740×360, le bouton « ? » est visuellement caché par les étiquettes (capture `outcome-740x360.png`) ; le clic l'atteint encore (`elementFromPoint` renvoie le bouton, l'aide s'ouvre). S'y ajoutent, plus légers, « e = 0,24 m » sur le panneau des mesures (92×9 px) et « poids » sur ce panneau (9×5 px).

Cause : `src/ui/layout.ts:337-341`, `force.y`, `iGauge.y` et `gaugeMax.y` ne sont pas bornés par la barre du haut (`TOP_BAR`, l. 112) ni par la zone des boutons.

Correctif proposé : borner ces ordonnées à `TOP_BAR` plus la hauteur d'une étiquette, ou décaler les étiquettes à gauche de la zone des boutons quand elles l'atteindraient.

Test de régression proposé : étendre le test sans recouvrement de `level2.spec.ts` (g) à 844×390, 740×360 et 667×375, pour les deux niveaux.

### A-09 — Titre et menu très bas : haut de la carte rogné et inaccessible (mineur, cas rare)

Reproduction (`resize.mjs`, `lowh.mjs`) : écran titre à 1280×300 : haut de la carte à −10 px (marge intérieure seulement) ; à 800×200 : carte du titre à −60 px, `<h1>` en partie hors de l'écran, et `scrollTop` ne peut pas descendre sous 0 ; menu à 800×200 : carte à −41 px. Aux tailles de téléphone en paysage (844×390, 844×340, 667×375, 667×320, 568×320), le haut reste visible et le défilement fonctionne : seul le cas des hauteurs d'environ 300 px et moins est touché.

Cause : `src/ui/screens.css:7-19`, `justify-content: center` sur un conteneur flex en `overflow-y: auto` : le débordement par le haut ne peut pas défiler.

Correctif proposé : `justify-content: safe center`, ou `margin-block: auto` sur la carte.

Test de régression proposé : e2e à 800×200 : après `scrollTop = 0`, le haut de la carte est ≥ 0.

### A-10 — `stats()` du crochet de test cumule les rendus hors boucle (mineur, outil de test)

Reproduction (`stats.mjs`, mode e2e, niveau 1) :

| Mesure | Appels de dessin / triangles |
| --- | --- |
| boucle seule | 4 / 2641 |
| un `advance` dans la même tâche | 8 / 5282 |
| trois `advance` dans la même tâche | 20 / 13205 |
| papier seul, boucle | 2 / 3 ; après un `advance` : 4 / 6 |

La documentation dit « Compteurs de la dernière image dessinée » (`src/main.ts:97`, `src/render/session.ts:23` et `:64`) ; ce sont les compteurs depuis la dernière image de la boucle, et `renderNow` s'y ajoute.

Cause : `src/render/session.ts:166-167` lit `renderer.info.render`, que three ne remet à zéro que dans sa boucle d'animation (`node_modules/three/src/renderers/common/Animation.js:83`).

Impact : les e2e qui lisent `stats()` (`screens.spec.ts:236`, `ui.spec.ts:780`, `level.spec.ts:297-302`, seuils de 50 appels et 30 000 triangles) dépendent du nombre d'images écoulées ; ils passent parce qu'ils attendent deux images avant de lire.

Correctif proposé : `renderer.info.reset()` au début de `renderNow`, ou relever les compteurs juste après chaque dessin.

Test de régression proposé : e2e : trois `advance` dans la même tâche, puis `stats()` égal aux compteurs d'une seule image.

## 3. Attaques sans défaut

| Attaque | Ce qui a été fait | Mesures |
| --- | --- | --- |
| 1. Enchaînements, temps réel | 30 cycles titre → menu → niveau (1 et 2 en alternance) → marche → Échap → « Menu » → « Retour », souris et clavier (`cycles.mjs real 30`) | console vide ; au titre : `#ui` 0, `#screens` 1, 25 éléments, nœuds CDP 49 ou 50 (annonce en attente ou écrite), écouteurs de `document`, `window` et du canvas identiques au départ (15 entrées), `setTimeout` en attente 0 ou 1 (l'annonce de 100 ms), rAF 1, `ResizeObserver` 1 cible ; objets GPU identiques au départ (Buffer 7, Texture 2, Program 2, VertexArray 2, Framebuffer 1, Shader 4) |
| 1. Enchaînements, mode e2e | 40 cycles par `__huygens.app`, puis 300 cycles (`cycles.mjs e2e 40`, `longheap.mjs 300`) | mêmes nombres ; tas 4,74 Mo → 6,15 Mo (100 cycles) → 6,53 Mo (300 cycles), croissance décroissante |
| 1. Mémoire | instantanés de tas après 60 puis 160 cycles, différence par constructeur (`heapdiff.mjs`) | aucune croissance d'objet ni de fermeture JS ; la croissance est du code compilé par V8 (+990 entrées, 283 ko) et des entrées `PerformanceLongAnimationFrameTiming` du navigateur (+122) : pas une fuite de l'application |
| 1. Dans le niveau | 12 cycles réels avec Pause, aide ouverte, Échap, Menu (`inlevel.mjs`) | à chaque entrée : `#ui` 1, `#screens` 0, 98 éléments (niveau 1) ou 101 (niveau 2), un seul écouteur `keydown` sur `document` et sur `window`, un `blur`, un `visibilitychange`, un clic canvas, 2 cibles `ResizeObserver`, aide fermée, région `aria-live` vide |
| 2. Ressources GPU | 50 `detachLevel` et `attachLevel`, 30 changements de niveau, 20 cycles avec trajets saturés et chocs puis 5 rejouer chacun (`gpu.mjs`, `gpu2.mjs`) | niveau attaché : Buffer 13 (19 après un trajet), Program 3, VertexArray 4 (6) ; détaché ou au menu : retour exact à 7, 2 et 2 ; aucune croissance ; `view.dispose()` libère ce que la vue a créé ; `stage.dispose()` et `disposeRenderer` libèrent tout sauf le framebuffer par défaut (vu après échec) |
| 3. Quitter en cours de route | `leaveLevel()` en approche, réglage, réglage modifié, trajet, pause, issue, issue après rejouer, aux deux niveaux, puis réentrée (`leave.mjs`) ; temps réel : pause puis Menu en plein trajet (`blur.mjs`) | toujours : phase `approach`, Kp 2000 (niveau 1) ou Kp 2500 et Ki 2000 (niveau 2), tentative 1, k = 0, t = 0, cabine à 0, bonhomme à −5,5 m, tracé vide, `iTerm` 0, issue `null`, panneaux et pause effacés, région `aria-live` vide |
| 3. Touche maintenue, Échap rapide au menu | Entrée maintenue sur « Rejouer » ; Échap maintenue au menu | « Rejouer » : un seul redémarrage (tentative 2, répétitions bloquées) ; menu : retour au titre une fois, répétitions sans effet |
| 3. Tactile | ▶ maintenu par `Input.dispatchTouchEvent`, `leaveLevel()` pendant l'appui, relâché au menu (`touch.mjs`) | aucune erreur ; réentrée : bonhomme immobile à −5,5 m |
| 4. Langue | bascule au titre, puis menu ; dans chaque phase des deux niveaux ; aide ouverte ; puis retour au menu (`lang.mjs`) | `<html lang>`, `document.title`, textes et noms accessibles justes partout, hors régions d'annonce (A-06) |
| 4. Perte de focus | `visibilitychange` (état `hidden` simulé) et `blur` de la fenêtre en plein trajet temps réel, puis Menu, puis `blur` et `visibilitychange` au menu (`blur.mjs`) | pause immédiate, temps figé à 1,2 s ; aucun effet ni erreur au menu ; réentrée neuve |
| 4. Aide ouverte et Menu | pause, aide ouverte, bascule de langue, clic sur « Menu » | le clic est sans effet tant que l'aide est ouverte : comportement voulu par K24 (`commandsBlocked`), non compté comme défaut ; on pourrait masquer ou désactiver ce bouton pendant l'aide |
| 5. Rejouer | 20 rejouer par cas, en alternant R, « Rejouer » et « Recommencer » en plein trajet : niveau 1 Kp 2000 (victoire), 8000 (choc), 500 (trop court) ; niveau 2 Ki 2000 (choc), 0 (trop court), 500 (victoire) (`replay.mjs`) | issues constantes ; tentatives 2 à 21 ; après chaque rejouer : phase `tuning`, tracé 0, `iTerm` 0, k 0 ; région `aria-live` plafonnée à 3 lignes ; 107 éléments (niveau 1) ou 110 (niveau 2) à chaque fois ; focus sur le curseur ; objets GPU constants |
| 6. Redimensionnement | titre, menu, approche, réglage, trajet, pause, issue, aide, aux deux niveaux, sur la suite 1280×720, 390×844 (deux fois), 320×480, 2560×1440, 1280×300, 240×800, 800×200, 1280×720 (`resize.mjs`) ; 60 bascules portrait et paysage ; 100×60, 10×10, 1×1, 60×400 (`tiny.mjs`) | aucun `NaN` ni `Infinity` dans les styles ; aucun panneau du niveau hors de l'écran ; la page ne défile jamais ; `ResizeObserver` du niveau retiré à la sortie (2 cibles dans le niveau, 1 au menu) ; écarts relevés : A-02, A-08, A-09 |
| 6. Stress | 400 bascules de langue et 60 bascules d'orientation dans un niveau 2 en trajet (`stress.mjs`) | éléments 106 → 103 (annonces plafonnées), écouteurs 22 constants, `ResizeObserver` 2 |
| 7. Échecs | perte de contexte (`WEBGL_lose_context`) au titre, au menu, en plein trajet temps réel, en pause, aide ouverte ; `crashNextFrame` au titre, au menu, aux deux niveaux, à l'issue, et par `advance` ; `?renderer=none` avec `lang=en` et `lang=fr`, `?renderer=webgl&lang=en`, renderer automatique (`failure.mjs`) | à chaque échec : une seule page `#fallback` du bon type (`context-lost` ou `error`), traduite, `#ui` et `#screens` retirés, canvas masqué, focus sur `body`, plus aucun écouteur du niveau ni des écrans, rAF 0, `ResizeObserver` 0, minuteries 0, objets GPU libérés ; console : une seule erreur attendue (`context-lost` ou `panne simulée`) ; frappes après l'échec sans effet ; repli `none` traduit, sans titre |
| 8. Clavier | Tab et Maj+Tab sur le titre, le menu et chaque phase du niveau 1 (`tab.mjs`) ; balayage de 19 touches au titre et au menu, focus sur `body`, avec relevé de `defaultPrevented` (`keysweep.mjs`) | le focus ne tombe jamais sur un élément masqué ou désactivé ; au titre, aucune touche n'est bloquée ; au menu, seules ↑, ↓ et Échap le sont ; aucune touche du niveau n'agit au titre ou au menu (aucun écouteur `keydown` de niveau hors niveau) ; une seule frappe d'Entrée sur « Jouer » ou « Menu » ne fait qu'un changement d'écran. Tabuler au-delà du dernier contrôle pendant un trajet met en pause (perte de focus de la fenêtre) : comportement voulu |
| 9. Lecture du code | état global, `Map` et `Set`, fermetures, courses entre `destroy` et rappels | seul état de module mutable hors noyau : le cache borné de `Intl.NumberFormat` (`src/i18n/format.ts:37`) ; niveaux, vues, peintres et files d'événements créés à chaque entrée ; `Ui.update` gardé par `destroyed` (rappels `blur` et `lostpointercapture` après `destroy` sans effet) ; `unmountCurrent` et `handleFailure` idempotents ; défauts trouvés : A-04, A-05, A-07, A-10 |

## 4. Non exécuté

- WebGPU réel (le Chromium de Playwright n'a pas d'adaptateur : « No available adapters », repli WebGL2) ; chemin `device.lost` non exercé (K8).
- Vraie répétition matérielle du clavier, vrai changement d'onglet et vrai écran tactile : émulés (CDP `autoRepeat`, `visibilityState` redéfini avec `visibilitychange` envoyé à la main, `Input.dispatchTouchEvent`, `hasTouch`).
- Restauration du contexte (`webglcontextrestored`) : non prévue par le code (page de repli, rechargement), non essayée.
- Lecteur d'écran réel ; Firefox et Safari.
- MATLAB : hors du périmètre de cette partie (aucun changement du noyau examiné ici).

## 5. État final du dépôt

Les PNG réécrits par l'e2e ont été restaurés (`git checkout -- docs/img`) ; aucun fichier jetable dans le dépôt ; serveur de prévisualisation arrêté. `git status --short` après l'écriture de ce rapport :

```text
?? docs/validation/V-v0.2-A-cycle-de-vie.md
```
