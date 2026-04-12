/**
 * Proxy endpoint controller for Remote Falcon API forwarding.
 *
 * Coordinates extracting client info, stripping the /proxy prefix,
 * calling ProxySvc, and formatting the response via ProxyView.
 *
 * @module controllers/proxy.controller
 * @example
 * const ProxyCtrl = require('./proxy.controller');
 * const result = await ProxyCtrl.forward(props, REQ, RESP);
 */

const { ProxySvc } = require("../services");
const { ProxyView } = require("../views");

/**
 * Forward a proxy request to the Remote Falcon API.
 *
 * Extracts client info and request details from props, strips the
 * `/proxy` prefix from the path, delegates to ProxySvc, and returns
 * the formatted response via ProxyView.
 *
 * @async
 * @param {Object} props - Request properties populated by the Router
 * @param {string} [props.path] - The request path (e.g., '/proxy/showDetails')
 * @param {string} [props.method] - The HTTP method (e.g., 'GET', 'POST')
 * @param {Object|null} [props.body] - The parsed request body
 * @param {string} [props.requestId] - Lambda request ID for log correlation
 * @param {{ipAddress: string, userAgent: string, host: string}} [props.clientInfo] - Client information
 * @param {Object} REQ - Cache-data ClientRequest instance
 * @param {Object} RESP - Cache-data Response instance
 * @returns {Promise<{statusCode: number, body: *}>} Formatted response object
 * @throws {Error} Rethrows non-credential errors for the Router to handle as INTERNAL_ERROR
 * @example
 * const result = await forward(
 *   { path: '/proxy/showDetails', method: 'GET', body: null, requestId: 'req-123', clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Mozilla/5.0', host: 'example.com' } },
 *   REQ,
 *   RESP
 * );
 * // result.statusCode === 200
 * // result.body === { preferences: {...}, sequences: [...] }
 */
async function forward(props, REQ, RESP) {
	const path = props.path || REQ.path || "";
	const method = props.method || REQ.method || "GET";
	const body = props.body || REQ.body || null;
	const requestId = props.requestId || "";
	const clientInfo = props.clientInfo || {
		ipAddress: "unknown",
		userAgent: "unknown",
		host: "unknown"
	};

	// Strip /proxy prefix from path for Remote Falcon API
	const remoteFalconPath = path.replace("/proxy", "");

	try {
		const result = await ProxySvc.forwardToRemoteFalcon(
			remoteFalconPath,
			method,
			body,
			clientInfo,
			requestId
		);

		return {
			statusCode: result.statusCode,
			body: ProxyView.forwardView(result)
		};
	} catch (error) {
		// >! Credential retrieval failures return AUTH_ERROR
		if (error.message === "Failed to retrieve credentials") {
			const timestamp = new Date().toISOString();
			return {
				statusCode: 500,
				body: ProxyView.authErrorView(requestId, timestamp)
			};
		}

		// Other errors (network failures, etc.) rethrow for Router to handle as INTERNAL_ERROR
		throw error;
	}
}

module.exports = { forward };
