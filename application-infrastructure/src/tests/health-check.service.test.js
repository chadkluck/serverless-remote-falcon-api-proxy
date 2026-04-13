/**
 * Unit tests for health check service.
 *
 * Tests Remote Falcon connectivity checking via HealthCheckSvc.checkRemoteFalcon(),
 * covering success paths, HTTP error paths, network error paths, timeout paths,
 * field extraction from nested preferences, and response shape invariants.
 *
 * Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2
 */

jest.mock('../services/proxy.service', () => ({
	forwardToRemoteFalcon: jest.fn()
}));

const ProxySvc = require('../services/proxy.service');
const HealthCheckSvc = require('../services/health-check.service');

describe('HealthCheckSvc', () => {
	const clientInfo = { ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'example.com' };
	const requestId = 'req-health-1';

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	/* ------------------------------------------------------------------ */
	/*  Success path (2xx)                                                 */
	/* ------------------------------------------------------------------ */
	describe('Success path (2xx response)', () => {
		it('should return isConnected true with extracted fields for 200 response', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({
				statusCode: 200,
				body: {
					preferences: {
						viewerControlEnabled: true,
						viewerControlMode: 'jukebox'
					},
					playingNow: 'Let It Go',
					playingNext: 'Into the Unknown'
				}
			});

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.isConnected).toBe(true);
			expect(result.statusCode).toBe(200);
			expect(result.viewerControlEnabled).toBe(true);
			expect(result.viewerControlMode).toBe('jukebox');
			expect(result.playingNow).toBe('Let It Go');
			expect(result.playingNext).toBe('Into the Unknown');
		});

		it('should return isConnected true for any 2xx status code', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({
				statusCode: 201,
				body: {
					preferences: {
						viewerControlEnabled: false,
						viewerControlMode: 'voting'
					},
					playingNow: null,
					playingNext: null
				}
			});

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.isConnected).toBe(true);
			expect(result.statusCode).toBe(201);
		});

		it('should extract fields from nested preferences object', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({
				statusCode: 200,
				body: {
					preferences: {
						viewerControlEnabled: false,
						viewerControlMode: 'voting',
						otherSetting: 'ignored'
					},
					playingNow: null,
					playingNext: 'Frosty the Snowman',
					sequences: [{ name: 'ignored' }],
					votes: []
				}
			});

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.viewerControlEnabled).toBe(false);
			expect(result.viewerControlMode).toBe('voting');
			expect(result.playingNow).toBeNull();
			expect(result.playingNext).toBe('Frosty the Snowman');
			expect(result).not.toHaveProperty('sequences');
			expect(result).not.toHaveProperty('votes');
		});

		it('should never include error field in success response', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({
				statusCode: 200,
				body: {
					preferences: {
						viewerControlEnabled: true,
						viewerControlMode: 'jukebox'
					},
					playingNow: 'Silent Night',
					playingNext: null
				}
			});

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.isConnected).toBe(true);
			expect(result).not.toHaveProperty('error');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  HTTP error path (4xx/5xx)                                          */
	/* ------------------------------------------------------------------ */
	describe('HTTP error path (4xx/5xx response)', () => {
		it('should return isConnected false with statusCode and error for 4xx', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({
				statusCode: 401,
				body: { message: 'Unauthorized' }
			});

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.isConnected).toBe(false);
			expect(result.statusCode).toBe(401);
			expect(result.error).toMatch(/401/);
		});

		it('should return isConnected false with statusCode and error for 5xx', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({
				statusCode: 500,
				body: { message: 'Internal Server Error' }
			});

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.isConnected).toBe(false);
			expect(result.statusCode).toBe(500);
			expect(result.error).toMatch(/500/);
		});

		it('should not include success-only fields in failure response', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({
				statusCode: 403,
				body: {}
			});

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.isConnected).toBe(false);
			expect(result).not.toHaveProperty('viewerControlEnabled');
			expect(result).not.toHaveProperty('viewerControlMode');
			expect(result).not.toHaveProperty('playingNow');
			expect(result).not.toHaveProperty('playingNext');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  Network error path                                                 */
	/* ------------------------------------------------------------------ */
	describe('Network error path', () => {
		it('should return isConnected false with statusCode 0 for network error', async () => {
			ProxySvc.forwardToRemoteFalcon.mockRejectedValue(
				new Error('ECONNREFUSED')
			);

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.isConnected).toBe(false);
			expect(result.statusCode).toBe(0);
			expect(result.error).toBeDefined();
			expect(typeof result.error).toBe('string');
		});

		it('should not include success-only fields in network error response', async () => {
			ProxySvc.forwardToRemoteFalcon.mockRejectedValue(
				new Error('DNS resolution failed')
			);

			const result = await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(result.isConnected).toBe(false);
			expect(result).not.toHaveProperty('viewerControlEnabled');
			expect(result).not.toHaveProperty('viewerControlMode');
			expect(result).not.toHaveProperty('playingNow');
			expect(result).not.toHaveProperty('playingNext');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  Timeout path                                                       */
	/* ------------------------------------------------------------------ */
	describe('Timeout path', () => {
		it('should return isConnected false with statusCode 0 on timeout', async () => {
			jest.useFakeTimers();

			ProxySvc.forwardToRemoteFalcon.mockImplementation(() => {
				return new Promise(() => {
					// Never resolves — simulates a hung request
				});
			});

			const resultPromise = HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			jest.advanceTimersByTime(5000);

			const result = await resultPromise;

			expect(result.isConnected).toBe(false);
			expect(result.statusCode).toBe(0);
			expect(result.error).toMatch(/timed out/i);
		});

		it('should not include success-only fields in timeout response', async () => {
			jest.useFakeTimers();

			ProxySvc.forwardToRemoteFalcon.mockImplementation(() => {
				return new Promise(() => {});
			});

			const resultPromise = HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			jest.advanceTimersByTime(5000);

			const result = await resultPromise;

			expect(result.isConnected).toBe(false);
			expect(result).not.toHaveProperty('viewerControlEnabled');
			expect(result).not.toHaveProperty('viewerControlMode');
			expect(result).not.toHaveProperty('playingNow');
			expect(result).not.toHaveProperty('playingNext');
		});
	});

	/* ------------------------------------------------------------------ */
	/*  ProxySvc call verification                                         */
	/* ------------------------------------------------------------------ */
	describe('ProxySvc call verification', () => {
		it('should call forwardToRemoteFalcon with correct arguments', async () => {
			ProxySvc.forwardToRemoteFalcon.mockResolvedValue({
				statusCode: 200,
				body: { preferences: {}, playingNow: null, playingNext: null }
			});

			await HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId);

			expect(ProxySvc.forwardToRemoteFalcon).toHaveBeenCalledWith(
				'/showDetails', 'GET', null, clientInfo, requestId
			);
		});
	});
});
