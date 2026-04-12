/**
 * Property-based tests for logging.
 *
 * Feature: convert-to-atlantis, Property 9/10/11
 *
 * Property 9: Remote Falcon log classification
 * **Validates: Requirements 7.1, 7.2, 7.3**
 *
 * Property 10: Log entry PII sanitization
 * **Validates: Requirements 7.5, 7.6**
 *
 * Property 11: Unknown endpoints return 404 with available endpoints
 * **Validates: Requirements 14.1**
 */

const { describe, it, expect } = require('@jest/globals');
const fc = require('fast-check');
const RemoteFalconLogBuilder = require('../utils/RemoteFalconLogBuilder');

describe('Feature: convert-to-atlantis, Property 9: Remote Falcon log classification', () => {

	it('should classify HTTP 2xx with no app error as REMOTE_FALCON_REQUEST SUCCESS', () => {
		const statusArb = fc.constantFrom(200, 201, 202, 204);
		const responseDataArb = fc.record({
			data: fc.string({ minLength: 0, maxLength: 50 })
		});

		fc.assert(
			fc.property(
				statusArb,
				responseDataArb,
				(status, responseData) => {
					const builder = new RemoteFalconLogBuilder(
						'req-123',
						{ ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'test.com' },
						'/showDetails',
						'GET'
					);

					const mockResponse = { status };
					const log = builder.buildSuccessLog(mockResponse, responseData);

					expect(log.logType).toBe('REMOTE_FALCON_REQUEST');
					expect(log.status).toBe('SUCCESS');
					expect(log.response.status).toBe(status);
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should classify HTTP 4xx/5xx as REMOTE_FALCON_ERROR', () => {
		const errorStatusArb = fc.constantFrom(400, 401, 403, 404, 500, 502, 503);

		fc.assert(
			fc.property(
				errorStatusArb,
				(httpStatus) => {
					const builder = new RemoteFalconLogBuilder(
						'req-456',
						{ ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'test.com' },
						'/addSequenceToQueue',
						'POST'
					);

					const error = new Error(`HTTP ${httpStatus} error`);
					const log = builder.buildErrorLog(error, httpStatus);

					expect(log.logType).toBe('REMOTE_FALCON_ERROR');
					expect(log.status).toBe('ERROR');
					expect(log.error.httpStatus).toBe(httpStatus);
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should detect application-level errors in HTTP 200 responses', () => {
		const appErrorArb = fc.oneof(
			fc.record({ message: fc.constant('SONG_REQUESTED') }),
			fc.record({ message: fc.constant('QUEUE_FULL') }),
			fc.record({ message: fc.constantFrom('ERROR occurred', 'FAILED to process') }),
			fc.record({ success: fc.constant(false), error: fc.string({ minLength: 1, maxLength: 30 }) }),
			fc.record({ status: fc.constant('error') })
		);

		fc.assert(
			fc.property(
				appErrorArb,
				(responseData) => {
					const appError = RemoteFalconLogBuilder.detectApplicationError(responseData);

					expect(appError).not.toBeNull();
					expect(appError.type).toBe('APPLICATION_ERROR');
				}
			),
			{ numRuns: 100 }
		);
	});
});


describe('Feature: convert-to-atlantis, Property 10: Log entry PII sanitization', () => {

	it('should redact email addresses from strings', () => {
		const localPartArb = fc.stringMatching(/^[a-zA-Z0-9._%+-]{1,20}$/);
		const domainArb = fc.stringMatching(/^[a-zA-Z0-9.-]{1,15}\.[a-zA-Z]{2,4}$/);

		fc.assert(
			fc.property(
				localPartArb,
				domainArb,
				(localPart, domain) => {
					const email = `${localPart}@${domain}`;
					const builder = new RemoteFalconLogBuilder(
						'req-pii',
						{ ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'test.com' },
						'/test',
						'GET'
					);

					const sanitized = builder.sanitizePII(email);
					// Email should be redacted
					expect(sanitized).not.toContain(localPart + '@');
					expect(sanitized).toContain('[EMAIL_REDACTED]');
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should redact phone numbers from strings', () => {
		// Generate phone number patterns: 3 digits, separator, 3 digits, separator, 4 digits
		const digitGroupArb = (len) => fc.stringMatching(new RegExp(`^\\d{${len}}$`));
		const sepArb = fc.constantFrom('-', '.', '');

		fc.assert(
			fc.property(
				digitGroupArb(3),
				sepArb,
				digitGroupArb(3),
				sepArb,
				digitGroupArb(4),
				(d1, s1, d2, s2, d3) => {
					const phone = `${d1}${s1}${d2}${s2}${d3}`;
					const builder = new RemoteFalconLogBuilder(
						'req-pii',
						{ ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'test.com' },
						'/test',
						'GET'
					);

					const sanitized = builder.sanitizeClientInfo(`Contact: ${phone}`);
					// Phone should be redacted (note: SSN regex may also match some patterns)
					const hasRedaction = sanitized.includes('[PHONE_REDACTED]') || sanitized.includes('[SSN_REDACTED]');
					expect(hasRedaction).toBe(true);
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should redact JWT tokens from error messages', () => {
		// Generate JWT-like tokens: header.payload.signature
		const jwtPartArb = fc.stringMatching(/^[A-Za-z0-9_-]{10,30}$/);

		fc.assert(
			fc.property(
				jwtPartArb,
				jwtPartArb,
				jwtPartArb,
				(header, payload, signature) => {
					const jwt = `Bearer ${header}.${payload}.${signature}`;
					const builder = new RemoteFalconLogBuilder(
						'req-pii',
						{ ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'test.com' },
						'/test',
						'GET'
					);

					const sanitized = builder.sanitizeErrorMessage(jwt);
					expect(sanitized).toContain('[REDACTED]');
					expect(sanitized).not.toContain(signature);
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: convert-to-atlantis, Property 11: Unknown endpoints return 404 with available endpoints', () => {

	let Routes;

	beforeEach(() => {
		jest.resetModules();
		process.env.ALLOWED_ORIGINS = '*';

		// Mock cache-data tools with full dependency chain
		const createMockResp = () => {
			const resp = {
				_statusCode: null,
				_body: null,
				_headers: {},
				addHeader: jest.fn(function(k, v) { this._headers[k] = v; }),
				setStatusCode: jest.fn(function(code) { this._statusCode = code; }),
				setBody: jest.fn(function(body) { this._body = body; }),
				toObject: jest.fn(function() { return { statusCode: this._statusCode, body: this._body }; }),
				finalize: jest.fn(function() { return { statusCode: this._statusCode, body: this._body }; })
			};
			resp.addHeader = resp.addHeader.bind(resp);
			resp.setStatusCode = resp.setStatusCode.bind(resp);
			resp.setBody = resp.setBody.bind(resp);
			resp.toObject = resp.toObject.bind(resp);
			resp.finalize = resp.finalize.bind(resp);
			return resp;
		};

		jest.mock('@63klabs/cache-data', () => ({
			cache: {
				Cache: { init: jest.fn(), info: jest.fn().mockReturnValue({}) },
				CacheableDataAccess: { prime: jest.fn().mockResolvedValue(true) }
			},
			tools: {
				DebugAndLog: { debug: jest.fn(), log: jest.fn(), error: jest.fn(), warn: jest.fn(), diag: jest.fn(), isProduction: jest.fn().mockReturnValue(false) },
				Timer: jest.fn().mockImplementation(() => ({ stop: jest.fn() })),
				CachedParameterSecrets: { prime: jest.fn().mockResolvedValue(true) },
				CachedSsmParameter: jest.fn().mockImplementation(() => ({
					prime: jest.fn().mockResolvedValue(true),
					getValue: jest.fn().mockResolvedValue('mock-value')
				})),
				AppConfig: class MockAppConfig {
					static init() {}
					static promise() { return Promise.resolve(true); }
					static settings() { return { remoteFalconApiBaseUrl: 'https://mock.com', allowedOrigins: '*' }; }
				},
				ClientRequest: jest.fn().mockImplementation(() => ({
					getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
					getClientUserAgent: jest.fn().mockReturnValue('TestAgent'),
					addPathLog: jest.fn(),
					path: '/',
					method: 'GET'
				})),
				Response: jest.fn().mockImplementation(() => createMockResp())
			}
		}));

		Routes = require('../routes');
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
	});

	it('should return 404 with correct structure for any undefined path', async () => {
		// Generate paths that don't match defined endpoints
		const undefinedPathArb = fc.oneof(
			fc.stringMatching(/^\/[a-z]{1,15}$/).filter(p =>
				p !== '/telemetry' && !p.startsWith('/proxy')
			),
			fc.constantFrom(
				'/unknown',
				'/api/data',
				'/health',
				'/status',
				'/v1/test',
				'/random'
			)
		);

		const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
		const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

		await fc.assert(
			fc.asyncProperty(
				undefinedPathArb,
				async (path) => {
					consoleSpy.mockClear();
					consoleWarnSpy.mockClear();

					const event = {
						httpMethod: 'GET',
						path,
						headers: { origin: 'https://example.com' },
						requestContext: { requestId: 'test-req-404' }
					};

					const resp = await Routes.process(event, { awsRequestId: 'ctx-req-404' });

					// Verify 404 status code
					expect(resp._statusCode).toBe(404);

					// Verify response body structure
					const body = resp._body;
					expect(body).toHaveProperty('message', 'Endpoint not found');
					expect(body).toHaveProperty('error', 'NOT_FOUND');
					expect(body).toHaveProperty('requestId');
					expect(body).toHaveProperty('availableEndpoints');
					expect(body).toHaveProperty('timestamp');
					expect(Array.isArray(body.availableEndpoints)).toBe(true);
					expect(body.availableEndpoints.length).toBeGreaterThan(0);
				}
			),
			{ numRuns: 100 }
		);

		consoleSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});
});


describe('Feature: logging-updates, Property 1: Successful Remote Falcon requests use DebugAndLog', () => {

	let forward;
	let mockDebugAndLog;

	beforeEach(() => {
		jest.resetModules();

		mockDebugAndLog = {
			log: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			diag: jest.fn(),
			isProduction: jest.fn().mockReturnValue(false)
		};

		jest.mock('@63klabs/cache-data', () => ({
			tools: {
				DebugAndLog: mockDebugAndLog
			}
		}));
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
		if (global.fetch && global.fetch.mockRestore) {
			global.fetch.mockRestore();
		}
	});

	/**
	 * Property 1: Successful Remote Falcon requests use DebugAndLog with preserved structure
	 *
	 * For any successful Remote Falcon API response (HTTP 2xx with no application-level error),
	 * the RemoteFalcon DAO shall call DebugAndLog.log with the tag "REMOTE_FALCON_REQUEST"
	 * and a structured object containing timestamp, requestId, logType, status, request details,
	 * and response details — and shall not call console.log.
	 *
	 * **Validates: Requirements 1.1, 1.2, 9.1**
	 */
	it('should call DebugAndLog.log with REMOTE_FALCON_REQUEST tag and structured object for 2xx success responses', async () => {
		const statusArb = fc.constantFrom(200, 201, 202, 204);
		const safeResponseDataArb = fc.oneof(
			fc.record({ data: fc.string({ minLength: 1, maxLength: 50 }) }),
			fc.record({ items: fc.constant([]) }),
			fc.record({ count: fc.nat({ max: 1000 }) }),
			fc.record({ result: fc.constant('ok') })
		);
		const methodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE');
		const pathArb = fc.constantFrom('/showDetails', '/addSequenceToQueue', '/voteForSequence', '/resetAllVotes');
		const requestIdArb = fc.stringMatching(/^[a-z0-9-]{8,36}$/);

		const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

		await fc.assert(
			fc.asyncProperty(
				statusArb,
				safeResponseDataArb,
				methodArb,
				pathArb,
				requestIdArb,
				async (status, responseData, method, path, requestId) => {
					// Clear mocks between iterations
					mockDebugAndLog.log.mockClear();
					mockDebugAndLog.error.mockClear();
					consoleSpy.mockClear();

					// Mock global fetch to return controlled response
					global.fetch = jest.fn().mockResolvedValue({
						status,
						statusText: 'OK',
						json: jest.fn().mockResolvedValue(responseData)
					});

					// Require fresh module with mocked dependencies
					const { forward: fwd } = require('../models/RemoteFalcon.dao');

					const clientInfo = {
						ipAddress: '10.0.0.1',
						userAgent: 'TestAgent/1.0',
						host: 'test.example.com'
					};

					await fwd(
						`https://remotefalcon.com/remote-falcon-external-api${path}`,
						method,
						method !== 'GET' ? { key: 'value' } : null,
						'mock-jwt-token',
						clientInfo,
						requestId
					);

					// Assert DebugAndLog.log was called with correct tag
					expect(mockDebugAndLog.log).toHaveBeenCalledTimes(1);
					const [message, tag, logObj] = mockDebugAndLog.log.mock.calls[0];

					expect(typeof message).toBe('string');
					expect(tag).toBe('REMOTE_FALCON_REQUEST');

					// Assert structured object contains required fields (Requirement 9.1)
					expect(logObj).toHaveProperty('timestamp');
					expect(logObj).toHaveProperty('requestId', requestId);
					expect(logObj).toHaveProperty('logType', 'REMOTE_FALCON_REQUEST');
					expect(logObj).toHaveProperty('status', 'SUCCESS');

					// Request details
					expect(logObj).toHaveProperty('request');
					expect(logObj.request).toHaveProperty('method', method);
					expect(logObj.request).toHaveProperty('path', path);
					expect(logObj.request).toHaveProperty('ip');
					expect(logObj.request).toHaveProperty('userAgent');
					expect(logObj.request).toHaveProperty('host');

					// Response details
					expect(logObj).toHaveProperty('response');
					expect(logObj.response).toHaveProperty('status', status);
					expect(logObj.response).toHaveProperty('processingTime');
					expect(typeof logObj.response.processingTime).toBe('number');
					expect(logObj.response).toHaveProperty('dataSummary');

					// Assert console.log was NOT called (Requirement 1.2)
					expect(consoleSpy).not.toHaveBeenCalled();

					// Clean up module cache for next iteration
					jest.resetModules();
					jest.mock('@63klabs/cache-data', () => ({
						tools: {
							DebugAndLog: mockDebugAndLog
						}
					}));
				}
			),
			{ numRuns: 100 }
		);

		consoleSpy.mockRestore();
	});
});


describe('Feature: logging-updates, Property 2: Failed Remote Falcon requests use DebugAndLog.error', () => {

	let mockDebugAndLog;

	beforeEach(() => {
		jest.resetModules();

		mockDebugAndLog = {
			log: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			diag: jest.fn(),
			isProduction: jest.fn().mockReturnValue(false)
		};

		jest.mock('@63klabs/cache-data', () => ({
			tools: {
				DebugAndLog: mockDebugAndLog
			}
		}));
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
		if (global.fetch && global.fetch.mockRestore) {
			global.fetch.mockRestore();
		}
	});

	/**
	 * Property 2 - Scenario 1: HTTP error responses (4xx/5xx status codes)
	 *
	 * For any Remote Falcon API error response (HTTP 4xx/5xx), the RemoteFalcon DAO
	 * shall call DebugAndLog.error with a message containing "REMOTE_FALCON_ERROR:"
	 * and a structured object containing timestamp, requestId, logType, status,
	 * request details, and error details — and shall not call console.log or console.error.
	 *
	 * **Validates: Requirements 2.1, 2.2, 2.5, 9.2**
	 */
	it('should call DebugAndLog.error with REMOTE_FALCON_ERROR message for HTTP 4xx/5xx error responses', async () => {
		const errorStatusArb = fc.constantFrom(400, 401, 403, 404, 405, 408, 429, 500, 502, 503, 504);
		const statusTextArb = fc.constantFrom('Bad Request', 'Unauthorized', 'Forbidden', 'Not Found', 'Internal Server Error', 'Bad Gateway', 'Service Unavailable', 'Error');
		const methodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE');
		const pathArb = fc.constantFrom('/showDetails', '/addSequenceToQueue', '/voteForSequence', '/resetAllVotes');
		const requestIdArb = fc.stringMatching(/^[a-z0-9-]{8,36}$/);
		const responseDataArb = fc.oneof(
			fc.record({ error: fc.string({ minLength: 1, maxLength: 50 }) }),
			fc.record({ message: fc.string({ minLength: 1, maxLength: 50 }) }),
			fc.constant({})
		);

		const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

		await fc.assert(
			fc.asyncProperty(
				errorStatusArb,
				statusTextArb,
				methodArb,
				pathArb,
				requestIdArb,
				responseDataArb,
				async (status, statusText, method, path, requestId, responseData) => {
					mockDebugAndLog.log.mockClear();
					mockDebugAndLog.error.mockClear();
					consoleLogSpy.mockClear();
					consoleErrorSpy.mockClear();

					global.fetch = jest.fn().mockResolvedValue({
						status,
						statusText,
						json: jest.fn().mockResolvedValue(responseData)
					});

					const { forward } = require('../models/RemoteFalcon.dao');

					const clientInfo = {
						ipAddress: '10.0.0.1',
						userAgent: 'TestAgent/1.0',
						host: 'test.example.com'
					};

					await forward(
						`https://remotefalcon.com/remote-falcon-external-api${path}`,
						method,
						method !== 'GET' ? { key: 'value' } : null,
						'mock-jwt-token',
						clientInfo,
						requestId
					);

					// Assert DebugAndLog.error was called (Requirement 2.1)
					expect(mockDebugAndLog.error).toHaveBeenCalledTimes(1);
					const [message, errorObj] = mockDebugAndLog.error.mock.calls[0];

					// Assert message contains REMOTE_FALCON_ERROR: prefix
					expect(message).toContain('REMOTE_FALCON_ERROR:');

					// Assert structured object contains required fields (Requirement 9.2)
					expect(errorObj).toHaveProperty('timestamp');
					expect(errorObj).toHaveProperty('requestId', requestId);
					expect(errorObj).toHaveProperty('logType', 'REMOTE_FALCON_ERROR');
					expect(errorObj).toHaveProperty('status', 'ERROR');

					// Request details
					expect(errorObj).toHaveProperty('request');
					expect(errorObj.request).toHaveProperty('method', method);
					expect(errorObj.request).toHaveProperty('path', path);
					expect(errorObj.request).toHaveProperty('ip');
					expect(errorObj.request).toHaveProperty('userAgent');
					expect(errorObj.request).toHaveProperty('host');

					// Error details
					expect(errorObj).toHaveProperty('error');
					expect(errorObj.error).toHaveProperty('type');
					expect(errorObj.error).toHaveProperty('message');
					expect(errorObj.error).toHaveProperty('httpStatus', status);
					expect(errorObj.error).toHaveProperty('processingTime');
					expect(typeof errorObj.error.processingTime).toBe('number');

					// Assert console.log and console.error were NOT called (Requirements 2.4, 2.5)
					expect(consoleLogSpy).not.toHaveBeenCalled();
					expect(consoleErrorSpy).not.toHaveBeenCalled();

					// Clean up module cache for next iteration
					jest.resetModules();
					jest.mock('@63klabs/cache-data', () => ({
						tools: {
							DebugAndLog: mockDebugAndLog
						}
					}));
				}
			),
			{ numRuns: 100 }
		);

		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	/**
	 * Property 2 - Scenario 2: Application-level errors in 2xx responses
	 *
	 * For any Remote Falcon API response with HTTP 2xx but containing an application-level
	 * error (e.g., SONG_REQUESTED, success: false, status: 'error'), the RemoteFalcon DAO
	 * shall call DebugAndLog.error with a message containing "REMOTE_FALCON_ERROR:"
	 * and a structured object — and shall not call console.log or console.error.
	 *
	 * **Validates: Requirements 2.2, 2.5, 9.2**
	 */
	it('should call DebugAndLog.error with REMOTE_FALCON_ERROR message for application-level errors in 2xx responses', async () => {
		const successStatusArb = fc.constantFrom(200, 201, 202);
		const appErrorResponseArb = fc.oneof(
			fc.record({ message: fc.constant('SONG_REQUESTED') }),
			fc.record({ message: fc.constant('QUEUE_FULL') }),
			fc.record({ message: fc.constantFrom('ERROR occurred', 'FAILED to process') }),
			fc.record({ success: fc.constant(false), error: fc.string({ minLength: 1, maxLength: 30 }) }),
			fc.record({ status: fc.constant('error') })
		);
		const methodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE');
		const pathArb = fc.constantFrom('/showDetails', '/addSequenceToQueue', '/voteForSequence', '/resetAllVotes');
		const requestIdArb = fc.stringMatching(/^[a-z0-9-]{8,36}$/);

		const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

		await fc.assert(
			fc.asyncProperty(
				successStatusArb,
				appErrorResponseArb,
				methodArb,
				pathArb,
				requestIdArb,
				async (status, responseData, method, path, requestId) => {
					mockDebugAndLog.log.mockClear();
					mockDebugAndLog.error.mockClear();
					consoleLogSpy.mockClear();
					consoleErrorSpy.mockClear();

					global.fetch = jest.fn().mockResolvedValue({
						status,
						statusText: 'OK',
						json: jest.fn().mockResolvedValue(responseData)
					});

					const { forward } = require('../models/RemoteFalcon.dao');

					const clientInfo = {
						ipAddress: '10.0.0.1',
						userAgent: 'TestAgent/1.0',
						host: 'test.example.com'
					};

					await forward(
						`https://remotefalcon.com/remote-falcon-external-api${path}`,
						method,
						method !== 'GET' ? { key: 'value' } : null,
						'mock-jwt-token',
						clientInfo,
						requestId
					);

					// Assert DebugAndLog.error was called (Requirement 2.2)
					expect(mockDebugAndLog.error).toHaveBeenCalledTimes(1);
					const [message, errorObj] = mockDebugAndLog.error.mock.calls[0];

					// Assert message contains REMOTE_FALCON_ERROR: prefix
					expect(message).toContain('REMOTE_FALCON_ERROR:');

					// Assert structured object contains required fields (Requirement 9.2)
					expect(errorObj).toHaveProperty('timestamp');
					expect(errorObj).toHaveProperty('requestId', requestId);
					expect(errorObj).toHaveProperty('logType', 'REMOTE_FALCON_ERROR');
					expect(errorObj).toHaveProperty('status', 'ERROR');

					// Request details
					expect(errorObj).toHaveProperty('request');
					expect(errorObj.request).toHaveProperty('method', method);
					expect(errorObj.request).toHaveProperty('path', path);
					expect(errorObj.request).toHaveProperty('ip');
					expect(errorObj.request).toHaveProperty('userAgent');
					expect(errorObj.request).toHaveProperty('host');

					// Error details
					expect(errorObj).toHaveProperty('error');
					expect(errorObj.error).toHaveProperty('type');
					expect(errorObj.error).toHaveProperty('message');
					expect(errorObj.error).toHaveProperty('httpStatus', status);
					expect(errorObj.error).toHaveProperty('processingTime');
					expect(typeof errorObj.error.processingTime).toBe('number');

					// Assert console.log and console.error were NOT called (Requirement 2.5)
					expect(consoleLogSpy).not.toHaveBeenCalled();
					expect(consoleErrorSpy).not.toHaveBeenCalled();

					// Clean up module cache for next iteration
					jest.resetModules();
					jest.mock('@63klabs/cache-data', () => ({
						tools: {
							DebugAndLog: mockDebugAndLog
						}
					}));
				}
			),
			{ numRuns: 100 }
		);

		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});
});


describe('Feature: logging-updates, Property 3: Valid telemetry events use DebugAndLog', () => {

	let mockDebugAndLog;

	beforeEach(() => {
		jest.resetModules();

		mockDebugAndLog = {
			log: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			diag: jest.fn(),
			isProduction: jest.fn().mockReturnValue(false)
		};

		jest.mock('@63klabs/cache-data', () => ({
			tools: {
				DebugAndLog: mockDebugAndLog
			}
		}));
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
	});

	/**
	 * Property 3: Valid telemetry events use DebugAndLog with preserved structure for both event and metrics
	 *
	 * For any valid telemetry tracking event, the Telemetry Service shall call DebugAndLog.log twice —
	 * once with tag "TELEMETRY_EVENT" and the full event log entry (timestamp, eventType, ipAddress,
	 * userAgent, host, url, eventData, processingTime, requestId), and once with tag "TELEMETRY_METRICS"
	 * and the metrics object (timestamp, eventType, processingTime, success, requestId) — and shall not
	 * call console.log.
	 *
	 * **Validates: Requirements 3.1, 3.2, 4.1, 4.2, 9.3, 9.4**
	 */
	it('should call DebugAndLog.log twice with TELEMETRY_EVENT and TELEMETRY_METRICS tags and not call console.log', async () => {
		const eventTypeArb = fc.constantFrom('pageView', 'click', 'videoPlay', 'songRequest');
		const pathSegmentArb = fc.stringMatching(/^[a-z0-9-]{1,20}$/);
		const ipArb = fc.tuple(
			fc.integer({ min: 1, max: 255 }),
			fc.integer({ min: 0, max: 255 }),
			fc.integer({ min: 0, max: 255 }),
			fc.integer({ min: 0, max: 255 })
		).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);
		const userAgentArb = fc.constantFrom(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
			'TestAgent/1.0',
			'curl/7.68.0'
		);
		const hostArb = fc.constantFrom('example.com', 'test.example.com', 'app.mysite.org');
		const requestIdArb = fc.stringMatching(/^[a-z0-9-]{8,36}$/);

		const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

		await fc.assert(
			fc.asyncProperty(
				eventTypeArb,
				pathSegmentArb,
				ipArb,
				userAgentArb,
				hostArb,
				requestIdArb,
				async (eventType, pathSegment, ipAddress, userAgent, host, requestId) => {
					// Clear mocks between iterations
					mockDebugAndLog.log.mockClear();
					consoleSpy.mockClear();

					// Require fresh module with mocked dependencies
					const { processTracking } = require('../services/telemetry.service');

					const body = {
						eventType,
						url: `https://example.com/${pathSegment}`
					};

					const clientInfo = {
						ipAddress,
						userAgent,
						host
					};

					const result = await processTracking(body, clientInfo, requestId);

					// Should return 200 for valid tracking data
					expect(result.statusCode).toBe(200);

					// Assert DebugAndLog.log was called exactly twice (Requirement 3.1, 4.1)
					expect(mockDebugAndLog.log).toHaveBeenCalledTimes(2);

					// First call: TELEMETRY_EVENT
					const [eventMsg, eventTag, eventObj] = mockDebugAndLog.log.mock.calls[0];
					expect(typeof eventMsg).toBe('string');
					expect(eventTag).toBe('TELEMETRY_EVENT');

					// Verify TELEMETRY_EVENT structured fields (Requirement 9.3)
					expect(eventObj).toHaveProperty('timestamp');
					expect(eventObj).toHaveProperty('eventType', eventType);
					expect(eventObj).toHaveProperty('ipAddress', ipAddress);
					expect(eventObj).toHaveProperty('userAgent', userAgent);
					expect(eventObj).toHaveProperty('host', host);
					expect(eventObj).toHaveProperty('url', body.url);
					expect(eventObj).toHaveProperty('eventData');
					expect(eventObj).toHaveProperty('processingTime');
					expect(typeof eventObj.processingTime).toBe('number');
					expect(eventObj).toHaveProperty('requestId', requestId);

					// Second call: TELEMETRY_METRICS
					const [metricsMsg, metricsTag, metricsObj] = mockDebugAndLog.log.mock.calls[1];
					expect(typeof metricsMsg).toBe('string');
					expect(metricsTag).toBe('TELEMETRY_METRICS');

					// Verify TELEMETRY_METRICS structured fields (Requirement 9.4)
					expect(metricsObj).toHaveProperty('timestamp');
					expect(metricsObj).toHaveProperty('eventType', eventType);
					expect(metricsObj).toHaveProperty('processingTime');
					expect(typeof metricsObj.processingTime).toBe('number');
					expect(metricsObj).toHaveProperty('success', true);
					expect(metricsObj).toHaveProperty('requestId', requestId);

					// Assert console.log was NOT called (Requirements 3.2, 4.2)
					expect(consoleSpy).not.toHaveBeenCalled();

					// Clean up module cache for next iteration
					jest.resetModules();
					jest.mock('@63klabs/cache-data', () => ({
						tools: {
							DebugAndLog: mockDebugAndLog
						}
					}));
				}
			),
			{ numRuns: 100 }
		);

		consoleSpy.mockRestore();
	});
});


describe('Feature: logging-updates, Property 4: All request outcomes log REQUEST_METRICS via DebugAndLog', () => {

	let Routes;
	let mockDebugAndLog;

	beforeEach(() => {
		jest.resetModules();
		process.env.ALLOWED_ORIGINS = '*';

		mockDebugAndLog = {
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
			diag: jest.fn(),
			isProduction: jest.fn().mockReturnValue(false)
		};

		const createMockResp = () => {
			const resp = {
				_statusCode: null,
				_body: null,
				_headers: {},
				addHeader: jest.fn(function(k, v) { this._headers[k] = v; }),
				setStatusCode: jest.fn(function(code) { this._statusCode = code; }),
				setBody: jest.fn(function(body) { this._body = body; }),
				toObject: jest.fn(function() { return { statusCode: this._statusCode, body: this._body }; }),
				finalize: jest.fn(function() { return { statusCode: this._statusCode, body: this._body }; })
			};
			resp.addHeader = resp.addHeader.bind(resp);
			resp.setStatusCode = resp.setStatusCode.bind(resp);
			resp.setBody = resp.setBody.bind(resp);
			resp.toObject = resp.toObject.bind(resp);
			resp.finalize = resp.finalize.bind(resp);
			return resp;
		};

		jest.mock('@63klabs/cache-data', () => ({
			cache: {
				Cache: { init: jest.fn(), info: jest.fn().mockReturnValue({}) },
				CacheableDataAccess: { prime: jest.fn().mockResolvedValue(true) }
			},
			tools: {
				DebugAndLog: mockDebugAndLog,
				Timer: jest.fn().mockImplementation(() => ({ stop: jest.fn() })),
				CachedParameterSecrets: { prime: jest.fn().mockResolvedValue(true) },
				CachedSsmParameter: jest.fn().mockImplementation(() => ({
					prime: jest.fn().mockResolvedValue(true),
					getValue: jest.fn().mockResolvedValue('mock-value')
				})),
				AppConfig: class MockAppConfig {
					static init() {}
					static promise() { return Promise.resolve(true); }
					static settings() { return { remoteFalconApiBaseUrl: 'https://mock.com', allowedOrigins: '*' }; }
				},
				ClientRequest: jest.fn().mockImplementation(() => ({
					getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
					getClientUserAgent: jest.fn().mockReturnValue('TestAgent'),
					addPathLog: jest.fn(),
					path: '/',
					method: 'GET'
				})),
				Response: jest.fn().mockImplementation(() => createMockResp())
			}
		}));

		Routes = require('../routes');
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
	});

	/**
	 * Property 4: All request outcomes log REQUEST_METRICS via DebugAndLog with preserved structure
	 *
	 * For any request to an unknown endpoint (404 scenario), the Router shall call
	 * DebugAndLog.log with the tag "REQUEST_METRICS" and a structured object containing
	 * requestId, timestamp, method, path, statusCode (404), processingTime, totalTime,
	 * and success (false) — and shall not call console.log.
	 *
	 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 9.5**
	 */
	it('should call DebugAndLog.log with REQUEST_METRICS tag and structured object for 404 unknown endpoint requests', async () => {
		const undefinedPathArb = fc.oneof(
			fc.stringMatching(/^\/[a-z]{1,15}$/).filter(p =>
				p !== '/telemetry' && !p.startsWith('/proxy')
			),
			fc.constantFrom(
				'/unknown',
				'/api/data',
				'/health',
				'/status',
				'/v1/test',
				'/random'
			)
		);

		const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

		await fc.assert(
			fc.asyncProperty(
				undefinedPathArb,
				async (path) => {
					mockDebugAndLog.log.mockClear();
					mockDebugAndLog.warn.mockClear();
					consoleSpy.mockClear();

					const event = {
						httpMethod: 'GET',
						path,
						headers: { origin: 'https://example.com' },
						requestContext: { requestId: 'test-req-metrics-404' }
					};

					const resp = await Routes.process(event, { awsRequestId: 'ctx-req-metrics-404' });

					// Verify 404 status code
					expect(resp._statusCode).toBe(404);

					// Find the REQUEST_METRICS call among DebugAndLog.log calls
					const metricsCall = mockDebugAndLog.log.mock.calls.find(
						call => call[1] === 'REQUEST_METRICS'
					);

					expect(metricsCall).toBeDefined();

					const [message, tag, metricsObj] = metricsCall;

					// Assert tag and message
					expect(typeof message).toBe('string');
					expect(tag).toBe('REQUEST_METRICS');

					// Assert structured object contains required fields (Requirement 9.5)
					expect(metricsObj).toHaveProperty('requestId');
					expect(metricsObj).toHaveProperty('timestamp');
					expect(metricsObj).toHaveProperty('method', 'GET');
					expect(metricsObj).toHaveProperty('path', path);
					expect(metricsObj).toHaveProperty('statusCode', 404);
					expect(metricsObj).toHaveProperty('processingTime');
					expect(typeof metricsObj.processingTime).toBe('number');
					expect(metricsObj).toHaveProperty('totalTime');
					expect(typeof metricsObj.totalTime).toBe('number');
					expect(metricsObj).toHaveProperty('success', false);

					// Assert console.log was NOT called (Requirement 5.4)
					expect(consoleSpy).not.toHaveBeenCalled();
				}
			),
			{ numRuns: 100 }
		);

		consoleSpy.mockRestore();
	});
});


describe('Feature: logging-updates, Property 5: Unhandled errors use DebugAndLog.error', () => {

	let Routes;
	let mockDebugAndLog;

	beforeEach(() => {
		jest.resetModules();
		process.env.ALLOWED_ORIGINS = '*';

		mockDebugAndLog = {
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
			diag: jest.fn(),
			isProduction: jest.fn().mockReturnValue(false)
		};

		const createMockResp = () => {
			const resp = {
				_statusCode: null,
				_body: null,
				_headers: {},
				addHeader: jest.fn(function(k, v) { this._headers[k] = v; }),
				setStatusCode: jest.fn(function(code) { this._statusCode = code; }),
				setBody: jest.fn(function(body) { this._body = body; }),
				toObject: jest.fn(function() { return { statusCode: this._statusCode, body: this._body }; }),
				finalize: jest.fn(function() { return { statusCode: this._statusCode, body: this._body }; })
			};
			resp.addHeader = resp.addHeader.bind(resp);
			resp.setStatusCode = resp.setStatusCode.bind(resp);
			resp.setBody = resp.setBody.bind(resp);
			resp.toObject = resp.toObject.bind(resp);
			resp.finalize = resp.finalize.bind(resp);
			return resp;
		};

		jest.mock('@63klabs/cache-data', () => ({
			cache: {
				Cache: { init: jest.fn(), info: jest.fn().mockReturnValue({}) },
				CacheableDataAccess: { prime: jest.fn().mockResolvedValue(true) }
			},
			tools: {
				DebugAndLog: mockDebugAndLog,
				Timer: jest.fn().mockImplementation(() => ({ stop: jest.fn() })),
				CachedParameterSecrets: { prime: jest.fn().mockResolvedValue(true) },
				CachedSsmParameter: jest.fn().mockImplementation(() => ({
					prime: jest.fn().mockResolvedValue(true),
					getValue: jest.fn().mockResolvedValue('mock-value')
				})),
				AppConfig: class MockAppConfig {
					static init() {}
					static promise() { return Promise.resolve(true); }
					static settings() { return { remoteFalconApiBaseUrl: 'https://mock.com', allowedOrigins: '*' }; }
				},
				ClientRequest: jest.fn().mockImplementation(() => ({
					getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
					getClientUserAgent: jest.fn().mockReturnValue('TestAgent'),
					addPathLog: jest.fn(),
					path: '/',
					method: 'GET'
				})),
				Response: jest.fn().mockImplementation(() => createMockResp())
			}
		}));

		// Mock controllers so we can make them throw errors
		jest.mock('../controllers', () => ({
			TelemetryCtrl: {
				post: jest.fn()
			},
			ProxyCtrl: {
				forward: jest.fn()
			}
		}));

		Routes = require('../routes');
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
	});

	/**
	 * Property 5: Unhandled errors use DebugAndLog.error with preserved structure
	 *
	 * For any unhandled error during request processing, the Router shall call
	 * DebugAndLog.error with a descriptive message and a structured object containing
	 * requestId, timestamp, error details (message, name, stack), request context
	 * (method, path, origin, userAgent), and totalTime — and shall not call console.error.
	 *
	 * **Validates: Requirements 6.1, 6.2, 9.6**
	 */
	it('should call DebugAndLog.error with LAMBDA_ERROR message and structured object when controller throws', async () => {
		const errorMessageArb = fc.stringMatching(/^[A-Za-z0-9 _-]{1,50}$/);
		const errorNameArb = fc.constantFrom(
			'Error', 'TypeError', 'RangeError', 'ReferenceError',
			'SyntaxError', 'URIError', 'CustomError', 'ServiceError'
		);
		const originArb = fc.constantFrom(
			'https://example.com',
			'https://app.mysite.org',
			'http://localhost:3000',
			'https://test.example.com'
		);
		const userAgentArb = fc.constantFrom(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
			'TestAgent/1.0',
			'curl/7.68.0'
		);

		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

		await fc.assert(
			fc.asyncProperty(
				errorMessageArb,
				errorNameArb,
				originArb,
				userAgentArb,
				async (errorMessage, errorName, origin, userAgent) => {
					mockDebugAndLog.error.mockClear();
					mockDebugAndLog.log.mockClear();
					consoleErrorSpy.mockClear();

					// Configure TelemetryCtrl.post to throw the generated error
					const thrownError = new Error(errorMessage);
					thrownError.name = errorName;
					const { TelemetryCtrl } = require('../controllers');
					TelemetryCtrl.post.mockRejectedValue(thrownError);

					const event = {
						httpMethod: 'POST',
						path: '/telemetry',
						body: JSON.stringify({ eventType: 'pageView' }),
						headers: {
							origin,
							'user-agent': userAgent
						},
						requestContext: { requestId: 'test-req-error' }
					};

					const resp = await Routes.process(event, { awsRequestId: 'ctx-req-error' });

					// Verify 500 status code
					expect(resp._statusCode).toBe(500);

					// Assert DebugAndLog.error was called (Requirement 6.1)
					expect(mockDebugAndLog.error).toHaveBeenCalled();

					const errorCall = mockDebugAndLog.error.mock.calls.find(
						call => typeof call[0] === 'string' && call[0].includes('LAMBDA_ERROR')
					);

					expect(errorCall).toBeDefined();

					const [message, errorObj] = errorCall;

					// Assert message contains LAMBDA_ERROR
					expect(message).toContain('LAMBDA_ERROR');

					// Assert structured object contains required fields (Requirement 9.6)
					expect(errorObj).toHaveProperty('requestId');
					expect(errorObj).toHaveProperty('timestamp');

					// Error details
					expect(errorObj).toHaveProperty('error');
					expect(errorObj.error).toHaveProperty('message', errorMessage);
					expect(errorObj.error).toHaveProperty('name', errorName);
					expect(errorObj.error).toHaveProperty('stack');
					expect(typeof errorObj.error.stack).toBe('string');

					// Request context
					expect(errorObj).toHaveProperty('request');
					expect(errorObj.request).toHaveProperty('method', 'POST');
					expect(errorObj.request).toHaveProperty('path', '/telemetry');
					expect(errorObj.request).toHaveProperty('origin', origin);
					expect(errorObj.request).toHaveProperty('userAgent', userAgent);

					// Total time
					expect(errorObj).toHaveProperty('totalTime');
					expect(typeof errorObj.totalTime).toBe('number');

					// Assert console.error was NOT called (Requirement 6.2)
					expect(consoleErrorSpy).not.toHaveBeenCalled();
				}
			),
			{ numRuns: 100 }
		);

		consoleErrorSpy.mockRestore();
	});
});


describe('Feature: logging-updates, Property 6: Unknown endpoints use DebugAndLog.warn', () => {

	let Routes;
	let mockDebugAndLog;

	beforeEach(() => {
		jest.resetModules();
		process.env.ALLOWED_ORIGINS = '*';

		mockDebugAndLog = {
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
			diag: jest.fn(),
			isProduction: jest.fn().mockReturnValue(false)
		};

		const createMockResp = () => {
			const resp = {
				_statusCode: null,
				_body: null,
				_headers: {},
				addHeader: jest.fn(function(k, v) { this._headers[k] = v; }),
				setStatusCode: jest.fn(function(code) { this._statusCode = code; }),
				setBody: jest.fn(function(body) { this._body = body; }),
				toObject: jest.fn(function() { return { statusCode: this._statusCode, body: this._body }; }),
				finalize: jest.fn(function() { return { statusCode: this._statusCode, body: this._body }; })
			};
			resp.addHeader = resp.addHeader.bind(resp);
			resp.setStatusCode = resp.setStatusCode.bind(resp);
			resp.setBody = resp.setBody.bind(resp);
			resp.toObject = resp.toObject.bind(resp);
			resp.finalize = resp.finalize.bind(resp);
			return resp;
		};

		jest.mock('@63klabs/cache-data', () => ({
			cache: {
				Cache: { init: jest.fn(), info: jest.fn().mockReturnValue({}) },
				CacheableDataAccess: { prime: jest.fn().mockResolvedValue(true) }
			},
			tools: {
				DebugAndLog: mockDebugAndLog,
				Timer: jest.fn().mockImplementation(() => ({ stop: jest.fn() })),
				CachedParameterSecrets: { prime: jest.fn().mockResolvedValue(true) },
				CachedSsmParameter: jest.fn().mockImplementation(() => ({
					prime: jest.fn().mockResolvedValue(true),
					getValue: jest.fn().mockResolvedValue('mock-value')
				})),
				AppConfig: class MockAppConfig {
					static init() {}
					static promise() { return Promise.resolve(true); }
					static settings() { return { remoteFalconApiBaseUrl: 'https://mock.com', allowedOrigins: '*' }; }
				},
				ClientRequest: jest.fn().mockImplementation(() => ({
					getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
					getClientUserAgent: jest.fn().mockReturnValue('TestAgent'),
					addPathLog: jest.fn(),
					path: '/',
					method: 'GET'
				})),
				Response: jest.fn().mockImplementation(() => createMockResp())
			}
		}));

		Routes = require('../routes');
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
	});

	/**
	 * Property 6: Unknown endpoints use DebugAndLog.warn
	 *
	 * For any request to an unknown endpoint, the Router shall call DebugAndLog.warn
	 * with a descriptive message and an object containing path, method, and requestId
	 * — and shall not call console.warn.
	 *
	 * **Validates: Requirements 7.1, 7.2**
	 */
	it('should call DebugAndLog.warn with descriptive message and object containing path, method, requestId for unknown endpoints', async () => {
		const unknownPathArb = fc.oneof(
			fc.stringMatching(/^\/[a-z]{1,15}$/).filter(p =>
				p !== '/telemetry' && !p.startsWith('/proxy')
			),
			fc.constantFrom(
				'/unknown',
				'/api/data',
				'/health',
				'/status',
				'/v1/test',
				'/random'
			)
		);

		const methodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE');

		const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

		await fc.assert(
			fc.asyncProperty(
				unknownPathArb,
				methodArb,
				async (path, method) => {
					mockDebugAndLog.warn.mockClear();
					mockDebugAndLog.log.mockClear();
					consoleWarnSpy.mockClear();

					const event = {
						httpMethod: method,
						path,
						headers: { origin: 'https://example.com' },
						requestContext: { requestId: 'test-req-warn' }
					};

					await Routes.process(event, { awsRequestId: 'ctx-req-warn' });

					// Assert DebugAndLog.warn was called (Requirement 7.1)
					expect(mockDebugAndLog.warn).toHaveBeenCalledTimes(1);

					const [message, warnObj] = mockDebugAndLog.warn.mock.calls[0];

					// Assert message is a descriptive string
					expect(typeof message).toBe('string');
					expect(message.length).toBeGreaterThan(0);

					// Assert object contains path, method, and requestId
					expect(warnObj).toHaveProperty('path', path);
					expect(warnObj).toHaveProperty('method', method);
					expect(warnObj).toHaveProperty('requestId');
					expect(typeof warnObj.requestId).toBe('string');

					// Assert console.warn was NOT called (Requirement 7.2)
					expect(consoleWarnSpy).not.toHaveBeenCalled();
				}
			),
			{ numRuns: 100 }
		);

		consoleWarnSpy.mockRestore();
	});
});
