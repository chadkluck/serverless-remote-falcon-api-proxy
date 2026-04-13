# Implementation Plan: Add Client Status to System Health

## Overview

Add a `clientStatus` property to the telemetry endpoint's success response for `systemHealth` events. The controller assembles `clientStatus` from existing `clientInfo` and `body.eventData`, and the view conditionally includes it in the response — following the same pattern as `remoteFalcon`. Changes are limited to `telemetry.controller.js` and `telemetry.view.js` plus their corresponding test files.

## Tasks

- [x] 1. Add clientStatus to the view layer
  - [x] 1.1 Update `successView` in `telemetry.view.js` to conditionally include `clientStatus`
    - Add a conditional block after the existing `remoteFalcon` block: `if (data.clientStatus) { response.clientStatus = data.clientStatus; }`
    - Pass through `clientStatus` as-is with no transformation, filtering, or defaults
    - Update JSDoc for `successView` to document the optional `data.clientStatus` parameter and response property
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 1.2 Add unit tests for clientStatus in `telemetry.view.test.js`
    - Test that `successView` includes `clientStatus` when provided in data
    - Test that `successView` omits `clientStatus` when not provided
    - Test that `clientStatus` has exactly three keys: `ip`, `userAgent`, `eventData`
    - Test that `eventData` is passed through as-is including optional fields like `rateLimitStatus`
    - Test that `eventData` omits optional fields when not provided
    - Test JSON round-trip preserves `clientStatus` structure
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.3, 3.4_

- [x] 2. Checkpoint - Ensure view tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add clientStatus assembly to the controller
  - [x] 3.1 Update `post()` in `telemetry.controller.js` to assemble `clientStatus` for systemHealth events
    - Inside the existing `if (body.eventType === 'systemHealth')` block, after the `remoteFalcon` line, add: `viewData.clientStatus = { ip: clientInfo.ipAddress, userAgent: clientInfo.userAgent, eventData: body.eventData };`
    - Update JSDoc for `post()` to document that systemHealth responses now include `clientStatus`
    - _Requirements: 1.1, 1.2, 1.3, 3.2, 5.1_

  - [x] 3.2 Add unit tests for clientStatus assembly in `telemetry.controller.test.js`
    - Test that `successView` is called with `clientStatus` containing `ip`, `userAgent`, and `eventData` for systemHealth events
    - Test that `clientStatus.ip` matches `clientInfo.ipAddress`
    - Test that `clientStatus.userAgent` matches `clientInfo.userAgent`
    - Test that `clientStatus.eventData` is the same reference as `body.eventData`
    - Test that `clientStatus` is NOT included in `successView` call for non-systemHealth events (pageView, click, etc.)
    - Test that `clientStatus` is NOT included when TelemetrySvc returns a validation error
    - Test that `clientStatus` is NOT included when body is null (parse error path)
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_

- [x] 4. Checkpoint - Ensure all controller and view tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add property-based test for eventData round-trip fidelity
  - [x] 5.1 Write property test for eventData pass-through in `telemetry.property.test.js`
    - Generate arbitrary valid systemHealth eventData objects with `totalRequests`, `failedRequests`, `errorRate`, and optional `rateLimitStatus` plus extra fields
    - Assert that the `clientStatus.eventData` in the view output is identical to the input `body.eventData`
    - Assert that no fields are added, removed, or modified during the controller → view pass-through
    - Use fast-check with `numRuns: 100`
    - **Validates: Requirements 5.1, 5.2**

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Only `telemetry.controller.js` and `telemetry.view.js` are modified — no service layer changes needed
- The `clientStatus` pattern mirrors the existing `remoteFalcon` conditional inclusion pattern
- All tests use Jest with CommonJS modules (`require`/`module.exports`) matching the existing test conventions
- Property tests use fast-check, consistent with the existing `telemetry.property.test.js` patterns
