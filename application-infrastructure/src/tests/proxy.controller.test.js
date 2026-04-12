/**
 * Unit tests for proxy controller.
 *
 * Tests proxy forwarding for showDetails, addSequenceToQueue, voteForSequence,
 * path stripping, AUTH_ERROR response, and error propagation.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 16.1, 16.5
 */

jest.mock('../services', () => ({
	ProxySvc: {
		forwardToRemoteFalcon: jest.fn()
	},
	JwtSvc: {},
	TelemetrySvc: {}
}));

jest.mock('../views', () => ({
	ProxyView: {
		forwardView: jest.fn((result) => result.body),
		authErrorView: jest.fn((requestId, timestamp) => ({
			message: 'Authentication service unavailable',
			error: 'AUTH_ERROR',
			requestId,
			timestamp
		})),
		notFoundView: jest.fn()
	},
	TelemetryView: {}
}));

const { ProxySvc } = require('../services');
const { ProxyView } = require('../views');
const ProxyCtrl = require('../controllers/proxy.controller');

describe('Proxy Controller — forward', () => {
	const mockREQ = {};
	const mockRESP = {};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('showDetails (GET)', () => {
		it('should forward GET /proxy/showDetails and return response', async () => {
			const apiResponse = { statusCode: 200, body: { sequences: [] } };
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue(apiResponse);

			const props = {
				path: '/proxy/showDetails',
				method: 'GET',
				body: null,
				requestId: 'req-1',
				clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Test', host: 'example.com' }
			};

			const result = await ProxyCtrl.forward(props, mockREQ, mockRESP);

			expect(ProxySvc.forwardToRemoteFalcon).toHaveBeenCalledWith(
				'/showDetails', 'GET', null,
				props.clientInfo, 'req-1'
			);
			expect(result.statusCode).toBe(200);
		});
	});

	describe('addSequenceToQueue (POST)', () => {
		it('should forward POST /proxy/addSequenceToQueue with body', async () => {
			const body = { sequence: 'Test Sequence' };
			const apiResponse = { statusCode: 200, body: { success: true } };
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue(apiResponse);

			const props = {
				path: '/proxy/addSequenceToQueue',
				method: 'POST',
				body,
				requestId: 'req-2',
				clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Test', host: 'example.com' }
			};

			const result = await ProxyCtrl.forward(props, mockREQ, mockRESP);

			expect(ProxySvc.forwardToRemoteFalcon).toHaveBeenCalledWith(
				'/addSequenceToQueue', 'POST', body,
				props.clientInfo, 'req-2'
			);
			expect(result.statusCode).toBe(200);
		});
	});

	describe('voteForSequence (POST)', () => {
		it('should forward POST /proxy/voteForSequence with body', async () => {
			const body = { sequenceName: 'Jingle Bells' };
			const apiResponse = { statusCode: 200, body: { voted: true } };
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue(apiResponse);

			const props = {
				path: '/proxy/voteForSequence',
				method: 'POST',
				body,
				requestId: 'req-3',
				clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Test', host: 'example.com' }
			};

			const result = await ProxyCtrl.forward(props, mockREQ, mockRESP);

			expect(ProxySvc.forwardToRemoteFalcon).toHaveBeenCalledWith(
				'/voteForSequence', 'POST', body,
				props.clientInfo, 'req-3'
			);
			expect(result.statusCode).toBe(200);
		});
	});

	describe('Path stripping', () => {
		it('should strip /proxy prefix from path before forwarding', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({ statusCode: 200, body: {} });

			const props = {
				path: '/proxy/showDetails',
				method: 'GET',
				body: null,
				requestId: 'req-4',
				clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Test', host: 'example.com' }
			};

			await ProxyCtrl.forward(props, mockREQ, mockRESP);

			expect(ProxySvc.forwardToRemoteFalcon.mock.calls[0][0]).toBe('/showDetails');
		});
	});

	describe('AUTH_ERROR response', () => {
		it('should return 500 AUTH_ERROR when credentials fail', async () => {
			ProxySvc.forwardToRemoteFalcon.mockRejectedValue(
				new Error('Failed to retrieve credentials')
			);

			const props = {
				path: '/proxy/showDetails',
				method: 'GET',
				body: null,
				requestId: 'req-5',
				clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Test', host: 'example.com' }
			};

			const result = await ProxyCtrl.forward(props, mockREQ, mockRESP);

			expect(result.statusCode).toBe(500);
			expect(result.body.error).toBe('AUTH_ERROR');
			expect(ProxyView.authErrorView).toHaveBeenCalled();
		});
	});

	describe('Error propagation for network failures', () => {
		it('should rethrow non-credential errors', async () => {
			ProxySvc.forwardToRemoteFalcon.mockRejectedValue(
				new Error('Failed to communicate with Remote Falcon API')
			);

			const props = {
				path: '/proxy/showDetails',
				method: 'GET',
				body: null,
				requestId: 'req-6',
				clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Test', host: 'example.com' }
			};

			await expect(ProxyCtrl.forward(props, mockREQ, mockRESP))
				.rejects.toThrow('Failed to communicate with Remote Falcon API');
		});
	});
});
