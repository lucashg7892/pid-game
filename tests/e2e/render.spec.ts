/**
 * Rendu en navigateur réel (T-008, réserve E9 de T-002) : démarrage WebGL2, papier réellement
 * dessiné et aligné sur le cadrage, page de repli traduite, redimensionnement, mode automatique.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { computeFrame, worldXToPixel, worldYToPixel, type Frame } from '../../src/render/camera';
import { decodePng, luma, pixelAt, type DecodedPng, type Rgb } from './png';

/**
 * Textes de repli lus directement dans les locales : le chargeur ESM de Playwright refuse
 * l'import JSON sans attribut `type: json` utilisé par src/i18n (prévu pour Vite).
 */
function fallbackTexts(lang: 'fr' | 'en'): { title: string; explanation: string; docs: string } {
  const catalog = JSON.parse(
    readFileSync(new URL(`../../src/i18n/locales/${lang}.json`, import.meta.url), 'utf8'),
  ) as Record<string, string | undefined>;
  return {
    title: catalog['fallback.title'] ?? '',
    explanation: catalog['fallback.explanation'] ?? '',
    docs: catalog['fallback.docs'] ?? '',
  };
}

/**
 * Avertissement de Chrome « GPU stall due to ReadPixels » en WebGL sur SwiftShader.
 * Établi (source de three 0.187 lue, T-008b) : le seul `gl.readPixels` du backend WebGL2 est dans
 * `WebGLTextureUtils.copyTextureToBuffer` (l. 1336), atteint uniquement par
 * `Renderer.readRenderTargetPixelsAsync` (l. 3576-3578), que notre code n'appelle jamais ; les
 * requêtes de chronométrage sont désactivées (`trackTimestamp` faux par défaut, Backend.js l. 76).
 * Observé par l'orchestrateur : le message apparaît sans capture ni lecture de pixels, puis cesse
 * (« this message will no longer repeat »).
 * Supposé (non vérifié dans le source de Chromium) : il provient de la composition logicielle du
 * canvas WebGL en headless, qui relit l'image rendue par SwiftShader.
 * Motif précis : ne tolère que ce message de pilote.
 */
const SWIFTSHADER_READPIXELS_STALL = /GL Driver Message .* GPU stall due to ReadPixels/;

/**
 * Messages console tolérés, par mode. En WebGL2 imposé : seulement le message ci-dessus.
 * En mode automatique, sans adaptateur WebGPU (Chromium headless) : Chrome écrit « No available
 * adapters. » quand `navigator.gpu.requestAdapter()` ne trouve aucun adaptateur, puis three avertit
 * volontairement du repli (WebGPURenderer.js l. 65-67, `getFallback`). C'est le comportement
 * attendu du repli, pas un défaut.
 */
const ALLOWED_WEBGL: readonly RegExp[] = [SWIFTSHADER_READPIXELS_STALL];
const ALLOWED_AUTO: readonly RegExp[] = [
  SWIFTSHADER_READPIXELS_STALL,
  /^No available adapters\./,
  /^THREE\.WebGPURenderer: WebGPU is not available, running under WebGL2 backend\./,
];

/** Message d'échec de l'assertion console : liste tous les messages reçus. */
const CONSOLE_FAILURE = 'messages console inattendus (liste complète ci-dessous)';

/** Collecte erreurs et avertissements console non tolérés, et exceptions non gérées. */
function watchConsole(page: Page, allowed: readonly RegExp[]): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') {
      return;
    }
    const text = message.text();
    if (!allowed.some((pattern) => pattern.test(text))) {
      problems.push(`${type}: ${text}`);
    }
  });
  page.on('pageerror', (error) => {
    problems.push(`exception: ${error.message}`);
  });
  return problems;
}

/** Attend la première image dessinée (main.ts écrit alors data-draw-calls). */
async function waitFirstFrame(page: Page): Promise<void> {
  await page.waitForFunction(() => document.body.dataset['drawCalls'] !== undefined);
}

/** Attend deux images d'animation (le redimensionnement est appliqué puis dessiné). */
async function waitTwoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

function describeRgb(c: Rgb): string {
  return `rgb(${String(c.r)}, ${String(c.g)}, ${String(c.b)})`;
}

/**
 * Zone de papier vierge où l'on vérifie la grille : au-dessus du quai de départ, entre le
 * bonhomme (x = −5,5 m au départ) et la console (x = −1 m), là où le niveau au crayon (T-009) ne
 * dessine rien. Avant T-009, la vérification portait sur la case (0,55 ; 0,55) et les lignes
 * y = 0 et x = 4, désormais recouvertes par la cabine, le quai et la cage.
 */
const CELL_X = -3.45;
const CELL_Y = 2.55;
const LINE_Y = 2;
const LINE_X = -3;

/**
 * Vérifie le papier dans une capture : crème au milieu d'une case, ligne de mètre y = LINE_Y au
 * pixel prévu par computeFrame (±2 px), plus sombre et plus bleutée ; idem ligne verticale
 * x = LINE_X.
 */
function checkPaper(
  image: DecodedPng,
  width: number,
  height: number,
  contrast: { readonly darker: number; readonly bluer: number } = { darker: 30, bluer: 20 },
): string[] {
  const report: string[] = [];
  const frame = computeFrame(width, height);
  // Milieu d'une case du millimètre, loin de tout trait.
  const cellX = worldXToPixel(frame, width, CELL_X);
  const cellY = worldYToPixel(frame, height, CELL_Y);
  const cream = pixelAt(image, cellX, cellY);
  report.push(
    `case (${String(CELL_X)} ; ${String(CELL_Y)}) → pixel (${cellX.toFixed(1)}, ${cellY.toFixed(1)}) : ${describeRgb(cream)}`,
  );
  expect(cream.r, 'papier crème : rouge').toBeGreaterThanOrEqual(225);
  expect(cream.g, 'papier crème : vert').toBeGreaterThanOrEqual(218);
  expect(cream.b, 'papier crème : bleu').toBeGreaterThanOrEqual(190);
  expect(cream.r - cream.b, 'papier chaud : R > B').toBeGreaterThanOrEqual(8);

  // Ligne horizontale y = LINE_Y : ligne la plus sombre de la colonne de la case.
  const expectedRow = worldYToPixel(frame, height, LINE_Y);
  let darkestRow = -1;
  let darkest: Rgb = cream;
  for (let row = Math.floor(expectedRow) - 8; row <= Math.floor(expectedRow) + 8; row += 1) {
    const c = pixelAt(image, cellX, row);
    if (luma(c) < luma(darkest)) {
      darkest = c;
      darkestRow = row;
    }
  }
  report.push(
    `ligne y = ${String(LINE_Y)} : attendue au pixel ${expectedRow.toFixed(2)}, la plus sombre en ${String(darkestRow)} (centre ${String(darkestRow + 0.5)}) : ${describeRgb(darkest)}`,
  );
  expect(
    Math.abs(darkestRow + 0.5 - expectedRow),
    'position de la ligne horizontale',
  ).toBeLessThanOrEqual(2);
  expect(luma(cream) - luma(darkest), 'ligne nettement plus sombre').toBeGreaterThanOrEqual(
    contrast.darker,
  );
  expect(darkest.b - darkest.r, 'ligne bleutée').toBeGreaterThan(
    cream.b - cream.r + contrast.bluer,
  );

  // Ligne verticale x = LINE_X, sur la ligne de pixels de la case.
  const expectedCol = worldXToPixel(frame, width, LINE_X);
  let darkestCol = -1;
  let darkestV: Rgb = cream;
  for (let col = Math.floor(expectedCol) - 8; col <= Math.floor(expectedCol) + 8; col += 1) {
    const c = pixelAt(image, col, cellY);
    if (luma(c) < luma(darkestV)) {
      darkestV = c;
      darkestCol = col;
    }
  }
  report.push(
    `ligne x = ${String(LINE_X)} : attendue au pixel ${expectedCol.toFixed(2)}, la plus sombre en ${String(darkestCol)} : ${describeRgb(darkestV)}`,
  );
  expect(
    Math.abs(darkestCol + 0.5 - expectedCol),
    'position de la ligne verticale',
  ).toBeLessThanOrEqual(2);
  expect(luma(cream) - luma(darkestV), 'ligne verticale plus sombre').toBeGreaterThanOrEqual(
    contrast.darker,
  );
  return report;
}

async function canvasBox(page: Page): Promise<{ width: number; height: number }> {
  const box = await page.locator('#scene').boundingBox();
  expect(box).not.toBeNull();
  return { width: box?.width ?? 0, height: box?.height ?? 0 };
}

test('WebGL2 imposé : démarre sans erreur console et dessine le papier', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl&lang=fr');
  await waitFirstFrame(page);
  await waitTwoFrames(page);
  expect(await page.evaluate(() => document.body.dataset['backend'])).toBe('webgl');
  const box = await canvasBox(page);
  expect(box).toEqual({ width: 1280, height: 720 });
  const counts = await page.evaluate(() => [
    document.body.dataset['drawCalls'],
    document.body.dataset['triangles'],
  ]);
  test.info().annotations.push({
    type: 'mesure',
    description: `appels de dessin=${String(counts[0])}, triangles=${String(counts[1])}`,
  });
  const png = await page.screenshot({ path: 'docs/img/t008-paper-1280x720.png' });
  const report = checkPaper(decodePng(png), 1280, 720);
  test.info().annotations.push({ type: 'pixels 1280×720', description: report.join(' | ') });
  // Appels de dessin à l'état initial, lot par lot :
  // - papier : 1 (opaque) ;
  // - décor (quais, cage, poutre, poulies, moteur, jauge vide, pupitre, axe) : 1 ;
  // - éléments mobiles (cabine, câbles, levier, bonhomme) : 1 ;
  // - erreur, courbe, jauge rouge : 0 (lots vides, meshes masqués hors trajet) ;
  // - passe de sortie de WebGPURenderer (conversion vers sRGB) : 1 (voir src/render/stage.ts).
  // Les lots sont transparents et DoubleSide : sans `forceSinglePass` (pencil-material.ts),
  // three les dessinait deux fois (faces arrière puis avant), d'où les 6 appels constatés en T-009.
  expect(counts[0], 'appels de dessin').toBe('4');
  const triangles = Number(counts[1]);
  expect(triangles, 'triangles : au moins le décor').toBeGreaterThan(1000);
  expect(triangles, 'triangles : budget').toBeLessThanOrEqual(30_000);
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('portrait 390×844 : papier aligné, sans déformation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl');
  await waitFirstFrame(page);
  await waitTwoFrames(page);
  const png = await page.screenshot({ path: 'docs/img/t008-paper-390x844.png' });
  // À 390 px de large (22,9 px/m), la grille fine (2,3 px de pas) est estompée et un trait de
  // mètre fait 0,5 px, dessiné sur un pixel à intensité réduite : seuils de contraste abaissés.
  const report = checkPaper(decodePng(png), 390, 844, { darker: 20, bluer: 12 });
  test.info().annotations.push({ type: 'pixels 390×844', description: report.join(' | ') });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

test('portrait 390×844 : toutes les lignes de mètre ont la même teinte', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl');
  await waitFirstFrame(page);
  await waitTwoFrames(page);
  const image = decodePng(await page.screenshot());
  const frame = computeFrame(390, 844);
  const report: string[] = [];
  /** Pixel le plus sombre à ±3 px de la position prévue d'une ligne. */
  const darkestAround = (horizontal: boolean, at: number, across: number): Rgb => {
    let best: Rgb = { r: 255, g: 255, b: 255 };
    const centre = horizontal ? worldYToPixel(frame, 844, at) : worldXToPixel(frame, 390, at);
    const fixed = horizontal
      ? worldXToPixel(frame, 390, across)
      : worldYToPixel(frame, 844, across);
    for (let k = Math.floor(centre) - 3; k <= Math.floor(centre) + 3; k += 1) {
      const c = horizontal ? pixelAt(image, fixed, k) : pixelAt(image, k, fixed);
      if (luma(c) < luma(best)) best = c;
    }
    return best;
  };
  // Lignes horizontales y = 1 … 5 (colonne x = −3,45 m, papier vierge) ; lignes verticales
  // x = −4, −3, −2 (rangée y = 2,55 m) et x = 6 … 9 (rangée y = 4,55 m, au-dessus du quai).
  const lines: { name: string; color: Rgb }[] = [];
  for (const y of [1, 2, 3, 4, 5]) {
    lines.push({ name: `y=${String(y)}`, color: darkestAround(true, y, -3.45) });
  }
  for (const x of [-4, -3, -2]) {
    lines.push({ name: `x=${String(x)}`, color: darkestAround(false, x, 2.55) });
  }
  for (const x of [6, 7, 8, 9]) {
    lines.push({ name: `x=${String(x)}`, color: darkestAround(false, x, 4.55) });
  }
  for (const line of lines) report.push(`${line.name} : ${describeRgb(line.color)}`);
  test
    .info()
    .annotations.push({ type: 'lignes de mètre 390×844', description: report.join(' | ') });
  const reference = lines[0]?.color ?? { r: 0, g: 0, b: 0 };
  for (const line of lines) {
    // Ligne bien bleu-vert (pas brunâtre) et de même teinte que la première, à 12 niveaux près.
    expect(line.color.g - line.color.r, `${line.name} : teinte bleu-vert`).toBeGreaterThan(20);
    expect(Math.abs(line.color.r - reference.r), `${line.name} : rouge`).toBeLessThanOrEqual(12);
    expect(Math.abs(line.color.g - reference.g), `${line.name} : vert`).toBeLessThanOrEqual(12);
    expect(Math.abs(line.color.b - reference.b), `${line.name} : bleu`).toBeLessThanOrEqual(12);
  }
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

/** Mesure d'une ligne de mètre en un point : pixel le plus sombre et noirceur intégrée. */
interface LineSample {
  readonly name: string;
  readonly darkest: Rgb;
  /** Somme, sur ±3 px autour de la ligne, de (luminance du papier − luminance du pixel), ≥ 0. */
  readonly darkness: number;
}

/**
 * Mesure la ligne de mètre `line` (y = line si `horizontal`, sinon x = line) à la position
 * `across` le long de la ligne. La noirceur intégrée ne dépend pas de la phase sous-pixel du trait
 * (énergie conservée par l'anti-crénelage) : c'est la grandeur comparée entre lignes.
 */
function sampleLine(
  image: DecodedPng,
  frame: Frame,
  paperLuma: number,
  horizontal: boolean,
  line: number,
  across: number,
): LineSample {
  const centre = horizontal
    ? worldYToPixel(frame, image.height, line)
    : worldXToPixel(frame, image.width, line);
  const fixed = horizontal
    ? worldXToPixel(frame, image.width, across)
    : worldYToPixel(frame, image.height, across);
  let darkest: Rgb = { r: 255, g: 255, b: 255 };
  let darkness = 0;
  for (let k = Math.floor(centre) - 3; k <= Math.floor(centre) + 3; k += 1) {
    const c = horizontal ? pixelAt(image, fixed, k) : pixelAt(image, k, fixed);
    darkness += Math.max(0, paperLuma - luma(c));
    if (luma(c) < luma(darkest)) darkest = c;
  }
  const name = `${horizontal ? 'y' : 'x'}=${String(line)} @${String(across)}`;
  return { name, darkest, darkness };
}

/**
 * Référence T-008 (capture validée par l'utilisateur, `git show ed46321:docs/img/t008-paper-1280x720.png`,
 * décodée et mesurée avec la même méthode, papier nu) : ligne y = 6 en x = −4,25 et ligne x = −6 en
 * y = 3,75. Valeurs lues dans la capture et figées ici.
 */
const T008_REFERENCE: readonly {
  readonly horizontal: boolean;
  readonly line: number;
  readonly across: number;
  readonly darkest: Rgb;
  readonly darkness: number;
}[] = [
  {
    horizontal: true,
    line: 6,
    across: -4.25,
    darkest: { r: 109, g: 153, b: 146 },
    darkness: 162.3,
  },
  {
    horizontal: false,
    line: -6,
    across: 3.75,
    darkest: { r: 101, g: 150, b: 143 },
    darkness: 154.7,
  },
];

/** Abscisses d'échantillonnage le long d'une horizontale : papier nu, des deux côtés du centre (x = 2). */
const ALONG_X: readonly number[] = [
  -6.25, -4.25, -2.25, -0.25, 1.75, 2.25, 4.25, 6.25, 8.25, 10.25,
];
/** Ordonnées d'échantillonnage le long de la verticale x = −6 (papier nu, à gauche du décor). */
const ALONG_Y: readonly number[] = [-2.25, 0.75, 1.75, 2.75, 3.75, 6.25];

function expectClose(a: Rgb, b: Rgb, tolerance: number, label: string): void {
  expect(Math.abs(a.r - b.r), `${label} : rouge`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.g - b.g), `${label} : vert`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.b - b.b), `${label} : bleu`).toBeLessThanOrEqual(tolerance);
}

function expectRelative(value: number, reference: number, tolerance: number, label: string): void {
  expect(Math.abs(value - reference) / reference, label).toBeLessThanOrEqual(tolerance);
}

for (const [width, height] of [
  [1280, 720],
  [1281, 721],
  [390, 844],
] as const) {
  test(`${String(width)}×${String(height)} : lignes de mètre uniformes (le long et entre lignes)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const problems = watchConsole(page, ALLOWED_WEBGL);
    await page.goto('?renderer=webgl');
    await waitFirstFrame(page);
    await waitTwoFrames(page);
    const image = decodePng(await page.screenshot());
    const frame = computeFrame(width, height);
    const paperLuma = luma(
      pixelAt(image, worldXToPixel(frame, width, CELL_X), worldYToPixel(frame, height, CELL_Y)),
    );
    const report: string[] = [`papier ${paperLuma.toFixed(1)}`];
    const log = (sample: LineSample): LineSample => {
      report.push(`${sample.name} ${describeRgb(sample.darkest)} ${sample.darkness.toFixed(1)}`);
      return sample;
    };

    // (a) Le long d'une même ligne : y = 6 et y = −2 (8 abscisses et plus), x = −6 (6 ordonnées).
    const groups: LineSample[][] = [
      ALONG_X.map((x) => log(sampleLine(image, frame, paperLuma, true, 6, x))),
      ALONG_X.map((x) => log(sampleLine(image, frame, paperLuma, true, -2, x))),
      ALONG_Y.map((y) => log(sampleLine(image, frame, paperLuma, false, -6, y))),
    ];
    for (const group of groups) {
      const first = group[0];
      if (first === undefined) continue;
      for (const sample of group) {
        // Même phase sous-pixel tout le long : même couleur (grain ±1,5 % compris) et même noirceur.
        expectClose(sample.darkest, first.darkest, 8, `le long : ${sample.name}`);
        expectRelative(
          sample.darkness,
          first.darkness,
          0.08,
          `le long (noirceur) : ${sample.name}`,
        );
      }
    }

    // (b) Entre lignes : 9 horizontales (y = −2 … 6 en x = −6,25) et 17 verticales (x = −6 … 10 en
    // y = 6,25). La phase sous-pixel change d'une ligne à l'autre : on compare la noirceur intégrée.
    const between: LineSample[] = [];
    for (let y = -2; y <= 6; y += 1)
      between.push(log(sampleLine(image, frame, paperLuma, true, y, -6.25)));
    for (let x = -6; x <= 10; x += 1)
      between.push(log(sampleLine(image, frame, paperLuma, false, x, 6.25)));
    const mean = between.reduce((sum, s) => sum + s.darkness, 0) / between.length;
    report.push(`noirceur moyenne ${mean.toFixed(1)}`);
    for (const sample of between) {
      expect(
        sample.darkest.g - sample.darkest.r,
        `${sample.name} : teinte bleu-vert`,
      ).toBeGreaterThan(20);
      expectRelative(sample.darkness, mean, 0.1, `entre lignes : ${sample.name}`);
    }

    // (c) À 1280×720 : identique à la capture validée de T-008.
    if (width === 1280) {
      for (const ref of T008_REFERENCE) {
        const sample = log(
          sampleLine(image, frame, paperLuma, ref.horizontal, ref.line, ref.across),
        );
        expectClose(sample.darkest, ref.darkest, 8, `T-008 : ${sample.name}`);
        expectRelative(sample.darkness, ref.darkness, 0.08, `T-008 (noirceur) : ${sample.name}`);
      }
    }
    test.info().annotations.push({
      type: `lignes ${String(width)}×${String(height)}`,
      description: report.join(' | '),
    });
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('redimensionnement 1280×720 → 800×900 : le canvas suit, sans déformation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watchConsole(page, ALLOWED_WEBGL);
  await page.goto('?renderer=webgl');
  await waitFirstFrame(page);
  await page.setViewportSize({ width: 800, height: 900 });
  await waitTwoFrames(page);
  await waitTwoFrames(page);
  expect(await canvasBox(page)).toEqual({ width: 800, height: 900 });
  const backing = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas === null ? [0, 0] : [canvas.width, canvas.height];
  });
  expect(backing).toEqual([800, 900]);
  const report = checkPaper(decodePng(await page.screenshot()), 800, 900);
  test.info().annotations.push({ type: 'pixels 800×900', description: report.join(' | ') });
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});

for (const lang of ['fr', 'en'] as const) {
  test(`?renderer=none : page de repli traduite (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const problems = watchConsole(page, []);
    await page.goto(`?renderer=none&lang=${lang}`);
    await expect(page.locator('body')).toHaveAttribute('data-backend', 'none');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const texts = fallbackTexts(lang);
    expect(texts.title).not.toBe('');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(texts.title);
    await expect(page.getByText(texts.explanation)).toBeVisible();
    await expect(page.getByRole('link', { name: texts.docs })).toBeVisible();
    await expect(page.locator('#scene')).toBeHidden();
    if (lang === 'fr') {
      await page.screenshot({ path: 'docs/img/t008-fallback-fr.png' });
    }
    expect(problems, CONSOLE_FAILURE).toEqual([]);
  });
}

test('mode automatique : constate le backend, sans exception', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = watchConsole(page, ALLOWED_AUTO);
  await page.goto('');
  await page.waitForFunction(() => document.body.dataset['backend'] !== undefined);
  const backend = await page.evaluate(() => document.body.dataset['backend']);
  test.info().annotations.push({ type: 'backend automatique', description: String(backend) });
  expect(['webgpu', 'webgl', 'none']).toContain(backend);
  if (backend !== 'none') {
    await waitFirstFrame(page);
  }
  expect(problems, CONSOLE_FAILURE).toEqual([]);
});
