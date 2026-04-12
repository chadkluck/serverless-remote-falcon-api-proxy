/**
 * Router for Remote Falcon proxy and telemetry endpoints.
 *
 * Receives API Gateway events, creates ClientRequest and Response objects,
 * applies CORS headers, dispatches to the appropriate Controller based on
 * method + path, and logs REQUEST_METRICS for every request.
 *
 * Routing table:
 *   OPTIONS *                        → 200 with CORS headers, empty body
 *   POST /telemetry                  → TelemetryCtrl.post(props, REQ, RESP)
 *   GET  /proxy/showDetails          → ProxyCtrl.forward(props, REQ, RESP)
 *   POST /proxy/addSequenceToQueue   → ProxyCtrl.forward(props, REQ, RESP)
 *   POST /proxy/voteForSequence      → ProxyCtrl.forward(props, REQ, RESP)
 *   ANY  /proxy/{proxy+}             → ProxyCtrl.forward(props, REQ, RESP)
 *   *                                → 404 NOT_FOUND with available endpoints
 *
 * @module routes
 * @example
 * const Routes = require('./routes');
 * const response = await Routes.process(event, context);
 * return response.finalize();
 */

const {
	tools: {
		DebugAndLog,
		ClientRequest,
		Response
	}
} = require("@63klabs/cache-data");

const { ProxyCtrl, TelemetryCtrl } = require("../controllers");
const { ProxyView } = require("../views");
const { cors } = require("../utils");

/**
 * Process an incoming API Gateway event and route to the appropriate controller.
 *
 * @async
 * @param {Object} event - API Gateway event object
 * @param {Object} context - Lambda context object
 * @returns {Promise<Response>} The Response object (caller calls .finalize())
 */
const process = async function (event, context) {

	DebugAndLog.debug("Received event", event);

	const startTime = Date.now();
	const requestId = event.requestContext?.requestId || context?.awsRequestId || "unknown";

	/*
	 * Create ClientRequest and Response from event/context
	 */
	const REQ = new ClientRequest(event, context);
	const RESP = new Response(REQ);

	/*
	 * Extract origin and apply CORS + security headers to all responses
	 */
	const origin = event.headers?.origin
		|| event.headers?.Origin
		|| event.headers?.["Origin"]
		|| event.headers?.["origin"];

	const corsHeaders = cors.getCorsHeaders(origin);

	// >! Apply CORS and security headers to the Response
	for (const [key, value] of Object.entries(corsHeaders)) {
		RESP.addHeader(key, value);
	}

	/*
	 * Handle OPTIONS preflight — return immediately, no business logic
	 */
	const method = event.httpMethod || "GET";
	const rawPath = event.path || "";
	// >! Normalize path to always have a leading slash
	const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

	if (method === "OPTIONS") {
		RESP.setStatusCode(200);
		RESP.setBody("");
		DebugAndLog.debug("OPTIONS preflight handled", { path });
		return RESP;
	}

	try {
		/*
		 * Parse body — try JSON, fall back to null
		 */
		let body = null;
		if (event.body) {
			try {
				body = JSON.parse(event.body);
			} catch (parseError) {
				DebugAndLog.debug("Failed to parse request body as JSON");
				body = null;
			}
		}

		/*
		 * Build client info from ClientRequest
		 */
		const clientInfo = {
			ipAddress: REQ.getClientIp() || "unknown",
			userAgent: REQ.getClientUserAgent() || "unknown",
			host: event.headers?.host || event.headers?.Host || "unknown"
		};

		/*
		 * Build props object for controllers
		 */
		const props = {
			path,
			method,
			body,
			requestId,
			clientInfo
		};

		REQ.addPathLog(`${method}:${path}`);

		let result;
		const processingStartTime = Date.now();

		/*
		 * Route based on method + path
		 */
		if (method === "POST" && path === "/telemetry") {
			result = await TelemetryCtrl.post(props, REQ, RESP);
		} else if (path.startsWith("/proxy/")) {
			result = await ProxyCtrl.forward(props, REQ, RESP);
		} else {
			// Unknown endpoint
			const timestamp = new Date().toISOString();
			DebugAndLog.warn("Unknown endpoint requested", { path, method, requestId });

			RESP.setStatusCode(404);
			RESP.setBody(ProxyView.notFoundView(requestId, timestamp));

			const totalTime = Date.now() - startTime;

			// Log REQUEST_METRICS for 404
			DebugAndLog.log("Request metrics", "REQUEST_METRICS", {
				requestId,
				timestamp: new Date().toISOString(),
				method,
				path,
				statusCode: 404,
				processingTime: 0,
				totalTime,
				success: false
			});

			return RESP;
		}

		const processingTime = Date.now() - processingStartTime;
		const totalTime = Date.now() - startTime;

		/*
		 * Apply controller result to Response
		 */
		RESP.setStatusCode(result.statusCode);
		RESP.setBody(result.body);

		// Merge any extra headers from the controller result
		if (result.headers) {
			for (const [key, value] of Object.entries(result.headers)) {
				RESP.addHeader(key, value);
			}
		}

		// Log REQUEST_METRICS (matching old-backend format)
		DebugAndLog.log("Request metrics", "REQUEST_METRICS", {
			requestId,
			timestamp: new Date().toISOString(),
			method,
			path,
			statusCode: result.statusCode,
			processingTime,
			totalTime,
			success: result.statusCode < 400
		});

		DebugAndLog.debug("Response from Routes:", RESP.toObject());

		return RESP;

	} catch (error) {
		const totalTime = Date.now() - startTime;

		// Log LAMBDA_ERROR (matching old-backend format)
		DebugAndLog.error("LAMBDA_ERROR: Unhandled error during request processing", {
			requestId,
			timestamp: new Date().toISOString(),
			error: {
				message: error.message,
				name: error.name,
				stack: error.stack
			},
			request: {
				method,
				path,
				origin,
				userAgent: event.headers?.["user-agent"]
			},
			totalTime
		});

		// Log REQUEST_METRICS for error
		DebugAndLog.log("Request metrics", "REQUEST_METRICS", {
			requestId,
			timestamp: new Date().toISOString(),
			method,
			path,
			statusCode: 500,
			totalTime,
			success: false,
			errorType: error.name,
			errorMessage: error.message
		});

		RESP.setStatusCode(500);
		RESP.setBody({
			message: "Internal server error",
			error: "INTERNAL_ERROR",
			requestId,
			timestamp: new Date().toISOString()
		});

		return RESP;
	}
};

module.exports = {
	process
};
