# Implementation Plan: Logging Updates

## Overview

Migrate all structured application logging from direct `console.log`, `console.error`, and `console.warn` calls to the `DebugAndLog` utility from `@63klabs/cache-data` across three modules: `RemoteFalcon.dao.js`, `telemetry.service.js`, and `routes/index.js`. Update property-based tests and add per-log-type CloudWatch Log Insights query examples to admin-ops documentation.

## Tasks

- [x] 1. Migrate RemoteFalcon.dao.js logging to DebugAndLog
  - [x] 1.1 Add DebugAndLog import and migrate REMOTE_FALCON_REQUEST and REMOTE_FALCON_ERROR logging
    - Import `DebugAndLog` from `@63klabs/cache-data` in `application-infrastructure/src/models/RemoteFalcon.dao.js`
    - Replace `console.log(\`REMOTE_FALCON_REQUEST: ...\`)` with `DebugAndLog.log("Remote Falcon request succeeded", "REMOTE_FALCON_REQUEST", successLog)`
    - Replace `console.log(\`REMOTE_FALCON_ERROR: ...\`)` with `DebugAndLog.error(\`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}\`, errorLog)` for HTTP errors, application-level errors, and network errors
    - Remove the supplementary `console.error("Failed to forward request to Remote Falcon:", error)` call in the network error catch block (covered by the DebugAndLog.error call)
    - Ensure all structured log entry fields (timestamp, requestId, logType, status, request details, response/error details) are preserved in the object parameter
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 8.2, 9.1, 9.2, 11.1, 11.2_

  - [x] 1.2 Write property test for Property 1: Successful Remote Falcon requests use DebugAndLog
    - **Property 1: Successful Remote Falcon requests use DebugAndLog with preserved structure**
    - Mock `DebugAndLog.log` and spy on `console.log` to verify it is NOT called
    - Generate random valid HTTP 2xx statuses and response data using fast-check
    - Assert `DebugAndLog.log` is called with tag `"REMOTE_FALCON_REQUEST"` and structured object containing timestamp, requestId, logType, status, request details, and response details
    - Update existing tests in `application-infrastructure/src/tests/logging.property.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 1.1, 1.2, 9.1**

  - [x] 1.3 Write property test for Property 2: Failed Remote Falcon requests use DebugAndLog.error
    - **Property 2: Failed Remote Falcon requests use DebugAndLog.error with preserved structure**
    - Mock `DebugAndLog.error` and spy on `console.log`/`console.error` to verify they are NOT called
    - Generate random HTTP 4xx/5xx statuses and application-level error responses using fast-check
    - Assert `DebugAndLog.error` is called with a message containing `"REMOTE_FALCON_ERROR:"` and structured object containing timestamp, requestId, logType, status, request details, and error details
    - Update existing tests in `application-infrastructure/src/tests/logging.property.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 2.1, 2.2, 2.5, 9.2**

- [x] 2. Checkpoint - Verify RemoteFalcon.dao.js migration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Migrate telemetry.service.js logging to DebugAndLog
  - [x] 3.1 Add DebugAndLog import and migrate TELEMETRY_EVENT and TELEMETRY_METRICS logging
    - Import `DebugAndLog` from `@63klabs/cache-data` in `application-infrastructure/src/services/telemetry.service.js`
    - Replace `console.log('TELEMETRY_EVENT:', JSON.stringify(logEntry))` with `DebugAndLog.log("Telemetry event received", "TELEMETRY_EVENT", logEntry)`
    - Replace `console.log('TELEMETRY_METRICS:', JSON.stringify({...}))` with `DebugAndLog.log("Telemetry metrics", "TELEMETRY_METRICS", metricsObj)`
    - Ensure all structured log entry fields are preserved: TELEMETRY_EVENT (timestamp, eventType, ipAddress, userAgent, host, url, eventData, processingTime, requestId) and TELEMETRY_METRICS (timestamp, eventType, processingTime, success, requestId)
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 8.1, 9.3, 9.4, 11.3_

  - [x] 3.2 Write property test for Property 3: Valid telemetry events use DebugAndLog for both event and metrics
    - **Property 3: Valid telemetry events use DebugAndLog with preserved structure for both event and metrics**
    - Mock `DebugAndLog.log` and spy on `console.log` to verify it is NOT called
    - Generate random valid telemetry events (various eventTypes, URLs, eventData) using fast-check
    - Assert `DebugAndLog.log` is called twice: once with tag `"TELEMETRY_EVENT"` and full event log entry, once with tag `"TELEMETRY_METRICS"` and metrics object
    - Add tests to `application-infrastructure/src/tests/logging.property.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 3.1, 3.2, 4.1, 4.2, 9.3, 9.4**

- [x] 4. Checkpoint - Verify telemetry.service.js migration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Migrate routes/index.js logging to DebugAndLog
  - [x] 5.1 Migrate REQUEST_METRICS, LAMBDA_ERROR, and unknown endpoint warning logging
    - DebugAndLog is already imported in `application-infrastructure/src/routes/index.js` — no new import needed
    - Replace `console.warn("Unknown endpoint requested:", JSON.stringify({...}))` with `DebugAndLog.warn("Unknown endpoint requested", { path, method, requestId })`
    - Replace all three `console.log("REQUEST_METRICS:", JSON.stringify({...}))` calls (success, 404, error) with `DebugAndLog.log("Request metrics", "REQUEST_METRICS", {...})`
    - Replace `console.error("LAMBDA_ERROR:", JSON.stringify({...}))` with `DebugAndLog.error("LAMBDA_ERROR: Unhandled error during request processing", {...})`
    - Ensure all structured log entry fields are preserved: REQUEST_METRICS (requestId, timestamp, method, path, statusCode, processingTime, totalTime, success) and LAMBDA_ERROR (requestId, timestamp, error details, request context, totalTime)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 7.1, 7.2, 8.3, 9.5, 9.6, 11.4, 11.5, 11.6_

  - [x] 5.2 Write property test for Property 4: All request outcomes log REQUEST_METRICS via DebugAndLog
    - **Property 4: All request outcomes log REQUEST_METRICS via DebugAndLog with preserved structure**
    - Mock `DebugAndLog.log` and spy on `console.log` to verify it is NOT called for REQUEST_METRICS entries
    - Generate random request scenarios (successful routes, unknown paths returning 404, error-throwing controllers) using fast-check
    - Assert `DebugAndLog.log` is called with tag `"REQUEST_METRICS"` and structured object containing requestId, timestamp, method, path, statusCode, processingTime, totalTime, and success
    - Add tests to `application-infrastructure/src/tests/logging.property.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 9.5**

  - [x] 5.3 Write property test for Property 5: Unhandled errors use DebugAndLog.error
    - **Property 5: Unhandled errors use DebugAndLog.error with preserved structure**
    - Mock `DebugAndLog.error` and spy on `console.error` to verify it is NOT called
    - Generate random error types and request contexts using fast-check
    - Assert `DebugAndLog.error` is called with a descriptive message and structured object containing requestId, timestamp, error details (message, name, stack), request context (method, path, origin, userAgent), and totalTime
    - Add tests to `application-infrastructure/src/tests/logging.property.test.js`
    - Minimum 100 iterations
    - **Validates: Requirements 6.1, 6.2, 9.6**

  - [x] 5.4 Write property test for Property 6: Unknown endpoints use DebugAndLog.warn
    - **Property 6: Unknown endpoints use DebugAndLog.warn**
    - Mock `DebugAndLog.warn` and spy on `console.warn` to verify it is NOT called
    - Generate random unknown endpoint paths and methods using fast-check
    - Assert `DebugAndLog.warn` is called with a descriptive message and object containing path, method, and requestId
    - Update existing Property 11 test in `application-infrastructure/src/tests/logging.property.test.js` to verify DebugAndLog.warn usage instead of console.warn
    - Minimum 100 iterations
    - **Validates: Requirements 7.1, 7.2**

- [x] 6. Checkpoint - Verify routes/index.js migration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update admin-ops documentation with per-log-type CloudWatch Log Insights queries
  - Add a note to `docs/admin-ops/README.md` that log entries now follow the `[TAG] message | obj` format produced by DebugAndLog
  - Add example Log Insights queries for each log type: REMOTE_FALCON_REQUEST, REMOTE_FALCON_ERROR, TELEMETRY_EVENT, TELEMETRY_METRICS, REQUEST_METRICS, LAMBDA_ERROR
  - Each query should demonstrate filtering by the tag format and parsing structured fields
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each module migration
- Property tests validate universal correctness properties from the design document
- The existing `logging.property.test.js` file will be updated with new/modified property tests for the DebugAndLog migration
- DebugAndLog is already imported in `routes/index.js`; only `RemoteFalcon.dao.js` and `telemetry.service.js` need new imports
- All structured log entry fields are preserved — only the transport mechanism changes from `console.*` to `DebugAndLog.*`
