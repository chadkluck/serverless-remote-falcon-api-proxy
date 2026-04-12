/**
 * Behavioral parity tests.
 *
 * Uses old-backend mock events as test inputs and verifies the converted
 * application's router/controllers produce the same response structure.
 * Tests RemoteFalconLogBuilder log structures for success and error scenarios.
 *
 * Requirements: 16.1, 16.2, 16.6
 */

const path = require('path');
const fs = require('fs');

/* ------------------------------------------------------------------ */
/*  Load old-backend mock events                                       */
/* ------------------------------------------------------------------ */
const mockEventsDir = path.resolve(__dirname, '../../../old-backend/tests/mock-events/lambda-events');

const showDetailsEvent = JSON.parse(fs.readFileSync(path.join(mockEventsDir, 'api-gateway-show-details-event.json'), 'utf8'));
const addSequenceEvent = JSON.parse(fs.readFileSync(path.join(mockEventsDir, 'api-gateway-add-sequence-event.json'), 'utf8'));
const trackingEvent = JSON.parse(fs.readFileSync(path.join(mockEventsDir, 'api-gateway-tracking-event.json'), 'utf8'));
const optionsEvent = JSON.parse(fs.readFileSync(path.join(mockEventsDir, 'api-gateway-options-event.json'), 'utf8'));
const testEvent = JSON.parse(fs.readFileSync(path.join(mockEventsDir, 'test-event.json'), 'utf8'));

/* ------------------------------------------------------------------ */
/*  Mock @63klabs/cache-data                                           */
/* ------------------------------------------------------------------ */
const mockHeaders = {};
const mockAddHeader = jest.fn((k, v) => { mockHeaders[k] = v; });
let mockStatusCode = 200;
const mockSetStatusCode = jest.fn((code) => { mockStatusCode = code; });
let mockBody = null;
const mockSetBody = jest.fn((b) => { mockBody = b; });

const mockRESP = {
	addHeader: mockAddHeader,
	setStatusCode: mockSetStatusCode,
	setBody: mockSetBody,
	toObject: jest.fn().mockReturnValue({})
};

const mockREQ = {
	getClientIp: jest.fn().mockReturnValue('203.0.113.12'),
	getClientUserAgent: jest.fn().mockReturnValue('Mozilla/5.0'),
	addPathLog: jest.fn()
};

jest.mock('@63klabs/cache-data', () => ({
	tools: {
		DebugAndLog: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
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
			'Access-Control-Allow-Origin': 'https://example.com',
			'Access-Control-Allow-Credentials': 'true',
			'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
			'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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
const RemoteFalconLogBuilder = require('../utils/RemoteFalconLogBuilder');

describe('Behavioral Parity Tests', () => {

	beforeEach(() => {
		jest.clearAllMocks();
		Object.keys(mockHeaders).forEach(k => delete mockHeaders[k]);
		mockStatusCode = 200;
		mockBody = null;
		jest.spyOn(console, 'log').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	/* ------------------------------------------------------------------ */
	/*  Response structure parity                                          */
	/* ------------------------------------------------------------------ */
	describe('Response structure parity with old-backend mock events', () => {

		it('showDetails event should dispatch to ProxyCtrl.forward', async () => {
			mockProxyForward.mockResolvedValue({ statusCode: 200, body: { sequences: [] } });
			await Routes.process(showDetailsEvent, { awsRequestId: 'test-req' });
			expect(mockProxyForward).toHaveBeenCalledTimes(1);
		});

		it('addSequence event should dispatch to ProxyCtrl.forward', async () => {
			mockProxyForward.mockResolvedValue({ statusCode: 200, body: { success: true } });
			await Routes.process(addSequenceEvent, { awsRequestId: 'test-req' });
			expect(mockProxyForward).toHaveBeenCalledTimes(1);
		});

		it('tracking event should dispatch to TelemetryCtrl.post', async () => {
			mockTelemetryPost.mockResolvedValue({ statusCode: 200, body: { message: 'ok' } });
			await Routes.process(trackingEvent, { awsRequestId: 'test-req' });
			expect(mockTelemetryPost).toHaveBeenCalledTimes(1);
		});

		it('OPTIONS event should return 200 with empty body', async () => {
			await Routes.process(optionsEvent, { awsRequestId: 'test-req' });
			expect(mockSetStatusCode).toHaveBeenCalledWith(200);
			expect(mockSetBody).toHaveBeenCalledWith('');
			expect(mockProxyForward).not.toHaveBeenCalled();
			expect(mockTelemetryPost).not.toHaveBeenCalled();
		});

		it('unknown /test event should return 404 with available endpoints', async () => {
			await Routes.process(testEvent, { awsRequestId: 'test-req' });
			expect(mockSetStatusCode).toHaveBeenCalledWith(404);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  RemoteFalconLogBuilder parity                                      */
	/* ------------------------------------------------------------------ */
	describe('RemoteFalconLogBuilder log structure parity', () => {
		const clientInfo = { ipAddress: '203.0.113.12', userAgent: 'Mozilla/5.0', host: 'api.example.com' };

		it('should produce SUCCESS log with correct structure', () => {
			const builder = new RemoteFalconLogBuilder('req-1', clientInfo, '/showDetails', 'GET');
			const mockResponse = { status: 200 };
			const mockData = { preferences: { viewerControlEnabled: true }, sequences: [1, 2] };

			const log = builder.buildSuccessLog(mockResponse, mockData);

			expect(log.logType).toBe('REMOTE_FALCON_REQUEST');
			expect(log.status).toBe('SUCCESS');
			expect(log.requestId).toBe('req-1');
			expect(log.request.method).toBe('GET');
			expect(log.request.path).toBe('/showDetails');
			expect(log.response.status).toBe(200);
			expect(typeof log.response.processingTime).toBe('number');
			expect(log.response.dataSummary).toBeDefined();
			expect(typeof log.timestamp).toBe('string');
		});

		it('should produce ERROR log with correct structure', () => {
			const builder = new RemoteFalconLogBuilder('req-2', clientInfo, '/showDetails', 'GET');
			const error = new Error('Network timeout');
			error.name = 'AbortError';

			const log = builder.buildErrorLog(error, 504);

			expect(log.logType).toBe('REMOTE_FALCON_ERROR');
			expect(log.status).toBe('ERROR');
			expect(log.error.type).toBe('TIMEOUT_ERROR');
			expect(log.error.httpStatus).toBe(504);
			expect(typeof log.error.processingTime).toBe('number');
		});

		it('should detect application-level errors in HTTP 200 responses', () => {
			const result1 = RemoteFalconLogBuilder.detectApplicationError({ message: 'SONG_REQUESTED' });
			expect(result1).not.toBeNull();
			expect(result1.type).toBe('APPLICATION_ERROR');

			const result2 = RemoteFalconLogBuilder.detectApplicationError({ message: 'QUEUE_FULL' });
			expect(result2).not.toBeNull();

			const result3 = RemoteFalconLogBuilder.detectApplicationError({ success: false, error: 'fail' });
			expect(result3).not.toBeNull();
		});

		it('should return null for successful responses without application errors', () => {
			const result = RemoteFalconLogBuilder.detectApplicationError({ sequences: [], preferences: {} });
			expect(result).toBeNull();
		});

		it('should generate showDetails-specific data summary', () => {
			const builder = new RemoteFalconLogBuilder('req-3', clientInfo, '/showDetails', 'GET');
			const data = { preferences: { viewerControlEnabled: true, viewerControlMode: 'voting' }, sequences: [1, 2, 3] };
			const summary = builder.generateDataSummary(data);

			expect(summary.viewerControlEnabled).toBe(true);
			expect(summary.viewerControlMode).toBe('voting');
			expect(summary.numOfSequences).toBe(3);
		});

		it('should generate generic data summary for non-showDetails paths', () => {
			const builder = new RemoteFalconLogBuilder('req-4', clientInfo, '/addSequenceToQueue', 'POST');
			const data = { success: true, message: 'Added' };
			const summary = builder.generateDataSummary(data);

			expect(summary.hasData).toBe(true);
			expect(typeof summary.responseSize).toBe('number');
			expect(Array.isArray(summary.keyFields)).toBe(true);
		});
	});
});
