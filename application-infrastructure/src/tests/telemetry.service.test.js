/**
 * Unit tests for telemetry service.
 *
 * Tests validation functions, PII detection, size limits,
 * processTracking response structure, and structured log entries.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 16.2, 16.7
 */

const {
	processTracking,
	validateTrackingData,
	validateSystemHealthData,
	validateSystemAlertData,
	validateEventFailureData
} = require('../services/telemetry.service');

describe('Telemetry Service', () => {

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	/* ------------------------------------------------------------------ */
	/*  processTracking                                                    */
	/* ------------------------------------------------------------------ */
	describe('processTracking', () => {
		it('should return 200 with correct structure for valid tracking data', async () => {
			const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
			const body = { eventType: 'pageView', url: 'https://example.com' };
			const clientInfo = { ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'example.com' };

			const result = await processTracking(body, clientInfo, 'req-123');

			expect(result.statusCode).toBe(200);
			expect(result.body.message).toBe('Tracking data received successfully');
			expect(typeof result.body.timestamp).toBe('string');
			expect(typeof result.body.processingTime).toBe('number');
			consoleSpy.mockRestore();
		});

		it('should log TELEMETRY_EVENT and TELEMETRY_METRICS entries via DebugAndLog', async () => {
			const { tools: { DebugAndLog } } = require('@63klabs/cache-data');
			const logSpy = jest.spyOn(DebugAndLog, 'log').mockImplementation(() => {});
			const body = { eventType: 'click', url: 'https://example.com/page' };
			const clientInfo = { ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'example.com' };

			await processTracking(body, clientInfo, 'req-456');

			const calls = logSpy.mock.calls;
			expect(calls.some(c => c[1] === 'TELEMETRY_EVENT')).toBe(true);
			expect(calls.some(c => c[1] === 'TELEMETRY_METRICS')).toBe(true);
			logSpy.mockRestore();
		});

		it('should return 400 VALIDATION_ERROR for invalid data', async () => {
			const result = await processTracking({ eventType: 'invalid' }, {}, 'req-789');
			expect(result.statusCode).toBe(400);
			expect(result.body.error).toBe('VALIDATION_ERROR');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  validateTrackingData — eventType                                   */
	/* ------------------------------------------------------------------ */
	describe('validateTrackingData — eventType', () => {
		it('should reject missing eventType', () => {
			const r = validateTrackingData({ url: 'https://example.com' });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/eventType/);
		});

		it('should reject invalid eventType', () => {
			const r = validateTrackingData({ eventType: 'badType', url: 'https://example.com' });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/Invalid eventType/);
		});

		it('should accept all valid event types', () => {
			const types = ['pageView', 'click', 'videoPlay', 'songRequest', 'systemHealth', 'systemAlert', 'eventFailure'];
			for (const eventType of types) {
				const data = { eventType, url: 'https://example.com' };
				if (['systemHealth', 'systemAlert', 'eventFailure'].includes(eventType)) {
					// These need eventData — tested separately
					continue;
				}
				expect(validateTrackingData(data).isValid).toBe(true);
			}
		});
	});

	/* ------------------------------------------------------------------ */
	/*  validateTrackingData — URL                                         */
	/* ------------------------------------------------------------------ */
	describe('validateTrackingData — URL', () => {
		it('should reject missing url', () => {
			const r = validateTrackingData({ eventType: 'pageView' });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/url/);
		});

		it('should reject invalid URL format', () => {
			const r = validateTrackingData({ eventType: 'pageView', url: 'not-a-url' });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/Invalid URL/);
		});

		it('should accept valid URL', () => {
			const r = validateTrackingData({ eventType: 'pageView', url: 'https://example.com/path?q=1' });
			expect(r.isValid).toBe(true);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  validateSystemHealthData                                           */
	/* ------------------------------------------------------------------ */
	describe('validateSystemHealthData', () => {
		const valid = { totalRequests: 100, failedRequests: 5, errorRate: 0.05 };

		it('should accept valid system health data', () => {
			expect(validateSystemHealthData(valid).isValid).toBe(true);
		});

		it('should reject non-object input', () => {
			expect(validateSystemHealthData(null).isValid).toBe(false);
			expect(validateSystemHealthData('string').isValid).toBe(false);
			expect(validateSystemHealthData([]).isValid).toBe(false);
		});

		it('should reject missing required fields', () => {
			expect(validateSystemHealthData({ totalRequests: 10 }).isValid).toBe(false);
		});

		it('should reject negative totalRequests', () => {
			expect(validateSystemHealthData({ ...valid, totalRequests: -1 }).isValid).toBe(false);
		});

		it('should reject errorRate > 1', () => {
			expect(validateSystemHealthData({ ...valid, errorRate: 1.5 }).isValid).toBe(false);
		});

		it('should reject failedRequests > totalRequests', () => {
			expect(validateSystemHealthData({ ...valid, failedRequests: 200 }).isValid).toBe(false);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  validateSystemAlertData                                            */
	/* ------------------------------------------------------------------ */
	describe('validateSystemAlertData', () => {
		const valid = { type: 'HIGH_ERROR_RATE', errorRate: 0.5, threshold: 0.3 };

		it('should accept valid system alert data', () => {
			expect(validateSystemAlertData(valid).isValid).toBe(true);
		});

		it('should accept CONSECUTIVE_ERRORS type', () => {
			expect(validateSystemAlertData({ ...valid, type: 'CONSECUTIVE_ERRORS' }).isValid).toBe(true);
		});

		it('should reject invalid alert type', () => {
			expect(validateSystemAlertData({ ...valid, type: 'BAD_TYPE' }).isValid).toBe(false);
		});

		it('should reject errorRate > 1', () => {
			expect(validateSystemAlertData({ ...valid, errorRate: 2 }).isValid).toBe(false);
		});

		it('should reject threshold > 1', () => {
			expect(validateSystemAlertData({ ...valid, threshold: 1.5 }).isValid).toBe(false);
		});

		it('should reject negative optional totalRequests', () => {
			expect(validateSystemAlertData({ ...valid, totalRequests: -1 }).isValid).toBe(false);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  validateEventFailureData                                           */
	/* ------------------------------------------------------------------ */
	describe('validateEventFailureData', () => {
		const valid = { originalEventType: 'pageView', failureReason: 'Timeout', errorType: 'TIMEOUT' };

		it('should accept valid event failure data', () => {
			expect(validateEventFailureData(valid).isValid).toBe(true);
		});

		it('should reject missing required fields', () => {
			expect(validateEventFailureData({ originalEventType: 'pageView' }).isValid).toBe(false);
		});

		it('should reject invalid originalEventType', () => {
			expect(validateEventFailureData({ ...valid, originalEventType: 'eventFailure' }).isValid).toBe(false);
		});

		it('should reject non-string failureReason', () => {
			expect(validateEventFailureData({ ...valid, failureReason: 123 }).isValid).toBe(false);
		});

		it('should reject negative finalAttempts', () => {
			expect(validateEventFailureData({ ...valid, finalAttempts: -1 }).isValid).toBe(false);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  PII detection                                                      */
	/* ------------------------------------------------------------------ */
	describe('PII detection in eventData', () => {
		const base = { eventType: 'pageView', url: 'https://example.com' };

		it('should reject eventData containing email field', () => {
			const r = validateTrackingData({ ...base, eventData: { email: 'test@test.com' } });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/PII/i);
		});

		it('should reject eventData containing phone field', () => {
			const r = validateTrackingData({ ...base, eventData: { phoneNumber: '555-1234' } });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/PII/i);
		});

		it('should reject eventData containing name field', () => {
			const r = validateTrackingData({ ...base, eventData: { firstName: 'John' } });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/PII/i);
		});

		it('should reject eventData containing ssn field', () => {
			const r = validateTrackingData({ ...base, eventData: { ssn: '123-45-6789' } });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/PII/i);
		});

		it('should reject eventData containing creditCard field', () => {
			const r = validateTrackingData({ ...base, eventData: { creditCard: '4111111111111111' } });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/PII/i);
		});

		it('should reject nested PII fields', () => {
			const r = validateTrackingData({ ...base, eventData: { nested: { password: 'secret' } } });
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/PII/i);
		});

		it('should accept eventData without PII fields', () => {
			const r = validateTrackingData({ ...base, eventData: { title: 'Home', path: '/home' } });
			expect(r.isValid).toBe(true);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  Size limit enforcement                                             */
	/* ------------------------------------------------------------------ */
	describe('Size limit enforcement', () => {
		it('should reject tracking data larger than 10KB', () => {
			const largeData = {
				eventType: 'pageView',
				url: 'https://example.com',
				eventData: { bigField: 'x'.repeat(10001) }
			};
			const r = validateTrackingData(largeData);
			expect(r.isValid).toBe(false);
			expect(r.error).toMatch(/10KB/);
		});

		it('should accept tracking data under 10KB', () => {
			const r = validateTrackingData({ eventType: 'pageView', url: 'https://example.com' });
			expect(r.isValid).toBe(true);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  Missing required fields                                            */
	/* ------------------------------------------------------------------ */
	describe('Missing required fields', () => {
		it('should reject null input', () => {
			expect(validateTrackingData(null).isValid).toBe(false);
		});

		it('should reject non-object input', () => {
			expect(validateTrackingData('string').isValid).toBe(false);
		});
	});
});
