/** A result type for error handling. */

/**
 * Success values return `ok` as `true` with value `val`.
 * Failure values return `ok` as `false` with error `err`.
 */
export type Result<T, E> = { ok: true; val: T } | { ok: false; err: E };

/** Returns a success value `t`. */
export const ok: <T, E>(t: T) => Result<T, E> = (t) => ({ ok: true, val: t });

/** Returns a failure value `e`. */
export const err: <T, E>(e: E) => Result<T, E> = (e) => ({ ok: false, err: e });
