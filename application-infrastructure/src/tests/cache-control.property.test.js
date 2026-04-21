/**
 * Property-based tests for cache-control utility functions.
 *
 * Feature: dynamic-proxy-cache-control
 * Uses fast-check to verify universal correctness properties of
 * calculateCacheDuration, formatCacheControlHeader, and parseCacheControlHeader.
 */

const { describe, it, expect } = require('@jest/globals');
const fc = require('fast-check');
const { calculateCacheDuration, formatCacheControlHeader, parseCacheControlHeader } = require('../utils/cache-control');

describe('Feature: dynamic-proxy-cache-control, Property 1: Deterministic output and range bounds', () => {

	/**
	 * **Validates: Requirements 3.2, 3.4**
	 *
	 * For all valid inputs, calculateCacheDuration returns an integer between 1 and 300 inclusive.
	 */
	it('should return an integer in [1, 300] for all valid inputs', () => {
		const playingNowArb = fc.oneof(
			fc.string({ minLength: 1 }),
			fc.constant(''),
			fc.constant(null)
		);

		const dateArb = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z') });

		fc.assert(
			fc.property(
				playingNowArb,
				dateArb,
				(playingNow, now) => {
					const result = calculateCacheDuration(playingNow, now);

					expect(Number.isInteger(result)).toBe(true);
					expect(result).toBeGreaterThanOrEqual(1);
					expect(result).toBeLessThanOrEqual(300);
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: dynamic-proxy-cache-control, Property 2: Active playback constant', () => {

	/**
	 * **Validates: Requirements 1.1**
	 *
	 * For all non-empty playingNow strings and any Date, calculateCacheDuration returns exactly 5.
	 */
	it('should return exactly 5 for all non-empty playingNow strings', () => {
		const nonEmptyStringArb = fc.string({ minLength: 1 });
		const dateArb = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z') });

		fc.assert(
			fc.property(
				nonEmptyStringArb,
				dateArb,
				(playingNow, now) => {
					const result = calculateCacheDuration(playingNow, now);
					expect(result).toBe(5);
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: dynamic-proxy-cache-control, Property 3: Monotonic decrease within interval', () => {

	/**
	 * **Validates: Requirements 3.5**
	 *
	 * For two times within the same 5-minute interval where playingNow is empty/null,
	 * the earlier time produces a max-age >= the later time's max-age.
	 */
	it('should return monotonically decreasing max-age within the same 5-minute interval', () => {
		const intervalArb = fc.tuple(
			fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z') }),
			fc.integer({ min: 0, max: 299 }),
			fc.integer({ min: 0, max: 299 })
		);

		fc.assert(
			fc.property(
				intervalArb,
				([baseDate, offsetA, offsetB]) => {
					// Compute the base of the 5-minute interval
					const baseMs = baseDate.getTime();
					const totalSeconds = Math.floor(baseMs / 1000);
					const intervalBase = totalSeconds - (totalSeconds % 300);

					// Create two times within the same 5-minute interval
					const timeA = new Date(intervalBase * 1000 + offsetA * 1000);
					const timeB = new Date(intervalBase * 1000 + offsetB * 1000);

					// Determine earlier and later
					const earlier = offsetA <= offsetB ? timeA : timeB;
					const later = offsetA <= offsetB ? timeB : timeA;

					const maxAgeEarlier = calculateCacheDuration(null, earlier);
					const maxAgeLater = calculateCacheDuration(null, later);

					expect(maxAgeEarlier).toBeGreaterThanOrEqual(maxAgeLater);
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: dynamic-proxy-cache-control, Property 4: Round-trip consistency', () => {

	/**
	 * **Validates: Requirements 4.3**
	 *
	 * For all integers in [1, 300], formatting then parsing produces the original integer.
	 */
	it('should round-trip format and parse for all valid max-age values', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 1, max: 300 }),
				(n) => {
					const formatted = formatCacheControlHeader(n);
					const parsed = parseCacheControlHeader(formatted);
					expect(parsed).toBe(n);
				}
			),
			{ numRuns: 100 }
		);
	});
});
