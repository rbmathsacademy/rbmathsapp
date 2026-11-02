/** Reasons that only mean the time ran out - not a termination. */
const TIME_UP = ['time_limit', 'server_auto_expired'];

/** True when the attempt was cut short by the proctoring (terminated), not just time up. */
export function isTerminated(reason: string | null | undefined): boolean {
    return !!reason && !TIME_UP.includes(reason);
}
