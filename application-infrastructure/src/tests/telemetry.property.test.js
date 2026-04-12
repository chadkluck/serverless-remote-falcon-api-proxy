/**
 * Property-based tests for telemetry validation.
 *
 * Feature: convert-to-atlantis, Property 3/4/5/12
 *
 * Property 3: Valid telemetry produces correct log and response
 * **Validates: Requirements 3.1, 3.2**
 *
 * Property 4: Invalid tracking data is rejected with VALIDATION_ERROR
 * **Validates: Requirements 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**
 *
 * Property 5: PII detection in tracking data
 * **Validates: Requirements 4.6**
 *
 * Property 12: Tracking data size limit enforcement
 * **Validates: Requirements 4.7**
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const fc = require('fast-check');
const { processTracking, validateTrackingData } = require('../services/telemetry.service');

const VALID_EVENT_TYPES = ['pageView', 'click', 'videoPlay', 'songRequest'];
const SYSTEM_EVENT_TYPES = ['systemHealth', 'systemAlert', 'eventFailure'];

// Generator for valid URLs
const validUrlArb = fc.oneof(
	fc.webUrl(),
	fc.constantFrom(
		'https://example.com',
		'https://test.remotefalcon.com/page',
		'http://localhost:3000/test'
	)
);

// Generator for valid simple tracking data (non-system event types)
const validSimpleTrackingArb = fc.record({
	eventType: fc.constantFrom(...VALID_EVENT_TYPES),
	url: validUrlArb
});

const defaultClientInfo = {
	ipAddress: '10.0.0.1',
	userAgent: 'TestAgent/1.0',
	host: 'test.example.com'
};

describe('Feature: convert-to-atlantis, Property 3: Valid telemetry produces correct log and response', () => {

	let consoleSpy;

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should return 200 with message, timestamp, processingTime and log TELEMETRY_EVENT for valid data', async () => {
		await fc.assert(
			fc.asyncProperty(
				validSimpleTrackingArb,
				async (trackingData) => {
					consoleSpy.mockClear();

					const result = await processTracking(trackingData, defaultClientInfo, 'req-123');

					// Verify 200 response
					expect(result.statusCode).toBe(200);

					// Verify response body structure
					expect(result.body).toHaveProperty('message');
					expect(result.body).toHaveProperty('timestamp');
					expect(result.body).toHaveProperty('processingTime');
					expect(typeof result.body.message).toBe('string');
					expect(typeof result.body.timestamp).toBe('string');
					expect(typeof result.body.processingTime).toBe('number');
					expect(result.body.processingTime).toBeGreaterThanOrEqual(0);

					// Verify TELEMETRY_EVENT log was emitted
					const telemetryLogCalls = consoleSpy.mock.calls.filter(
						call => typeof call[0] === 'string' && call[0].includes('TELEMETRY_EVENT')
					);
					expect(telemetryLogCalls.length).toBeGreaterThanOrEqual(1);

					// Parse the log entry and verify required fields
					const logStr = telemetryLogCalls[0][1];
					const logEntry = JSON.parse(logStr);
					expect(logEntry).toHaveProperty('timestamp');
					expect(logEntry).toHaveProperty('eventType', trackingData.eventType);
					expect(logEntry).toHaveProperty('ipAddress', defaultClientInfo.ipAddress);
					expect(logEntry).toHaveProperty('userAgent', defaultClientInfo.userAgent);
					expect(logEntry).toHaveProperty('host', defaultClientInfo.host);
					expect(logEntry).toHaveProperty('url', trackingData.url);
					expect(logEntry).toHaveProperty('processingTime');
					expect(logEntry).toHaveProperty('requestId', 'req-123');
				}
			),
			{ numRuns: 100 }
		);
	});
});


describe('Feature: convert-to-atlantis, Property 4: Invalid tracking data is rejected with VALIDATION_ERROR', () => {

	it('should reject tracking data with missing or invalid eventType', () => {
		const invalidEventTypeArb = fc.oneof(
			// Missing eventType
			fc.record({ url: validUrlArb }),
			// Empty eventType
			fc.record({ eventType: fc.constant(''), url: validUrlArb }),
			// Invalid eventType string
			fc.record({
				eventType: fc.string({ minLength: 1, maxLength: 20 })
					.filter(s => !['pageView', 'click', 'videoPlay', 'songRequest', 'systemHealth', 'systemAlert', 'eventFailure'].includes(s)),
				url: validUrlArb
			})
		);

		fc.assert(
			fc.property(
				invalidEventTypeArb,
				(data) => {
					const result = validateTrackingData(data);
					expect(result.isValid).toBe(false);
					expect(typeof result.error).toBe('string');
					expect(result.error.length).toBeGreaterThan(0);
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should reject tracking data with missing or invalid url', () => {
		const invalidUrlArb = fc.oneof(
			// Missing url
			fc.record({ eventType: fc.constantFrom(...VALID_EVENT_TYPES) }),
			// Empty url
			fc.record({ eventType: fc.constantFrom(...VALID_EVENT_TYPES), url: fc.constant('') }),
			// Invalid url format (strings that fail new URL())
			fc.record({
				eventType: fc.constantFrom(...VALID_EVENT_TYPES),
				url: fc.constantFrom('not-a-url', '://bad', 'just text', 'no-scheme.com', '/relative/path')
			})
		);

		fc.assert(
			fc.property(
				invalidUrlArb,
				(data) => {
					const result = validateTrackingData(data);
					expect(result.isValid).toBe(false);
					expect(typeof result.error).toBe('string');
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should reject non-object tracking data', () => {
		const nonObjectArb = fc.oneof(
			fc.constant(null),
			fc.constant(undefined),
			fc.string(),
			fc.integer(),
			fc.boolean()
		);

		fc.assert(
			fc.property(
				nonObjectArb,
				(data) => {
					const result = validateTrackingData(data);
					expect(result.isValid).toBe(false);
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: convert-to-atlantis, Property 5: PII detection in tracking data', () => {

	const PII_FIELD_NAMES = [
		'email', 'phone', 'phoneNumber', 'address', 'firstName', 'lastName',
		'fullName', 'name', 'username', 'userId', 'ssn', 'creditCard',
		'password', 'token', 'apiKey', 'personalInfo'
	];

	it('should reject eventData containing PII field names', () => {
		const piiFieldArb = fc.constantFrom(...PII_FIELD_NAMES);
		const piiValueArb = fc.string({ minLength: 1, maxLength: 50 });

		fc.assert(
			fc.property(
				fc.constantFrom(...VALID_EVENT_TYPES),
				piiFieldArb,
				piiValueArb,
				(eventType, piiField, piiValue) => {
					const data = {
						eventType,
						url: 'https://example.com',
						eventData: {
							[piiField]: piiValue
						}
					};

					const result = validateTrackingData(data);
					expect(result.isValid).toBe(false);
					expect(result.error).toContain('PII');
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should reject nested eventData containing PII field names', () => {
		const piiFieldArb = fc.constantFrom(...PII_FIELD_NAMES);

		fc.assert(
			fc.property(
				fc.constantFrom(...VALID_EVENT_TYPES),
				piiFieldArb,
				(eventType, piiField) => {
					const data = {
						eventType,
						url: 'https://example.com',
						eventData: {
							nested: {
								[piiField]: 'some-value'
							}
						}
					};

					const result = validateTrackingData(data);
					expect(result.isValid).toBe(false);
					expect(result.error).toContain('PII');
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: convert-to-atlantis, Property 12: Tracking data size limit enforcement', () => {

	it('should reject tracking data larger than 10KB', () => {
		// Generate a large string to exceed 10KB
		const largeStringArb = fc.string({ minLength: 5000, maxLength: 8000 });

		fc.assert(
			fc.property(
				fc.constantFrom(...VALID_EVENT_TYPES),
				largeStringArb,
				largeStringArb,
				(eventType, str1, str2) => {
					const data = {
						eventType,
						url: 'https://example.com',
						eventData: {
							largeField1: str1,
							largeField2: str2
						}
					};

					// Only test if the data actually exceeds 10KB
					const jsonSize = JSON.stringify(data).length;
					if (jsonSize > 10000) {
						const result = validateTrackingData(data);
						expect(result.isValid).toBe(false);
						expect(result.error).toContain('10KB');
					}
				}
			),
			{ numRuns: 100 }
		);
	});
});
