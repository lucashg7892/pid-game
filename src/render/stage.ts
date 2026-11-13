/**
 * Scène minimale de T-008 : caméra orthographique cadrée sur la zone de jeu et feuille de papier
 * millimétré. Les traits du niveau au crayon y sont ajoutés par `level-view.ts` (T-009).
 */
import { OrthographicCamera, Scene, type WebGPURenderer } from 'three/webgpu';
import { applyFrame, computeFrame, type Frame } from './camera';
import { createPaper, fitPaperToFrame } from './paper';

/** Distance de la caméra au plan z = 0 (m) ; elle regarde vers −z. */
export const CAMERA_Z = 10;
/** Plan de coupe proche de la caméra (m). */
export const CAMERA_NEAR = 0.1;
/** Plan de coupe lointain de la caméra (m). */
export const CAMERA_FAR = 100;

/** Scène, caméra et papier, redimensionnables. */
export interface PaperStage {
  /** Scène three. */
  readonly scene: Scene;
  /** Caméra orthographique. */
  readonly camera: OrthographicCamera;
  /** Cadrage courant (remplacé à chaque `resize`). */
  readonly frame: Frame;
  /** Recadre la caméra et le papier pour une surface de `widthPx` × `heightPx` pixels CSS. */
  resize(widthPx: number, heightPx: number): void;
  /**
   * Dessine une image (aucune allocation de notre part). Coût mesuré (orchestrateur, Chrome
   * headless, WebGL2) : 2 appels de dessin, 3 triangles. Le papier fait 1 appel et 2 triangles ;
   * WebGPURenderer ajoute une passe de sortie (1 appel, 1 triangle plein écran `QuadMesh`) qui
   * convertit la cible intermédiaire linéaire (HalfFloat) vers l'espace sRGB du canvas, parce que
   * `outputColorSpace` (sRGB) diffère de l'espace de travail linéaire (`needsFrameBufferTarget`).
   * Le niveau (T-009) ajoute un appel par lot de traits non vide, 5 au plus.
   */
  render(): void;
  /** Libère géométries et matériaux. */
  dispose(): void;
}

/**
 * Crée la scène du papier.
 * @param renderer renderer initialisé.
 */
export function createPaperStage(renderer: WebGPURenderer): PaperStage {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, 0, CAMERA_Z);
  const paper = createPaper();
  scene.add(paper);
  let frame = computeFrame(0, 0);
  applyFrame(camera, frame);
  fitPaperToFrame(paper, frame);

  return {
    scene,
    camera,
    get frame(): Frame {
      return frame;
    },
    resize(widthPx: number, heightPx: number): void {
      frame = computeFrame(widthPx, heightPx);
      applyFrame(camera, frame);
      fitPaperToFrame(paper, frame);
    },
    render(): void {
      renderer.render(scene, camera);
    },
    dispose(): void {
      paper.geometry.dispose();
      paper.material.dispose();
    },
  };
}
