/**
 * Unit tests for telemetry controller — post() with systemHealth orchestration.
 *
 * Tests that TelemetryCtrl.post() calls HealthCheckSvc.checkRemoteFalcon for
 * systemHealth events, skips it for other event types, passes clientInfo and
 * requestId correctly, and preserves the 400 error path for invalid bodies.
 *
 * Requirements: 1.1, 1.2, 1.5, 5.1, 5.2
 */

jest.mock('../services', () => ({
	ProxySvc: {},
	JwtSvc: {},
	TelemetrySvc: {
		processTracking: jest.fn()
	},
	HealthCheckSvc: {
		checkRemoteFalcon: jest.fn()
	}
}));

jest.mock('../views', () => ({
	ProxyView: {},
	TelemetryView: {
		successView: jest.fn((data) => data),
		errorView: jest.fn((msg, code) => ({ message: msg, error: code, timestamp: new Date().toISOString() }))
	}
}));

const { TelemetrySvc, HealthCheckSvc } = require('../services');
const { TelemetryView } = require('../views');
const TelemetryCtrl = require('../controllers/telemetry.controller');

describe('Telemetry Controller — post', () => {
	const mockREQ = {};
	const mockRESP = {};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('systemHealth event', () => {
		it('should call HealthCheckSvc.checkRemoteFalcon and pass result to successView', async () => {
			const remoteFalconResult = {
				isConnected: true,
				statusCode: 200,
				viewerControlEnabled: true,
				viewerControlMode: 'jukebox',
				playingNow: 'Let It Go',
				playingNext: 'Into the Unknown'
			};

			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 200,
				body: { processingTime: 10 }
			});
			HealthCheckSvc.checkRemoteFalcon.mockResolvedValue(remoteFalconResult);

			const props = {
				body: { eventType: 'systemHealth', eventData: { totalRequests: 50 } },
				requestId: 'req-health-1',
				clientInfo: { ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'example.com' }
			};

			const result = await TelemetryCtrl.post(props, mockREQ, mockRESP);

			expect(HealthCheckSvc.checkRemoteFalcon).toHaveBeenCalledTimes(1);
			expect(result.statusCode).toBe(200);
			expect(TelemetryView.successView).toHaveBeenCalledWith({
				processingTime: 10,
				remoteFalcon: remoteFalconResult,
				clientStatus: {
					ip: '10.0.0.1',
					userAgent: 'TestAgent',
					eventData: { totalRequests: 50 }
				}
			});
		});

		it('should pass clientInfo and requestId to checkRemoteFalcon', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 200,
				body: { processingTime: 5 }
			});
			HealthCheckSvc.checkRemoteFalcon.mockResolvedValue({ isConnected: false, statusCode: 0, error: 'timeout' });

			const clientInfo = { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0', host: 'myhost.com' };
			const props = {
				body: { eventType: 'systemHealth', eventData: {} },
				requestId: 'req-health-2',
				clientInfo
			};

			await TelemetryCtrl.post(props, mockREQ, mockRESP);

			expect(HealthCheckSvc.checkRemoteFalcon).toHaveBeenCalledWith(clientInfo, 'req-health-2');
		});
	});

	describe('non-systemHealth event', () => {
		it('should NOT call HealthCheckSvc.checkRemoteFalcon for pageView events', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 200,
				body: { processingTime: 3 }
			});

			const props = {
				body: { eventType: 'pageView', url: 'https://example.com/home' },
				requestId: 'req-page-1',
				clientInfo: { ipAddress: '10.0.0.2', userAgent: 'Test', host: 'example.com' }
			};

			const result = await TelemetryCtrl.post(props, mockREQ, mockRESP);

			expect(HealthCheckSvc.checkRemoteFalcon).not.toHaveBeenCalled();
			expect(result.statusCode).toBe(200);
			expect(TelemetryView.successView).toHaveBeenCalledWith({ processingTime: 3 });
		});
	});

	describe('400 error path', () => {
		it('should return 400 with PARSE_ERROR when body is null', async () => {
			const props = { body: null, requestId: 'req-err-1' };

			const result = await TelemetryCtrl.post(props, mockREQ, mockRESP);

			expect(result.statusCode).toBe(400);
			expect(TelemetryView.errorView).toHaveBeenCalledWith(
				'Invalid JSON in request body',
				'PARSE_ERROR'
			);
			expect(TelemetrySvc.processTracking).not.toHaveBeenCalled();
			expect(HealthCheckSvc.checkRemoteFalcon).not.toHaveBeenCalled();
		});

		it('should return 400 with PARSE_ERROR when body is undefined', async () => {
			const props = { requestId: 'req-err-2' };

			const result = await TelemetryCtrl.post(props, mockREQ, mockRESP);

			expect(result.statusCode).toBe(400);
			expect(TelemetryView.errorView).toHaveBeenCalledWith(
				'Invalid JSON in request body',
				'PARSE_ERROR'
			);
		});
	});

	describe('validation error from TelemetrySvc', () => {
		it('should return service error status and message without calling health check', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 400,
				body: { message: 'Missing required field: eventType', error: 'VALIDATION_ERROR' }
			});

			const props = {
				body: { url: 'https://example.com' },
				requestId: 'req-val-1',
				clientInfo: { ipAddress: '10.0.0.3', userAgent: 'Test', host: 'example.com' }
			};

			const result = await TelemetryCtrl.post(props, mockREQ, mockRESP);

			expect(result.statusCode).toBe(400);
			expect(TelemetryView.errorView).toHaveBeenCalledWith(
				'Missing required field: eventType',
				'VALIDATION_ERROR'
			);
			expect(HealthCheckSvc.checkRemoteFalcon).not.toHaveBeenCalled();
		});
	});

	describe('clientStatus assembly — Requirements 1.1, 1.2, 1.3, 4.1, 4.2', () => {
		it('should map clientStatus.ip from clientInfo.ipAddress', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 200,
				body: { processingTime: 7 }
			});
			HealthCheckSvc.checkRemoteFalcon.mockResolvedValue({ isConnected: true, statusCode: 200 });

			const props = {
				body: { eventType: 'systemHealth', eventData: { totalRequests: 10, failedRequests: 0, errorRate: 0 } },
				requestId: 'req-cs-1',
				clientInfo: { ipAddress: '172.16.0.99', userAgent: 'AgentX/1.0', host: 'test.example.com' }
			};

			await TelemetryCtrl.post(props, mockREQ, mockRESP);

			const viewArg = TelemetryView.successView.mock.calls[0][0];
			expect(viewArg.clientStatus.ip).toBe('172.16.0.99');
		});

		it('should map clientStatus.userAgent from clientInfo.userAgent', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 200,
				body: { processingTime: 4 }
			});
			HealthCheckSvc.checkRemoteFalcon.mockResolvedValue({ isConnected: false, statusCode: 0 });

			const props = {
				body: { eventType: 'systemHealth', eventData: { totalRequests: 5, failedRequests: 1, errorRate: 0.2 } },
				requestId: 'req-cs-2',
				clientInfo: { ipAddress: '10.1.1.1', userAgent: 'Mozilla/5.0 (Windows NT 10.0)', host: 'host.example.com' }
			};

			await TelemetryCtrl.post(props, mockREQ, mockRESP);

			const viewArg = TelemetryView.successView.mock.calls[0][0];
			expect(viewArg.clientStatus.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0)');
		});

		it('should pass clientStatus.eventData as the same reference as body.eventData', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 200,
				body: { processingTime: 2 }
			});
			HealthCheckSvc.checkRemoteFalcon.mockResolvedValue({ isConnected: true, statusCode: 200 });

			const eventData = { totalRequests: 100, failedRequests: 3, errorRate: 0.03 };
			const props = {
				body: { eventType: 'systemHealth', eventData },
				requestId: 'req-cs-3',
				clientInfo: { ipAddress: '10.0.0.5', userAgent: 'TestBot/2.0', host: 'api.example.com' }
			};

			await TelemetryCtrl.post(props, mockREQ, mockRESP);

			const viewArg = TelemetryView.successView.mock.calls[0][0];
			expect(viewArg.clientStatus.eventData).toBe(eventData);
		});

		it('should NOT include clientStatus for pageView events', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 200,
				body: { processingTime: 1 }
			});

			const props = {
				body: { eventType: 'pageView', url: 'https://example.com/page' },
				requestId: 'req-cs-4',
				clientInfo: { ipAddress: '10.0.0.6', userAgent: 'Browser/1.0', host: 'example.com' }
			};

			await TelemetryCtrl.post(props, mockREQ, mockRESP);

			const viewArg = TelemetryView.successView.mock.calls[0][0];
			expect(viewArg).not.toHaveProperty('clientStatus');
		});

		it('should NOT include clientStatus for click events', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 200,
				body: { processingTime: 1 }
			});

			const props = {
				body: { eventType: 'click', elementId: 'btn-submit' },
				requestId: 'req-cs-5',
				clientInfo: { ipAddress: '10.0.0.7', userAgent: 'Browser/2.0', host: 'example.com' }
			};

			await TelemetryCtrl.post(props, mockREQ, mockRESP);

			const viewArg = TelemetryView.successView.mock.calls[0][0];
			expect(viewArg).not.toHaveProperty('clientStatus');
		});

		it('should NOT include clientStatus when TelemetrySvc returns a validation error', async () => {
			TelemetrySvc.processTracking.mockResolvedValue({
				statusCode: 400,
				body: { message: 'Invalid eventData', error: 'VALIDATION_ERROR' }
			});

			const props = {
				body: { eventType: 'systemHealth', eventData: {} },
				requestId: 'req-cs-6',
				clientInfo: { ipAddress: '10.0.0.8', userAgent: 'TestAgent', host: 'example.com' }
			};

			const result = await TelemetryCtrl.post(props, mockREQ, mockRESP);

			expect(result.statusCode).toBe(400);
			expect(TelemetryView.successView).not.toHaveBeenCalled();
		});

		it('should NOT include clientStatus when body is null (parse error path)', async () => {
			const props = { body: null, requestId: 'req-cs-7' };

			const result = await TelemetryCtrl.post(props, mockREQ, mockRESP);

			expect(result.statusCode).toBe(400);
			expect(TelemetryView.successView).not.toHaveBeenCalled();
		});
	});
});
