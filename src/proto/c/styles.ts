/**
 * Maquette C (jetable) : feuille de style injectée (papier millimétré, police manuscrite, champs et
 * bouton au crayon). Tout est préfixé `pc-` et retiré au détachement.
 */
import { creerAlea } from './crayon';

/** Grain du papier : tuile de bruit très discrète (data URL), faite une fois. */
function grainPapier(): string {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (ctx === null) return 'none';
  const alea = creerAlea(42);
  const image = ctx.createImageData(96, 96);
  for (let k = 0; k < 96 * 96; k++) {
    const sombre = alea() < 0.5;
    image.data[k * 4] = sombre ? 60 : 255;
    image.data[k * 4 + 1] = sombre ? 55 : 255;
    image.data[k * 4 + 2] = sombre ? 45 : 250;
    image.data[k * 4 + 3] = Math.round(alea() * 16);
  }
  ctx.putImageData(image, 0, 0);
  return `url(${c.toDataURL('image/png')})`;
}

/** Crée l'élément <style> de la maquette. */
export function creerStyle(): HTMLStyleElement {
  const base = import.meta.env.BASE_URL;
  const style = document.createElement('style');
  style.textContent = `
@font-face {
  font-family: 'Patrick Hand C';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('${base}fonts/patrick-hand-latin-ext-400-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308,
    U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113,
    U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Patrick Hand C';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('${base}fonts/patrick-hand-latin-400-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
    U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
.pc-feuille {
  position: absolute; inset: 0; overflow: hidden;
  background-color: #f7f0de;
  background-image: ${grainPapier()},
    linear-gradient(rgba(61,133,128,0.42) 1.3px, transparent 1.3px),
    linear-gradient(90deg, rgba(61,133,128,0.42) 1.3px, transparent 1.3px),
    linear-gradient(rgba(95,159,153,0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(95,159,153,0.3) 1px, transparent 1px),
    linear-gradient(rgba(134,185,178,0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(134,185,178,0.3) 1px, transparent 1px);
  background-size: 96px 96px, 100px 100px, 100px 100px, 50px 50px, 50px 50px, 10px 10px, 10px 10px;
  font-family: 'Patrick Hand C', 'Patrick Hand', 'Segoe Print', 'Comic Sans MS', cursive;
  color: #2a2724;
}
.pc-scene { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; transform-origin: 0 0; }
.pc-scene canvas.pc-calque { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; pointer-events: none; }
.pc-tube { position: absolute; display: block; }
.pc-txt { position: absolute; white-space: nowrap; line-height: 1.15; }
.pc-num { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-variant-numeric: tabular-nums; font-size: 0.88em; }
.pc-champ {
  position: absolute; box-sizing: border-box; height: 34px; width: 96px; padding: 0 4px;
  font: 24px 'Patrick Hand C', 'Patrick Hand', 'Segoe Print', cursive; color: #2a2724;
  text-align: right; background: rgba(251,247,236,0.75);
  border: none; border-bottom: 2px solid #3a3a3a; border-radius: 3px 3px 0 0;
  -moz-appearance: textfield; appearance: textfield;
}
.pc-champ::-webkit-inner-spin-button, .pc-champ::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.pc-champ:focus-visible, .pc-levier:focus-visible, .pc-bouton:focus-visible {
  outline: 2px dashed #1f4e7a; outline-offset: 3px;
}
.pc-levier { position: absolute; cursor: grab; border-radius: 8px; touch-action: none; }
.pc-levier:active { cursor: grabbing; }
.pc-bouton {
  position: absolute; box-sizing: border-box; cursor: pointer;
  font: 28px 'Patrick Hand C', 'Patrick Hand', 'Segoe Print', cursive; color: #2a2724;
  background: rgba(251,247,236,0.82);
  border: 2.5px solid #3a3a3a;
  border-radius: 255px 14px 225px 14px / 14px 225px 14px 255px;
  box-shadow: 3px 3px 0 rgba(58,58,58,0.55);
}
.pc-bouton:hover { background: rgba(240,232,210,0.95); }
.pc-bouton:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 rgba(58,58,58,0.55); }
.pc-rouge { color: #9a2a1c; }
.pc-cache { display: none; }
`;
  return style;
}
