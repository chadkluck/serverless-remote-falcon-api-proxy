/**
 * Unit tests for JWT service.
 *
 * Tests JWT generation, caching (55-minute TTL), credential retrieval
 * from SSM via CachedSsmParameter, and SSM failure handling.
 *
 * Requirements: 2.3, 2.4, 2.5, 2.6, 16.4
 */

const { jwtVerify } = require('jose');

const mockGetValue = jest.fn();
const mockSecretGetValue = jest.fn();

jest.mock('../config', () => ({
	Config: {
		getRemoteFalconAccessToken: jest.fn(() => ({
			getValue: mockGetValue
		})),
		getRemoteFalconSecretKey: jest.fn(() => ({
			getValue: mockSecretGetValue
		}))
	}
}));

const { getToken, getCredentials, generateJWT, _resetCache } = require('../services/jwt.service');

describe('JWT Service', () => {

	beforeEach(() => {
		jest.clearAllMocks();
		_resetCache();
	});

	describe('generateJWT', () => {
		it('should produce a valid HS256-signed JWT with accessToken in payload', async () => {
			const accessToken = 'test-access-token-123';
			const secretKey = 'test-secret-key-that-is-long-enough';

			const jwt = await generateJWT(accessToken, secretKey);

			expect(typeof jwt).toBe('string');
			expect(jwt.split('.')).toHaveLength(3);

			const secret = new TextEncoder().encode(secretKey);
			const { payload, protectedHeader } = await jwtVerify(jwt, secret);

			expect(protectedHeader.alg).toBe('HS256');
			expect(payload.accessToken).toBe(accessToken);
			expect(typeof payload.iat).toBe('number');
			expect(typeof payload.exp).toBe('number');
		});

		it('should set expiration to approximately 1 hour from now', async () => {
			const beforeTime = Math.floor(Date.now() / 1000);
			const jwt = await generateJWT('token', 'secret-key-long-enough-for-test');
			const afterTime = Math.floor(Date.now() / 1000);

			const secret = new TextEncoder().encode('secret-key-long-enough-for-test');
			const { payload } = await jwtVerify(jwt, secret);

			const expectedExp = beforeTime + 3600;
			expect(payload.exp).toBeGreaterThanOrEqual(expectedExp - 2);
			expect(payload.exp).toBeLessThanOrEqual(afterTime + 3600 + 2);
		});
	});

	describe('getCredentials', () => {
		it('should retrieve access token and secret key from SSM', async () => {
			mockGetValue.mockResolvedValue('my-access-token');
			mockSecretGetValue.mockResolvedValue('my-secret-key');

			const creds = await getCredentials();

			expect(creds.accessToken).toBe('my-access-token');
			expect(creds.secretKey).toBe('my-secret-key');
			expect(mockGetValue).toHaveBeenCalledTimes(1);
			expect(mockSecretGetValue).toHaveBeenCalledTimes(1);
		});

		it('should throw "Failed to retrieve credentials" when SSM fails', async () => {
			mockGetValue.mockRejectedValue(new Error('SSM unavailable'));

			await expect(getCredentials()).rejects.toThrow('Failed to retrieve credentials');
		});

		it('should throw "Failed to retrieve credentials" when secret key retrieval fails', async () => {
			mockGetValue.mockResolvedValue('my-access-token');
			mockSecretGetValue.mockRejectedValue(new Error('SSM unavailable'));

			await expect(getCredentials()).rejects.toThrow('Failed to retrieve credentials');
		});
	});

	describe('getToken', () => {
		it('should generate a new JWT on first call', async () => {
			mockGetValue.mockResolvedValue('access-token-1');
			mockSecretGetValue.mockResolvedValue('secret-key-long-enough');

			const token = await getToken();

			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3);
			expect(mockGetValue).toHaveBeenCalledTimes(1);
		});

		it('should return cached token on second call within 55-minute TTL', async () => {
			mockGetValue.mockResolvedValue('access-token-1');
			mockSecretGetValue.mockResolvedValue('secret-key-long-enough');

			const token1 = await getToken();
			const token2 = await getToken();

			expect(token1).toBe(token2);
			// Credentials should only be fetched once
			expect(mockGetValue).toHaveBeenCalledTimes(1);
			expect(mockSecretGetValue).toHaveBeenCalledTimes(1);
		});

		it('should generate a new token after cache is reset', async () => {
			mockGetValue.mockResolvedValue('access-token-1');
			mockSecretGetValue.mockResolvedValue('secret-key-long-enough');

			const token1 = await getToken();
			_resetCache();

			mockGetValue.mockResolvedValue('access-token-2');
			const token2 = await getToken();

			// Different credentials should produce different tokens
			expect(mockGetValue).toHaveBeenCalledTimes(2);
		});

		it('should propagate SSM errors through getToken', async () => {
			mockGetValue.mockRejectedValue(new Error('SSM unavailable'));

			await expect(getToken()).rejects.toThrow('Failed to retrieve credentials');
		});
	});
});
