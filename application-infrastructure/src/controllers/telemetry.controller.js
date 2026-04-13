/**
 * Telemetry endpoint controller for tracking event processing.
 *
 * Coordinates extracting the request body, delegating to TelemetrySvc
 * for validation and processing, and formatting the response via
 * TelemetryView.
 *
 * @module controllers/telemetry.controller
 * @example
 * const TelemetryCtrl = require('./telemetry.controller');
 * const result = await TelemetryCtrl.post(props, REQ, RESP);
 */

const { TelemetrySvc, HealthCheckSvc } = require("../services");
const { TelemetryView } = require("../views");

/**
 * Process a telemetry tracking request.
 *
 * Extracts the parsed body from props, checks for null/undefined body
 * (indicating invalid JSON caught by the Router), delegates to
 * TelemetrySvc.processTracking, and formats the response via
 * TelemetryView.
 *
 * @async
 * @param {Object} props - Request properties populated by the Router
 * @param {Object|null} [props.body] - The parsed request body (null if JSON parsing failed)
 * @param {string} [props.requestId] - Lambda request ID for log correlation
 * @param {{ipAddress: string, userAgent: string, host: string}} [props.clientInfo] - Client information
 * @param {Object} REQ - Cache-data ClientRequest instance
 * @param {Object} RESP - Cache-data Response instance
 * @returns {Promise<{statusCode: number, body: Object}>} Formatted response object.
 *   For systemHealth events, the body includes a `remoteFalcon` sub-object with
 *   connectivity status from HealthCheckSvc. For all other event types, the body
 *   contains only `message`, `timestamp`, and `processingTime`.
 * @example
 * // systemHealth event — response includes remoteFalcon status
 * const result = await post(
 *   { body: { eventType: 'systemHealth', eventData: { totalRequests: 100 } }, requestId: 'req-123', clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Mozilla/5.0', host: 'example.com' } },
 *   REQ,
 *   RESP
 * );
 * // result.statusCode === 200
 * // result.body.remoteFalcon.isConnected === true
 *
 * @example
 * // Non-systemHealth event — no remoteFalcon in response
 * const result = await post(
 *   { body: { eventType: 'pageView', url: 'https://example.com' }, requestId: 'req-123', clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Mozilla/5.0', host: 'example.com' } },
 *   REQ,
 *   RESP
 * );
 * // result.statusCode === 200
 * // result.body.message === 'Tracking data received successfully'
 */
async function post(props, REQ, RESP) {
	const body = props.body !== undefined ? props.body : null;
	const requestId = props.requestId || "";
	const clientInfo = props.clientInfo || {
		ipAddress: "unknown",
		userAgent: "unknown",
		host: "unknown"
	};

	// If body is null/undefined, the Router caught invalid JSON
	if (body === null || body === undefined) {
		return {
			statusCode: 400,
			body: TelemetryView.errorView(
				"Invalid JSON in request body",
				"PARSE_ERROR"
			)
		};
	}

	const result = await TelemetrySvc.processTracking(body, clientInfo, requestId);

	if (result.statusCode === 200) {
		const viewData = { processingTime: result.body.processingTime };

		if (body.eventType === 'systemHealth') {
			viewData.remoteFalcon = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);
		}

		return {
			statusCode: result.statusCode,
			body: TelemetryView.successView(viewData)
		};
	}

	// Validation error or other service-level error
	return {
		statusCode: result.statusCode,
		body: TelemetryView.errorView(
			result.body.message,
			result.body.error
		)
	};
}

module.exports = { post };
