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
});
