# Internationalisation et accessibilité

À quoi sert cette page : décrire le module de traduction FR/EN (`src/i18n`, validé en T-006) et la façon d'ajouter une clé ou une langue. La seconde partie résume l'accessibilité prévue par la spec T-001 §8 ; elle n'est pas encore réalisée.

## Partie 1 — i18n (validé, T-006)

### Vue d'ensemble

Le module est pur : il n'importe que lui-même (règle `i18n-is-pure` de dependency-cruiser) et n'utilise aucune bibliothèque externe ([ADR-007](decisions/ADR-007-i18n-maison.md)). Il ne touche pas au DOM : l'appelant lui passe `location.search` et `navigator.languages`.

Il n'est encore branché nulle part. `src/main.ts` ne l'importe pas : bouton de langue, mise à jour de `<html lang>` et affichage des textes sont Prévu (T-010).

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
- 89 clés par langue, les mêmes dans les deux fichiers (comptage par script au commit `c00e678` ; parité vérifiée par `tests/i18n/catalogs.test.ts`).
- Fins de ligne LF, aucune clé dupliquée, aucune valeur vide (tests).

### Convention de clés

Forme imposée par le test « clés en points, segments en camelCase, préfixe connu » :

```text
^[a-z][a-z0-9]*(\.[a-z][A-Za-z0-9]*)+$
```

Exemples : `level1.fail.noLift`, `hud.status.win`. Aucune clé n'est le préfixe d'une autre (`level1` et `level1.title` ne peuvent pas coexister), pour permettre un passage futur à du JSON imbriqué.

| Préfixe | Usage | Clés |
|---|---|---|
| `app.` | titre, chargement, langue, erreurs générales | 9 |
| `level1.` | textes du niveau 1 : objectif, Kp, échecs, victoire | 25 |
| `hud.` | courbes, légende, valeurs affichées, messages d'état | 22 |
| `controls.` | boutons et aide des commandes | 19 |
| `a11y.` | noms accessibles et descriptions pour lecteurs d'écran | 7 |
| `fallback.` | page affichée sans WebGPU ni WebGL2 | 7 |

Un texte identique en FR et en EN est suspect (oubli de traduction). Seules trois clés y ont droit, avec une raison écrite dans le test : `controls.pause`, `controls.action`, `level1.dimension`.

Titre du jeu proposé dans `app.title` : « PID au crayon » / « Pencil PID ». Ce titre attend une décision de l'utilisateur (log T-006).

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
- `MESSAGE_PARAMS` liste les paramètres de chaque clé qui en a (13 clés). Un test vérifie que cette table correspond exactement aux `{…}` des deux catalogues.
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

Liste complète au commit `c00e678` : 18 valeurs (dont la classe `I18nError`) et 12 types.

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
2. Créer `src/i18n/locales/<langue>.json` avec les 89 clés, l'importer dans `catalogs.ts`, le typer `Catalog` et l'ajouter à `CATALOGS`.
3. Revoir `otherLocale` : il renvoie l'autre langue d'une paire. Avec trois langues, la bascule doit devenir un choix.
4. Revoir `formatQuantity` : le collage de `%` est codé pour l'anglais seulement.
5. Ajouter les règles typographiques de la langue dans `tests/i18n/catalogs.test.ts` (les tests actuels traitent FR et EN nommément).
6. Ajouter des cas dans `tests/i18n/detect.test.ts` et `format.test.ts`.
7. Lancer `npm run check`.

## Partie 2 — Accessibilité : Prévu (T-010)

Rien de ce qui suit n'est réalisé. Résumé de la spec T-001 §8 ; les textes nécessaires existent déjà sous le préfixe `a11y.` et dans `controls.`.

| Exigence | Détail prévu |
|---|---|
| clavier | tout le niveau jouable sans souris ; ordre de tabulation logique ; focus visible (contour 3 px) |
| contrastes | textes et contrôles DOM ≥ 4,5:1 (WCAG AA) sur le papier |
| couleurs | les courbes se distinguent aussi par le motif : plein (y), pointillé (r), hachures (e) |
| lecteurs d'écran | région `aria-live="polite"` : lancement, saturation (une fois par trajet), issue, valeur de e ; canvas `role="img"` avec `aria-label` traduit |
| mouvement réduit | avec `prefers-reduced-motion` : pas d'effet « boiling », pas de secousse caméra, transitions instantanées |
| sans WebGPU ni WebGL2 | page HTML statique traduite (clés `fallback.`), aucune exception non gérée ; test e2e avec `?renderer=none` |
| langue | bouton de bascule avec attribut `lang` ; `<html lang>` mis à jour (log T-006) |
| tactile | boutons ◀ ▶ « Action » d'au moins 44 × 44 px CSS (spec §6) |

Point à vérifier en T-010 : le rendu de U+202F dans la police manuscrite retenue (log T-006).
