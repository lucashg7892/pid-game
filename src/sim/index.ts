/** Noyau de simulation (spec T-001 §4). Pur : ni DOM, ni three, ni horloge murale. */

export type {
  ClosedLoop,
  ClosedLoopConfig,
  Controller,
  FixedStepClock,
  Integrator,
  LoopSample,
  PlantModel,
  Saturation,
  SignalName,
  SignalRecorder,
} from './types';
export {
  MAX_FRAME_SECONDS,
  MAX_SIM_DT,
  MAX_STEPS_PER_FRAME,
  SIM_DT,
  createFixedStepClock,
  type ResettableFixedStepClock,
} from './clock';
export { createRk4 } from './integrators';
export { createSaturation, isSaturated, saturate } from './saturation';
export { SIGNAL_STRIDE, createSignalRecorder, type CircularSignalRecorder } from './signals';
export { createProportionalController, type ProportionalController } from './controllers/p';
export {
  ELEVATOR_MAX_FORCE,
  ELEVATOR_PARAMS,
  ELEVATOR_POSITION,
  ELEVATOR_SETPOINT,
  ELEVATOR_STATE_SIZE,
  ELEVATOR_VELOCITY,
  createElevator,
  createElevatorLoop,
  type ElevatorLoopOptions,
  type ElevatorParams,
} from './plants/elevator';
export { createClosedLoop, type SteppableClosedLoop } from './loop';
