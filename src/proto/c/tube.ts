/**
 * Maquette C (jetable) : le tube cathodique à phosphore vert.
 *
 * Deux étages :
 * 1. un canvas 2D HORS DOM (« phosphore ») où l'on dessine à chaque image, en vert sur noir, le
 *    treuil en fil de fer et les traces de l'oscilloscope (texte compris : simple en 2D) ;
 * 2. three.js (WebGLRenderer) en post-traitement : rémanence (tampon de rétroaction ping-pong :
 *    max(image, ancienne × décroissance)), écran bombé (déformation en coussin, coins arrondis),
 *    halo vert (lecture floue dans les mipmaps), lignes de balayage, bande de balayage qui roule,
 *    grain, vignettage et reflet de verre. Le reste du pupitre est mat (crayon, DOM).
 * Repli sans WebGL : le canvas phosphore est montré tel quel, coins arrondis en CSS.
 */
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

const SOMMET = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const REMANENCE = /* glsl */ `
uniform sampler2D tNouveau;
uniform sampler2D tAncien;
uniform float decroissance;
varying vec2 vUv;
void main() {
  vec3 n = texture2D(tNouveau, vUv).rgb;
  vec3 a = texture2D(tAncien, vUv).rgb;
  gl_FragColor = vec4(max(n, a * decroissance - 0.008), 1.0);
}`;

const AFFICHAGE = /* glsl */ `
uniform sampler2D tImage;
uniform vec2 taille;
uniform float temps;
uniform float mouvement;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  vec2 w = c * (1.0 + vec2(0.028, 0.045) * (c.yx * c.yx));
  float aspect = taille.x / taille.y;
  vec2 p = w * vec2(aspect, 1.0);
  float r = 0.11;
  vec2 b = vec2(aspect, 1.0) - r;
  float d = length(max(abs(p) - b, 0.0)) + min(max(abs(p).x - b.x, abs(p).y - b.y), 0.0) - r;
  float masque = 1.0 - smoothstep(-0.004, 0.0, d);
  vec2 uv = w * 0.5 + 0.5;
  vec3 net = texture2D(tImage, uv).rgb;
  vec3 halo = texture2D(tImage, uv, 2.5).rgb * 0.75 + texture2D(tImage, uv, 4.5).rgb * 0.7;
  vec3 col = net + halo * vec3(0.45, 1.0, 0.6);
  float balayage = 0.86 + 0.14 * sin(gl_FragCoord.y * 2.0944);
  float roule = 0.05 * mouvement * exp(-pow((fract(vUv.y + temps * 0.11) - 0.5) * 7.0, 2.0));
  float grain = (hash(gl_FragCoord.xy + vec2(fract(temps * 7.31) * 97.0, 0.0)) - 0.5) * 0.06;
  vec3 fond = vec3(0.016, 0.045, 0.024);
  vec3 vert = vec3(0.35, 1.0, 0.5);
  col = col * balayage + fond + vert * (roule + grain * 0.6);
  float vignette = 1.0 - 0.32 * dot(c * 0.9, c * 0.9);
  col *= vignette;
  col *= 0.55 + 0.45 * smoothstep(0.0, -0.09, d);
  float reflet = 0.06 * (1.0 - smoothstep(0.0, 0.75, length((c - vec2(-0.55, 0.62)) * vec2(1.0, 1.6))));
  col += vec3(reflet * 0.8, reflet, reflet * 0.85);
  gl_FragColor = vec4(col * masque, masque);
}`;

/** Le tube : canvas phosphore (dessin) et sortie (DOM). */
export class Tube {
  /** Largeur et hauteur du tube (pixels CSS de la maquette). */
  readonly l: number;
  readonly h: number;
  /** Canvas phosphore (hors DOM) et son contexte, transformation en pixels CSS posée à `effacer`. */
  readonly phosphore: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Élément montré dans le DOM (canvas WebGL, ou le phosphore en repli). */
  readonly element: HTMLCanvasElement;
  /** Vrai si le post-traitement three.js tourne (sinon repli 2D). */
  readonly webgl: boolean;
  private echelle = 1;
  private temps = 0;
  private readonly rendu: WebGLRenderer | null = null;
  private readonly texture: CanvasTexture | null = null;
  private cibleA: WebGLRenderTarget | null = null;
  private cibleB: WebGLRenderTarget | null = null;
  private readonly matRemanence: ShaderMaterial | null = null;
  private readonly matAffichage: ShaderMaterial | null = null;
  private readonly geometrie = new PlaneGeometry(2, 2);
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly sceneRemanence = new Scene();
  private readonly sceneAffichage = new Scene();

  constructor(l: number, h: number) {
    this.l = l;
    this.h = h;
    this.phosphore = document.createElement('canvas');
    const ctx = this.phosphore.getContext('2d', { alpha: false, willReadFrequently: true });
    if (ctx === null) throw new Error('canvas 2D indisponible');
    this.ctx = ctx;
    const sortie = document.createElement('canvas');
    let rendu: WebGLRenderer | null;
    try {
      rendu = new WebGLRenderer({
        canvas: sortie,
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
      });
    } catch {
      rendu = null;
    }
    if (rendu === null) {
      this.element = this.phosphore;
      this.webgl = false;
      this.phosphore.style.borderRadius = '28px';
      return;
    }
    this.webgl = true;
    this.element = sortie;
    this.rendu = rendu;
    rendu.setClearColor(0x000000, 0);
    this.texture = new CanvasTexture(this.phosphore);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.matRemanence = new ShaderMaterial({
      vertexShader: SOMMET,
      fragmentShader: REMANENCE,
      uniforms: {
        tNouveau: { value: this.texture },
        tAncien: { value: null },
        decroissance: { value: 0.8 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.matAffichage = new ShaderMaterial({
      vertexShader: SOMMET,
      fragmentShader: AFFICHAGE,
      uniforms: {
        tImage: { value: null },
        taille: { value: new Vector2(l, h) },
        temps: { value: 0 },
        mouvement: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const m1 = new Mesh(this.geometrie, this.matRemanence);
    m1.frustumCulled = false;
    this.sceneRemanence.add(m1);
    const m2 = new Mesh(this.geometrie, this.matAffichage);
    m2.frustumCulled = false;
    this.sceneAffichage.add(m2);
  }

  /** Taille des tampons : pixels CSS × échelle de la scène × densité de l'écran (bornée à 2). */
  redimensionner(echelle: number): void {
    this.echelle = Math.min(2, Math.max(0.5, echelle));
    const lp = Math.round(this.l * this.echelle);
    const hp = Math.round(this.h * this.echelle);
    this.phosphore.width = lp;
    this.phosphore.height = hp;
    if (this.rendu === null) {
      this.phosphore.style.width = `${String(this.l)}px`;
      this.phosphore.style.height = `${String(this.h)}px`;
      return;
    }
    this.rendu.setPixelRatio(1);
    this.rendu.setSize(lp, hp, false);
    this.element.style.width = `${String(this.l)}px`;
    this.element.style.height = `${String(this.h)}px`;
    this.cibleA?.dispose();
    this.cibleB?.dispose();
    const options = {
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: true,
      depthBuffer: false,
    } as const;
    this.cibleA = new WebGLRenderTarget(lp, hp, options);
    this.cibleB = new WebGLRenderTarget(lp, hp, options);
    // Nouvelle taille du canvas source : la texture doit être recréée côté GPU.
    this.texture?.dispose();
    if (this.matAffichage !== null) {
      (this.matAffichage.uniforms.taille as { value: Vector2 }).value.set(lp, hp);
    }
  }

  /** Efface le phosphore (noir) et pose la transformation en pixels CSS du tube. */
  effacer(): CanvasRenderingContext2D {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.phosphore.width, this.phosphore.height);
    ctx.setTransform(this.echelle, 0, 0, this.echelle, 0, 0);
    return ctx;
  }

  /** Vide la rémanence (changement de trajet). */
  oublier(): void {
    if (this.rendu === null || this.cibleA === null || this.cibleB === null) return;
    const avant = this.rendu.getRenderTarget();
    for (const cible of [this.cibleA, this.cibleB]) {
      this.rendu.setRenderTarget(cible);
      this.rendu.setClearColor(0x000000, 1);
      this.rendu.clear(true, false, false);
    }
    this.rendu.setClearColor(0x000000, 0);
    this.rendu.setRenderTarget(avant);
  }

  /**
   * Envoie le phosphore à l'écran.
   * @param dt temps écoulé depuis l'image précédente (s), pour la rémanence.
   * @param mouvement 0 si l'utilisateur préfère réduire les animations (pas de bande qui roule).
   */
  presenter(dt: number, mouvement: boolean): void {
    const rendu = this.rendu;
    const a = this.cibleA;
    const b = this.cibleB;
    const ma = this.matAffichage;
    const mr = this.matRemanence;
    if (rendu === null || a === null || b === null || ma === null || mr === null) return;
    if (this.texture !== null) this.texture.needsUpdate = true;
    this.temps += dt;
    (mr.uniforms.tAncien as { value: unknown }).value = b.texture;
    (mr.uniforms.decroissance as { value: number }).value = Math.exp(-Math.max(dt, 0.001) / 0.06);
    rendu.setRenderTarget(a);
    rendu.render(this.sceneRemanence, this.camera);
    (ma.uniforms.tImage as { value: unknown }).value = a.texture;
    (ma.uniforms.temps as { value: number }).value = this.temps;
    (ma.uniforms.mouvement as { value: number }).value = mouvement ? 1 : 0;
    rendu.setRenderTarget(null);
    rendu.render(this.sceneAffichage, this.camera);
    this.cibleA = b;
    this.cibleB = a;
  }

  /** Libère le contexte WebGL, les tampons et le DOM. */
  detruire(): void {
    this.cibleA?.dispose();
    this.cibleB?.dispose();
    this.texture?.dispose();
    this.matAffichage?.dispose();
    this.matRemanence?.dispose();
    this.geometrie.dispose();
    if (this.rendu !== null) {
      this.rendu.dispose();
      this.rendu.forceContextLoss();
    }
    this.element.remove();
  }
}
