/**
 * Point de composition (spec T-001 §3) : démarre le rendu du papier, ou affiche la page de repli
 * traduite si aucun GPU n'est utilisable. N'importe pas three : tout le rendu vit dans src/render.
 */
import { createTranslator, detectLocale, type Translator } from './i18n';
import { parseRendererChoice, startRendering } from './render';

/** Page de documentation du projet, citée par la page de repli. */
const DOCS_URL = 'https://github.com/lucashg7892/pid-game#readme';

/** Remplace le contenu de la page par la page de repli traduite (DOM statique, sans GPU). */
function showFallback(translator: Translator, canvas: HTMLCanvasElement | null): void {
  document.body.dataset['backend'] = 'none';
  if (canvas !== null) {
    canvas.hidden = true;
  }
  const page = document.createElement('main');
  page.id = 'fallback';
  const title = document.createElement('h1');
  title.textContent = translator.t('fallback.title');
  const explanation = document.createElement('p');
  explanation.textContent = translator.t('fallback.explanation');
  const tipsTitle = document.createElement('h2');
  tipsTitle.textContent = translator.t('fallback.tipsTitle');
  const tips = document.createElement('ul');
  for (const key of [
    'fallback.tip.update',
    'fallback.tip.acceleration',
    'fallback.tip.device',
  ] as const) {
    const item = document.createElement('li');
    item.textContent = translator.t(key);
    tips.append(item);
  }
  const docs = document.createElement('p');
  const link = document.createElement('a');
  link.href = DOCS_URL;
  link.textContent = translator.t('fallback.docs');
  docs.append(link);
  page.append(title, explanation, tipsTitle, tips, docs);
  document.body.append(page);
}

async function main(): Promise<void> {
  const translator = createTranslator(detectLocale(location.search, navigator.languages));
  document.documentElement.lang = translator.locale;
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  if (canvas === null) {
    showFallback(translator, null);
    return;
  }
  canvas.setAttribute('aria-label', translator.t('a11y.canvas'));
  const result = await startRendering(canvas, parseRendererChoice(location.search));
  if (!result.ok) {
    showFallback(translator, canvas);
    return;
  }
  const { session } = result;
  document.body.dataset['backend'] = session.backend;
  const stats = await session.firstFrame;
  document.body.dataset['drawCalls'] = String(stats.drawCalls);
  document.body.dataset['triangles'] = String(stats.triangles);
}

void main();
