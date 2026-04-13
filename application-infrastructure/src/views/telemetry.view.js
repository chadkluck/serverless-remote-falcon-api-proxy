/**
 * Telemetry response formatting view
 * 
 * Formats telemetry endpoint responses for success and error cases.
 * 
 * @module views/telemetry.view
 * @example
 * const TelemetryView = require('./telemetry.view');
 * const response = TelemetryView.successView({ processingTime: 12 });
 */

/**
 * Format a successful telemetry response.
 * 
 * When `data.remoteFalcon` is provided (for systemHealth events), the response
 * includes a `remoteFalcon` sub-object with connectivity and metadata fields.
 * When `data.clientStatus` is provided (for systemHealth events), the response
 * includes a `clientStatus` sub-object echoing back the client's IP, user agent,
 * and validated eventData. When absent, the response contains only the base fields.
 * 
 * @param {Object} data - Telemetry processing result data
 * @param {number} data.processingTime - Time taken to process the request in ms
 * @param {Object} [data.remoteFalcon] - Optional Remote Falcon connectivity status
 * @param {boolean} data.remoteFalcon.isConnected - Whether Remote Falcon returned a 2xx response
 * @param {number} data.remoteFalcon.statusCode - HTTP status code from Remote Falcon (0 for network/timeout errors)
 * @param {boolean} [data.remoteFalcon.viewerControlEnabled] - Viewer control enabled preference (success only)
 * @param {string} [data.remoteFalcon.viewerControlMode] - Viewer control mode preference (success only)
 * @param {string|null} [data.remoteFalcon.playingNow] - Currently playing sequence (success only)
 * @param {string|null} [data.remoteFalcon.playingNext] - Next playing sequence (success only)
 * @param {string} [data.remoteFalcon.error] - Descriptive error message (failure only)
 * @param {Object} [data.clientStatus] - Optional client status echoed back for systemHealth events
 * @param {string} data.clientStatus.ip - Client IP address from the request
 * @param {string} data.clientStatus.userAgent - Client user agent string from the request
 * @param {Object} data.clientStatus.eventData - Validated eventData from the request body, passed through as-is
 * @returns {{message: string, timestamp: string, processingTime: number, remoteFalcon?: Object, clientStatus?: Object}} Formatted success response
 * @example
 * // Without remoteFalcon or clientStatus (non-systemHealth event)
 * const body = successView({ processingTime: 15 });
 * // { message: 'Tracking data received successfully', timestamp: '...', processingTime: 15 }
 * 
 * @example
 * // With remoteFalcon and clientStatus (systemHealth event)
 * const body = successView({ processingTime: 15, remoteFalcon: { isConnected: true, statusCode: 200, viewerControlEnabled: true, viewerControlMode: 'jukebox', playingNow: 'Let It Go', playingNext: 'Into the Unknown' }, clientStatus: { ip: '10.0.0.1', userAgent: 'Mozilla/5.0', eventData: { totalRequests: 1500, failedRequests: 12, errorRate: 0.008 } } });
 * // { message: '...', timestamp: '...', processingTime: 15, remoteFalcon: { ... }, clientStatus: { ip: '10.0.0.1', ... } }
 */
const successView = (data) => {
	const response = {
		message: 'Tracking data received successfully',
		timestamp: new Date().toISOString(),
		processingTime: data.processingTime
	};

	if (data.remoteFalcon) {
		response.remoteFalcon = data.remoteFalcon;
	}

	if (data.clientStatus) {
		response.clientStatus = data.clientStatus;
	}

	return response;
};

/**
 * Format a telemetry error response.
 * 
 * @param {string} error - Human-readable error message
 * @param {string} errorCode - Machine-readable error code (e.g. 'VALIDATION_ERROR')
 * @returns {{message: string, error: string, timestamp: string}} Formatted error response
 * @example
 * const body = errorView('Missing required field: eventType', 'VALIDATION_ERROR');
 * // { message: 'Missing required field: eventType', error: 'VALIDATION_ERROR', timestamp: '...' }
 */
const errorView = (error, errorCode) => {
	return {
		message: error,
		error: errorCode,
		timestamp: new Date().toISOString()
	};
};

module.exports = { successView, errorView };
