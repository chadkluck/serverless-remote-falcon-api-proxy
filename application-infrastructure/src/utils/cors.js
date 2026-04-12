/**
 * CORS header generation utility
 * 
 * Provides cross-origin resource sharing headers and security headers
 * for all API responses. Supports exact origin matching, wildcard patterns,
 * and credential handling.
 * 
 * Ported from old-backend getCorsHeaders with identical logic.
 * 
 * @module utils/cors
 * @example
 * const cors = require('./cors');
 * const headers = cors.getCorsHeaders('https://mysite.com');
 */

/**
 * Get CORS and security headers based on request origin.
 * 
 * Parses the ALLOWED_ORIGINS environment variable (comma-separated list),
 * matches the request origin against allowed origins (exact match or wildcard
 * pattern), and returns appropriate CORS and security headers.
 * 
 * @param {string|undefined} origin - The request Origin header value
 * @returns {Object} Headers object containing CORS and security headers
 * @example
 * // With specific allowed origin
 * // ALLOWED_ORIGINS=https://mysite.com,https://other.com
 * const headers = getCorsHeaders('https://mysite.com');
 * // headers['Access-Control-Allow-Origin'] === 'https://mysite.com'
 * // headers['Access-Control-Allow-Credentials'] === 'true'
 * 
 * @example
 * // With wildcard pattern
 * // ALLOWED_ORIGINS=*.mysite.com
 * const headers = getCorsHeaders('https://app.mysite.com');
 * // headers['Access-Control-Allow-Origin'] === 'https://app.mysite.com'
 */
function getCorsHeaders(origin) {
	const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'];

	// >! Check if the origin is allowed using exact match or wildcard pattern
	const isAllowed = allowedOrigins.includes('*') || 
		allowedOrigins.some(allowed => {
			if (allowed.includes('*')) {
				let pattern = allowed
					.replace(/\./g, '\\.')
					.replace(/\*/g, '.*');
				return new RegExp(`^${pattern}$`).test(origin);
			}
			return allowed === origin;
		});

	let allowedOrigin;
	let allowCredentials = 'false';

	if (!origin) {
		allowedOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins[0];
	} else {
		if (isAllowed) {
			allowedOrigin = origin;
			if (!allowedOrigins.includes('*') && !origin.includes('*')) {
				allowCredentials = 'true';
			}
		} else {
			allowedOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins[0];
		}
	}

	const headers = {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
		'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
		'Access-Control-Allow-Credentials': allowCredentials,
		'Vary': 'Origin',
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'X-XSS-Protection': '1; mode=block',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
	};

	return headers;
}

module.exports = { getCorsHeaders };
