// Round 49: one tap = one trip. While the Add food sheet is leaving for another page, it stays open (no flash of Today)
// and ignores a second tap. Pure helpers here (no React) so the tests can run them.

/** How long we wait before we give up and let her try again (the trip never finished). */
export const NAV_GIVE_UP_MS = 12000;

export type NavState = { pending: string | null };

export const IDLE_NAV: NavState = { pending: null };

/** A tap on `key`. `go` = true means "start the trip now"; false = a trip is already under way, ignore this tap. */
export function beginNav(state: NavState, key: string): { state: NavState; go: boolean } {
  if (state.pending !== null) return { state, go: false };
  return { state: { pending: key }, go: true };
}

/** The trip ended (arrived, failed, or she came back): taps work again. */
export function endNav(): NavState {
  return IDLE_NAV;
}

/** Is this one row the busy one? */
export function isPending(state: NavState, key: string): boolean {
  return state.pending === key;
}
