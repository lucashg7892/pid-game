/**
 * Décodeur PNG minimal pour les tests e2e (captures Playwright) : 8 bits par canal, RVB ou RVBA,
 * non entrelacé. Sans dépendance : `node:zlib` seulement.
 */
import { inflateSync } from 'node:zlib';

/** Image décodée, pixels RVBA ligne par ligne. */
export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

/** Couleur d'un pixel (0-255 par canal). */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  return pb <= pc ? b : c;
}

/**
 * Décode un PNG.
 * @param data contenu du fichier.
 * @throws Error si le format n'est pas pris en charge.
 */
export function decodePng(data: Uint8Array): DecodedPng {
  SIGNATURE.forEach((byte, i) => {
    if (data[i] !== byte) {
      throw new Error('signature PNG invalide');
    }
  });
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];
  while (offset < data.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const bitDepth = body[8];
      const colorType = body[9];
      const interlace = body[12];
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
        throw new Error(
          `PNG non pris en charge (profondeur ${String(bitDepth)}, type ${String(colorType)})`,
        );
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[src + x] ?? 0;
      const left = x >= channels ? (pixels[dst + x - channels] ?? 0) : 0;
      const up = y > 0 ? (pixels[dst - stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= channels ? (pixels[dst - stride + x - channels] ?? 0) : 0;
      let predicted: number;
      switch (filter) {
        case 0:
          predicted = 0;
          break;
        case 1:
          predicted = left;
          break;
        case 2:
          predicted = up;
          break;
        case 3:
          predicted = (left + up) >> 1;
          break;
        case 4:
          predicted = paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`filtre PNG inconnu ${String(filter)}`);
      }
      pixels[dst + x] = (value + predicted) & 0xff;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = pixels[i * channels] ?? 0;
    rgba[i * 4 + 1] = pixels[i * channels + 1] ?? 0;
    rgba[i * 4 + 2] = pixels[i * channels + 2] ?? 0;
    rgba[i * 4 + 3] = channels === 4 ? (pixels[i * channels + 3] ?? 0) : 255;
  }
  return { width, height, rgba };
}

/**
 * Couleur du pixel (x, y) (coordonnées entières, origine en haut à gauche).
 * @param image image décodée.
 * @param x colonne.
 * @param y ligne.
 */
export function pixelAt(image: DecodedPng, x: number, y: number): Rgb {
  const i = (Math.floor(y) * image.width + Math.floor(x)) * 4;
  return { r: image.rgba[i] ?? 0, g: image.rgba[i + 1] ?? 0, b: image.rgba[i + 2] ?? 0 };
}

/**
 * Luminance relative approchée (0-255), pondérations Rec. 709.
 * @param c couleur.
 */
export function luma(c: Rgb): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
