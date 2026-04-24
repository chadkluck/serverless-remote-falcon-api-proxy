/**
 * Unit tests for cache-control utility module.
 *
 * Tests calculateCacheDuration, formatCacheControlHeader, and
 * parseCacheControlHeader with specific examples and edge cases.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.4, 4.1, 4.2
 */

const { calculateCacheDuration, formatCacheControlHeader, parseCacheControlHeader, calculateExpirationDate, formatExpiresHeader, parseExpiresHeader } = require('../utils/cache-control');

describe('cache-control utility', () => {

	/* ------------------------------------------------------------------ */
	/*  calculateCacheDuration                                             */
	/* ------------------------------------------------------------------ */
	describe('calculateCacheDuration', () => {

		describe('when playingNow is a non-empty string', () => {
			it('should return 5 for active playback', () => {
				const result = calculateCacheDuration('Jingle Bells', new Date('2025-01-01T08:01:30Z'));
				expect(result).toBe(5);
			});

			it('should return 5 regardless of the current time', () => {
				const result = calculateCacheDuration('Silent Night', new Date('2025-01-01T08:05:00Z'));
				expect(result).toBe(5);
			});
		});

		describe('when playingNow is empty string', () => {
			it('should return 210 at 08:01:30 (3.5 min to next boundary 08:05:00)', () => {
				const result = calculateCacheDuration('', new Date('2025-01-01T08:01:30Z'));
				expect(result).toBe(210);
			});

			it('should return 1 at 08:04:59 (1 second to next boundary)', () => {
				const result = calculateCacheDuration('', new Date('2025-01-01T08:04:59Z'));
				expect(result).toBe(1);
			});

			it('should return 300 at 08:05:00 (exactly on boundary → full interval)', () => {
				const result = calculateCacheDuration('', new Date('2025-01-01T08:05:00Z'));
				expect(result).toBe(300);
			});

			it('should return 180 at 08:02:00 (3 minutes to next boundary)', () => {
				const result = calculateCacheDuration('', new Date('2025-01-01T08:02:00Z'));
				expect(result).toBe(180);
			});
		});

		describe('when playingNow is null', () => {
			it('should return 210 at 08:01:30', () => {
				const result = calculateCacheDuration(null, new Date('2025-01-01T08:01:30Z'));
				expect(result).toBe(210);
			});

			it('should return 1 at 08:04:59', () => {
				const result = calculateCacheDuration(null, new Date('2025-01-01T08:04:59Z'));
				expect(result).toBe(1);
			});

			it('should return 300 at 08:05:00 (exactly on boundary)', () => {
				const result = calculateCacheDuration(null, new Date('2025-01-01T08:05:00Z'));
				expect(result).toBe(300);
			});

			it('should return 180 at 08:02:00', () => {
				const result = calculateCacheDuration(null, new Date('2025-01-01T08:02:00Z'));
				expect(result).toBe(180);
			});
		});
	});

	/* ------------------------------------------------------------------ */
	/*  formatCacheControlHeader                                           */
	/* ------------------------------------------------------------------ */
	describe('formatCacheControlHeader', () => {
		it('should produce "max-age=5" for input 5', () => {
			expect(formatCacheControlHeader(5)).toBe('max-age=5');
		});

		it('should produce "max-age=210" for input 210', () => {
			expect(formatCacheControlHeader(210)).toBe('max-age=210');
		});

		it('should produce "max-age=300" for input 300', () => {
			expect(formatCacheControlHeader(300)).toBe('max-age=300');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  parseCacheControlHeader                                            */
	/* ------------------------------------------------------------------ */
	describe('parseCacheControlHeader', () => {
		it('should extract 5 from "max-age=5"', () => {
			expect(parseCacheControlHeader('max-age=5')).toBe(5);
		});

		it('should extract 210 from "max-age=210"', () => {
			expect(parseCacheControlHeader('max-age=210')).toBe(210);
		});

		it('should extract 300 from "max-age=300"', () => {
			expect(parseCacheControlHeader('max-age=300')).toBe(300);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  calculateExpirationDate                                            */
	/* ------------------------------------------------------------------ */
	describe('calculateExpirationDate', () => {

		describe('when playingNow is a non-empty string', () => {
			it('should return now + 5 seconds', () => {
				const now = new Date('2025-01-01T08:01:30Z');
				const result = calculateExpirationDate('Jingle Bells', now);
				expect(result.getTime()).toBe(now.getTime() + 5000);
			});
		});

		describe('when playingNow is empty string', () => {
			it('should return 08:05:00 at 08:01:30', () => {
				const result = calculateExpirationDate('', new Date('2025-01-01T08:01:30Z'));
				expect(result.getTime()).toBe(new Date('2025-01-01T08:05:00Z').getTime());
			});

			it('should return 08:10:00 at 08:05:00 (on boundary)', () => {
				const result = calculateExpirationDate('', new Date('2025-01-01T08:05:00.000Z'));
				expect(result.getTime()).toBe(new Date('2025-01-01T08:10:00Z').getTime());
			});
		});

		describe('when playingNow is null', () => {
			it('should return 08:05:00 at 08:04:59', () => {
				const result = calculateExpirationDate(null, new Date('2025-01-01T08:04:59Z'));
				expect(result.getTime()).toBe(new Date('2025-01-01T08:05:00Z').getTime());
			});

			it('should return 08:05:00 at 08:02:00', () => {
				const result = calculateExpirationDate(null, new Date('2025-01-01T08:02:00Z'));
				expect(result.getTime()).toBe(new Date('2025-01-01T08:05:00Z').getTime());
			});
		});
	});

	/* ------------------------------------------------------------------ */
	/*  formatExpiresHeader                                                */
	/* ------------------------------------------------------------------ */
	describe('formatExpiresHeader', () => {
		it('should produce correct HTTP-date string', () => {
			const date = new Date('2025-01-01T08:05:00Z');
			const result = formatExpiresHeader(date);
			expect(result).toBe('Wed, 01 Jan 2025 08:05:00 GMT');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  parseExpiresHeader                                                 */
	/* ------------------------------------------------------------------ */
	describe('parseExpiresHeader', () => {
		it('should extract correct Date from HTTP-date string', () => {
			const result = parseExpiresHeader('Wed, 01 Jan 2025 08:05:00 GMT');
			expect(result.getTime()).toBe(new Date('2025-01-01T08:05:00Z').getTime());
		});
	});
});
