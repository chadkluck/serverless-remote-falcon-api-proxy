# Implementation Plan: Convert to Atlantis

## Overview

Convert the Remote Falcon JWT Proxy from the monolithic `old-backend/` to the Atlantis Platform MVC architecture in `application-infrastructure/`. Tasks are ordered: infrastructure/config first, then core services, DAO, controllers, router, views, tests, CloudFormation/OpenAPI, and documentation last. Old-backend files must not be modified.

## Tasks

- [x] 1. Update configuration and dependencies
  - [x] 1.1 Update `src/package.json` to add `jose` and `fast-check` dependencies
    - Add `"jose": "^6.1.3"` to `dependencies`
    - Add `"fast-check": "^3.15.0"` to `devDependencies`
    - _Requirements: 13.4_

  - [x] 1.2 Update `src/config/settings.js` with Remote Falcon settings
    - Add `remoteFalconApiBaseUrl` from `REMOTE_FALCON_API_BASE_URL` env var
    - Add `allowedOrigins` from `ALLOWED_ORIGINS` env var
    - _Requirements: 13.2_

  - [x] 1.3 Update `src/config/connections.js` for Remote Falcon API endpoint
    - Replace the example `games` connection with a Remote Falcon API connection
    - Configure host as `remotefalcon.com`, path as `/remote-falcon-external-api`
    - Set appropriate cache profiles for the connection
    - _Requirements: 10.4_

  - [x] 1.4 Update `src/config/validations.js` for Remote Falcon
    - Remove example validators (`id`, `players`, `BY_ROUTE`)
    - Update `ALLOWED_REFERRERS` to use settings if needed
    - Keep `EXCLUDE_PARAMS_WITH_NO_VALIDATION_MATCH` as `false` since validation is downstream
    - _Requirements: 10.1_

  - [x] 1.5 Update `src/config/index.js` to add CachedSsmParameter for Remote Falcon credentials
    - Add `CachedSsmParameter` instances for `${PARAM_STORE_HIERARCHY}RemoteFalcon/access-token` and `${PARAM_STORE_HIERARCHY}RemoteFalcon/secret-key` with `refreshAfter: 43200` (12 hours)
    - Ensure `Config.prime()` includes priming for the new parameters
    - _Requirements: 2.1, 2.2, 2.4, 11.1, 11.2_

- [x] 2. Implement CORS utility and views
  - [x] 2.1 Create `src/utils/cors.js` — CORS header generation
    - Port `getCorsHeaders(origin)` from old-backend with identical logic
    - Parse `ALLOWED_ORIGINS` env var, match origin against allowed list (exact + wildcard)
    - Return headers object with CORS headers and security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy`)
    - Handle missing origin, wildcard `*`, specific origins, and `Access-Control-Allow-Credentials`
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x] 2.2 Update `src/utils/index.js` to export `cors` module
    - Add `cors` to the barrel export
    - _Requirements: 10.1_

  - [x] 2.3 Create `src/views/telemetry.view.js` — Telemetry response formatting
    - Implement `successView(data)` returning `{message, timestamp, processingTime}`
    - Implement `errorView(error, errorCode)` returning `{message, error, timestamp}`
    - _Requirements: 3.2, 3.3, 10.3_

  - [x] 2.4 Create `src/views/proxy.view.js` — Proxy response formatting
    - Implement `forwardView(result)` — pass-through of `result.body`
    - Implement `notFoundView(requestId, timestamp)` — 404 response with `availableEndpoints`
    - Implement `authErrorView(requestId, timestamp)` — auth error response
    - _Requirements: 14.1, 10.3_

  - [x] 2.5 Update `src/views/index.js` to export new views
    - Replace `ExampleView` with `TelemetryView` and `ProxyView`
    - _Requirements: 10.3_

- [x] 3. Implement JWT service
  - [x] 3.1 Create `src/services/jwt.service.js` — JWT generation and credential caching
    - Implement `getToken()` — checks JWT cache (55-minute TTL), generates new if expired
    - Implement `getCredentials()` — retrieves access token and secret key from SSM via `CachedSsmParameter`
    - Implement `generateJWT(accessToken, secretKey)` — uses `jose` `SignJWT` to create HS256-signed JWT with `{accessToken}` payload and 1-hour expiration, matching old-backend exactly
    - JWT cache at 55 minutes, credential cache at 12 hours via `CachedSsmParameter` `refreshAfter`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 11.1, 11.2_

  - [x] 3.2 Write property test for JWT structure — `src/tests/jwt.property.test.js`
    - **Property 2: JWT token structure and signing**
    - Generate random access tokens and secret keys, verify JWT is HS256, contains accessToken in payload, expires in ~1 hour
    - **Validates: Requirements 2.3**

  - [x] 3.3 Write unit tests for JWT service — `src/tests/jwt.service.test.js`
    - Test JWT generation produces valid HS256 tokens with correct payload
    - Test JWT caching (55-minute TTL)
    - Test credential retrieval from SSM
    - Test SSM failure returns 500 AUTH_ERROR
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 16.4_

- [x] 4. Checkpoint — Verify config, CORS, views, and JWT service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Remote Falcon DAO
  - [x] 5.1 Create `src/models/RemoteFalcon.dao.js` — Remote Falcon API DAO
    - Implement `forward(url, method, body, jwt, clientInfo, requestId)` returning `{statusCode, body, headers}`
    - Use `endpoint.send()` from cache-data for HTTP requests (X-Ray tracing)
    - Construct request with `Authorization: Bearer ${jwt}` header
    - Use `RemoteFalconLogBuilder` for structured logging
    - Detect application-level errors via `RemoteFalconLogBuilder.detectApplicationError()`
    - Log `REMOTE_FALCON_REQUEST` (success) or `REMOTE_FALCON_ERROR` (HTTP errors, app errors, network errors) via `console.log`
    - On network error: log error, throw `"Failed to communicate with Remote Falcon API"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 10.4_

  - [x] 5.2 Update `src/models/index.js` to export `RemoteFalconDao`
    - Replace `ExampleDao` with `RemoteFalconDao`
    - _Requirements: 10.4_

- [x] 6. Implement proxy service and telemetry service
  - [x] 6.1 Create `src/services/proxy.service.js` — Proxy forwarding service
    - Implement `forwardToRemoteFalcon(path, method, body, clientInfo, requestId)` returning `{statusCode, body, headers}`
    - Get JWT via `JwtSvc.getToken()`
    - Delegate to `RemoteFalconDao.forward()` with full URL, method, body, jwt, clientInfo, requestId
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.2_

  - [x] 6.2 Create `src/services/telemetry.service.js` — Telemetry processing and validation
    - Implement `processTracking(body, clientInfo, requestId)` returning `{statusCode, body}`
    - Implement `validateTrackingData(data)` — port from old-backend with identical logic
    - Implement `validateSystemHealthData(eventData)` — port from old-backend
    - Implement `validateSystemAlertData(eventData)` — port from old-backend
    - Implement `validateEventFailureData(eventData)` — port from old-backend
    - PII detection in eventData (email, phone, address, name, ssn, creditCard, password, token, apiKey)
    - Size limit enforcement (10KB)
    - Log `TELEMETRY_EVENT` and `TELEMETRY_METRICS` structured entries via `console.log`
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.4, 10.2_

  - [x] 6.3 Update `src/services/index.js` to export new services
    - Replace `ExampleSvc` with `ProxySvc`, `JwtSvc`, `TelemetrySvc`
    - _Requirements: 10.2_

- [x] 7. Implement controllers
  - [x] 7.1 Create `src/controllers/proxy.controller.js` — Proxy endpoint controller
    - Implement `forward(props, REQ, RESP)` returning formatted response
    - Extract client info from `REQ` (`getClientIp()`, `getClientUserAgent()`, `getClientHost()` or equivalent `ClientRequest` methods)
    - Build `clientInfo` object `{ipAddress, userAgent, host}` for `RemoteFalconLogBuilder`
    - Strip `/proxy` prefix from path
    - Call `ProxySvc.forwardToRemoteFalcon(path, method, body, clientInfo, requestId)`
    - Format response via `ProxyView`
    - Handle errors: SSM failures → 500 AUTH_ERROR, network failures → 500 INTERNAL_ERROR
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.1, 9.4, 10.2_

  - [x] 7.2 Create `src/controllers/telemetry.controller.js` — Telemetry endpoint controller
    - Implement `post(props, REQ, RESP)` returning formatted response
    - Extract body from `REQ`, parse JSON
    - Handle invalid JSON → 400 PARSE_ERROR
    - Call `TelemetrySvc.processTracking(body, clientInfo, requestId)`
    - Format response via `TelemetryView`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.2_

  - [x] 7.3 Update `src/controllers/index.js` to export new controllers
    - Replace `ExampleCtrl` with `ProxyCtrl` and `TelemetryCtrl`
    - _Requirements: 10.2_

- [x] 8. Implement Router
  - [x] 8.1 Rewrite `src/routes/index.js` for Remote Falcon proxy and telemetry routing
    - Create `ClientRequest` and `Response` from event/context
    - Apply CORS headers (via `cors.js`) and security headers to all responses
    - Routing table:
      - `OPTIONS *` → 200 with CORS headers, empty body (no business logic)
      - `POST /telemetry` → `TelemetryCtrl.post(props, REQ, RESP)`
      - `GET /proxy/showDetails` → `ProxyCtrl.forward(props, REQ, RESP)`
      - `POST /proxy/addSequenceToQueue` → `ProxyCtrl.forward(props, REQ, RESP)`
      - `POST /proxy/voteForSequence` → `ProxyCtrl.forward(props, REQ, RESP)`
      - `ANY /proxy/{proxy+}` → `ProxyCtrl.forward(props, REQ, RESP)`
      - `*` → 404 NOT_FOUND with available endpoints
    - Log `REQUEST_METRICS` after each request
    - Log warning for unknown endpoint access
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 10.1, 14.1, 14.2_

- [x] 9. Remove example scaffold files
  - [x] 9.1 Remove example files no longer needed
    - Delete `src/controllers/example.controller.js`
    - Delete `src/services/example.service.js`
    - Delete `src/views/example.view.js`
    - Delete `src/models/Example.dao.js`, `src/models/ApiExample.dao.js`
    - Delete `src/models/sample-data/` and `src/models/test-data/` directories
    - Clean up any remaining example references
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 10. Checkpoint — Verify full application wiring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update CloudFormation template and OpenAPI spec
  - [x] 11.1 Update `template.yml` Lambda events for Remote Falcon endpoints
    - Replace example `GetApiData` and `GetById` events with:
      - `TelemetryPost`: POST `/telemetry`
      - `TelemetryOptions`: OPTIONS `/telemetry`
      - `ProxyShowDetails`: GET `/proxy/showDetails`
      - `ProxyAddSequence`: POST `/proxy/addSequenceToQueue`
      - `ProxyVoteSequence`: POST `/proxy/voteForSequence`
      - `ProxyAny`: ANY `/proxy/{proxy+}`
      - `ProxyOptions`: OPTIONS `/proxy/{proxy+}`
    - Add environment variables: `REMOTE_FALCON_API_BASE_URL`, `ALLOWED_ORIGINS`
    - Add `AllowedOrigins` parameter
    - Update `WebApi` CORS `AllowMethods` to include POST
    - Verify IAM permissions cover `${ParameterStoreHierarchy}*` for RemoteFalcon SSM params
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 11.2 Rewrite `template-openapi-spec.yml` for Remote Falcon endpoints
    - Remove example `/api/example/` and `/api/example/{id}` paths
    - Add `/telemetry` POST and OPTIONS paths with request/response schemas
    - Add `/proxy/showDetails` GET path
    - Add `/proxy/addSequenceToQueue` POST path
    - Add `/proxy/voteForSequence` POST path
    - Add `/proxy/{proxy+}` ANY and OPTIONS paths
    - Define component schemas: `TrackingData`, `TelemetrySuccess`, `ErrorResponse`
    - All paths use `aws_proxy` integration pointing to `${AppFunction.Arn}`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 11.3 Update `template-configuration.json` if needed
    - Verify tags and parameters are appropriate for Remote Falcon proxy application
    - Update `Application` and `Name` tags to reflect Remote Falcon proxy
    - _Requirements: 13.1_

- [x] 12. Write unit tests for core components
  - [x] 12.1 Write unit tests for CORS — `src/tests/cors.test.js`
    - Test allowed origins, disallowed origins, wildcard patterns, missing origin header
    - Test security headers present on all responses
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 16.3_

  - [x] 12.2 Write unit tests for telemetry service — `src/tests/telemetry.service.test.js`
    - Test valid tracking data processing and response structure
    - Test all validation functions: eventType, URL, systemHealth, systemAlert, eventFailure
    - Test PII detection in eventData
    - Test size limit enforcement (10KB)
    - Test invalid JSON handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 16.2, 16.7_

  - [x] 12.3 Write unit tests for proxy controller — `src/tests/proxy.controller.test.js`
    - Test proxy forwarding for showDetails, addSequenceToQueue, voteForSequence
    - Test path stripping (`/proxy/showDetails` → `/showDetails`)
    - Test error responses (500 AUTH_ERROR, 500 INTERNAL_ERROR)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 16.1, 16.5_

  - [x] 12.4 Write unit tests for router — `src/tests/router.test.js`
    - Test routing dispatch for all defined endpoints
    - Test OPTIONS preflight returns 200 with empty body
    - Test unknown endpoint returns 404 with available endpoints
    - Test CORS headers on all responses
    - _Requirements: 6.3, 14.1, 14.2, 16.3, 16.5_

  - [x] 12.5 Update `src/tests/index.test.js` for handler integration
    - Remove example validation and view tests
    - Add handler cold-start init test
    - Add end-to-end request flow test (mock external dependencies)
    - _Requirements: 16.1, 16.2_

  - [x] 12.6 Write behavioral parity tests — `src/tests/parity.test.js`
    - Use old-backend mock events from `old-backend/tests/mock-events/` as test inputs
    - Verify converted application produces same response structure and status codes
    - Test RemoteFalconLogBuilder produces identical log structures
    - _Requirements: 16.1, 16.2, 16.6_

- [x] 13. Checkpoint — Verify all unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Write property-based tests
  - [x] 14.1 Write property test for proxy forwarding — `src/tests/proxy.property.test.js`
    - **Property 1: Proxy forwarding preserves path, method, body, and response**
    - Generate random paths, methods, bodies, mock responses; verify proxy strips `/proxy`, forwards correctly, returns response unchanged
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [x] 14.2 Write property test for telemetry validation — `src/tests/telemetry.property.test.js`
    - **Property 3: Valid telemetry produces correct log and response**
    - Generate random valid tracking data; verify 200 response structure and TELEMETRY_EVENT log
    - **Validates: Requirements 3.1, 3.2**
    - **Property 4: Invalid tracking data is rejected with VALIDATION_ERROR**
    - Generate random invalid tracking data; verify 400 VALIDATION_ERROR
    - **Validates: Requirements 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**
    - **Property 5: PII detection in tracking data**
    - Generate random eventData with PII field names; verify rejection
    - **Validates: Requirements 4.6**
    - **Property 12: Tracking data size limit enforcement**
    - Generate random large tracking data; verify rejection at 10KB
    - **Validates: Requirements 4.7**

  - [x] 14.3 Write property test for CORS origin matching — `src/tests/cors.property.test.js`
    - **Property 6: CORS and security headers on all responses**
    - Generate random requests; verify all required headers present
    - **Validates: Requirements 6.1, 6.4**
    - **Property 7: CORS origin matching**
    - Generate random origins and ALLOWED_ORIGINS configs; verify correct matching
    - **Validates: Requirements 6.2, 6.5**
    - **Property 8: OPTIONS preflight returns 200 with empty body**
    - Generate random paths; verify 200, empty body, no side effects
    - **Validates: Requirements 6.3**

  - [x] 14.4 Write property test for logging — `src/tests/logging.property.test.js`
    - **Property 9: Remote Falcon log classification**
    - Generate random response scenarios; verify correct log type classification
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - **Property 10: Log entry PII sanitization**
    - Generate random strings with PII patterns; verify redaction
    - **Validates: Requirements 7.5, 7.6**
    - **Property 11: Unknown endpoints return 404 with available endpoints**
    - Generate random undefined paths; verify 404 structure
    - **Validates: Requirements 14.1**

- [x] 15. Checkpoint — Verify all property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Update documentation
  - [x] 16.1 Update `ARCHITECTURE.md`
    - Reflect new MVC structure with Remote Falcon proxy flow and telemetry endpoint
    - Update directory structure diagram
    - Update application stack diagram to show Remote Falcon API integration
    - Add SSM parameter paths and credential flow
    - _Requirements: 15.1_

  - [x] 16.2 Update `DEPLOYMENT.md`
    - Add instructions for setting up `RemoteFalcon/access-token` and `RemoteFalcon/secret-key` SSM parameters
    - Document `ALLOWED_ORIGINS` and `REMOTE_FALCON_API_BASE_URL` configuration
    - Reference Atlantis pipeline deployment workflow
    - _Requirements: 15.2_

  - [x] 16.3 Update `docs/` directory content
    - Update `docs/admin-ops/README.md` with SSM parameter management and monitoring guidance
    - Update `docs/developer/README.md` with MVC structure, adding endpoints, and testing guide
    - Update `docs/end-user/README.md` with API endpoints, request/response formats
    - _Requirements: 15.3_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples, edge cases, and behavioral parity with old-backend
- Old-backend files in `old-backend/` must NOT be modified (Requirement 17)
- `RemoteFalconLogBuilder.js` is already present in `src/utils/` and reused as-is
- Structured log entries use `console.log` (not `DebugAndLog`) for CloudWatch log filter compatibility
- Credential cache TTL is 12 hours (not 5 minutes as in old-backend)
- JWT cache TTL is 55 minutes (matching old-backend)
- `endpoint.send()` from cache-data replaces raw `fetch` in the DAO
- `ClientRequest` from cache-data replaces the old-backend `ClientInfo` class
