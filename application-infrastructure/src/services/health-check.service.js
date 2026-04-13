/**
 * Health check service for Remote Falcon connectivity monitoring.
 *
 * Wraps the existing ProxySvc.forwardToRemoteFalcon() call to the
 * GET /showDetails endpoint with a 5-second timeout and never-throw
 * semantics. Returns a structured status object indicating connectivity,
 * HTTP status, and lightweight metadata from Remote Falcon.
 *
 * @module services/health-check.service
 * @example
 * const HealthCheckSvc = require('./health-check.service');
 * const status = await HealthCheckSvc.checkRemoteFalcon(
 *   { ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0', host: 'example.com' },
 *   'req-123'
 * );
 * // status.isConnected === true or false
 */

const ProxySvc = require('./proxy.service');

/**
 * Maximum time in milliseconds to wait for the Remote Falcon
 * /showDetails response before treating the request as timed out.
 *
 * @type {number}
 */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Check Remote Falcon connectivity via GET /showDetails.
 *
 * Calls ProxySvc.forwardToRemoteFalcon for the /showDetails endpoint
 * and enforces a timeout using Promise.race. The function never throws;
 * all error paths are caught and mapped to a structured failure object.
 *
 * On success (2xx), returns connectivity metadata extracted from the
 * response body including viewer control preferences and playback info.
 * On failure (HTTP error, network error, or timeout), returns a failure
 * object with isConnected false and a descriptive error message.
 *
 * @async
 * @param {{ipAddress: string, userAgent: string, host: string}} clientInfo - Client information for logging
 * @param {string} requestId - Lambda request ID for log correlation
 * @returns {Promise<{isConnected: boolean, statusCode: number, viewerControlEnabled?: boolean, viewerControlMode?: string, playingNow?: (string|null), playingNext?: (string|null), error?: string}>} Always resolves, never throws
 * @example
 * // Success response
 * const status = await checkRemoteFalcon(clientInfo, 'req-abc');
 * // {
 * //   isConnected: true,
 * //   statusCode: 200,
 * //   viewerControlEnabled: true,
 * //   viewerControlMode: "jukebox",
 * //   playingNow: "Let It Go",
 * //   playingNext: "Into the Unknown"
 * // }
 *
 * @example
 * // Failure response
 * const status = await checkRemoteFalcon(clientInfo, 'req-abc');
 * // {
 * //   isConnected: false,
 * //   statusCode: 0,
 * //   error: "Health check timed out after 5000ms"
 * // }
 */
async function checkRemoteFalcon(clientInfo, requestId) {
	try {
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`));
			}, HEALTH_CHECK_TIMEOUT_MS);
		});

		const fetchPromise = ProxySvc.forwardToRemoteFalcon(
			'/showDetails',
			'GET',
			null,
			clientInfo,
			requestId
		);

		const response = await Promise.race([fetchPromise, timeoutPromise]);

		if (response.statusCode >= 200 && response.statusCode <= 299) {
			return {
				isConnected: true,
				statusCode: response.statusCode,
				viewerControlEnabled: response.body && response.body.preferences
					? response.body.preferences.viewerControlEnabled
					: undefined,
				viewerControlMode: response.body && response.body.preferences
					? response.body.preferences.viewerControlMode
					: undefined,
				playingNow: response.body ? response.body.playingNow : undefined,
				playingNext: response.body ? response.body.playingNext : undefined
			};
		}

		return {
			isConnected: false,
			statusCode: response.statusCode,
			error: `Remote Falcon returned HTTP ${response.statusCode}`
		};
	} catch (error) {
		if (error.message && error.message.includes('timed out')) {
			return {
				isConnected: false,
				statusCode: 0,
				error: error.message
			};
		}

		return {
			isConnected: false,
			statusCode: 0,
			error: `Network error: ${error.message || 'Unknown error'}`
		};
	}
}

module.exports = {
	checkRemoteFalcon
};
