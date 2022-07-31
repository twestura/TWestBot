/** Utility for generating random numbers. */

/**
 * Returns a random int in `ceil(a)..=floor(b)`, with both bounds inclusive.
 * Requires `ceil(a) <= floor(b)`.
 * See "Getting a random integer between two values, inclusive:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 */
export const rand_int: (a: number, b: number) => number = (a, b) => {
  const min = Math.ceil(a);
  const max = Math.floor(b);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
