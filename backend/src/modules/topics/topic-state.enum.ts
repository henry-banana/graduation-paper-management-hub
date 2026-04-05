// Topic type: BCTT (Báo cáo thực tập) or KLTN (Khóa luận tốt nghiệp)
export type TopicType = 'BCTT' | 'KLTN';

// Topic states for BCTT workflow
export type BcttState =
  | 'DRAFT'
  | 'PENDING_GV'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'GRADING'
  | 'COMPLETED'
  | 'CANCELLED';

// Topic states for KLTN workflow
export type KltnState =
  | 'DRAFT'
  | 'PENDING_GV'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'PENDING_CONFIRM'
  | 'DEFENSE'
  | 'SCORING'
  | 'COMPLETED'
  | 'CANCELLED';

// Combined topic state
export type TopicState = BcttState | KltnState;

// State transition actions
export type TopicAction =
  | 'SUBMIT_TO_GV'        // DRAFT -> PENDING_GV
  | 'APPROVE'             // PENDING_GV -> CONFIRMED
  | 'REJECT'              // Canonical reject endpoint handles state-specific outcomes
  | 'START_PROGRESS'      // CONFIRMED -> IN_PROGRESS
  | 'MOVE_TO_GRADING'     // IN_PROGRESS -> GRADING (BCTT)
  | 'REQUEST_CONFIRM'     // IN_PROGRESS -> PENDING_CONFIRM (KLTN)
  | 'CONFIRM_DEFENSE'     // PENDING_CONFIRM -> DEFENSE (KLTN)
  | 'START_SCORING'       // DEFENSE -> SCORING (KLTN) or GRADING -> SCORING (BCTT)
  | 'COMPLETE'            // GRADING/SCORING -> COMPLETED
  | 'CANCEL'              // Any -> CANCELLED
  | 'TIMEOUT_CANCEL';     // System action for auto-cancel

// Valid state transitions for BCTT
export const BCTT_STATE_TRANSITIONS: Record<BcttState, BcttState[]> = {
  DRAFT: ['PENDING_GV', 'CANCELLED'],
  PENDING_GV: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['GRADING', 'CANCELLED'],
  GRADING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// Valid state transitions for KLTN
export const KLTN_STATE_TRANSITIONS: Record<KltnState, KltnState[]> = {
  DRAFT: ['PENDING_GV', 'CANCELLED'],
  PENDING_GV: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_CONFIRM', 'CANCELLED'],
  PENDING_CONFIRM: ['DEFENSE', 'IN_PROGRESS', 'CANCELLED'],
  DEFENSE: ['SCORING', 'CANCELLED'],
  SCORING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// States that allow topic editing
export const EDITABLE_STATES: TopicState[] = ['DRAFT', 'PENDING_GV'];

// States that allow deadline changes
export const DEADLINE_EDITABLE_STATES: TopicState[] = [
  'CONFIRMED',
  'IN_PROGRESS',
  'PENDING_CONFIRM',
  'DEFENSE',
];

// Action to state mapping
export const ACTION_TO_STATE: Record<TopicAction, TopicState> = {
  SUBMIT_TO_GV: 'PENDING_GV',
  APPROVE: 'CONFIRMED',
  REJECT: 'CANCELLED',
  START_PROGRESS: 'IN_PROGRESS',
  MOVE_TO_GRADING: 'GRADING',
  REQUEST_CONFIRM: 'PENDING_CONFIRM',
  CONFIRM_DEFENSE: 'DEFENSE',
  START_SCORING: 'SCORING',
  COMPLETE: 'COMPLETED',
  CANCEL: 'CANCELLED',
  TIMEOUT_CANCEL: 'CANCELLED',
};

/**
 * Validate if a state transition is allowed
 */
export function isValidTransition(
  type: TopicType,
  fromState: TopicState,
  toState: TopicState,
): boolean {
  const transitions =
    type === 'BCTT'
      ? BCTT_STATE_TRANSITIONS[fromState as BcttState]
      : KLTN_STATE_TRANSITIONS[fromState as KltnState];

  return transitions?.includes(toState as never) ?? false;
}

/**
 * Get allowed next states for a topic
 */
export function getAllowedNextStates(
  type: TopicType,
  currentState: TopicState,
): TopicState[] {
  return type === 'BCTT'
    ? (BCTT_STATE_TRANSITIONS[currentState as BcttState] ?? [])
    : (KLTN_STATE_TRANSITIONS[currentState as KltnState] ?? []);
}

/**
 * Check if topic can be edited in current state
 */
export function canEditTopic(state: TopicState): boolean {
  return EDITABLE_STATES.includes(state);
}

/**
 * Check if deadline can be changed in current state
 */
export function canEditDeadline(state: TopicState): boolean {
  return DEADLINE_EDITABLE_STATES.includes(state);
}
