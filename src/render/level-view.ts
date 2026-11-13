/**
 * Vue three du niveau (T-009) : un mesh par lot de traits du {@link LevelPainter}, dont les
 * `BufferAttribute` enveloppent directement les tableaux préalloués du lot (aucune copie). À
 * chaque image : le peintre réécrit les tableaux, puis la vue règle la plage de dessin
 * (`setDrawRange`), la plage à envoyer au GPU (un seul objet de plage par attribut, créé une fois
 * et réutilisé) et `needsUpdate`. Le décor n'est renvoyé au GPU que lorsqu'il a été redessiné.
 *
 * Coût : 5 meshes au plus (5 appels de dessin), masqués quand leur lot est vide.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Mesh,
  type MeshBasicNodeMaterial,
  type Scene,
} from 'three/webgpu';
import type { LevelSnapshot } from '../game';
import type { SignalRecorder } from '../sim';
import type { Frame } from './camera';
import { LevelPainter } from './level-painter';
import { STROKE_ATTRIBUTE, createPencilMaterial } from './pencil-material';
import {
  GRAPHITE_COLOR,
  GRAPHITE_OPACITY,
  RED_PENCIL_COLOR,
  RED_PENCIL_OPACITY,
} from './pencil-style';
import { POSITION_ITEM_SIZE, STROKE_ITEM_SIZE, type StrokeBatch } from './stroke-batch';

/** Ordre de dessin du premier lot (le papier est à −1). */
export const LEVEL_RENDER_ORDER = 1;

/** Plage d'envoi réutilisée (même forme que celles de `BufferAttribute.addUpdateRange`). */
interface UpdateRange {
  start: number;
  count: number;
}

/** Un lot, son mesh et ses attributs. */
interface BatchMesh {
  readonly batch: StrokeBatch;
  readonly mesh: Mesh<BufferGeometry, MeshBasicNodeMaterial>;
  readonly position: BufferAttribute;
  readonly stroke: BufferAttribute;
  readonly positionRange: UpdateRange;
  readonly strokeRange: UpdateRange;
}

/** Vue du niveau. */
export interface LevelView {
  /** Peintre (lots CPU). */
  readonly painter: LevelPainter;
  /**
   * Repeint et prépare l'envoi au GPU (aucune allocation de notre part).
   * @param s instantané du niveau (lu, jamais conservé).
   * @param signals enregistreur de signaux du niveau.
   * @param visualSeconds temps visuel (s), pour le « boiling ».
   * @param reducedMotion préférence `prefers-reduced-motion`.
   */
  paint(
    s: Readonly<LevelSnapshot>,
    signals: SignalRecorder,
    visualSeconds: number,
    reducedMotion: boolean,
  ): void;
  /** Adapte l'épaisseur minimale des traits au cadrage (pixels par mètre). */
  resize(frame: Frame): void;
  /** Retire les meshes de la scène et libère géométries et matériaux. */
  dispose(): void;
}

function wrapBatch(
  batch: StrokeBatch,
  material: MeshBasicNodeMaterial,
  order: number,
  name: string,
): BatchMesh {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(batch.positions, POSITION_ITEM_SIZE);
  position.setUsage(DynamicDrawUsage);
  const stroke = new BufferAttribute(batch.strokes, STROKE_ITEM_SIZE);
  stroke.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute(STROKE_ATTRIBUTE, stroke);
  geometry.setDrawRange(0, 0);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  mesh.visible = false;
  return {
    batch,
    mesh,
    position,
    stroke,
    positionRange: { start: 0, count: 0 },
    strokeRange: { start: 0, count: 0 },
  };
}

function upload(attribute: BufferAttribute, range: UpdateRange, count: number): void {
  range.start = 0;
  range.count = count;
  attribute.updateRanges.length = 0;
  attribute.updateRanges.push(range);
  attribute.needsUpdate = true;
}

function sync(entry: BatchMesh): void {
  const count = entry.batch.vertexCount;
  entry.mesh.visible = count > 0;
  entry.mesh.geometry.setDrawRange(0, count);
  if (count > 0) {
    upload(entry.position, entry.positionRange, count * POSITION_ITEM_SIZE);
    upload(entry.stroke, entry.strokeRange, count * STROKE_ITEM_SIZE);
  }
}

/**
 * Crée la vue du niveau et ajoute ses meshes à `scene`.
 * @param scene scène three (celle du papier).
 */
export function createLevelView(scene: Scene): LevelView {
  const painter = new LevelPainter();
  const graphite = createPencilMaterial(GRAPHITE_COLOR, GRAPHITE_OPACITY, 'graphite');
  const red = createPencilMaterial(RED_PENCIL_COLOR, RED_PENCIL_OPACITY, 'red-pencil');
  const entries: readonly BatchMesh[] = Object.freeze([
    wrapBatch(painter.decor, graphite, LEVEL_RENDER_ORDER, 'decor'),
    wrapBatch(painter.error, graphite, LEVEL_RENDER_ORDER + 1, 'error'),
    wrapBatch(painter.curve, graphite, LEVEL_RENDER_ORDER + 2, 'curve'),
    wrapBatch(painter.actors, graphite, LEVEL_RENDER_ORDER + 3, 'actors'),
    wrapBatch(painter.red, red, LEVEL_RENDER_ORDER + 4, 'red'),
  ]);
  for (const entry of entries) {
    scene.add(entry.mesh);
  }
  const decor = entries[0] as BatchMesh;
  let decorBuildsSent = -1;

  return {
    painter,
    paint(
      s: Readonly<LevelSnapshot>,
      signals: SignalRecorder,
      visualSeconds: number,
      reducedMotion: boolean,
    ): void {
      painter.paint(s, signals, visualSeconds, reducedMotion);
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i] as BatchMesh;
        if (entry === decor) {
          if (painter.decorBuilds === decorBuildsSent) {
            continue;
          }
          decorBuildsSent = painter.decorBuilds;
        }
        sync(entry);
      }
    },
    resize(frame: Frame): void {
      painter.setPixelSize(frame.pixelsPerMeter > 0 ? 1 / frame.pixelsPerMeter : 0);
    },
    dispose(): void {
      for (const entry of entries) {
        scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
      }
      graphite.dispose();
      red.dispose();
    },
  };
}
