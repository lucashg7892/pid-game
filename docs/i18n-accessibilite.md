# Internationalisation et accessibilité

À quoi sert cette page : décrire le module de traduction FR/EN (`src/i18n`, validé en T-006 et complété en T-010) et la façon d'ajouter une clé ou une langue. La seconde partie décrit l'accessibilité réalisée et testée en T-010. État au commit `566a8a3`.

## Partie 1 — i18n (validé, T-006)

### Vue d'ensemble

Le module est pur : il n'importe que lui-même (règle `i18n-is-pure` de dependency-cruiser) et n'utilise aucune bibliothèque externe ([ADR-007](decisions/ADR-007-i18n-maison.md)). Il ne touche pas au DOM : l'appelant lui passe `location.search` et `navigator.languages`.

Il est branché depuis T-010 : `src/main.ts` crée le traducteur avec `detectLocale(location.search, navigator.languages)`, écrit `<html lang>` et le titre du document, et le passe à l'interface (`src/ui`), qui affiche tous les textes et propose le bouton de langue (voir [interface.md](interface.md#langue)).

| Fichier | Rôle |
|---|---|
| `src/i18n/locales/fr.json`, `en.json` | textes, un objet JSON plat par langue |
| `src/i18n/catalogs.ts` | langues prises en charge, type des clés, catalogues |
| `src/i18n/params.ts` | paramètres attendus par clé, pour le typage |
| `src/i18n/interpolate.ts` | remplacement des `{nom}` et erreurs |
| `src/i18n/format.ts` | formatage des nombres et des unités |
| `src/i18n/detect.ts` | choix de la langue initiale |
| `src/i18n/translator.ts` | traducteur avec langue courante et abonnés |
| `src/i18n/index.ts` | point d'entrée public |

### Structure des locales

- Un fichier JSON plat par langue : `{ "clé": "texte", … }`, sans imbrication.
- 111 clés par langue, les mêmes dans les deux fichiers (comptage par script au commit `566a8a3` ; parité vérifiée par `tests/i18n/catalogs.test.ts`). T-006 en avait créé 89 ; T-010 en a ajouté 22 (liste plus bas).
- Fins de ligne LF, aucune clé dupliquée, aucune valeur vide (tests).

### Convention de clés

Forme imposée par le test « clés en points, segments en camelCase, préfixe connu » :

```text
^[a-z][a-z0-9]*(\.[a-z][A-Za-z0-9]*)+$
```

Exemples : `level1.fail.noLift`, `hud.status.win`. Aucune clé n'est le préfixe d'une autre (`level1` et `level1.title` ne peuvent pas coexister), pour permettre un passage futur à du JSON imbriqué.

| Préfixe | Usage | Clés |
|---|---|---|
| `app.` | titre, chargement, langue, erreurs générales, invite de rotation | 10 |
| `level1.` | textes du niveau 1 : objectif, Kp, échecs, victoire | 25 |
| `hud.` | courbes, légende, valeurs affichées, messages d'état, bandeau d'aide, étiquette de Kp | 38 |
| `controls.` | boutons, aide des commandes, noms des touches | 24 |
| `a11y.` | noms accessibles et descriptions pour lecteurs d'écran | 7 |
| `fallback.` | page affichée sans WebGPU ni WebGL2 | 7 |

Un texte identique en FR et en EN est suspect (oubli de traduction). Seules cinq clés y ont droit, avec une raison écrite dans le test : `controls.pause`, `controls.action`, `level1.dimension`, `app.title`, `hud.kp.value`.

Titre du jeu : `app.title` vaut « Huygens’s world » dans les deux langues (apostrophe typographique U+2019), titre provisoire décidé par l'utilisateur en hommage à Christiaan Huygens (décision D15). T-006 avait proposé « PID au crayon » / « Pencil PID » ; T-010 l'a remplacé.

### Clés ajoutées par T-010

| Clé | Français | Anglais |
|---|---|---|
| `app.rotateHint` | Tourne ton appareil en paysage pour mieux voir la scène. | Turn your device sideways for a bigger view of the scene. |
| `hud.kp.value` | Kp = {kp} N/m | Kp = {kp} N/m |
| `hud.hint.label` | Que faire maintenant | What to do now |
| `hud.hint.item` | {keys} : {action} | {keys}: {action} |
| `hud.hint.or` | ou | or |
| `hud.hint.walk` | avancer vers la console | walk to the console |
| `hud.hint.use` | utiliser la console | use the console |
| `hud.hint.tune` | régler Kp | set Kp |
| `hud.hint.tuneBig` | pas de 1000 | steps of 1000 |
| `hud.hint.launch` | lancer | launch |
| `hud.hint.locked` | Kp est verrouillé | Kp is locked |
| `hud.hint.restart` | recommencer | restart |
| `hud.hint.pause` | mettre en pause | pause |
| `hud.hint.retry` | réessayer | try again |
| `hud.hint.resume` | reprendre | resume |
| `hud.hint.closeHelp` | fermer l’aide | close the help |
| `hud.readout.label` | Mesures du trajet | Trip readings |
| `controls.help.close` | Fermer l’aide | Close the help |
| `controls.key.enter` | Entrée | Enter |
| `controls.key.escape` | Échap | Esc |
| `controls.key.pageUp` | Page préc. | Page Up |
| `controls.key.pageDown` | Page suiv. | Page Down |

Dans `hud.hint.item`, l'espace avant « : » est U+00A0 en français. Aucune clé n'a été supprimée ; seule `app.title` a changé de valeur.

### Interpolation

Un texte peut contenir des paramètres `{nom}`, où `nom` suit `[A-Za-z_][A-Za-z0-9_]*`. `{{` et `}}` produisent des accolades littérales.

L'interpolation est stricte : chaque cas douteux lève `I18nError` (nom de classe `'I18nError'`, hérite de `Error`). Un `{e}` brut n'est jamais montré au joueur.

| Situation | Résultat |
|---|---|
| paramètre manquant | `I18nError` « paramètre manquant » (une propriété héritée du prototype ne compte pas) |
| paramètre en trop | `I18nError` « paramètre(s) en trop » : attrape les fautes de frappe |
| valeur qui n'est pas une chaîne | `I18nError` : le nombre doit être formaté avant |
| accolade ouvrante non fermée, accolade fermante isolée | `I18nError` |
| nom invalide entre accolades (`{1x}`, `{}`) | `I18nError` |
| valeur insérée contenant `{x}` | insérée telle quelle, jamais réinterprétée |

Les messages d'erreur citent la clé d'origine quand elle est connue.

**Contrat pour l'appelant** : les paramètres sont des chaînes **déjà formatées** par `formatNumber` ou `formatQuantity`, pour respecter la virgule décimale du français. `level1.formula` reçoit l'erreur théorique m·g/Kp ; `level1.dimension` reçoit la cote mesurée (log T-006).

### Typage des clés et des paramètres

- `MessageKey` est dérivé de `fr.json` (`keyof typeof fr`). Une clé absente du français ne compile pas.
- Le catalogue anglais est typé `Catalog` contre le français : une clé manquante en anglais ne compile pas.
- `MESSAGE_PARAMS` liste les paramètres de chaque clé qui en a (15 clés : T-010 a ajouté `hud.kp.value` et `hud.hint.item`). Un test vérifie que cette table correspond exactement aux `{…}` des deux catalogues.
- `t` a deux surcharges :

```ts
t(key: PlainKey): string;
t<K extends ParameterizedKey>(key: K, params: MessageParams<K>): string;
```

Un paramètre oublié, en trop ou mal nommé est donc refusé à la compilation. À l'exécution (appel non typé, depuis du JavaScript), la même faute lève `I18nError`.

### Détection de la langue

`detectLocale(search, preferred)` applique trois règles dans l'ordre :

1. Paramètre d'URL `?lang=` : premier paramètre `lang`, casse et région ignorées (`?lang=FR`, `?lang=fr-BE` → `fr`). Une valeur non prise en charge ou vide est ignorée. Le nom du paramètre est sensible à la casse (`?LANG=` est ignoré).
2. Sinon, la première langue de `preferred` dont la sous-étiquette principale est prise en charge : `['fr-CA', 'en']` → `fr`, `['de', 'fr']` → `fr`.
3. Sinon `DEFAULT_LOCALE`, soit `en`.

`matchLocale` compare la sous-étiquette entière, pas un préfixe de caractères : `frr` (frison septentrional) n'est pas du français.

Écart avec la spec §8, qui parle de `navigator.language` (une seule langue) : le code parcourt toute la liste `navigator.languages`. Un navigateur réglé sur `['de', 'fr']` obtient donc le français, là où la spec donnerait l'anglais.

### Formatage des nombres et des unités

`formatNumber(locale, value, options)` et `formatQuantity(locale, value, unit, options)` s'appuient sur `Intl.NumberFormat`, avec des formateurs mis en cache.

| Règle | Français | Anglais |
|---|---|---|
| séparateur décimal | `0,2` | `0.2` |
| décimales par défaut | minimum 0, maximum max(minimum, 2), arrondi au plus proche, zéros finaux retirés | idem |
| groupement des milliers | seulement à partir de 5 chiffres entiers : `5000`, `12 345` (espace U+202F) | `5000`, `12,345` |
| signe moins | U+002D (celui d'ICU avec Node 22) | U+002D |
| zéro négatif, négatif arrondi à zéro | `0`, jamais `-0` | idem |
| nombre et unité | séparés par U+00A0 : `0,2 m` | U+00A0 : `0.2 m` |
| pour cent | `12,5 %` (U+00A0) | `12.5%` (collé) |

Unités disponibles (`Unit`) : `m`, `N`, `N/m`, `s`, `%`.

Erreurs : `RangeError` si la valeur n'est pas finie (NaN et ±Infinity ne sont jamais affichés) ou si les décimales ne sont pas des entiers de 0 à 20 avec minimum ≤ maximum.

### Règles typographiques des textes

Vérifiées par `tests/i18n/catalogs.test.ts` sur chaque valeur des deux catalogues.

| Règle | Point de code | Langue |
|---|---|---|
| apostrophe typographique, jamais l'apostrophe droite U+0027 | U+2019 | FR, EN |
| points de suspension en un caractère, jamais `...` | U+2026 | FR, EN |
| pas de double espace | — | FR, EN |
| espace fine insécable avant `;` `!` `?` | U+202F (`NNBSP`) | FR |
| espace insécable avant `:` | U+00A0 (`NBSP`) | FR |
| aucune espace avant `:` `;` `!` `?` | — | EN |
| espace insécable entre un nombre (ou `{param}`) et son unité `m`, `N`, `s` | U+00A0 | FR, EN |

### Traducteur

`createTranslator(initial, catalogs = CATALOGS)` renvoie un `Translator` :

| Membre | Rôle | Erreurs |
|---|---|---|
| `locale` | langue courante | — |
| `t(key)`, `t(key, params)` | texte dans la langue courante | `I18nError` : clé inconnue, paramètre manquant ou en trop |
| `setLocale(locale)` | change la langue ; renvoie vrai si elle a changé ; notifie chaque abonné une fois | `RangeError` : langue non prise en charge ; `AggregateError` si des abonnés ont levé (tous sont appelés, la langue reste changée) |
| `subscribe(listener)` | abonne une fonction `(locale, previous) => void` ; renvoie la fonction de désabonnement, idempotente | — |
| `formatNumber`, `formatQuantity` | formatage dans la langue courante | comme les fonctions libres |

Détails : une même fonction n'est abonnée qu'une fois ; un abonnement ou désabonnement pendant une notification prend effet à la suivante ; la langue est déjà changée quand l'abonné est appelé.

`createTranslator` lève `RangeError` si la langue initiale n'est pas prise en charge. Le paramètre `catalogs` sert aux tests.

### Exports de `src/i18n/index.ts`

Liste complète au commit `c00e678`, inchangée à `566a8a3` : 18 valeurs (dont la classe `I18nError`) et 12 types.

| Nom | Nature | Rôle |
|---|---|---|
| `SUPPORTED_LOCALES` | constante | `['fr', 'en']` |
| `DEFAULT_LOCALE` | constante | `'en'` |
| `CATALOGS` | constante | catalogues de toutes les langues |
| `MESSAGE_PARAMS` | constante | paramètres attendus par clé |
| `NBSP` | constante | U+00A0 |
| `NNBSP` | constante | U+202F |
| `isLocale` | fonction | `(value) → value is Locale`, comparaison exacte, sensible à la casse |
| `isMessageKey` | fonction | `(value) → value is MessageKey` |
| `matchLocale` | fonction | `(tag) → Locale \| undefined`, sous-étiquette principale |
| `otherLocale` | fonction | `(locale) → Locale`, l'autre langue (bascule FR ⇄ EN) |
| `detectLocale` | fonction | `(search, preferred) → Locale` |
| `parseTemplate` | fonction | `(template, context?) → TemplatePart[]` ; `I18nError` si mal formé |
| `placeholdersOf` | fonction | `(template) → string[]`, noms sans doublon ; `I18nError` si mal formé |
| `interpolate` | fonction | `(template, params?, context?) → string` ; `I18nError` (voir plus haut) |
| `formatNumber` | fonction | `(locale, value, options?) → string` ; `RangeError` |
| `formatQuantity` | fonction | `(locale, value, unit, options?) → string` ; `RangeError` |
| `createTranslator` | fabrique | `(initial, catalogs?) → Translator` ; `RangeError` |
| `I18nError` | classe | erreur de l'i18n |
| `Locale` | type | `'fr' \| 'en'` |
| `MessageKey` | type | clé du catalogue français |
| `Catalog` | type | un texte par clé |
| `PlainKey` | type | clés sans paramètre |
| `ParameterizedKey` | type | clés avec paramètres |
| `ParamName` | type | noms des paramètres d'une clé |
| `MessageParams` | type | objet de paramètres d'une clé, valeurs `string` |
| `TemplatePart` | type | morceau de gabarit : texte ou paramètre |
| `NumberFormatOptions` | type | `minimumFractionDigits`, `maximumFractionDigits` |
| `Unit` | type | `'m' \| 'N' \| 'N/m' \| 's' \| '%'` |
| `Translator` | type | traducteur |
| `LocaleListener` | type | `(locale, previous) => void` |

### Ajouter une clé

1. Choisir un nom conforme à la convention, sous un préfixe existant. Un nouveau préfixe doit aussi être ajouté à la liste `PREFIXES` de `tests/i18n/catalogs.test.ts`.
2. Ajouter la clé dans `src/i18n/locales/fr.json` **et** `en.json`.
3. Si le texte contient des `{nom}`, ajouter la clé et ses paramètres dans `MESSAGE_PARAMS` (`src/i18n/params.ts`), dans les deux langues avec les mêmes noms.
4. Respecter la typographie du tableau ci-dessus. Les espaces insécables sont des caractères réels dans le JSON. Pour écrire ces fichiers par script dans le shell de la VM, passer par Python : un heredoc convertit les échappements `\u…` (leçon L6 du registre).
5. Si le texte est identique dans les deux langues, l'ajouter à `IDENTICAL_ALLOWED` du test avec sa raison.
6. Lancer `npm run typecheck` puis `npm run test`.

### Ajouter une langue

Le code suppose aujourd'hui deux langues. Étapes :

1. Ajouter l'étiquette BCP 47 à `SUPPORTED_LOCALES` (`src/i18n/catalogs.ts`).
2. Créer `src/i18n/locales/<langue>.json` avec les 111 clés, l'importer dans `catalogs.ts`, le typer `Catalog` et l'ajouter à `CATALOGS`.
3. Revoir `otherLocale` : il renvoie l'autre langue d'une paire. Avec trois langues, la bascule doit devenir un choix.
4. Revoir `formatQuantity` : le collage de `%` est codé pour l'anglais seulement.
5. Ajouter les règles typographiques de la langue dans `tests/i18n/catalogs.test.ts` (les tests actuels traitent FR et EN nommément).
6. Ajouter des cas dans `tests/i18n/detect.test.ts` et `format.test.ts`.
7. Lancer `npm run check`.

## Partie 2 — Accessibilité (validé, T-010)

Réalisée en T-010 (`src/ui`), testée par les scénarios e2e (d), (e) et (f) de `tests/e2e/ui.spec.ts`, en français et en anglais. Les tests e2e sont exécutés par l'orchestrateur, pas par le rédacteur : 28 tests verts à `566a8a3` (log T-010 ; voir [tests.md](tests.md#tests-de-bout-en-bout-playwright)).

| Exigence de la spec §8 | Réalisation | Preuve |
|---|---|---|
| clavier : tout le niveau jouable sans souris | marche, console, réglage, lancement, pause, recommencer au clavier ; table des touches dans [interface.md](interface.md#touches) | e2e (a) FR et (b) EN au clavier réel, jusqu'à la victoire et au choc |
| ordre de tabulation logique, focus visible (contour 3 px) | seuls des contrôles prennent le focus ; le cycle revient au bouton « ? » ; contour `solid 3px` | e2e (d) |
| noms accessibles | boutons, curseur (`slider`), champ (`spinbutton`), panneau (`group`), canvas (`img`) nommés par les clés traduites | e2e (d), FR et EN |
| lecteurs d'écran | région `aria-live="polite"` unique : réglage, lancement, première saturation (une fois par trajet), issue avec la valeur de e, pause, reprise, recommencer | e2e (d) ; `tests/ui/announce.test.ts` |
| aucune touche ne fait défiler la page | toutes les touches du jeu et ↑ ↓ Début Fin Espace Entrée sont interceptées quand le focus est sur la page | e2e (e) |
| perte de focus | marche arrêtée ; pause automatique pendant un trajet, pas en approche | e2e (f) et (f bis) |
| couleurs : motif en plus de la teinte | consigne en pointillés, hauteur en trait plein, erreur hachurée ; seul le rouge de la jauge saturée est une couleur | captures ; [rendu.md](rendu.md#courbe-yt) |
| contrastes ≥ 4,5:1 | texte ≈ 14:1, secondaire ≈ 9:1, rouge ≈ 7:1, déclarés dans `src/ui/ui.css` | **non mesuré par un test** |
| mouvement réduit | « boiling » figé (`prefers-reduced-motion`), transitions CSS supprimées ; il n'y a pas de secousse de caméra | `tests/render/noise.test.ts`, `level-painter.test.ts` ; non testé en e2e |
| sans WebGPU ni WebGL2 | page de repli statique traduite, sans exception | e2e `?renderer=none` (FR, EN) |
| langue | bouton avec l'attribut `lang` de l'autre langue ; `<html lang>` mis à jour ; Kp et phase conservés | e2e (c) |
| tactile | boutons ◀ ▶ « Action » de 56 × 56 px (spec : ≥ 44 × 44) sur écran à pointeur grossier | **non essayé sur un vrai écran tactile** (log T-010) |

Rendu de U+202F dans la police manuscrite : Patrick Hand couvre la plage U+2000-206F (`unicode-range` du sous-ensemble latin, `src/ui/ui.css`). Le rendu effectif n'a pas été vérifié par un test.

Détails de l'interface : [interface.md](interface.md).
