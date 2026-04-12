/**
 * Application settings file
 *
 * Settings are loaded by AppConfig.init() and accessible via Config.settings().
 * 
 * @example
 * const { Config } = require("./config");
 * const baseUrl = Config.settings().remoteFalconApiBaseUrl;
 * 
 * @module config/settings
 */

const settings = {
	"remoteFalconApiBaseUrl": process.env.REMOTE_FALCON_API_BASE_URL || "https://remotefalcon.com/remote-falcon-external-api",
	"allowedOrigins": process.env.ALLOWED_ORIGINS || "*",
};

module.exports = settings;
