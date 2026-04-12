/**
 * Configuration initialization module for Lambda Function.
 *
 * Handles async initialization of:
 * - AppConfig.init() (Response, ClientRequest, Connections, Settings)
 * - Cache-data Cache.init()
 * - CachedSsmParameter for Remote Falcon credentials
 *
 * Config.init() should be called once during Lambda cold start
 * before processing any requests (outside the handler).
 * 
 * Within the handler, await Config.promise() and Config.prime().
 *
 * @module config
 */

const { 
	cache: {
		Cache,
		CacheableDataAccess
	},
	tools: {
		DebugAndLog,
		Timer,
		CachedParameterSecrets,
		CachedSsmParameter,
		AppConfig,
	} 
} = require("@63klabs/cache-data");

const settings = require("./settings.js");
const validations = require("./validations.js");
const connections = require("./connections.js");
const responses = require("./responses.js");

const PARAM_STORE_HIERARCHY = process.env.PARAM_STORE_PATH || "";

/**
 * CachedSsmParameter for Remote Falcon access token.
 * Refreshes every 12 hours (43200 seconds).
 * 
 * @type {CachedSsmParameter}
 */
const remoteFalconAccessToken = new CachedSsmParameter(
	`${PARAM_STORE_HIERARCHY}RemoteFalcon/access-token`,
	{ refreshAfter: 43200 }
);

/**
 * CachedSsmParameter for Remote Falcon secret key.
 * Refreshes every 12 hours (43200 seconds).
 * 
 * @type {CachedSsmParameter}
 */
const remoteFalconSecretKey = new CachedSsmParameter(
	`${PARAM_STORE_HIERARCHY}RemoteFalcon/secret-key`,
	{ refreshAfter: 43200 }
);

/**
 * Configuration class for Lambda Function.
 * 
 * Extends tools.AppConfig from @63klabs/cache-data to provide:
 * - Config.settings() - Getter for accessing application settings
 * - Config.getConnCacheProfile() - Method for retrieving connection cache profiles
 * - Config.getRemoteFalconAccessToken() - Getter for Remote Falcon access token parameter
 * - Config.getRemoteFalconSecretKey() - Getter for Remote Falcon secret key parameter
 * 
 * @extends AppConfig
 */
class Config extends AppConfig {

	/**
	 * Get the CachedSsmParameter for Remote Falcon access token.
	 * 
	 * @returns {CachedSsmParameter} The cached SSM parameter for the access token
	 */
	static getRemoteFalconAccessToken() {
		return remoteFalconAccessToken;
	}

	/**
	 * Get the CachedSsmParameter for Remote Falcon secret key.
	 * 
	 * @returns {CachedSsmParameter} The cached SSM parameter for the secret key
	 */
	static getRemoteFalconSecretKey() {
		return remoteFalconSecretKey;
	}

	/**
	 * Initialize configuration for Lambda cold start.
	 * 
	 * Performs async initialization that should be called once during
	 * Lambda cold start before processing any requests.
	 * Using AppConfig.init(), it initializes:
	 * - ClientRequest validation framework
	 * - Response formatting utilities
	 * - Connections
	 * - Application Settings
	 * Using Cache.init() it initializes:
	 * - Cache system with secure data key from SSM Parameter Store
	 * 
	 * @returns {Promise<boolean>} Resolves to true when initialization completes
	 * @example
	 * const { Config } = require('./config');
	 * Config.init();
	 * 
	 * exports.handler = async (event, context) => {
	 *   await Config.promise();
	 *   await Config.prime();
	 *   // Now safe to use Config.settings()
	 * };
	 */
	static init() {

		const timerConfigInit = new Timer("timerConfigInit", true);
				
		try {

			AppConfig.init( { settings, validations, connections, responses, debug: true } );

			Cache.init({
				secureDataKey: new CachedSsmParameter(PARAM_STORE_HIERARCHY+'CacheData_SecureDataKey', {refreshAfter: 43200}), // 12 hours
			});

			DebugAndLog.debug("Cache: ", Cache.info());

		} catch (error) {
			DebugAndLog.error(`Could not initialize Config ${error.message}`, error.stack);
		} finally {
			timerConfigInit.stop();
		};

		return AppConfig.promise();
	};

	/**
	 * Prime caches and parameters after Config.init() is complete.
	 * Primes CacheableDataAccess, CachedParameterSecrets, and
	 * Remote Falcon credential parameters.
	 *
	 * @async
	 * @returns {Promise<Array>}
	 * @example
	 * Config.init();
	 * exports.handler = async (event, context) => {
	 *   await Config.promise();
	 *   await Config.prime();
	 *   // Credentials are now primed and cached
	 * };
	 */
	static async prime() {
		return Promise.all([
			CacheableDataAccess.prime(),
			CachedParameterSecrets.prime(),
			remoteFalconAccessToken.prime(),
			remoteFalconSecretKey.prime(),
		]);
	};
};

module.exports = {
	Config
};
