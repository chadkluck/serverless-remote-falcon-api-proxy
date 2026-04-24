/**
 * @module utils/cache-control
 *
 * Pure utility functions for calculating and formatting Cache-Control
 * and Expires header values based on Remote Falcon playback state.
 */

const ACTIVE_PLAYBACK_MAX_AGE = 5;
const INTERVAL_SECONDS = 300;
const MIN_MAX_AGE = 1;
const MAX_MAX_AGE = 300;

/**
 * Calculate the Cache-Control max-age value based on playback state.
 *
 * When a sequence is actively playing, returns a short cache duration (5 s).
 * When nothing is playing, returns the whole seconds remaining until the
 * next 5-minute clock-aligned interval boundary, clamped to [1, 300].
 *
 * @param {string|null} playingNow - The playingNow field from the Remote Falcon response
 * @param {Date} now - The current time
 * @returns {number} max-age in seconds (integer, 1–300 inclusive)
 * @example
 * // Active playback
 * calculateCacheDuration("Jingle Bells", new Date()); // 5
 *
 * @example
 * // Nothing playing at 08:01:30 → 210 seconds to 08:05:00
 * calculateCacheDuration("", new Date("2025-01-01T08:01:30Z")); // 210
 *
 * @example
 * // Exactly on boundary → full interval
 * calculateCacheDuration(null, new Date("2025-01-01T08:05:00Z")); // 300
 */
function calculateCacheDuration(playingNow, now) {
	if (typeof playingNow === 'string' && playingNow.length > 0) {
		return ACTIVE_PLAYBACK_MAX_AGE;
	}

	// >! Guard against invalid Date to prevent NaN propagation
	if (isNaN(now.getTime())) {
		return MAX_MAX_AGE;
	}

	const totalSeconds = now.getMinutes() * 60 + now.getSeconds();
	const secondsIntoInterval = totalSeconds % INTERVAL_SECONDS;

	if (secondsIntoInterval === 0) {
		return MAX_MAX_AGE;
	}

	const secondsRemaining = INTERVAL_SECONDS - secondsIntoInterval;
	return Math.max(MIN_MAX_AGE, Math.min(MAX_MAX_AGE, secondsRemaining));
}

/**
 * Format a max-age integer into a Cache-Control header value.
 *
 * @param {number} maxAgeSeconds - The max-age value (positive integer)
 * @returns {string} e.g. "max-age=5"
 * @example
 * formatCacheControlHeader(5); // "max-age=5"
 * formatCacheControlHeader(210); // "max-age=210"
 */
function formatCacheControlHeader(maxAgeSeconds) {
	return `max-age=${maxAgeSeconds}`;
}

/**
 * Parse a Cache-Control header value to extract the max-age integer.
 *
 * @param {string} headerValue - e.g. "max-age=5"
 * @returns {number} The max-age integer
 * @example
 * parseCacheControlHeader("max-age=5"); // 5
 * parseCacheControlHeader("max-age=210"); // 210
 */
function parseCacheControlHeader(headerValue) {
	return parseInt(headerValue.replace('max-age=', ''), 10);
}

/**
 * Calculate the absolute expiration Date based on playback state.
 *
 * When a sequence is actively playing, returns now + 5 seconds.
 * When nothing is playing, returns the next 5-minute clock-aligned
 * interval boundary (e.g., if now is 08:01:30, returns 08:05:00).
 * When exactly on a boundary, returns now + 300 seconds (the next boundary).
 *
 * @param {string|null} playingNow - The playingNow field from the Remote Falcon response
 * @param {Date} now - The current time
 * @returns {Date} The absolute expiration timestamp
 * @example
 * // Active playback at 08:01:30 → expires at 08:01:35
 * calculateExpirationDate("Jingle Bells", new Date("2025-01-01T08:01:30Z"));
 *
 * @example
 * // Nothing playing at 08:01:30 → expires at 08:05:00
 * calculateExpirationDate("", new Date("2025-01-01T08:01:30Z"));
 *
 * @example
 * // Exactly on boundary at 08:05:00 → expires at 08:10:00
 * calculateExpirationDate(null, new Date("2025-01-01T08:05:00.000Z"));
 */
function calculateExpirationDate(playingNow, now) {
	if (typeof playingNow === 'string' && playingNow.length > 0) {
		return new Date(now.getTime() + ACTIVE_PLAYBACK_MAX_AGE * 1000);
	}

	// >! Guard against invalid Date to prevent NaN propagation
	if (isNaN(now.getTime())) {
		return new Date(Date.now() + INTERVAL_SECONDS * 1000);
	}

	const duration = calculateCacheDuration(playingNow, now);
	return new Date(now.getTime() + duration * 1000);
}

/**
 * Format a Date as an HTTP-date string per RFC 7234.
 *
 * Produces the format: `<day-name>, <DD> <Mon> <YYYY> <HH>:<MM>:<SS> GMT`
 *
 * @param {Date} date - The date to format
 * @returns {string} e.g. "Wed, 01 Jan 2025 08:05:00 GMT"
 * @example
 * formatExpiresHeader(new Date("2025-01-01T08:05:00Z"));
 * // "Wed, 01 Jan 2025 08:05:00 GMT"
 */
function formatExpiresHeader(date) {
	return date.toUTCString();
}

/**
 * Parse an HTTP-date string to extract a Date object.
 *
 * Accepts the RFC 7234 HTTP-date format produced by {@link formatExpiresHeader}.
 *
 * @param {string} headerValue - e.g. "Wed, 01 Jan 2025 08:05:00 GMT"
 * @returns {Date} The parsed Date
 * @example
 * parseExpiresHeader("Wed, 01 Jan 2025 08:05:00 GMT");
 * // Date object for 2025-01-01T08:05:00.000Z
 */
function parseExpiresHeader(headerValue) {
	return new Date(headerValue);
}

module.exports = {
	calculateCacheDuration,
	formatCacheControlHeader,
	parseCacheControlHeader,
	calculateExpirationDate,
	formatExpiresHeader,
	parseExpiresHeader
};
