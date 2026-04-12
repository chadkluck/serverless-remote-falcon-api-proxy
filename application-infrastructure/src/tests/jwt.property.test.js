/**
 * Property-based tests for JWT token structure and signing.
 *
 * Feature: convert-to-atlantis, Property 2: JWT token structure and signing
 * **Validates: Requirements 2.3**
 *
 * Uses fast-check to generate random access tokens and secret keys,
 * then verifies the generated JWT is HS256-signed, contains the
 * accessToken in the payload, and expires in approximately 1 hour.
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const fc = require('fast-check');
const { jwtVerify, SignJWT } = require('jose');
const { generateJWT, _setSignJWT } = require('../services/jwt.service');

describe('Feature: convert-to-atlantis, Property 2: JWT token structure and signing', () => {

	beforeAll(() => {
		_setSignJWT(SignJWT); // Inject babel-transformed SignJWT to avoid dynamic import
	});

	afterAll(() => {
		_setSignJWT(null);
	});

	it('should produce HS256-signed JWTs with correct payload and ~1 hour expiration for any access token and secret key', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.string({ minLength: 1, maxLength: 200 }),
				fc.string({ minLength: 32, maxLength: 128 }),
				async (accessToken, secretKey) => {
					const beforeTime = Math.floor(Date.now() / 1000);
					const jwt = await generateJWT(accessToken, secretKey);
					const afterTime = Math.floor(Date.now() / 1000);

					// Verify the JWT is valid and HS256-signed
					const secret = new TextEncoder().encode(secretKey);
					const { payload, protectedHeader } = await jwtVerify(jwt, secret);

					// Verify HS256 algorithm
					expect(protectedHeader.alg).toBe('HS256');

					// Verify payload contains accessToken
					expect(payload.accessToken).toBe(accessToken);

					// Verify issued-at is present and reasonable
					expect(typeof payload.iat).toBe('number');
					expect(payload.iat).toBeGreaterThanOrEqual(beforeTime);
					expect(payload.iat).toBeLessThanOrEqual(afterTime);

					// Verify expiration is approximately 1 hour from issuance
					expect(typeof payload.exp).toBe('number');
					const expectedExp = beforeTime + 3600;
					// Allow 5 seconds tolerance for test execution time
					expect(payload.exp).toBeGreaterThanOrEqual(expectedExp - 5);
					expect(payload.exp).toBeLessThanOrEqual(expectedExp + 5);
				}
			),
			{ numRuns: 100 }
		);
	});

});
