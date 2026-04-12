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
				DebugAndLog: { debug: jest.fn(), log: jest.fn(), error: jest.fn(), diag: jest.fn(), isProduction: jest.fn().mockReturnValue(false) },
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
