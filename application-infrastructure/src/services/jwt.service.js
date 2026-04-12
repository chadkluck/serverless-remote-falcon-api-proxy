/**
 * JWT Service for Remote Falcon authentication.
 *
 * Handles JWT token generation, credential retrieval from SSM,
 * and caching of both tokens and credentials.
 *
 * - JWT tokens are cached for 55 minutes (tokens expire in 1 hour)
 * - Credentials are cached via CachedSsmParameter with 12-hour refresh
 *
 * @module services/jwt.service
 */

const { Config } = require('../config');

/** @type {Promise<typeof import('jose')>|null} */
let _josePromise = null;

/**
 * Lazily load the jose ESM module via dynamic import.
 * Cached after first call so the import only happens once.
 *
 * @returns {Promise<typeof import('jose')>}
 * @private
 */
function _getJose() {
	if (!_josePromise) {
		_josePromise = import('jose');
	}
	return _josePromise;
}

/** @type {{ token: string|null, expiresAt: number|null }} */
let jwtCache = {
	token: null,
	expiresAt: null
};

/**
 * Get a valid JWT token, using cache if available.
 *
 * Checks the JWT cache (55-minute TTL). If the cached token is still
 * valid, returns it. Otherwise, retrieves credentials from SSM and
 * generates a new JWT.
 *
 * @async
 * @returns {Promise<string>} A valid JWT token string
 * @throws {Error} If credential retrieval or JWT generation fails
 * @example
 * const token = await JwtSvc.getToken();
 * // Use token in Authorization header
 * headers['Authorization'] = `Bearer ${token}`;
 */
async function getToken() {
	const now = Date.now();

	if (jwtCache.token && jwtCache.expiresAt > now) {
		return jwtCache.token;
	}

	const { accessToken, secretKey } = await getCredentials();
	const jwt = await generateJWT(accessToken, secretKey);

	jwtCache = {
		token: jwt,
		expiresAt: now + (55 * 60 * 1000)
	};

	return jwt;
}

/**
 * Retrieve Remote Falcon credentials from SSM Parameter Store.
 *
 * Uses CachedSsmParameter instances from Config, which handle
 * their own caching with a 12-hour refresh interval.
 *
 * @async
 * @returns {Promise<{accessToken: string, secretKey: string}>} The credentials
 * @throws {Error} With message "Failed to retrieve credentials" if SSM retrieval fails
 * @example
 * const { accessToken, secretKey } = await getCredentials();
 */
async function getCredentials() {
	try {
		const accessToken = await Config.getRemoteFalconAccessToken().getValue();
		const secretKey = await Config.getRemoteFalconSecretKey().getValue();
		return { accessToken, secretKey };
	} catch (error) {
		throw new Error('Failed to retrieve credentials');
	}
}

/**
 * Generate an HS256-signed JWT token.
 *
 * Creates a JWT with the access token as payload, issued-at timestamp,
 * and 1-hour expiration. Matches old-backend generateJWT exactly.
 *
 * @async
 * @param {string} accessToken - The Remote Falcon access token to embed in the JWT payload
 * @param {string} secretKey - The secret key used to sign the JWT
 * @returns {Promise<string>} The signed JWT token string
 * @example
 * const jwt = await generateJWT('my-access-token', 'my-secret-key');
 */
async function generateJWT(accessToken, secretKey) {
	const { SignJWT } = await _getJose();

	const payload = { accessToken: accessToken };
	const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60); // 1 hour
	const secret = new TextEncoder().encode(secretKey);

	const jwt = await new SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(expirationTime)
		.sign(secret);

	return jwt;
}

/**
 * Reset the JWT cache. Exposed for testing purposes.
 *
 * @private
 */
function _resetCache() {
	jwtCache = { token: null, expiresAt: null };
}

module.exports = {
	getToken,
	getCredentials,
	generateJWT,
	_resetCache
};
