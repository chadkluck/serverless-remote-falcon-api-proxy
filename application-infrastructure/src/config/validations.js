/**
 * Request parameter validation configuration.
 *
 * The OpenAPI specification in template-openapi-spec.yml is the primary
 * validation layer. Additional validation occurs downstream in the
 * Router/Controller/Service layers (telemetry validation, etc.).
 * 
 * EXCLUDE_PARAMS_WITH_NO_VALIDATION_MATCH is set to false since
 * validation is handled downstream by the controllers and services.
 *
 * @module config/validations
 */

/**
 * Allowed referrers for CORS and access control.
 * Domain matching is right-to-left, so example.com allows sub.example.com.
 * 
 * @type {Array<string>}
 */
const ALLOWED_REFERRERS = ['*'];

/**
 * When false, parameters without a matching validator are allowed through.
 * Set to false when relying on downstream validation (Router/Controller/Service).
 * 
 * @type {boolean}
 */
const EXCLUDE_PARAMS_WITH_NO_VALIDATION_MATCH = false;

/**
 * Exported validation configuration for ClientRequest.init() or AppConfig.init().
 * 
 * @example
 * const validations = require('./validations');
 * AppConfig.init({ validations });
 */
module.exports = {
	referrers: ALLOWED_REFERRERS,
	parameters: {
		excludeParamsWithNoValidationMatch: EXCLUDE_PARAMS_WITH_NO_VALIDATION_MATCH,
		pathParameters: {},
		queryStringParameters: {},
	}
};
