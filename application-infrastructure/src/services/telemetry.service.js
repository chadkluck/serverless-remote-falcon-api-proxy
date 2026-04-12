/**
 * Telemetry processing and validation service.
 *
 * Ports the old-backend telemetry logic with IDENTICAL validation
 * behavior. Handles tracking data validation, PII detection,
 * size limit enforcement, and structured logging.
 *
 * @module services/telemetry.service
 * @example
 * const TelemetrySvc = require('./telemetry.service');
 * const result = await TelemetrySvc.processTracking(
 *   { eventType: 'pageView', url: 'https://example.com' },
 *   { ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0', host: 'example.com' },
 *   'req-123'
 * );
 */

/**
 * Valid event types for tracking data.
 * 
 * @type {string[]}
 * @private
 */
const VALID_EVENT_TYPES = ['pageView', 'click', 'videoPlay', 'songRequest', 'systemHealth', 'systemAlert', 'eventFailure'];

/**
 * Valid alert types for systemAlert events.
 * 
 * @type {string[]}
 * @private
 */
const VALID_ALERT_TYPES = ['HIGH_ERROR_RATE', 'CONSECUTIVE_ERRORS'];

/**
 * Valid original event types for eventFailure events (excludes eventFailure itself).
 * 
 * @type {string[]}
 * @private
 */
const VALID_ORIGINAL_EVENT_TYPES = ['pageView', 'click', 'videoPlay', 'songRequest', 'systemHealth', 'systemAlert'];

/**
 * PII field names to detect in eventData (case-insensitive matching).
 * 
 * @type {string[]}
 * @private
 */
const PII_FIELDS = [
	'email', 'phone', 'phoneNumber', 'address', 'firstName', 'lastName',
	'fullName', 'name', 'username', 'userId', 'ssn', 'creditCard',
	'password', 'token', 'apiKey', 'personalInfo'
];

/**
 * Validate system health event data structure.
 *
 * Ported from old-backend with identical logic. Validates that
 * eventData contains required numeric fields and optional
 * rate limiting status.
 *
 * @param {Object} eventData - The eventData object from tracking data
 * @returns {{isValid: boolean, error?: string}} Validation result
 * @example
 * const result = validateSystemHealthData({ totalRequests: 100, failedRequests: 5, errorRate: 0.05 });
 * // result.isValid === true
 */
function validateSystemHealthData(eventData) {
	if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {
		return { isValid: false, error: 'System health event data must be an object' };
	}

	const requiredFields = ['totalRequests', 'failedRequests', 'errorRate'];
	for (const field of requiredFields) {
		if (eventData[field] === undefined || eventData[field] === null) {
			return { isValid: false, error: `Missing required field in system health data: ${field}` };
		}
	}

	if (typeof eventData.totalRequests !== 'number' || eventData.totalRequests < 0) {
		return { isValid: false, error: 'totalRequests must be a non-negative number' };
	}

	if (typeof eventData.failedRequests !== 'number' || eventData.failedRequests < 0) {
		return { isValid: false, error: 'failedRequests must be a non-negative number' };
	}

	if (typeof eventData.errorRate !== 'number' || eventData.errorRate < 0 || eventData.errorRate > 1) {
		return { isValid: false, error: 'errorRate must be a number between 0 and 1' };
	}

	if (eventData.failedRequests > eventData.totalRequests) {
		return { isValid: false, error: 'failedRequests cannot exceed totalRequests' };
	}

	if (eventData.rateLimitStatus && typeof eventData.rateLimitStatus === 'object') {
		const rateLimitStatus = eventData.rateLimitStatus;
		if (rateLimitStatus.isRateLimited !== undefined && typeof rateLimitStatus.isRateLimited !== 'boolean') {
			return { isValid: false, error: 'rateLimitStatus.isRateLimited must be a boolean' };
		}
		if (rateLimitStatus.requestsInWindow !== undefined && (typeof rateLimitStatus.requestsInWindow !== 'number' || rateLimitStatus.requestsInWindow < 0)) {
			return { isValid: false, error: 'rateLimitStatus.requestsInWindow must be a non-negative number' };
		}
	}

	return { isValid: true };
}

/**
 * Validate system alert event data structure.
 *
 * Ported from old-backend with identical logic. Validates alert type,
 * required numeric fields, and optional fields.
 *
 * @param {Object} eventData - The eventData object from tracking data
 * @returns {{isValid: boolean, error?: string}} Validation result
 * @example
 * const result = validateSystemAlertData({ type: 'HIGH_ERROR_RATE', errorRate: 0.5, threshold: 0.3 });
 * // result.isValid === true
 */
function validateSystemAlertData(eventData) {
	if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {
		return { isValid: false, error: 'System alert event data must be an object' };
	}

	const requiredFields = ['type', 'errorRate', 'threshold'];
	for (const field of requiredFields) {
		if (eventData[field] === undefined || eventData[field] === null) {
			return { isValid: false, error: `Missing required field in system alert data: ${field}` };
		}
	}

	if (!VALID_ALERT_TYPES.includes(eventData.type)) {
		return { isValid: false, error: `Invalid alert type. Must be one of: ${VALID_ALERT_TYPES.join(', ')}` };
	}

	if (typeof eventData.errorRate !== 'number' || eventData.errorRate < 0 || eventData.errorRate > 1) {
		return { isValid: false, error: 'errorRate must be a number between 0 and 1' };
	}

	if (typeof eventData.threshold !== 'number' || eventData.threshold < 0 || eventData.threshold > 1) {
		return { isValid: false, error: 'threshold must be a number between 0 and 1' };
	}

	if (eventData.totalRequests !== undefined && (typeof eventData.totalRequests !== 'number' || eventData.totalRequests < 0)) {
		return { isValid: false, error: 'totalRequests must be a non-negative number' };
	}

	if (eventData.failedRequests !== undefined && (typeof eventData.failedRequests !== 'number' || eventData.failedRequests < 0)) {
		return { isValid: false, error: 'failedRequests must be a non-negative number' };
	}

	if (eventData.consecutiveErrors !== undefined && (typeof eventData.consecutiveErrors !== 'number' || eventData.consecutiveErrors < 0)) {
		return { isValid: false, error: 'consecutiveErrors must be a non-negative number' };
	}

	return { isValid: true };
}

/**
 * Validate event failure event data structure.
 *
 * Ported from old-backend with identical logic. Validates required
 * string fields, originalEventType, and optional fields.
 *
 * @param {Object} eventData - The eventData object from tracking data
 * @returns {{isValid: boolean, error?: string}} Validation result
 * @example
 * const result = validateEventFailureData({
 *   originalEventType: 'pageView',
 *   failureReason: 'Network timeout',
 *   errorType: 'TIMEOUT'
 * });
 * // result.isValid === true
 */
function validateEventFailureData(eventData) {
	if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {
		return { isValid: false, error: 'Event failure event data must be an object' };
	}

	const requiredFields = ['originalEventType', 'failureReason', 'errorType'];
	for (const field of requiredFields) {
		if (!eventData[field] || eventData[field] === '') {
			return { isValid: false, error: `Missing required field in event failure data: ${field}` };
		}
	}

	if (!VALID_ORIGINAL_EVENT_TYPES.includes(eventData.originalEventType)) {
		return { isValid: false, error: `Invalid originalEventType. Must be one of: ${VALID_ORIGINAL_EVENT_TYPES.join(', ')}` };
	}

	if (typeof eventData.failureReason !== 'string') {
		return { isValid: false, error: 'failureReason must be a string' };
	}

	if (typeof eventData.errorType !== 'string') {
		return { isValid: false, error: 'errorType must be a string' };
	}

	if (eventData.finalAttempts !== undefined && (typeof eventData.finalAttempts !== 'number' || eventData.finalAttempts < 0)) {
		return { isValid: false, error: 'finalAttempts must be a non-negative number' };
	}

	if (eventData.originalEventData !== undefined && (typeof eventData.originalEventData !== 'object' || eventData.originalEventData === null)) {
		return { isValid: false, error: 'originalEventData must be an object' };
	}

	return { isValid: true };
}

/**
 * Validate tracking data structure.
 *
 * Ported from old-backend with identical logic. Validates eventType,
 * URL format, event-specific data, PII detection, and size limits.
 *
 * @param {Object} data - The tracking data object to validate
 * @returns {{isValid: boolean, error?: string}} Validation result
 * @example
 * const result = validateTrackingData({ eventType: 'pageView', url: 'https://example.com' });
 * // result.isValid === true
 *
 * @example
 * const result = validateTrackingData({ eventType: 'invalid' });
 * // result.isValid === false
 * // result.error === 'Missing required field: url'
 */
function validateTrackingData(data) {
	if (!data || typeof data !== 'object') {
		return { isValid: false, error: 'Tracking data must be an object' };
	}

	if (!data.eventType || data.eventType === '') {
		return { isValid: false, error: 'Missing required field: eventType' };
	}

	if (!data.url || data.url === '') {
		return { isValid: false, error: 'Missing required field: url' };
	}

	if (!VALID_EVENT_TYPES.includes(data.eventType)) {
		return {
			isValid: false,
			error: `Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`
		};
	}

	try {
		new URL(data.url);
	} catch (error) {
		return { isValid: false, error: 'Invalid URL format' };
	}

	if (data.eventType === 'systemHealth' || data.eventType === 'systemAlert' || data.eventType === 'eventFailure') {
		if (!data.eventData || typeof data.eventData !== 'object' || Array.isArray(data.eventData)) {
			return { isValid: false, error: `${data.eventType} events require eventData object` };
		}

		let systemHealthValidation;

		if (data.eventType === 'systemHealth') {
			systemHealthValidation = validateSystemHealthData(data.eventData);
			if (!systemHealthValidation.isValid) {
				return systemHealthValidation;
			}
		} else if (data.eventType === 'systemAlert') {
			systemHealthValidation = validateSystemAlertData(data.eventData);
			if (!systemHealthValidation.isValid) {
				return systemHealthValidation;
			}
		} else if (data.eventType === 'eventFailure') {
			systemHealthValidation = validateEventFailureData(data.eventData);
			if (!systemHealthValidation.isValid) {
				return systemHealthValidation;
			}
		}
	}

	// >! Security validation: Check for potential PII in event data
	if (data.eventData && typeof data.eventData === 'object') {
		const checkForPII = (obj, path = '') => {
			for (const [key, value] of Object.entries(obj)) {
				const keyLower = key.toLowerCase();
				const fullPath = path ? `${path}.${key}` : key;

				const containsPII = PII_FIELDS.some(piiField =>
					keyLower.includes(piiField.toLowerCase())
				);

				if (containsPII) {
					return {
						isValid: false,
						error: `Potential PII detected in field: ${fullPath}. PII is not allowed in tracking data.`
					};
				}

				if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					const nestedCheck = checkForPII(value, fullPath);
					if (!nestedCheck.isValid) {
						return nestedCheck;
					}
				}
			}
			return { isValid: true };
		};

		const piiCheck = checkForPII(data.eventData);
		if (!piiCheck.isValid) {
			return piiCheck;
		}
	}

	const jsonString = JSON.stringify(data);
	if (jsonString.length > 10000) {
		return {
			isValid: false,
			error: 'Tracking data too large. Maximum size is 10KB.'
		};
	}

	return { isValid: true };
}

/**
 * Process tracking data: validate, log, and return response.
 *
 * Receives already-parsed body, clientInfo, and requestId.
 * Validates via validateTrackingData, logs TELEMETRY_EVENT and
 * TELEMETRY_METRICS structured entries, and returns the response.
 *
 * @async
 * @param {Object} body - Parsed tracking data object
 * @param {{ipAddress: string, userAgent: string, host: string}} clientInfo - Client information
 * @param {string} requestId - Lambda request ID for log correlation
 * @returns {Promise<{statusCode: number, body: Object}>} Response object
 * @example
 * const result = await processTracking(
 *   { eventType: 'pageView', url: 'https://example.com' },
 *   { ipAddress: '10.0.0.1', userAgent: 'Mozilla/5.0', host: 'myapp.com' },
 *   'req-abc-123'
 * );
 * // result.statusCode === 200
 * // result.body.message === 'Tracking data received successfully'
 */
async function processTracking(body, clientInfo, requestId) {
	const startTime = Date.now();

	const validation = validateTrackingData(body);
	if (!validation.isValid) {
		return {
			statusCode: 400,
			body: {
				message: validation.error,
				error: 'VALIDATION_ERROR',
				timestamp: new Date().toISOString()
			}
		};
	}

	const processingTime = Date.now() - startTime;
	const timestamp = new Date().toISOString();

	const logEntry = {
		timestamp: timestamp,
		eventType: body.eventType,
		ipAddress: clientInfo.ipAddress,
		userAgent: clientInfo.userAgent,
		host: clientInfo.host,
		url: body.url,
		eventData: body.eventData || {},
		processingTime: processingTime,
		requestId: requestId
	};

	console.log('TELEMETRY_EVENT:', JSON.stringify(logEntry));

	console.log('TELEMETRY_METRICS:', JSON.stringify({
		timestamp: timestamp,
		eventType: body.eventType,
		processingTime: processingTime,
		success: true,
		requestId: requestId
	}));

	return {
		statusCode: 200,
		body: {
			message: 'Tracking data received successfully',
			timestamp: logEntry.timestamp,
			processingTime: processingTime
		}
	};
}

module.exports = {
	processTracking,
	validateTrackingData,
	validateSystemHealthData,
	validateSystemAlertData,
	validateEventFailureData
};
