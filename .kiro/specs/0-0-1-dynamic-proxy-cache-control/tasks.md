# Implementation Plan: Dynamic Proxy Cache-Control

## Overview

Add dynamic `Cache-Control` and `Expires` response headers to the proxy endpoint. The utility module (`utils/cache-control.js`) provides cache duration calculation, expiration date calculation, and header formatting/parsing. The proxy controller attaches both headers on 2xx responses. All tests use Jest with fast-check for property-based testing.

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

- [x] 7. Add Expires header utility functions
  - [x] 7.1 Add `calculateExpirationDate(playingNow, now)` to `application-infrastructure/src/utils/cache-control.js`
    - When `playingNow` is a non-empty string, return `new Date(now.getTime() + 5000)` (now + 5 seconds)
    - When `playingNow` is empty or null, compute the next 5-minute interval boundary and return it as a Date
    - When on an exact boundary, return now + 300 seconds (the next boundary)
    - Guard against invalid Date input (NaN) — return a fallback Date 300 seconds in the future
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 7.2 Add `formatExpiresHeader(date)` to `application-infrastructure/src/utils/cache-control.js`
    - Format a Date as HTTP-date per RFC 7234: `<day-name>, <DD> <Mon> <YYYY> <HH>:<MM>:<SS> GMT`
    - Use `date.toUTCString()` which produces the correct format in Node.js
    - _Requirements: 7.1_

  - [x] 7.3 Add `parseExpiresHeader(headerValue)` to `application-infrastructure/src/utils/cache-control.js`
    - Parse an HTTP-date string and return a Date object
    - Use `new Date(headerValue)` which handles RFC 7234 format
    - _Requirements: 7.2_

  - [x] 7.4 Export the three new functions from `application-infrastructure/src/utils/cache-control.js`
    - Add `calculateExpirationDate`, `formatExpiresHeader`, `parseExpiresHeader` to `module.exports`
    - _Requirements: 5.1, 7.1, 7.2_

  - [x] 7.5 Write unit tests for Expires utility functions in `application-infrastructure/src/tests/cache-control.test.js`
    - Test `calculateExpirationDate` with non-empty playingNow → returns now + 5s
    - Test `calculateExpirationDate` with empty string at 08:01:30 → returns 08:05:00
    - Test `calculateExpirationDate` with null at 08:04:59 → returns 08:05:00
    - Test `calculateExpirationDate` with empty string at 08:05:00 (on boundary) → returns 08:10:00
    - Test `calculateExpirationDate` with null at 08:02:00 → returns 08:05:00
    - Test `formatExpiresHeader` produces correct HTTP-date string
    - Test `parseExpiresHeader` extracts correct Date from HTTP-date string
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3_

- [x] 8. Checkpoint - Verify Expires utility functions
  - Run `npx jest cache-control.test` and ensure all tests pass, ask the user if questions arise.

- [x] 9. Integrate Expires header into proxy controller
  - [x] 9.1 Modify `application-infrastructure/src/controllers/proxy.controller.js` to add Expires header on 2xx responses
    - Import `calculateExpirationDate` and `formatExpiresHeader` from `../utils` (via `cacheControl`)
    - Capture `const now = new Date()` once before calling both calculation functions
    - Call `calculateExpirationDate(result.body?.playingNow, now)` and `formatExpiresHeader(expirationDate)`
    - Add `"Expires": expiresHeaderValue` alongside the existing `"Cache-Control"` header in `result.headers`
    - For non-2xx responses and auth errors, continue returning without any cache headers
    - _Requirements: 2.2, 2.3, 2.5, 8.1, 8.2_

  - [x] 9.2 Update controller unit tests in `application-infrastructure/src/tests/cache-control.controller.test.js`
    - Update mocks to include `calculateExpirationDate` and `formatExpiresHeader`
    - Test that 2xx responses include both `Cache-Control` and `Expires` headers
    - Test that 4xx/5xx responses include neither `Cache-Control` nor `Expires` headers
    - Test that auth error responses include neither header
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 10. Checkpoint - Verify controller integration with Expires header
  - Run `npx jest cache-control.controller.test` and ensure all tests pass, ask the user if questions arise.

- [x] 11. Write property-based tests for Expires header
  - [x] 11.1 Write property test for non-playing expiration boundary alignment
    - **Property 5: For any Date and empty/null playingNow, calculateExpirationDate returns a Date with minutes % 5 === 0, seconds === 0, strictly after now, and at most 300 seconds after now**
    - Generate arbitrary Dates and empty/null playingNow values
    - Assert the returned Date has UTC minutes divisible by 5, UTC seconds of 0, is after now, and within 300s of now
    - **Validates: Requirements 5.1, 5.2, 5.4, 6.4**

  - [x] 11.2 Write property test for expiration always in the future
    - **Property 6: For any valid playingNow and any Date, calculateExpirationDate returns a Date strictly after now**
    - Generate arbitrary playingNow values (non-empty strings, empty string, null) and arbitrary Dates
    - Assert `result.getTime() > now.getTime()`
    - **Validates: Requirements 5.4, 6.5**

  - [x] 11.3 Write property test for Expires header round-trip
    - **Property 7: For any valid Date, formatting then parsing produces a Date with the same value truncated to whole seconds**
    - Generate arbitrary Dates
    - Assert `parseExpiresHeader(formatExpiresHeader(date)).getTime() === Math.floor(date.getTime() / 1000) * 1000`
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 11.4 Write property test for Cache-Control and Expires consistency
    - **Property 8: For any valid playingNow and any Date, calculateExpirationDate(pn, now) equals now + calculateCacheDuration(pn, now) seconds**
    - Generate arbitrary playingNow values and arbitrary Dates
    - Assert `calculateExpirationDate(pn, now).getTime() === now.getTime() + calculateCacheDuration(pn, now) * 1000`
    - **Validates: Requirements 8.1, 8.2**

  - All new property tests go in `application-infrastructure/src/tests/cache-control.property.test.js`
  - Use `fast-check` with minimum 100 runs per property

- [x] 12. Final checkpoint - Ensure all tests pass
  - Run `npx jest --testPathPattern cache-control` and ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks 1–6 are complete (Cache-Control header implementation)
- Tasks 7–12 cover the new Expires header implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design (Properties 5–8)
- Unit tests validate specific examples and edge cases
- The Router already merges `result.headers` onto the Response — no Router changes needed
- The controller captures `new Date()` once and passes it to both calculation functions for consistency
