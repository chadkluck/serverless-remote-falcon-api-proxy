# Implementation Plan: Dynamic Proxy Cache-Control

## Overview

Add dynamic `Cache-Control` response headers to the proxy endpoint. A new pure utility module (`utils/cache-control.js`) provides the cache duration calculation and header formatting. The proxy controller is modified to attach the header on 2xx responses. All tests use Jest with fast-check for property-based testing.

## Tasks

- [x] 1. Create the cache-control utility module
  - [x] 1.1 Create `application-infrastructure/src/utils/cache-control.js` with three exported functions: `calculateCacheDuration`, `formatCacheControlHeader`, `parseCacheControlHeader`
    - `calculateCacheDuration(playingNow, now)` returns 5 when `playingNow` is a non-empty string; otherwise returns whole seconds until the next 5-minute interval boundary, clamped to 1–300
    - `formatCacheControlHeader(maxAgeSeconds)` returns `"max-age=<integer>"`
    - `parseCacheControlHeader(headerValue)` extracts the integer from `"max-age=<integer>"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [x] 1.2 Export the new module from `application-infrastructure/src/utils/index.js`
    - Add `const cacheControl = require('./cache-control.js');` and include `cacheControl` in `module.exports`
    - _Requirements: 2.1_

  - [x] 1.3 Write unit tests for cache-control utility in `application-infrastructure/src/tests/cache-control.test.js`
    - Test `calculateCacheDuration` with playingNow as non-empty string → returns 5
    - Test `calculateCacheDuration` with empty string and null at various times (e.g., 08:01:30 → 210, 08:04:59 → 1, 08:05:00 → 300, 08:02:00 → 180)
    - Test `formatCacheControlHeader` produces correct `"max-age=N"` string
    - Test `parseCacheControlHeader` extracts integer from header string
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.4, 4.1, 4.2_

- [x] 2. Checkpoint - Verify cache-control utility
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Integrate Cache-Control header into proxy controller
  - [x] 3.1 Modify `application-infrastructure/src/controllers/proxy.controller.js` to add Cache-Control header on 2xx responses
    - Import `calculateCacheDuration` and `formatCacheControlHeader` from `../utils`
    - In the `forward` function, after receiving the result from `ProxySvc`, check if `result.statusCode` is 2xx
    - If 2xx, call `calculateCacheDuration(result.body?.playingNow, new Date())` and `formatCacheControlHeader(maxAge)`, then return `headers: { "Cache-Control": headerValue }` alongside `statusCode` and `body`
    - For non-2xx responses and auth errors, return without a `Cache-Control` header (existing behavior)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Write unit tests for proxy controller Cache-Control integration in `application-infrastructure/src/tests/cache-control.controller.test.js`
    - Test that 2xx responses include a `Cache-Control` header with `max-age=` value
    - Test that 4xx/5xx responses from Remote Falcon do not include a `Cache-Control` header
    - Test that auth error responses (credential failure) do not include a `Cache-Control` header
    - Mock `ProxySvc.forwardToRemoteFalcon` and the cache-control utility functions
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Checkpoint - Verify controller integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Write property-based tests for cache-control
  - [x] 5.1 Write property test for deterministic output and range bounds
    - **Property 1: For all valid inputs, calculateCacheDuration returns an integer between 1 and 300 inclusive**
    - Generate arbitrary `playingNow` values (non-empty strings, empty string, null) and arbitrary `Date` objects
    - Assert the return value is always an integer in [1, 300]
    - **Validates: Requirements 3.2, 3.4**

  - [x] 5.2 Write property test for active playback constant
    - **Property 2: For all non-empty playingNow strings and any Date, calculateCacheDuration returns exactly 5**
    - Generate arbitrary non-empty strings and arbitrary `Date` objects
    - Assert the return value is always 5
    - **Validates: Requirements 1.1**

  - [x] 5.3 Write property test for monotonic decrease within interval
    - **Property 3: For two times within the same 5-minute interval where playingNow is empty/null, the earlier time produces a max-age >= the later time's max-age**
    - Generate a base time and two offsets within the same 5-minute window
    - Assert `calculateCacheDuration(null, earlier) >= calculateCacheDuration(null, later)`
    - **Validates: Requirements 3.5**

  - [x] 5.4 Write property test for round-trip consistency
    - **Property 4: For all integers in [1, 300], formatting then parsing produces the original integer**
    - Generate arbitrary integers in [1, 300]
    - Assert `parseCacheControlHeader(formatCacheControlHeader(n)) === n`
    - **Validates: Requirements 4.3**

  - All property tests go in `application-infrastructure/src/tests/cache-control.property.test.js`
  - Use `fast-check` with minimum 100 runs per property

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- The Router already merges `result.headers` onto the Response — no Router changes needed
