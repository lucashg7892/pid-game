/** Point de composition (bouchon T-002) : aucune logique de jeu, aucun rendu au chargement. */
import { WebGPURenderer } from 'three/webgpu';
import { parseRendererChoice } from './render';
import { SIM_DT } from './sim';

/** Crée et initialise le renderer (repli WebGL2 automatique, ou forcé par `?renderer=webgl`). */
async function startRenderer(canvas: HTMLCanvasElement): Promise<WebGPURenderer> {
  const forceWebGL = parseRendererChoice(location.search) === 'webgl';
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL });
  await renderer.init();
  // Les types de Backend n'exposent pas le drapeau : on teste sa présence (WebGLBackend.d.ts).
  const isWebGL = 'isWebGLBackend' in renderer.backend && renderer.backend.isWebGLBackend === true;
  document.body.dataset['backend'] = isWebGL ? 'webgl' : 'webgpu';
  return renderer;
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (canvas !== null) {
  canvas.dataset['simDt'] = String(SIM_DT);
  // Instanciation différée : jamais appelée au chargement.
  canvas.addEventListener('pointerdown', () => void startRenderer(canvas), { once: true });
}
