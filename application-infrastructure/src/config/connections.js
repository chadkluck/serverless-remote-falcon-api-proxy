const { tools: { DebugAndLog } } = require("@63klabs/cache-data");

/**
 * Connection configurations for external API endpoints.
 * 
 * Each connection defines a host, path, and cache profiles.
 * The DAO layer uses these connections via cache-data's endpoint.send()
 * for HTTP requests with built-in X-Ray tracing.
 * 
 * @module config/connections
 */
const connections = [
	{
		name: "remote-falcon-api",
		host: "remotefalcon.com",
		path: "/remote-falcon-external-api",
		cache: [
			{
				profile: "default",
				overrideOriginHeaderExpiration: true,
				defaultExpirationInSeconds: (DebugAndLog.isProduction() ? (5 * 60) : (1 * 60)), // 5 min prod, 1 min non-prod
				expirationIsOnInterval: false,
				headersToRetain: [],
				hostId: "remotefalcon",
				pathId: "external-api",
				encrypt: true,
			}
		]
	}
];

module.exports = connections;
