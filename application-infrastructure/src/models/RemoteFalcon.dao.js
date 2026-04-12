const RemoteFalconLogBuilder = require("../utils/RemoteFalconLogBuilder");

/**
 * Remote Falcon API Data Access Object.
 * 
 * Forwards authenticated requests to the Remote Falcon external API
 * with structured logging via RemoteFalconLogBuilder. Uses native fetch
 * for HTTP requests with behavioral parity to the old-backend
 * `forwardToRemoteFalcon` function.
 * 
 * @module models/RemoteFalcon.dao
 * @example
 * const { forward } = require("./RemoteFalcon.dao");
 * const result = await forward(
 *   "https://remotefalcon.com/remote-falcon-external-api/showDetails",
 *   "GET",
 *   null,
 *   jwtToken,
 *   { ipAddress: "127.0.0.1", userAgent: "Mozilla/5.0", host: "example.com" },
 *   "req-123"
 * );
 */

/**
 * Extract the path portion from a full URL for logging purposes.
 * 
 * The RemoteFalconLogBuilder expects a path (e.g., "/showDetails"),
 * not the full URL. This extracts the pathname from the URL and
 * removes the base API path prefix if present.
 * 
 * @param {string} url - Full URL (e.g., "https://remotefalcon.com/remote-falcon-external-api/showDetails")
 * @returns {string} The extracted path (e.g., "/showDetails")
 * @example
 * const path = extractPath("https://remotefalcon.com/remote-falcon-external-api/showDetails");
 * // Returns: "/showDetails"
 */
function extractPath(url) {
	try {
		const parsedUrl = new URL(url);
		let path = parsedUrl.pathname;

		// Remove the base API path prefix to get the endpoint path
		const basePath = "/remote-falcon-external-api";
		if (path.startsWith(basePath)) {
			path = path.substring(basePath.length);
		}

		return path || "/";
	} catch {
		return url;
	}
}

/**
 * Forward a request to the Remote Falcon API with JWT authentication
 * and comprehensive structured logging.
 * 
 * This function replicates the old-backend `forwardToRemoteFalcon` behavior:
 * - Constructs fetch options with Authorization Bearer header
 * - Attaches JSON body for non-GET requests
 * - Parses JSON response (falls back to empty object)
 * - Classifies and logs success, HTTP errors, and application-level errors
 * - On network failure, logs the error and throws
 * 
 * @async
 * @param {string} url - Full URL to the Remote Falcon API endpoint
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {Object|null} body - Request body (ignored for GET requests)
 * @param {string} jwt - JWT token for Authorization header
 * @param {{ipAddress: string, userAgent: string, host: string}} clientInfo - Client information for logging
 * @param {string} requestId - Lambda request ID for log correlation
 * @returns {Promise<{statusCode: number, body: Object, headers: Object}>} Response object
 * @throws {Error} "Failed to communicate with Remote Falcon API" on network errors
 * @example
 * const result = await forward(
 *   "https://remotefalcon.com/remote-falcon-external-api/showDetails",
 *   "GET",
 *   null,
 *   "eyJhbGciOiJIUzI1NiJ9...",
 *   { ipAddress: "10.0.0.1", userAgent: "Mozilla/5.0", host: "myapp.com" },
 *   "abc-123-def"
 * );
 * // result.statusCode === 200
 * // result.body === { preferences: {...}, sequences: [...] }
 */
async function forward(url, method, body, jwt, clientInfo, requestId) {
	const path = extractPath(url);
	const logBuilder = new RemoteFalconLogBuilder(requestId, clientInfo, path, method);

	const options = {
		method: method,
		headers: {
			"Authorization": `Bearer ${jwt}`,
			"Content-Type": "application/json"
		}
	};

	if (body && method !== "GET") {
		options.body = JSON.stringify(body);
	}

	try {
		const response = await fetch(url, options);
		const responseData = await response.json().catch(() => ({}));

		// Check for HTTP error status codes (4xx, 5xx)
		if (response.status >= 400) {
			const httpError = new Error(`HTTP ${response.status}: ${response.statusText || "Error"}`);
			httpError.name = "HTTPError";
			const errorLog = logBuilder.buildErrorLog(httpError, response.status);
			console.log(`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}`);
		} else {
			// Check for application-level errors in successful HTTP responses (2xx)
			const applicationError = RemoteFalconLogBuilder.detectApplicationError(responseData);

			if (applicationError) {
				const errorLog = logBuilder.buildErrorLog(
					new Error(applicationError.message),
					response.status
				);
				console.log(`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}`);
			} else {
				const successLog = logBuilder.buildSuccessLog(response, responseData);
				console.log(`REMOTE_FALCON_REQUEST: ${JSON.stringify(successLog)}`);
			}
		}

		return {
			statusCode: response.status,
			body: responseData,
			headers: {
				"Content-Type": "application/json"
			}
		};
	} catch (error) {
		const errorLog = logBuilder.buildErrorLog(error);
		console.log(`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}`);

		console.error("Failed to forward request to Remote Falcon:", error);
		throw new Error("Failed to communicate with Remote Falcon API");
	}
}

module.exports = {
	forward
};
