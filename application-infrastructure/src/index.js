/**
 * Lambda handler
 * 
 * The handler performs cold start initialization via Config.init() and delegates
 * request routing to the Routes module.
 * 
 * Uncaught errors are handled within try/catch/finally to provide logs and
 * error messages back to the client.
 * 
 * @module handler
*/

// >! Web service and cache framework package
const { tools: {DebugAndLog, Response, Timer} } = require("@63klabs/cache-data");

// >! Application Modules
const { Config } = require("./config");
const Routes = require("./routes");

// >! Log a cold start and time it using Timer - stop Timer in finally block
const coldStartInitTimer = new Timer("coldStartTimer", true);

// >! Initialize Config - done outside of handler so it is only done on cold start
Config.init(); // >! we will await completion in the handler

/**
 * Lambda function handler
 * 
 * This function is invoked by API Gateway for all incoming requests.
 * The handler will ensure the cold start init was resolved (either during
 * the current or prior invocation) and then sends the request to
 * Routes.process()
 * 
 * @async
 * @param {Object} event - API Gateway event object
 * @param {Object} event.body - Request body (JSON string)
 * @param {Object} event.headers - Request headers
 * @param {Object} event.queryStringParameters - Query parameters
 * @param {Object} event.requestContext - Request context with requestId, IP, etc.
 * @param {Object} context - Lambda context object
 * @param {string} context.requestId - Lambda request ID
 * @param {string} context.functionName - Lambda function name
 * @param {number} context.getRemainingTimeInMillis - Function to get remaining execution time
 * @returns {Promise<Object>} API Gateway response object
 * @returns {number} returns.statusCode - HTTP status code
 * @returns {Object} returns.headers - Response headers
 * @returns {string} returns.body - Response body (JSON string)
 */
exports.handler = async (event, context) => {

	let response = null;

	try {

		// >! Ensure Cold Start init is done and primed (all async complete) before continuing.
		// >! If this is a cold start, we may need to wait
		// >! If this is not a cold start then all promises will have already been resolved previously and we will move on
		const t = await Config.promise(); // >! makes sure general config init is complete
		await Config.prime(); // >! makes sure all prime tasks (tasks that need to be completed AFTER init but BEFORE handler) are completed
		// >! If the cold start init timer is running, stop it and log. This won't run again until next cold start
		if (coldStartInitTimer.isRunning()) { DebugAndLog.log(coldStartInitTimer.stop(),"COLDSTART"); }
		// >! Now that we have verified that all cold start tasks have completed we can continue handling the request


		// >! Delegate request processing to routing layer
		// >! Routes.process() handles tool routing and controller invocation
		response = await Routes.process(event, context);

	} catch (error) {

		/* Log the error */
		DebugAndLog.error(`Unhandled Execution Error in Handler  Error: ${error.message}`, error.stack);

		/* This failed before we even got to parsing the request so we don't have all the log info */
		response = new Response({statusCode: 500});
		response.setBody({
			message: 'Error initializing request - 1701-D' // 1701-D just so we know it is an app and not API Gateway error
		});

	} finally {
		DebugAndLog.debug("Response from Handler: ", response);
		// >! Send the result back to API Gateway (finalize will log the request and response status)
		return response.finalize();
	}

};