/**
 * Annonces de la région `aria-live="polite"` (spec T-001 §8, T-010) : une phrase par événement
 * du niveau (`level.drainEvents`, chaque événement consommé une seule fois). Fonction pure : les
 * valeurs viennent de l'instantané lu au moment de la consommation.
 */
import type { GameEvent, LevelSnapshot } from '../game';
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
