# Requirements Document

## Introduction

This document defines the requirements for converting the Remote Falcon JWT Proxy application from a standalone AWS SAM deployment (`old-backend/`) to the Atlantis Platform framework (`application-infrastructure/`). The converted application must exhibit exact behavioral parity with the reference implementation while adhering to Atlantis patterns, the Model-View-Controller architecture, and the `@63klabs/cache-data` tooling. Files in `old-backend/` serve as the immutable reference and must not be modified.

## Glossary

- **Old_Backend**: The reference implementation located in `old-backend/` that must not be modified and serves as the source of truth for all behavioral requirements.
- **Converted_Application**: The new implementation in `application-infrastructure/` that must replicate Old_Backend behavior using Atlantis patterns.
- **Atlantis_Platform**: The 63Klabs serverless deployment framework providing CloudFormation templates, CI/CD pipelines, and application starters.
- **Cache_Data**: The `@63klabs/cache-data` npm package providing tools for caching, request handling, logging, and response formatting in AWS Lambda.
- **ClientRequest**: The `tools.ClientRequest` class from Cache_Data that parses API Gateway events into structured request objects with validation, client IP extraction, user agent extraction, and host extraction.
- **Response**: The `tools.Response` class from Cache_Data that formats Lambda responses with proper status codes, headers, and body serialization.
- **DebugAndLog**: The `tools.DebugAndLog` class from Cache_Data providing structured logging with configurable log levels.
- **CachedParameterSecrets**: The `tools.CachedParameterSecrets` class from Cache_Data for retrieving and caching AWS SSM parameters and secrets via the Lambda Parameters and Secrets Extension.
- **CachedSsmParameter**: The `tools.CachedSsmParameter` class from Cache_Data for retrieving and caching individual SSM parameters.
- **Remote_Falcon_API**: The external API at `https://remotefalcon.com/remote-falcon-external-api` that the proxy forwards authenticated requests to.
- **JWT_Token**: A JSON Web Token generated using the Remote Falcon access token and secret key, used to authenticate requests to Remote_Falcon_API.
- **RemoteFalconLogBuilder**: A utility class (already copied to `src/utils/RemoteFalconLogBuilder.js`) that generates structured log entries for Remote_Falcon_API requests.
- **PARAM_STORE_HIERARCHY**: The Atlantis SSM Parameter Store hierarchy path (environment variable `PARAM_STORE_PATH`) used to organize application parameters.
- **Router**: The `src/routes/index.js` module that receives API Gateway events and dispatches to the appropriate Controller.
- **Controller**: Modules in `src/controllers/` that coordinate calling Services and returning responses via Views.
- **Service**: Modules in `src/services/` that encapsulate business logic and data retrieval.
- **Model_DAO**: Modules in `src/models/` containing Data Access Objects for external API communication.
- **View**: Modules in `src/views/` that filter, transform, and format data for the response.
- **OpenAPI_Spec**: The `template-openapi-spec.yml` file defining API Gateway endpoints, request/response schemas, and integration mappings.

## Requirements

### Requirement 1: Remote Falcon API Proxy Endpoints

**User Story:** As a frontend application, I want to call Remote Falcon API endpoints through a proxy, so that credentials are never exposed to the client.

#### Acceptance Criteria

1. WHEN a GET request is received at the `/proxy/showDetails` path, THE Converted_Application SHALL forward the request to Remote_Falcon_API at the `/showDetails` path with a valid JWT_Token in the Authorization header and return the response body and status code.
2. WHEN a POST request is received at the `/proxy/addSequenceToQueue` path with a JSON body, THE Converted_Application SHALL forward the request body to Remote_Falcon_API at the `/addSequenceToQueue` path with a valid JWT_Token and return the response body and status code.
3. WHEN a POST request is received at the `/proxy/voteForSequence` path with a JSON body, THE Converted_Application SHALL forward the request body to Remote_Falcon_API at the `/voteForSequence` path with a valid JWT_Token and return the response body and status code.
4. WHEN any request is received at a `/proxy/{proxy+}` path, THE Converted_Application SHALL strip the `/proxy` prefix and forward the request to the corresponding Remote_Falcon_API path using the same HTTP method and body.
5. WHEN the Remote_Falcon_API returns an HTTP error status code (4xx or 5xx), THE Converted_Application SHALL return that same status code and response body to the client.

### Requirement 2: JWT Token Generation and Credential Management

**User Story:** As a system operator, I want credentials stored securely in SSM Parameter Store and JWT tokens cached efficiently, so that the application is secure and performant.

#### Acceptance Criteria

1. THE Converted_Application SHALL retrieve the Remote Falcon access token from the SSM parameter at path `${PARAM_STORE_HIERARCHY}RemoteFalcon/access-token` using CachedParameterSecrets or CachedSsmParameter.
2. THE Converted_Application SHALL retrieve the Remote Falcon secret key from the SSM parameter at path `${PARAM_STORE_HIERARCHY}RemoteFalcon/secret-key` using CachedParameterSecrets or CachedSsmParameter.
3. WHEN generating a JWT_Token, THE Converted_Application SHALL create an HS256-signed JWT containing the access token as payload with a 1-hour expiration time, matching the Old_Backend `generateJWT` function behavior.
4. THE Converted_Application SHALL cache retrieved credentials for 12 hours to reduce SSM API calls, using CachedSsmParameter's `refreshAfter` parameter set to 43200 seconds.
5. THE Converted_Application SHALL cache generated JWT tokens for 55 minutes to reduce token generation overhead, matching Old_Backend caching behavior.
6. IF credential retrieval from SSM Parameter Store fails, THEN THE Converted_Application SHALL return a 500 status code with an `AUTH_ERROR` error code and the message "Authentication service unavailable".

### Requirement 3: Telemetry Endpoint

**User Story:** As a frontend application, I want to send telemetry events to a dedicated endpoint, so that user interactions are tracked for analytics.

#### Acceptance Criteria

1. WHEN a POST request is received at the `/telemetry` path with a valid JSON body, THE Converted_Application SHALL validate the tracking data and log a `TELEMETRY_EVENT` structured log entry containing timestamp, eventType, client IP, user agent, host, URL, eventData, processingTime, and requestId.
2. WHEN a POST request is received at `/telemetry` with valid tracking data, THE Converted_Application SHALL return a 200 status code with a JSON body containing `message`, `timestamp`, and `processingTime` fields.
3. WHEN tracking data validation fails, THE Converted_Application SHALL return a 400 status code with a JSON body containing the validation error message and a `VALIDATION_ERROR` error code.
4. WHEN the request body at `/telemetry` contains invalid JSON, THE Converted_Application SHALL return a 400 status code with a `PARSE_ERROR` error code and the message "Invalid JSON in request body".

### Requirement 4: Tracking Data Validation

**User Story:** As a system operator, I want telemetry data validated before processing, so that only well-formed events are logged.

#### Acceptance Criteria

1. THE Converted_Application SHALL validate that tracking data contains a non-empty `eventType` field with a value from the set: `pageView`, `click`, `videoPlay`, `songRequest`, `systemHealth`, `systemAlert`, `eventFailure`.
2. THE Converted_Application SHALL validate that tracking data contains a non-empty `url` field with a valid URL format.
3. WHEN `eventType` is `systemHealth`, THE Converted_Application SHALL validate that `eventData` contains numeric fields `totalRequests` (non-negative), `failedRequests` (non-negative), and `errorRate` (between 0 and 1), and that `failedRequests` does not exceed `totalRequests`.
4. WHEN `eventType` is `systemAlert`, THE Converted_Application SHALL validate that `eventData` contains a `type` field with value `HIGH_ERROR_RATE` or `CONSECUTIVE_ERRORS`, and numeric fields `errorRate` and `threshold` (both between 0 and 1).
5. WHEN `eventType` is `eventFailure`, THE Converted_Application SHALL validate that `eventData` contains string fields `originalEventType` (from the set of valid event types), `failureReason`, and `errorType`.
6. THE Converted_Application SHALL reject tracking data containing potential PII field names (email, phone, address, name, ssn, creditCard, password, token, apiKey) in `eventData` with a descriptive error message.
7. THE Converted_Application SHALL reject tracking data larger than 10KB with the message "Tracking data too large. Maximum size is 10KB."

### ~~Requirement 5: Deprecated Endpoint Handling~~ (REMOVED)

*This requirement has been removed. The `/proxy/track` deprecated endpoint handling is not needed in the converted application.*

### Requirement 6: CORS Handling

**User Story:** As a frontend application hosted on a different domain, I want proper CORS headers in all responses, so that cross-origin requests succeed.

#### Acceptance Criteria

1. THE Converted_Application SHALL return CORS headers including `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Credentials`, and `Vary: Origin` on all responses.
2. WHEN the request `Origin` header matches an allowed origin (configured via `ALLOWED_ORIGINS` environment variable), THE Converted_Application SHALL set `Access-Control-Allow-Origin` to the request origin and `Access-Control-Allow-Credentials` to `true` (for non-wildcard origins).
3. WHEN an OPTIONS preflight request is received, THE Converted_Application SHALL return a 200 status code with CORS headers and an empty body without invoking any business logic.
4. THE Converted_Application SHALL include security headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` in all responses.
5. WHEN `ALLOWED_ORIGINS` contains wildcard patterns (e.g., `*.mysite.com`), THE Converted_Application SHALL match origins using regex pattern matching, converting `*` to `.*` and escaping dots.


### Requirement 7: Remote Falcon Request Logging

**User Story:** As a system operator, I want comprehensive structured logging for all Remote Falcon API requests, so that I can monitor API health and debug issues.

#### Acceptance Criteria

1. WHEN a request to Remote_Falcon_API succeeds with an HTTP 2xx status and no application-level error is detected, THE Converted_Application SHALL log a `REMOTE_FALCON_REQUEST` entry using RemoteFalconLogBuilder containing request method, path, client IP, user agent, host, response status, processing time, and a data summary.
2. WHEN a request to Remote_Falcon_API returns an HTTP 4xx or 5xx status, THE Converted_Application SHALL log a `REMOTE_FALCON_ERROR` entry using RemoteFalconLogBuilder containing the HTTP status code, error classification, and full request context.
3. WHEN a request to Remote_Falcon_API returns HTTP 200 but the response body contains application-level error patterns (`SONG_REQUESTED`, `QUEUE_FULL`, `success: false`, or error status), THE Converted_Application SHALL log a `REMOTE_FALCON_ERROR` entry with error type `APPLICATION_ERROR`.
4. WHEN a network error, timeout, or fetch failure occurs during a request to Remote_Falcon_API, THE Converted_Application SHALL log a `REMOTE_FALCON_ERROR` entry with the appropriate error classification (`NETWORK_ERROR`, `TIMEOUT_ERROR`, `PARSE_ERROR`, or `UNKNOWN_ERROR`) and throw an error with message "Failed to communicate with Remote Falcon API".
5. THE Converted_Application SHALL sanitize all log entries to remove potential PII (email addresses, phone numbers, credit card numbers, SSN patterns) and credentials (JWT tokens, API keys, access tokens, passwords) before logging.
6. THE Converted_Application SHALL limit individual log entries to 10KB, truncating data summaries and error messages when the limit is exceeded.

### Requirement 8: Request Metrics and Error Logging

**User Story:** As a system operator, I want request-level metrics logged for all endpoints, so that I can monitor application health and performance.

#### Acceptance Criteria

1. WHEN any request completes successfully, THE Converted_Application SHALL log a `REQUEST_METRICS` entry containing requestId, timestamp, HTTP method, path, status code, processing time, total time, and success indicator.
2. WHEN any unhandled error occurs in the Lambda handler, THE Converted_Application SHALL log a `LAMBDA_ERROR` entry containing requestId, timestamp, error message, error name, stack trace, request method, path, origin, user agent, and total processing time.
3. WHEN any unhandled error occurs, THE Converted_Application SHALL return a 500 status code with a JSON body containing `message` "Internal server error", `error` "INTERNAL_ERROR", `requestId`, and `timestamp`.
4. WHEN a telemetry request completes, THE Converted_Application SHALL log a `TELEMETRY_METRICS` entry containing timestamp, eventType, processingTime, success indicator, and requestId.

### Requirement 9: Client Information Extraction via Cache-Data ClientRequest

**User Story:** As a developer, I want client information extracted using Cache_Data's ClientRequest class instead of the custom ClientInfo class, so that the application uses standard Atlantis tooling.

#### Acceptance Criteria

1. THE Converted_Application SHALL use Cache_Data's `tools.ClientRequest` class to extract client IP address, user agent, and host from API Gateway events instead of the Old_Backend `ClientInfo` class.
2. WHEN the `x-forwarded-for` header contains multiple comma-separated IPs, THE Converted_Application SHALL extract the first non-empty IP address, matching Old_Backend behavior.
3. WHEN no client information headers are present, THE Converted_Application SHALL default to `unknown` for IP address, user agent, and host, matching Old_Backend behavior.
4. THE Converted_Application SHALL pass extracted client information to RemoteFalconLogBuilder in the same format as Old_Backend (object with `ipAddress`, `userAgent`, and `host` properties).

### Requirement 10: MVC Architecture Compliance

**User Story:** As a developer, I want the converted application to follow the Atlantis MVC pattern, so that the codebase is maintainable and consistent with other Atlantis applications.

#### Acceptance Criteria

1. THE Converted_Application SHALL implement request routing in `src/routes/index.js` using Cache_Data's ClientRequest and Response classes, dispatching to appropriate Controllers based on HTTP method and path.
2. THE Converted_Application SHALL implement business logic (JWT generation, Remote Falcon forwarding, telemetry processing) in Controller and Service modules, not in the Router or handler.
3. THE Converted_Application SHALL implement response formatting in View modules that transform service data into the response structure expected by clients.
4. THE Converted_Application SHALL implement Remote Falcon API communication in Model/DAO modules that handle the HTTP request, authentication headers, and response parsing.
5. THE Converted_Application SHALL use Cache_Data's `tools.Response` class to format all Lambda responses with proper status codes, headers, and JSON body serialization.
6. THE Converted_Application SHALL use Cache_Data's `tools.DebugAndLog` class for all application logging instead of direct `console.log` and `console.error` calls (except for structured log entries that must match Old_Backend format).

### Requirement 11: SSM Parameter Path Migration

**User Story:** As a system operator, I want SSM parameter paths to follow Atlantis conventions, so that parameters are organized consistently across environments.

#### Acceptance Criteria

1. THE Converted_Application SHALL use the SSM parameter path `${PARAM_STORE_HIERARCHY}RemoteFalcon/access-token` for the Remote Falcon access token instead of the Old_Backend path `/remotefalcon/${Environment}/access-token`.
2. THE Converted_Application SHALL use the SSM parameter path `${PARAM_STORE_HIERARCHY}RemoteFalcon/secret-key` for the Remote Falcon secret key instead of the Old_Backend path `/remotefalcon/${Environment}/secret-key`.
3. THE Converted_Application SHALL configure the `generate-put-ssm.py` build script (or equivalent) to check for and create the `RemoteFalcon/access-token` and `RemoteFalcon/secret-key` parameters during deployment if they do not exist.

### Requirement 12: OpenAPI Specification Update

**User Story:** As a developer, I want the OpenAPI specification to define all Remote Falcon proxy and telemetry endpoints, so that API Gateway is properly configured and the API is documented.

#### Acceptance Criteria

1. THE OpenAPI_Spec SHALL define a POST endpoint at `/telemetry` with request body schema for tracking data and response schemas for success (200), validation error (400), and server error (500).
2. THE OpenAPI_Spec SHALL define a GET endpoint at `/proxy/showDetails` with the API Gateway Lambda proxy integration.
3. THE OpenAPI_Spec SHALL define POST endpoints at `/proxy/addSequenceToQueue` and `/proxy/voteForSequence` with request body schemas and the API Gateway Lambda proxy integration.
4. THE OpenAPI_Spec SHALL define an ANY method endpoint at `/proxy/{proxy+}` as a catch-all for additional Remote Falcon API paths with the API Gateway Lambda proxy integration.
5. THE OpenAPI_Spec SHALL define OPTIONS method endpoints for CORS preflight handling on all paths.
6. THE OpenAPI_Spec SHALL remove the example `/api/example/` and `/api/example/{id}` endpoints from the scaffold.

### Requirement 13: CloudFormation Template Updates

**User Story:** As a system operator, I want the CloudFormation template to define the correct API Gateway events and Lambda environment variables, so that the application deploys correctly on the Atlantis platform.

#### Acceptance Criteria

1. THE Converted_Application's `template.yml` SHALL define Lambda API events for: POST `/telemetry`, GET `/proxy/showDetails`, POST `/proxy/addSequenceToQueue`, POST `/proxy/voteForSequence`, ANY `/proxy/{proxy+}`, and OPTIONS on all paths.
2. THE Converted_Application's `template.yml` SHALL include Lambda environment variables for `REMOTE_FALCON_API_BASE_URL` (set to `https://remotefalcon.com/remote-falcon-external-api`) and `ALLOWED_ORIGINS`.
3. THE Converted_Application's `template.yml` SHALL include IAM permissions for the Lambda execution role to read SSM parameters at `${ParameterStoreHierarchy}${DeployEnvironment}/${Prefix}-${ProjectId}-${StageId}/RemoteFalcon/*`.
4. THE Converted_Application's `template.yml` SHALL include the `jose` npm package as a dependency for JWT token generation.

### Requirement 14: Endpoint Not Found Handling

**User Story:** As a client developer, I want informative responses when requesting unknown endpoints, so that I can identify and correct incorrect API calls.

#### Acceptance Criteria

1. WHEN a request is received for an undefined endpoint, THE Converted_Application SHALL return a 404 status code with a JSON body containing `message` "Endpoint not found", `error` "NOT_FOUND", `requestId`, a list of `availableEndpoints`, and `timestamp`.
2. WHEN a request is received for an undefined endpoint, THE Converted_Application SHALL log a warning with the requested path, method, and requestId.

### Requirement 15: Documentation Updates

**User Story:** As a developer or operator, I want up-to-date documentation, so that I can understand, deploy, and maintain the converted application.

#### Acceptance Criteria

1. WHEN the conversion is complete, THE Converted_Application SHALL have an updated `ARCHITECTURE.md` reflecting the new MVC structure, Remote Falcon proxy flow, telemetry endpoint, and Atlantis platform integration.
2. WHEN the conversion is complete, THE Converted_Application SHALL have an updated `DEPLOYMENT.md` including instructions for setting up the `RemoteFalcon/access-token` and `RemoteFalcon/secret-key` SSM parameters and deploying via Atlantis pipelines.
3. WHEN the conversion is complete, THE Converted_Application SHALL have updated `docs/` directory content covering admin operations (SSM parameter management, monitoring), developer documentation (MVC structure, adding endpoints), and end-user documentation (API endpoints, request/response formats).

### Requirement 16: Behavioral Parity Testing

**User Story:** As a developer, I want comprehensive tests verifying 1:1 behavioral parity with Old_Backend, so that the conversion is validated as correct.

#### Acceptance Criteria

1. THE Converted_Application SHALL include unit tests verifying that each proxy endpoint (`/proxy/showDetails`, `/proxy/addSequenceToQueue`, `/proxy/voteForSequence`) produces the same response structure and status codes as Old_Backend for identical inputs.
2. THE Converted_Application SHALL include unit tests verifying that the telemetry endpoint (`/telemetry`) produces the same response structure, validation behavior, and log output as Old_Backend for identical inputs.
3. THE Converted_Application SHALL include unit tests verifying that CORS headers match Old_Backend behavior for allowed origins, disallowed origins, wildcard patterns, and missing origin headers.
4. THE Converted_Application SHALL include unit tests verifying that JWT token generation produces valid HS256 tokens with the correct payload structure and expiration time.
5. THE Converted_Application SHALL include unit tests verifying that error responses (400, 404, 500) match Old_Backend response structure including `message`, `error`, `requestId`, and `timestamp` fields.
6. THE Converted_Application SHALL include unit tests verifying that RemoteFalconLogBuilder produces identical log entry structures for success, error, and application error scenarios.
7. THE Converted_Application SHALL include unit tests verifying that tracking data validation accepts and rejects the same inputs as Old_Backend, including PII detection, size limits, and system health/alert/failure event validation.

### Requirement 17: Immutability of Reference Implementation

**User Story:** As a project owner, I want the old-backend code preserved unchanged, so that it serves as a reliable reference for behavioral parity verification.

#### Acceptance Criteria

1. THE Converted_Application conversion process SHALL NOT modify any files in the `old-backend/` directory.
2. THE Old_Backend test suite SHALL continue to pass without modification after the conversion is complete.
