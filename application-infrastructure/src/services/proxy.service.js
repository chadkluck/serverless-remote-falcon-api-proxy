/**
 * Proxy forwarding service for Remote Falcon API.
 *
 * Coordinates JWT authentication and request forwarding to the
 * Remote Falcon external API. Delegates HTTP communication to
 * RemoteFalconDao and JWT generation to JwtSvc.
 *
 * @module services/proxy.service
 * @example
 * const ProxySvc = require('./proxy.service');
 * const result = await ProxySvc.forwardToRemoteFalcon(
 *   '/showDetails',
 *   'GET',
 *   null,
 *   { ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0', host: 'example.com' },
 *   'req-123'
 * );
 */

const JwtSvc = require('./jwt.service');
const { RemoteFalconDao } = require('../models');
const { Config } = require('../config');

/**
 * Forward a request to the Remote Falcon API with JWT authentication.
 *
 * Retrieves a cached or fresh JWT token, constructs the full Remote Falcon
 * API URL, and delegates the HTTP request to RemoteFalconDao.forward().
 *
 * @async
 * @param {string} path - The API path to forward to (e.g., '/showDetails')
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {Object|null} body - Request body (ignored for GET requests)
 * @param {{ipAddress: string, userAgent: string, host: string}} clientInfo - Client information for logging
 * @param {string} requestId - Lambda request ID for log correlation
 * @returns {Promise<{statusCode: number, body: Object, headers: Object}>} Response from Remote Falcon API
 * @throws {Error} "Failed to retrieve credentials" if SSM credential retrieval fails
 * @throws {Error} "Failed to communicate with Remote Falcon API" on network errors
 * @example
 * const result = await forwardToRemoteFalcon('/showDetails', 'GET', null, clientInfo, 'req-abc');
 * // result.statusCode === 200
 * // result.body === { preferences: {...}, sequences: [...] }
 */
async function forwardToRemoteFalcon(path, method, body, clientInfo, requestId) {
	const jwt = await JwtSvc.getToken();
	const url = Config.settings().remoteFalconApiBaseUrl + path;
	return RemoteFalconDao.forward(url, method, body, jwt, clientInfo, requestId);
}

module.exports = {
	forwardToRemoteFalcon
};
