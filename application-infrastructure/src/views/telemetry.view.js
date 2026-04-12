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
 * @param {Object} data - Telemetry processing result data
 * @param {number} data.processingTime - Time taken to process the request in ms
 * @returns {{message: string, timestamp: string, processingTime: number}} Formatted success response
 * @example
 * const body = successView({ processingTime: 15 });
 * // { message: 'Tracking data received successfully', timestamp: '...', processingTime: 15 }
 */
const successView = (data) => {
	return {
		message: 'Tracking data received successfully',
		timestamp: new Date().toISOString(),
		processingTime: data.processingTime
	};
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
