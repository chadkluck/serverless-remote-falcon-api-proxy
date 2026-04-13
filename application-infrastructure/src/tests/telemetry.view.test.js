/**
 * Unit tests for telemetry view — successView with remoteFalcon support.
 *
 * Tests that successView conditionally includes the remoteFalcon sub-object
 * and that the response round-trips through JSON serialization correctly.
 *
 * Requirements: 5.1, 5.2, 5.3
 */

const { successView } = require('../views/telemetry.view');

describe('TelemetryView — successView', () => {

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	/* ------------------------------------------------------------------ */
	/*  Without remoteFalcon                                               */
	/* ------------------------------------------------------------------ */
	describe('without remoteFalcon', () => {
		it('should return message, timestamp, and processingTime only', () => {
			const result = successView({ processingTime: 12 });

			expect(result.message).toBe('Tracking data received successfully');
			expect(typeof result.timestamp).toBe('string');
			expect(result.processingTime).toBe(12);
			expect(result).not.toHaveProperty('remoteFalcon');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  With remoteFalcon                                                  */
	/* ------------------------------------------------------------------ */
	describe('with remoteFalcon', () => {
		it('should include remoteFalcon sub-object in response', () => {
			const remoteFalcon = {
				isConnected: true,
				statusCode: 200,
				viewerControlEnabled: true,
				viewerControlMode: 'jukebox',
				playingNow: 'Let It Go',
				playingNext: 'Into the Unknown'
			};

			const result = successView({ processingTime: 15, remoteFalcon });

			expect(result.message).toBe('Tracking data received successfully');
			expect(typeof result.timestamp).toBe('string');
			expect(result.processingTime).toBe(15);
			expect(result.remoteFalcon).toEqual(remoteFalcon);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  JSON round-trip                                                    */
	/* ------------------------------------------------------------------ */
	describe('JSON round-trip', () => {
		it('should preserve remoteFalcon.isConnected as boolean after JSON round-trip', () => {
			const remoteFalcon = {
				isConnected: true,
				statusCode: 200,
				viewerControlEnabled: false,
				viewerControlMode: 'voting',
				playingNow: null,
				playingNext: null
			};

			const raw = successView({ processingTime: 8, remoteFalcon });
			const parsed = JSON.parse(JSON.stringify(raw));

			expect(parsed).toHaveProperty('remoteFalcon');
			expect(typeof parsed.remoteFalcon.isConnected).toBe('boolean');
			expect(parsed.remoteFalcon.isConnected).toBe(true);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  With clientStatus                                                  */
	/* ------------------------------------------------------------------ */
	describe('with clientStatus', () => {
		/**
		 * Validates: Requirements 2.1, 3.1
		 */
		it('should include clientStatus in response when provided in data', () => {
			const clientStatus = {
				ip: '10.0.0.1',
				userAgent: 'Mozilla/5.0',
				eventData: {
					totalRequests: 1500,
					failedRequests: 12,
					errorRate: 0.008
				}
			};

			const result = successView({ processingTime: 10, clientStatus });

			expect(result).toHaveProperty('clientStatus');
			expect(result.clientStatus).toEqual(clientStatus);
		});

		/**
		 * Validates: Requirement 3.1
		 */
		it('should have exactly three keys: ip, userAgent, eventData', () => {
			const clientStatus = {
				ip: '192.168.1.1',
				userAgent: 'TestAgent/1.0',
				eventData: {
					totalRequests: 0,
					failedRequests: 0,
					errorRate: 0
				}
			};

			const result = successView({ processingTime: 5, clientStatus });

			expect(Object.keys(result.clientStatus)).toHaveLength(3);
			expect(result.clientStatus).toHaveProperty('ip');
			expect(result.clientStatus).toHaveProperty('userAgent');
			expect(result.clientStatus).toHaveProperty('eventData');
		});

		/**
		 * Validates: Requirements 2.3, 3.3
		 */
		it('should pass through eventData as-is including optional rateLimitStatus', () => {
			const clientStatus = {
				ip: '10.0.0.1',
				userAgent: 'Mozilla/5.0',
				eventData: {
					totalRequests: 500,
					failedRequests: 3,
					errorRate: 0.006,
					rateLimitStatus: {
						isRateLimited: false,
						requestsInWindow: 42
					}
				}
			};

			const result = successView({ processingTime: 7, clientStatus });

			expect(result.clientStatus.eventData.rateLimitStatus).toEqual({
				isRateLimited: false,
				requestsInWindow: 42
			});
		});

		/**
		 * Validates: Requirement 3.4
		 */
		it('should omit optional fields from eventData when not provided', () => {
			const clientStatus = {
				ip: '10.0.0.1',
				userAgent: 'Mozilla/5.0',
				eventData: {
					totalRequests: 100,
					failedRequests: 0,
					errorRate: 0
				}
			};

			const result = successView({ processingTime: 4, clientStatus });

			expect(result.clientStatus.eventData).not.toHaveProperty('rateLimitStatus');
			expect(result.clientStatus.eventData).toEqual({
				totalRequests: 100,
				failedRequests: 0,
				errorRate: 0
			});
		});
	});

	/* ------------------------------------------------------------------ */
	/*  Without clientStatus                                               */
	/* ------------------------------------------------------------------ */
	describe('without clientStatus', () => {
		/**
		 * Validates: Requirement 2.2
		 */
		it('should omit clientStatus when not provided in data', () => {
			const result = successView({ processingTime: 9 });

			expect(result).not.toHaveProperty('clientStatus');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  JSON round-trip — clientStatus                                     */
	/* ------------------------------------------------------------------ */
	describe('JSON round-trip — clientStatus', () => {
		/**
		 * Validates: Requirements 2.3, 3.1
		 */
		it('should preserve clientStatus structure after JSON round-trip', () => {
			const clientStatus = {
				ip: '172.16.0.1',
				userAgent: 'CustomAgent/2.0',
				eventData: {
					totalRequests: 2000,
					failedRequests: 25,
					errorRate: 0.0125,
					rateLimitStatus: {
						isRateLimited: true,
						requestsInWindow: 999
					}
				}
			};

			const raw = successView({ processingTime: 6, clientStatus });
			const parsed = JSON.parse(JSON.stringify(raw));

			expect(parsed).toHaveProperty('clientStatus');
			expect(parsed.clientStatus.ip).toBe('172.16.0.1');
			expect(parsed.clientStatus.userAgent).toBe('CustomAgent/2.0');
			expect(parsed.clientStatus.eventData).toEqual(clientStatus.eventData);
			expect(typeof parsed.clientStatus.eventData.errorRate).toBe('number');
		});
	});
});
