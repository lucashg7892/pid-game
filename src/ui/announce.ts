/**
 * Annonces de la région `aria-live="polite"` (spec T-001 §8, T-010) : une phrase par événement
 * du niveau (`level.drainEvents`, chaque événement consommé une seule fois). Fonction pure : les
 * valeurs viennent de l'instantané lu au moment de la consommation.
 *
 * Exception : l'événement `launch` est émis au début de l'embarquement, environ 2,4 s avant que la
 * consigne change vraiment (R4, T-039). Son annonce est donc différée jusqu'au départ réel du
 * trajet ({@link releaseLaunch}) et annulée si le joueur recommence ou ferme le réglage avant
 * ({@link admitEvent}). Sans animation, le trajet part dans la même image : annonce immédiate.
 */
import type { GameEvent, LevelPhase, LevelSnapshot } from '../game';
import type { Translator } from '../i18n';

/** Décimales des erreurs annoncées et affichées (m) : 0,20 m. */
export const ERROR_DIGITS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

/** Kp formaté sans décimale (« 2500 »). */
export function formatKp(tr: Translator, kp: number): string {
  return tr.formatNumber(kp, { maximumFractionDigits: 0 });
}

/**
 * Erreur formatée à deux décimales (« 0,20 » / « 0.20 »), sans unité.
 * @param tr traducteur.
 * @param e erreur (m) ; une valeur non finie donne « 0 » (jamais affichée en pratique).
 */
export function formatError(tr: Translator, e: number): string {
  return tr.formatNumber(Number.isFinite(e) ? e : 0, ERROR_DIGITS);
}

/** Vrai si le trajet a réellement commencé (trajet, sortie ou issue). */
function tripStarted(phase: LevelPhase): boolean {
  return phase === 'trip' || phase === 'exit' || phase === 'outcome';
}

/** Annonce de lancement en attente du départ réel du trajet (R4). Objet alloué une fois. */
export interface LaunchGate {
  pending: boolean;
}

/** Crée une porte sans annonce en attente. */
export function createLaunchGate(): LaunchGate {
  return { pending: false };
}

/**
 * À appeler pour chaque événement consommé, avant de l'annoncer. Renvoie `false` si l'événement
 * `launch` est différé (embarquement en cours : il sera libéré par {@link releaseLaunch}) ; un
 * nouvel essai ou la fermeture du réglage annule l'annonce différée.
 * @param gate porte (modifiée).
 * @param event événement consommé.
 * @param phase phase de l'instantané courant.
 */
export function admitEvent(
  gate: LaunchGate,
  event: Readonly<GameEvent>,
  phase: LevelPhase,
): boolean {
  if (event.type === 'reset' || event.type === 'tuningOpened' || event.type === 'tuningClosed') {
    gate.pending = false;
  }
  if (event.type === 'launch' && !tripStarted(phase)) {
    gate.pending = true;
    return false;
  }
  return true;
}

/**
 * Vrai (une seule fois) quand l'annonce de lancement différée peut partir : le trajet a commencé.
 * @param gate porte (modifiée).
 * @param phase phase de l'instantané courant.
 */
export function releaseLaunch(gate: LaunchGate, phase: LevelPhase): boolean {
  if (gate.pending && tripStarted(phase)) {
    gate.pending = false;
    return true;
  }
  return false;
}

/**
 * Phrase à annoncer pour un événement, ou `null` s'il n'y a rien à dire.
 * @param event événement (copier les champs utiles : objet réutilisé par le niveau).
 * @param s instantané courant (valeurs de Kp et de l'erreur finale).
 * @param tr traducteur.
 */
export function announcementFor(
  event: Readonly<GameEvent>,
  s: Readonly<LevelSnapshot>,
  tr: Translator,
): string | null {
  const ki = s.levelId === 'level2';
  switch (event.type) {
    case 'tuningOpened':
      return tr.t(ki ? 'hud.status.readyKi' : 'hud.status.ready');
    case 'tuningClosed':
      return null;
    case 'launch':
      return ki
        ? tr.t('hud.status.launchKi', { kp: formatKp(tr, s.kp), ki: formatKp(tr, s.ki) })
        : tr.t('hud.status.launch', { kp: formatKp(tr, s.kp) });
    case 'firstSaturation':
      return tr.t(ki ? 'level2.saturation' : 'level1.saturation');
    case 'reset':
      return tr.t(ki ? 'hud.status.resetKi' : 'hud.status.reset');
    case 'pause':
      return tr.t('hud.status.paused');
    case 'resume':
      return tr.t('hud.status.resumed');
    case 'outcome': {
      const e = formatError(tr, s.finalError ?? s.e);
      const value = tr.t('hud.error.value', { e });
      switch (event.outcome) {
        case 'win':
          return ki
            ? tr.t('hud.status.winKi', { e: formatError(tr, Math.abs(s.finalError ?? s.e)) })
            : tr.t('hud.status.win', { e });
        case 'step':
          return tr.t(ki ? 'hud.status.fail.stepKi' : 'hud.status.fail.step', { e });
        case 'slow':
          return tr.t('hud.status.fail.slow');
        case 'noLift':
          return `${tr.t('hud.status.fail.noLift', { kp: formatKp(tr, s.kp) })} ${value}`;
        case 'bonk':
          return `${tr.t('hud.status.fail.bonk')} ${value}`;
        case null:
          return null;
      }
    }
  }
}
