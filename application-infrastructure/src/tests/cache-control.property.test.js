/**
 * Property-based tests for cache-control utility functions.
 *
 * Feature: dynamic-proxy-cache-control
 * Uses fast-check to verify universal correctness properties of
 * calculateCacheDuration, formatCacheControlHeader, and parseCacheControlHeader.
 */

const { describe, it, expect } = require('@jest/globals');
const fc = require('fast-check');
const {
	calculateCacheDuration,
	formatCacheControlHeader,
	parseCacheControlHeader,
	calculateExpirationDate,
	formatExpiresHeader,
	parseExpiresHeader
} = require('../utils/cache-control');

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

		const dateArb = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z'), noInvalidDate: true });

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
		const dateArb = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z'), noInvalidDate: true });

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
			fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z'), noInvalidDate: true }),
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

describe('Feature: 0-0-1-dynamic-proxy-cache-control, Property 5: Non-playing expiration boundary alignment', () => {

	/**
	 * **Validates: Requirements 5.1, 5.2, 5.4, 6.4**
	 *
	 * For any Date and empty/null playingNow, calculateExpirationDate returns a Date
	 * with minutes % 5 === 0, seconds === 0, strictly after now, and at most 300 seconds after now.
	 */
	it('should return a boundary-aligned Date strictly after now and within 300s for empty/null playingNow', () => {
		const playingNowArb = fc.oneof(
			fc.constant(''),
			fc.constant(null)
		);

		const dateArb = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z'), noInvalidDate: true });

		fc.assert(
			fc.property(
				playingNowArb,
				dateArb,
				(playingNow, now) => {
					const result = calculateExpirationDate(playingNow, now);

					expect(result.getUTCMinutes() % 5).toBe(0);
					expect(result.getUTCSeconds()).toBe(0);
					expect(result.getTime()).toBeGreaterThan(now.getTime());
					expect(result.getTime() - now.getTime()).toBeLessThanOrEqual(300 * 1000);
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: 0-0-1-dynamic-proxy-cache-control, Property 6: Expiration always in the future', () => {

	/**
	 * **Validates: Requirements 5.4, 6.5**
	 *
	 * For any valid playingNow (non-empty string, empty string, or null) and any Date,
	 * calculateExpirationDate returns a Date strictly after now.
	 */
	it('should return a Date strictly after now for all valid playingNow values', () => {
		const playingNowArb = fc.oneof(
			fc.string({ minLength: 1 }),
			fc.constant(''),
			fc.constant(null)
		);

		const dateArb = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z'), noInvalidDate: true });

		fc.assert(
			fc.property(
				playingNowArb,
				dateArb,
				(playingNow, now) => {
					const result = calculateExpirationDate(playingNow, now);
					expect(result.getTime()).toBeGreaterThan(now.getTime());
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: 0-0-1-dynamic-proxy-cache-control, Property 7: Expires header round-trip', () => {

	/**
	 * **Validates: Requirements 7.1, 7.2, 7.3**
	 *
	 * For any valid Date, formatting then parsing produces a Date whose time value
	 * equals the original Date's time value truncated to whole seconds.
	 */
	it('should round-trip format and parse with milliseconds truncated', () => {
		const dateArb = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z'), noInvalidDate: true });

		fc.assert(
			fc.property(
				dateArb,
				(date) => {
					const parsed = parseExpiresHeader(formatExpiresHeader(date));
					const expectedMs = Math.floor(date.getTime() / 1000) * 1000;
					expect(parsed.getTime()).toBe(expectedMs);
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: 0-0-1-dynamic-proxy-cache-control, Property 8: Cache-Control and Expires consistency', () => {

	/**
	 * **Validates: Requirements 8.1, 8.2**
	 *
	 * For any valid playingNow and any Date, calculateExpirationDate(pn, now).getTime()
	 * equals now.getTime() + calculateCacheDuration(pn, now) * 1000.
	 */
	it('should have consistent expiration between Cache-Control and Expires', () => {
		const playingNowArb = fc.oneof(
			fc.string({ minLength: 1 }),
			fc.constant(''),
			fc.constant(null)
		);

		const dateArb = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z'), noInvalidDate: true });

		fc.assert(
			fc.property(
				playingNowArb,
				dateArb,
				(playingNow, now) => {
					const expirationDate = calculateExpirationDate(playingNow, now);
					const cacheDuration = calculateCacheDuration(playingNow, now);
					expect(expirationDate.getTime()).toBe(now.getTime() + cacheDuration * 1000);
				}
			),
			{ numRuns: 100 }
		);
	});
});
