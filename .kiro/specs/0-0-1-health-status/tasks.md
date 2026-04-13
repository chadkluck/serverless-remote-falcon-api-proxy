# Implementation Plan: Health Status

## Overview

Add Remote Falcon connectivity checking to the `POST /telemetry` endpoint for `systemHealth` events. Introduces a new `HealthCheckSvc` service that wraps `ProxySvc.forwardToRemoteFalcon()` with a 5-second timeout and never-throw semantics. The controller orchestrates the health check after successful telemetry processing, and the view conditionally includes the `remoteFalcon` sub-object in the response.

## Tasks

- [x] 1. Create HealthCheckSvc service
  - [x] 1.1 Create `services/health-check.service.js` with `checkRemoteFalcon(clientInfo, requestId)`
    - Import `ProxySvc` from `../services/proxy.service`
    - Define `HEALTH_CHECK_TIMEOUT_MS = 5000` constant
    - Implement `checkRemoteFalcon` that calls `ProxySvc.forwardToRemoteFalcon('/showDetails', 'GET', null, clientInfo, requestId)` wrapped with `AbortController` or `Promise.race` for timeout enforcement
    - On success (2xx): return `{ isConnected: true, statusCode, viewerControlEnabled, viewerControlMode, playingNow, playingNext }` extracted from the response body
    - On HTTP error (4xx/5xx): return `{ isConnected: false, statusCode, error: descriptive message }`
    - On network error: return `{ isConnected: false, statusCode: 0, error: descriptive message }`
    - On timeout: return `{ isConnected: false, statusCode: 0, error: timeout message }`
    - Function must never throw — wrap entire body in try/catch
    - Include full JSDoc documentation per project standards
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [x] 1.2 Update `services/index.js` to export `HealthCheckSvc`
    - Add `const HealthCheckSvc = require("./health-check.service");`
    - Add `HealthCheckSvc` to `module.exports`
    - _Requirements: 1.1_

  - [x] 1.3 Write unit tests for HealthCheckSvc in `tests/health-check.service.test.js`
    - Mock `ProxySvc.forwardToRemoteFalcon` for all test cases
    - Test success path: 2xx response returns `isConnected: true` with extracted fields
    - Test HTTP error path: 4xx/5xx returns `isConnected: false` with statusCode and error
    - Test network error path: thrown error returns `isConnected: false`, statusCode 0, error message
    - Test timeout path: slow response returns `isConnected: false`, statusCode 0, timeout error
    - Test that success response never includes `error` field
    - Test that failure response never includes `viewerControlEnabled`, `viewerControlMode`, `playingNow`, `playingNext`
    - Test field extraction from nested `preferences` object
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Modify TelemetryView to support remoteFalcon sub-object
  - [x] 3.1 Update `views/telemetry.view.js` `successView` to accept optional `remoteFalcon` in data
    - When `data.remoteFalcon` is present, include it in the response object
    - When `data.remoteFalcon` is absent, response remains unchanged (no `remoteFalcon` key)
    - Update JSDoc to document the new optional parameter and return shape
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 3.2 Write unit tests for updated TelemetryView in `tests/telemetry.view.test.js`
    - Test `successView` without `remoteFalcon` — response has `message`, `timestamp`, `processingTime` only
    - Test `successView` with `remoteFalcon` — response includes `remoteFalcon` sub-object
    - Test round-trip: `JSON.parse(JSON.stringify(successView({...})))` produces object with `remoteFalcon.isConnected` boolean
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Modify TelemetryCtrl to orchestrate health check
  - [x] 4.1 Update `controllers/telemetry.controller.js` `post()` to call HealthCheckSvc for systemHealth events
    - Import `HealthCheckSvc` from `../services`
    - After `TelemetrySvc.processTracking()` returns 200, check if `body.eventType === 'systemHealth'`
    - If systemHealth: call `HealthCheckSvc.checkRemoteFalcon(clientInfo, requestId)` and pass result as `remoteFalcon` to `TelemetryView.successView()`
    - If not systemHealth: pass data to `TelemetryView.successView()` without `remoteFalcon`
    - Update JSDoc to document the new behavior
    - _Requirements: 1.1, 1.2, 1.5, 5.1, 5.2_

  - [x] 4.2 Write unit tests for updated TelemetryCtrl in `tests/telemetry.controller.test.js`
    - Mock `TelemetrySvc.processTracking`, `HealthCheckSvc.checkRemoteFalcon`, and `TelemetryView.successView`
    - Test systemHealth event: verify `HealthCheckSvc.checkRemoteFalcon` is called and result passed to view
    - Test non-systemHealth event (e.g., pageView): verify `HealthCheckSvc.checkRemoteFalcon` is NOT called
    - Test that `clientInfo` and `requestId` are passed correctly to `checkRemoteFalcon`
    - Test 400 error path remains unchanged (invalid body, validation error)
    - _Requirements: 1.1, 1.2, 1.5, 5.1, 5.2_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design has no Correctness Properties section, so property-based tests are not included
- All new test files use Jest (`.test.js`) per project conventions
- `HealthCheckSvc` never throws — all error paths return a structured failure object
