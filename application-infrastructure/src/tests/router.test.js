/**
 * Unit tests for router.
 *
 * Tests routing dispatch for all endpoints, OPTIONS preflight,
 * unknown endpoint 404, and CORS headers on all responses.
 *
 * Requirements: 6.3, 14.1, 14.2, 16.3, 16.5
 */

/* ------------------------------------------------------------------ */
/*  Mock @63klabs/cache-data                                           */
/* ------------------------------------------------------------------ */
const mockAddHeader = jest.fn();
const mockSetStatusCode = jest.fn();
const mockSetBody = jest.fn();
const mockAddPathLog = jest.fn();
const mockGetClientIp = jest.fn().mockReturnValue('10.0.0.1');
const mockGetClientUserAgent = jest.fn().mockReturnValue('TestAgent');

const mockRESP = {
	addHeader: mockAddHeader,
	setStatusCode: mockSetStatusCode,
	setBody: mockSetBody,
	toObject: jest.fn().mockReturnValue({})
};

const mockREQ = {
	getClientIp: mockGetClientIp,
	getClientUserAgent: mockGetClientUserAgent,
	addPathLog: mockAddPathLog
};

jest.mock('@63klabs/cache-data', () => ({
	tools: {
		DebugAndLog: {
			debug: jest.fn(),
			log: jest.fn(),
			warn: jest.fn(),
			error: jest.fn()
		},
		ClientRequest: jest.fn().mockImplementation(() => mockREQ),
		Response: jest.fn().mockImplementation(() => mockRESP)
	}
}));

/* ------------------------------------------------------------------ */
/*  Mock controllers                                                    */
/* ------------------------------------------------------------------ */
const mockTelemetryPost = jest.fn();
const mockProxyForward = jest.fn();

jest.mock('../controllers', () => ({
	TelemetryCtrl: { post: mockTelemetryPost },
	ProxyCtrl: { forward: mockProxyForward }
}));

jest.mock('../views', () => ({
	ProxyView: {
		notFoundView: jest.fn((requestId, timestamp) => ({
			message: 'Endpoint not found',
			error: 'NOT_FOUND',
			requestId,
			availableEndpoints: [
				'POST /telemetry - Track user events',
				'GET /proxy/showDetails - Get show details',
				'POST /proxy/addSequenceToQueue - Add sequence to queue',
				'POST /proxy/voteForSequence - Vote for sequence'
			],
			timestamp
		}))
	},
	TelemetryView: {}
}));

jest.mock('../utils', () => ({
	cors: {
		getCorsHeaders: jest.fn().mockReturnValue({
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
			'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
			'Access-Control-Allow-Credentials': 'false',
			'Vary': 'Origin',
			'X-Content-Type-Options': 'nosniff',
			'X-Frame-Options': 'DENY',
			'X-XSS-Protection': '1; mode=block',
			'Referrer-Policy': 'strict-origin-when-cross-origin',
			'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
		})
	},
	hash: {},
	func: {}
}));

const Routes = require('../routes');

describe('Router — Routes.process', () => {

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	function makeEvent(overrides = {}) {
		return {
			httpMethod: 'GET',
			path: '/',
			headers: { origin: 'https://example.com', host: 'api.example.com' },
			body: null,
			requestContext: { requestId: 'test-req-id' },
			...overrides
		};
	}

	const context = { awsRequestId: 'ctx-req-id' };

	/* ------------------------------------------------------------------ */
	/*  POST /telemetry                                                    */
	/* ------------------------------------------------------------------ */
	describe('POST /telemetry', () => {
		it('should dispatch to TelemetryCtrl.post', async () => {
			mockTelemetryPost.mockResolvedValue({ statusCode: 200, body: { message: 'ok' } });

			const event = makeEvent({
				httpMethod: 'POST',
				path: '/telemetry',
				body: JSON.stringify({ eventType: 'pageView', url: 'https://example.com' })
			});

			await Routes.process(event, context);

			expect(mockTelemetryPost).toHaveBeenCalledTimes(1);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  GET /proxy/showDetails                                             */
	/* ------------------------------------------------------------------ */
	describe('GET /proxy/showDetails', () => {
		it('should dispatch to ProxyCtrl.forward', async () => {
			mockProxyForward.mockResolvedValue({ statusCode: 200, body: { sequences: [] } });

			const event = makeEvent({ httpMethod: 'GET', path: '/proxy/showDetails' });
			await Routes.process(event, context);

			expect(mockProxyForward).toHaveBeenCalledTimes(1);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  POST /proxy/addSequenceToQueue                                     */
	/* ------------------------------------------------------------------ */
	describe('POST /proxy/addSequenceToQueue', () => {
		it('should dispatch to ProxyCtrl.forward', async () => {
			mockProxyForward.mockResolvedValue({ statusCode: 200, body: {} });

			const event = makeEvent({
				httpMethod: 'POST',
				path: '/proxy/addSequenceToQueue',
				body: JSON.stringify({ sequence: 'Test' })
			});
			await Routes.process(event, context);

			expect(mockProxyForward).toHaveBeenCalledTimes(1);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  /proxy/* catch-all                                                 */
	/* ------------------------------------------------------------------ */
	describe('/proxy/* catch-all', () => {
		it('should dispatch to ProxyCtrl.forward for any /proxy/ path', async () => {
			mockProxyForward.mockResolvedValue({ statusCode: 200, body: {} });

			const event = makeEvent({ httpMethod: 'GET', path: '/proxy/someOtherEndpoint' });
			await Routes.process(event, context);

			expect(mockProxyForward).toHaveBeenCalledTimes(1);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  OPTIONS preflight                                                  */
	/* ------------------------------------------------------------------ */
	describe('OPTIONS preflight', () => {
		it('should return 200 with empty body and not invoke controllers', async () => {
			const event = makeEvent({ httpMethod: 'OPTIONS', path: '/proxy/showDetails' });
			await Routes.process(event, context);

			expect(mockSetStatusCode).toHaveBeenCalledWith(200);
			expect(mockSetBody).toHaveBeenCalledWith('');
			expect(mockTelemetryPost).not.toHaveBeenCalled();
			expect(mockProxyForward).not.toHaveBeenCalled();
		});
	});

	/* ------------------------------------------------------------------ */
	/*  Unknown endpoint → 404                                             */
	/* ------------------------------------------------------------------ */
	describe('Unknown endpoint', () => {
		it('should return 404 with available endpoints', async () => {
			const event = makeEvent({ httpMethod: 'GET', path: '/unknown' });
			await Routes.process(event, context);

			expect(mockSetStatusCode).toHaveBeenCalledWith(404);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  CORS headers on all responses                                      */
	/* ------------------------------------------------------------------ */
	describe('CORS headers', () => {
		it('should apply CORS headers to successful responses', async () => {
			mockProxyForward.mockResolvedValue({ statusCode: 200, body: {} });

			const event = makeEvent({ httpMethod: 'GET', path: '/proxy/showDetails' });
			await Routes.process(event, context);

			// addHeader should have been called for each CORS/security header
			expect(mockAddHeader).toHaveBeenCalled();
			const headerKeys = mockAddHeader.mock.calls.map(c => c[0]);
			expect(headerKeys).toContain('Access-Control-Allow-Origin');
			expect(headerKeys).toContain('X-Content-Type-Options');
		});

		it('should apply CORS headers to OPTIONS responses', async () => {
			const event = makeEvent({ httpMethod: 'OPTIONS', path: '/telemetry' });
			await Routes.process(event, context);

			const headerKeys = mockAddHeader.mock.calls.map(c => c[0]);
			expect(headerKeys).toContain('Access-Control-Allow-Origin');
		});

		it('should apply CORS headers to 404 responses', async () => {
			const event = makeEvent({ httpMethod: 'GET', path: '/nope' });
			await Routes.process(event, context);

			const headerKeys = mockAddHeader.mock.calls.map(c => c[0]);
			expect(headerKeys).toContain('Access-Control-Allow-Origin');
		});
	});
});
