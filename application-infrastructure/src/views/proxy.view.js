/**
 * Proxy response formatting view
 * 
 * Formats proxy endpoint responses including forwarded results,
 * not-found errors, and authentication errors.
 * 
 * @module views/proxy.view
 * @example
 * const ProxyView = require('./proxy.view');
 * const body = ProxyView.forwardView({ body: { sequences: [] } });
 */

/**
 * Format a forwarded proxy response (pass-through).
 * 
 * @param {Object} result - Result from Remote Falcon API forwarding
 * @param {*} result.body - The response body from Remote Falcon API
 * @returns {*} The response body passed through unchanged
 * @example
 * const body = forwardView({ body: { sequences: [], preferences: {} } });
 * // { sequences: [], preferences: {} }
 */
const forwardView = (result) => {
	return result.body;
};

/**
 * Format a 404 not-found response with available endpoints.
 * 
 * @param {string} requestId - The Lambda request ID
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {{message: string, error: string, requestId: string, availableEndpoints: Array<string>, timestamp: string}} Formatted 404 response
 * @example
 * const body = notFoundView('abc-123', new Date().toISOString());
 * // { message: 'Endpoint not found', error: 'NOT_FOUND', requestId: 'abc-123', availableEndpoints: [...], timestamp: '...' }
 */
const notFoundView = (requestId, timestamp) => {
	return {
		message: 'Endpoint not found',
		error: 'NOT_FOUND',
		requestId,
		availableEndpoints: [
			'POST /telemetry - Track user events',
			'GET /proxy/showDetails - Get show details',
			'POST /proxy/addSequenceToQueue - Add sequence to queue',
			'POST /proxy/voteForSequence - Vote for sequence'
		],
		timestamp
	};
};

/**
 * Format an authentication error response.
 * 
 * @param {string} requestId - The Lambda request ID
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {{message: string, error: string, requestId: string, timestamp: string}} Formatted auth error response
 * @example
 * const body = authErrorView('abc-123', new Date().toISOString());
 * // { message: 'Authentication service unavailable', error: 'AUTH_ERROR', requestId: 'abc-123', timestamp: '...' }
 */
const authErrorView = (requestId, timestamp) => {
	return {
		message: 'Authentication service unavailable',
		error: 'AUTH_ERROR',
		requestId,
		timestamp
	};
};

module.exports = { forwardView, notFoundView, authErrorView };
