/**
 * Unit tests for CORS utility.
 *
 * Tests origin matching (exact, wildcard, missing), credential handling,
 * and security headers on all responses.
 *
 * Requirements: 6.1, 6.2, 6.4, 6.5, 16.3
 */

const cors = require('../utils/cors');

describe('CORS Utility — getCorsHeaders', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.resetModules();
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('Allowed origins (exact match)', () => {
		it('should return the request origin when it matches an allowed origin', () => {
			process.env.ALLOWED_ORIGINS = 'https://mysite.com,https://other.com';
			const headers = cors.getCorsHeaders('https://mysite.com');
			expect(headers['Access-Control-Allow-Origin']).toBe('https://mysite.com');
		});

		it('should set credentials to true for exact non-wildcard match', () => {
			process.env.ALLOWED_ORIGINS = 'https://mysite.com';
			const headers = cors.getCorsHeaders('https://mysite.com');
			expect(headers['Access-Control-Allow-Credentials']).toBe('true');
		});
	});

	describe('Disallowed origins', () => {
		it('should return first allowed origin when origin is not in the list', () => {
			process.env.ALLOWED_ORIGINS = 'https://mysite.com,https://other.com';
			const headers = cors.getCorsHeaders('https://evil.com');
			expect(headers['Access-Control-Allow-Origin']).toBe('https://mysite.com');
		});

		it('should return * when ALLOWED_ORIGINS contains * and origin is not matched', () => {
			process.env.ALLOWED_ORIGINS = '*';
			const headers = cors.getCorsHeaders('https://evil.com');
			expect(headers['Access-Control-Allow-Origin']).toBe('https://evil.com');
		});
	});

	describe('Wildcard patterns', () => {
		it('should match *.mysite.com against sub.mysite.com', () => {
			process.env.ALLOWED_ORIGINS = '*.mysite.com';
			const headers = cors.getCorsHeaders('https://sub.mysite.com');
			expect(headers['Access-Control-Allow-Origin']).toBe('https://sub.mysite.com');
		});

		it('should not match *.mysite.com against otherdomain.com', () => {
			process.env.ALLOWED_ORIGINS = '*.mysite.com';
			const headers = cors.getCorsHeaders('https://otherdomain.com');
			expect(headers['Access-Control-Allow-Origin']).toBe('*.mysite.com');
		});
	});

	describe('Missing origin header', () => {
		it('should return * when ALLOWED_ORIGINS is * and origin is undefined', () => {
			process.env.ALLOWED_ORIGINS = '*';
			const headers = cors.getCorsHeaders(undefined);
			expect(headers['Access-Control-Allow-Origin']).toBe('*');
		});

		it('should return first allowed origin when origin is undefined and no wildcard', () => {
			process.env.ALLOWED_ORIGINS = 'https://mysite.com,https://other.com';
			const headers = cors.getCorsHeaders(undefined);
			expect(headers['Access-Control-Allow-Origin']).toBe('https://mysite.com');
		});
	});

	describe('Wildcard * in ALLOWED_ORIGINS', () => {
		it('should allow any origin when ALLOWED_ORIGINS is *', () => {
			process.env.ALLOWED_ORIGINS = '*';
			const headers = cors.getCorsHeaders('https://anything.com');
			expect(headers['Access-Control-Allow-Origin']).toBe('https://anything.com');
		});

		it('should set credentials to false when ALLOWED_ORIGINS is *', () => {
			process.env.ALLOWED_ORIGINS = '*';
			const headers = cors.getCorsHeaders('https://anything.com');
			expect(headers['Access-Control-Allow-Credentials']).toBe('false');
		});
	});

	describe('Security headers', () => {
		it('should include all required security headers on every response', () => {
			process.env.ALLOWED_ORIGINS = '*';
			const headers = cors.getCorsHeaders('https://example.com');

			expect(headers['X-Content-Type-Options']).toBe('nosniff');
			expect(headers['X-Frame-Options']).toBe('DENY');
			expect(headers['X-XSS-Protection']).toBe('1; mode=block');
			expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
			expect(headers['Content-Security-Policy']).toBe("default-src 'none'; frame-ancestors 'none';");
		});

		it('should include Vary: Origin header', () => {
			process.env.ALLOWED_ORIGINS = 'https://mysite.com';
			const headers = cors.getCorsHeaders('https://mysite.com');
			expect(headers['Vary']).toBe('Origin');
		});

		it('should include CORS method and header headers', () => {
			process.env.ALLOWED_ORIGINS = '*';
			const headers = cors.getCorsHeaders('https://example.com');
			expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization,X-Requested-With');
			expect(headers['Access-Control-Allow-Methods']).toBe('GET,POST,OPTIONS');
		});
	});
});
