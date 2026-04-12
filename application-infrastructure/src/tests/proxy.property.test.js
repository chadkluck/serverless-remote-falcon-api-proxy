/**
 * Property-based tests for proxy forwarding.
 *
 * Feature: convert-to-atlantis, Property 1: Proxy forwarding preserves path, method, body, and response
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 *
 * Uses fast-check to generate random paths, methods, bodies, and mock responses,
 * then verifies the proxy controller strips the `/proxy` prefix, forwards correctly,
 * and returns the response unchanged.
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const fc = require('fast-check');

describe('Feature: convert-to-atlantis, Property 1: Proxy forwarding preserves path, method, body, and response', () => {

	let ProxyCtrl;
	let ProxySvc;

	beforeEach(() => {
		jest.resetModules();
		jest.mock('../services', () => ({
			ProxySvc: {
				forwardToRemoteFalcon: jest.fn()
			}
		}));
		ProxyCtrl = require('../controllers/proxy.controller');
		ProxySvc = require('../services').ProxySvc;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should strip /proxy prefix, forward path/method/body, and return response unchanged', async () => {
		// Arbitrary for alphanumeric path segments starting with /
		const pathSegmentArb = fc.stringMatching(/^[a-zA-Z0-9]{1,30}$/);
		const pathArb = fc.array(pathSegmentArb, { minLength: 1, maxLength: 4 })
			.map(segments => '/proxy/' + segments.join('/'));

		const methodArb = fc.constantFrom('GET', 'POST');

		const bodyArb = fc.oneof(
			fc.constant(null),
			fc.record({
				key: fc.string({ minLength: 1, maxLength: 20 }),
				value: fc.string({ minLength: 0, maxLength: 50 })
			})
		);

		const mockResponseArb = fc.record({
			statusCode: fc.constantFrom(200, 201, 400, 404, 500),
			body: fc.oneof(
				fc.record({
					message: fc.string({ minLength: 1, maxLength: 50 })
				}),
				fc.constant({ sequences: [], preferences: {} })
			)
		});

		await fc.assert(
			fc.asyncProperty(
				pathArb,
				methodArb,
				bodyArb,
				mockResponseArb,
				async (proxyPath, method, body, mockResponse) => {
					// Set up mock to capture arguments and return mock response
					let capturedArgs = null;
					ProxySvc.forwardToRemoteFalcon.mockImplementation((...args) => {
						capturedArgs = args;
						return Promise.resolve(mockResponse);
					});

					const expectedStrippedPath = proxyPath.replace('/proxy', '');

					const props = {
						path: proxyPath,
						method,
						body,
						requestId: 'test-req-id',
						clientInfo: { ipAddress: '10.0.0.1', userAgent: 'TestAgent', host: 'test.com' }
					};

					const REQ = { path: proxyPath, method, body };
					const RESP = {};

					const result = await ProxyCtrl.forward(props, REQ, RESP);

					// Verify /proxy prefix was stripped
					expect(capturedArgs[0]).toBe(expectedStrippedPath);

					// Verify method was forwarded
					expect(capturedArgs[1]).toBe(method);

					// Verify body was forwarded
					expect(capturedArgs[2]).toEqual(body);

					// Verify response status code is returned unchanged
					expect(result.statusCode).toBe(mockResponse.statusCode);

					// Verify response body is returned unchanged (via ProxyView.forwardView)
					expect(result.body).toEqual(mockResponse.body);
				}
			),
			{ numRuns: 100 }
		);
	});
});
