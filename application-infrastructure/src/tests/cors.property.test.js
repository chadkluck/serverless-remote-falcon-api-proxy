/**
 * Property-based tests for CORS origin matching and security headers.
 *
 * Feature: convert-to-atlantis, Property 6/7/8
 *
 * Property 6: CORS and security headers on all responses
 * **Validates: Requirements 6.1, 6.4**
 *
 * Property 7: CORS origin matching
 * **Validates: Requirements 6.2, 6.5**
 *
 * Property 8: OPTIONS preflight returns 200 with empty body
 * **Validates: Requirements 6.3**
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const fc = require('fast-check');
const { getCorsHeaders } = require('../utils/cors');

const REQUIRED_CORS_HEADERS = [
	'Access-Control-Allow-Origin',
	'Access-Control-Allow-Headers',
	'Access-Control-Allow-Methods',
	'Access-Control-Allow-Credentials',
	'Vary'
];

const REQUIRED_SECURITY_HEADERS = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'X-XSS-Protection': '1; mode=block',
	'Referrer-Policy': 'strict-origin-when-cross-origin'
};

describe('Feature: convert-to-atlantis, Property 6: CORS and security headers on all responses', () => {

	const originalEnv = process.env.ALLOWED_ORIGINS;

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.ALLOWED_ORIGINS = originalEnv;
		} else {
			delete process.env.ALLOWED_ORIGINS;
		}
	});

	it('should include all required CORS and security headers for any origin', () => {
		const originArb = fc.oneof(
			fc.webUrl(),
			fc.constant(undefined),
			fc.constant(''),
			fc.constantFrom(
				'https://example.com',
				'https://app.mysite.com',
				'http://localhost:3000',
				'https://unknown-origin.com'
			)
		);

		fc.assert(
			fc.property(
				originArb,
				(origin) => {
					process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.mysite.com,*';
					const headers = getCorsHeaders(origin);

					// Verify all required CORS headers are present
					for (const header of REQUIRED_CORS_HEADERS) {
						expect(headers).toHaveProperty(header);
						expect(headers[header]).toBeDefined();
					}

					// Verify all required security headers are present with correct values
					for (const [header, value] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
						expect(headers[header]).toBe(value);
					}

					// Verify Content-Security-Policy is present
					expect(headers).toHaveProperty('Content-Security-Policy');
					expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
				}
			),
			{ numRuns: 100 }
		);
	});
});

describe('Feature: convert-to-atlantis, Property 7: CORS origin matching', () => {

	const originalEnv = process.env.ALLOWED_ORIGINS;

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.ALLOWED_ORIGINS = originalEnv;
		} else {
			delete process.env.ALLOWED_ORIGINS;
		}
	});

	it('should set Access-Control-Allow-Origin to request origin when it matches an allowed origin', () => {
		// Generate random allowed origins and test that matching works
		const domainArb = fc.stringMatching(/^[a-z]{3,10}\.[a-z]{2,5}$/)
			.map(d => `https://${d}`);

		fc.assert(
			fc.property(
				fc.array(domainArb, { minLength: 1, maxLength: 5 }),
				fc.nat({ max: 4 }),
				(allowedOrigins, indexSeed) => {
					// Pick one of the allowed origins to test
					const idx = indexSeed % allowedOrigins.length;
					const testOrigin = allowedOrigins[idx];

					process.env.ALLOWED_ORIGINS = allowedOrigins.join(',');
					const headers = getCorsHeaders(testOrigin);

					// Origin should match
					expect(headers['Access-Control-Allow-Origin']).toBe(testOrigin);
					// Credentials should be true for specific origin match
					expect(headers['Access-Control-Allow-Credentials']).toBe('true');
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should handle wildcard * in ALLOWED_ORIGINS by allowing any origin', () => {
		const originArb = fc.oneof(
			fc.webUrl(),
			fc.constantFrom(
				'https://any-site.com',
				'http://localhost:8080',
				'https://random.example.org'
			)
		);

		fc.assert(
			fc.property(
				originArb,
				(origin) => {
					process.env.ALLOWED_ORIGINS = '*';
					const headers = getCorsHeaders(origin);

					// With wildcard, origin should be set to the request origin
					expect(headers['Access-Control-Allow-Origin']).toBe(origin);
				}
			),
			{ numRuns: 100 }
		);
	});

	it('should not set credentials to true when ALLOWED_ORIGINS is wildcard *', () => {
		fc.assert(
			fc.property(
				fc.constantFrom('https://a.com', 'https://b.com', 'https://c.com'),
				(origin) => {
					process.env.ALLOWED_ORIGINS = '*';
					const headers = getCorsHeaders(origin);

					// Credentials should be false for wildcard
					expect(headers['Access-Control-Allow-Credentials']).toBe('false');
				}
			),
			{ numRuns: 100 }
		);
	});
});


describe('Feature: convert-to-atlantis, Property 8: OPTIONS preflight returns 200 with empty body', () => {

	let Routes;
	const originalEnv = process.env.ALLOWED_ORIGINS;

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
					method: 'OPTIONS'
				})),
				Response: jest.fn().mockImplementation(() => createMockResp())
			}
		}));

		Routes = require('../routes');
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
		if (originalEnv !== undefined) {
			process.env.ALLOWED_ORIGINS = originalEnv;
		} else {
			delete process.env.ALLOWED_ORIGINS;
		}
	});

	it('should return 200 with empty body for OPTIONS on any path', async () => {
		const pathArb = fc.oneof(
			fc.constant('/telemetry'),
			fc.constant('/proxy/showDetails'),
			fc.constant('/proxy/addSequenceToQueue'),
			fc.constant('/proxy/voteForSequence'),
			fc.constant('/unknown/path'),
			fc.stringMatching(/^\/[a-z]{1,20}$/)
		);

		await fc.assert(
			fc.asyncProperty(
				pathArb,
				async (path) => {
					const event = {
						httpMethod: 'OPTIONS',
						path,
						headers: { origin: 'https://example.com' },
						requestContext: { requestId: 'test-req' }
					};

					const resp = await Routes.process(event, { awsRequestId: 'ctx-req' });

					// Verify 200 status code
					expect(resp._statusCode).toBe(200);

					// Verify empty body
					expect(resp._body).toBe('');
				}
			),
			{ numRuns: 100 }
		);
	});
});
