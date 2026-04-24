/**
 * Unit tests for proxy controller Cache-Control and Expires header integration.
 *
 * Tests that 2xx responses include both Cache-Control and Expires headers,
 * and that 4xx/5xx and auth error responses include neither.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
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

jest.mock('../utils', () => ({
	cacheControl: {
		calculateCacheDuration: jest.fn().mockReturnValue(5),
		formatCacheControlHeader: jest.fn((n) => `max-age=${n}`),
		calculateExpirationDate: jest.fn().mockReturnValue(new Date('2025-01-01T08:05:00Z')),
		formatExpiresHeader: jest.fn((d) => d.toUTCString())
	},
	func: {},
	hash: {},
	cors: {}
}));

const { ProxySvc } = require('../services');
const { ProxyView } = require('../views');
const { cacheControl } = require('../utils');
const ProxyCtrl = require('../controllers/proxy.controller');

describe('Proxy Controller — Cache-Control and Expires integration', () => {
	const mockREQ = {};
	const mockRESP = {};
	const defaultProps = {
		path: '/proxy/showDetails',
		method: 'GET',
		body: null,
		requestId: 'req-cc-1',
		clientInfo: { ipAddress: '10.0.0.1', userAgent: 'Test', host: 'example.com' }
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('2xx responses with Cache-Control and Expires headers', () => {
		it('should include both Cache-Control and Expires headers when playingNow is non-empty', async () => {
			const apiResponse = { statusCode: 200, body: { playingNow: 'Jingle Bells', sequences: [] } };
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue(apiResponse);

			const result = await ProxyCtrl.forward(defaultProps, mockREQ, mockRESP);

			expect(result.statusCode).toBe(200);
			expect(result.headers).toBeDefined();
			expect(result.headers['Cache-Control']).toMatch(/max-age=\d+/);
			expect(result.headers['Expires']).toBe('Wed, 01 Jan 2025 08:05:00 GMT');
			expect(cacheControl.calculateCacheDuration).toHaveBeenCalledWith('Jingle Bells', expect.any(Date));
			expect(cacheControl.formatCacheControlHeader).toHaveBeenCalledWith(5);
			expect(cacheControl.calculateExpirationDate).toHaveBeenCalledWith('Jingle Bells', expect.any(Date));
			expect(cacheControl.formatExpiresHeader).toHaveBeenCalledWith(new Date('2025-01-01T08:05:00Z'));
		});

		it('should include both Cache-Control and Expires headers when playingNow is empty', async () => {
			const apiResponse = { statusCode: 200, body: { playingNow: '', sequences: [] } };
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue(apiResponse);

			const result = await ProxyCtrl.forward(defaultProps, mockREQ, mockRESP);

			expect(result.statusCode).toBe(200);
			expect(result.headers).toBeDefined();
			expect(result.headers['Cache-Control']).toMatch(/max-age=/);
			expect(result.headers['Expires']).toBe('Wed, 01 Jan 2025 08:05:00 GMT');
			expect(cacheControl.calculateCacheDuration).toHaveBeenCalledWith('', expect.any(Date));
			expect(cacheControl.calculateExpirationDate).toHaveBeenCalledWith('', expect.any(Date));
			expect(cacheControl.formatExpiresHeader).toHaveBeenCalledWith(new Date('2025-01-01T08:05:00Z'));
		});
	});

	describe('Non-2xx responses without Cache-Control or Expires headers', () => {
		it('should not include Cache-Control or Expires headers on 404 response', async () => {
			const apiResponse = { statusCode: 404, body: { error: 'Not Found' } };
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue(apiResponse);

			const result = await ProxyCtrl.forward(defaultProps, mockREQ, mockRESP);

			expect(result.statusCode).toBe(404);
			expect(result.headers).toBeUndefined();
		});

		it('should not include Cache-Control or Expires headers on 500 response', async () => {
			const apiResponse = { statusCode: 500, body: { error: 'Internal Server Error' } };
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue(apiResponse);

			const result = await ProxyCtrl.forward(defaultProps, mockREQ, mockRESP);

			expect(result.statusCode).toBe(500);
			expect(result.headers).toBeUndefined();
		});
	});

	describe('Auth error responses without Cache-Control or Expires headers', () => {
		it('should not include Cache-Control or Expires headers on credential failure', async () => {
			ProxySvc.forwardToRemoteFalcon.mockRejectedValue(
				new Error('Failed to retrieve credentials')
			);

			const result = await ProxyCtrl.forward(defaultProps, mockREQ, mockRESP);

			expect(result.statusCode).toBe(500);
			expect(result.body.error).toBe('AUTH_ERROR');
			expect(result.headers).toBeUndefined();
		});
	});
});
