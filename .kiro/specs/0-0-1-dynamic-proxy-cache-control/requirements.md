# Requirements Document

## Introduction

The proxy endpoint currently returns responses without a `Cache-Control` header, causing clients to cache responses for too long. This feature introduces dynamic `Cache-Control` and `Expires` headers on proxy endpoint responses. The max-age value is determined by the `playingNow` field in the Remote Falcon API response body: short (5 seconds) when a sequence is actively playing, and aligned to the next 5-minute interval boundary when nothing is playing. The `Expires` header provides the same expiration as an absolute UTC timestamp in HTTP-date format, making the interval alignment explicit for clients and CDNs.

## Glossary

- **Proxy_Endpoint**: The set of routes under `/proxy/` that forward requests to the Remote Falcon API and return responses to the client. Handled by ProxyCtrl, ProxySvc, RemoteFalconDao, and ProxyView.
- **ProxyCtrl**: The proxy controller module (`controllers/proxy.controller.js`) that orchestrates proxy request handling and returns `{ statusCode, body }` (and optionally `headers`) to the Router.
- **Router**: The routing module (`routes/index.js`) that dispatches requests to controllers and merges `result.headers` onto the Response object.
- **Cache_Control_Header**: The HTTP `Cache-Control` response header that instructs clients how long to cache a response, expressed as `max-age=<seconds>`.
- **Playing_Now**: A string field at the top level of the Remote Falcon API response body. Non-empty when a sequence is actively playing; empty string or null when nothing is playing.
- **Interval_Boundary**: A clock-aligned point in time at a 5-minute interval (e.g., 08:00, 08:05, 08:10, 08:15, 08:20, 08:25, 08:30). Used to calculate cache expiration when nothing is playing.
- **Max_Age_Seconds**: The number of seconds set in the `Cache-Control: max-age=` directive, representing how long the client should cache the response.
- **Cache_Duration_Calculator**: A pure function that accepts the Playing_Now value and the current time, and returns the appropriate Max_Age_Seconds value.
- **Expires_Header**: The HTTP `Expires` response header that provides an absolute UTC timestamp indicating when the response becomes stale, formatted as an HTTP-date per RFC 7234 (e.g., `Thu, 01 Jan 2025 08:05:00 GMT`).
- **Expiration_Timestamp_Calculator**: A pure function that accepts the Playing_Now value and the current time, and returns the absolute Date representing when the response expires.

## Requirements

### Requirement 1: Calculate Cache Duration Based on Playback State

**User Story:** As a client application, I want the proxy response to include a cache duration that reflects the current playback state, so that I see near-real-time updates when a sequence is playing and avoid unnecessary requests when nothing is playing.

#### Acceptance Criteria

1. WHEN Playing_Now is a non-empty string, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value of 5.
2. WHEN Playing_Now is an empty string, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value equal to the number of whole seconds remaining until the next 5-minute Interval_Boundary.
3. WHEN Playing_Now is null, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value equal to the number of whole seconds remaining until the next 5-minute Interval_Boundary.
4. WHEN the current time is exactly on a 5-minute Interval_Boundary and Playing_Now is empty or null, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value of 300.
5. THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value that is a positive integer greater than or equal to 1.

### Requirement 2: Set Cache-Control and Expires Headers on Proxy Responses

**User Story:** As a client application, I want the proxy endpoint to return both a `Cache-Control` header with the calculated max-age and an `Expires` header with the absolute expiration timestamp, so that my HTTP cache layer and CDN respect the appropriate caching duration using either relative or absolute expiration.

#### Acceptance Criteria

1. WHEN the Proxy_Endpoint returns a successful response (HTTP 2xx), THE ProxyCtrl SHALL include a `Cache-Control` header with the value `max-age=<Max_Age_Seconds>` in the result returned to the Router.
2. WHEN the Proxy_Endpoint returns a successful response (HTTP 2xx), THE ProxyCtrl SHALL include an `Expires` header with the value of the Expiration_Timestamp formatted as an HTTP-date in the result returned to the Router.
3. WHEN the Proxy_Endpoint returns a successful response, THE Router SHALL merge both the `Cache-Control` and `Expires` headers from `result.headers` onto the Response object.
4. IF the Proxy_Endpoint returns an error response (HTTP 4xx or 5xx from Remote Falcon, or an auth error), THEN THE ProxyCtrl SHALL NOT include a `Cache-Control` header in the result.
5. IF the Proxy_Endpoint returns an error response (HTTP 4xx or 5xx from Remote Falcon, or an auth error), THEN THE ProxyCtrl SHALL NOT include an `Expires` header in the result.

### Requirement 3: Cache Duration Calculator is a Pure Function

**User Story:** As a developer, I want the cache duration calculation to be a pure, testable function, so that I can verify its correctness with property-based tests.

#### Acceptance Criteria

1. THE Cache_Duration_Calculator SHALL accept exactly two parameters: the Playing_Now value (string or null) and the current time (Date object).
2. THE Cache_Duration_Calculator SHALL produce the same Max_Age_Seconds output for the same Playing_Now value and current time input (deterministic).
3. THE Cache_Duration_Calculator SHALL have no side effects and SHALL NOT depend on global state.
4. FOR ALL valid inputs, THE Cache_Duration_Calculator SHALL return an integer between 1 and 300 inclusive.
5. FOR ALL times within the same 5-minute interval where Playing_Now is empty or null, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value that decreases as the current time approaches the next Interval_Boundary.

### Requirement 4: Pretty-Print and Round-Trip for Cache-Control Header Value

**User Story:** As a developer, I want to parse and format Cache-Control header values, so that I can verify round-trip correctness of the header.

#### Acceptance Criteria

1. THE Cache_Control_Header formatter SHALL produce a string in the format `max-age=<integer>` given a Max_Age_Seconds integer.
2. THE Cache_Control_Header parser SHALL extract the integer Max_Age_Seconds from a string in the format `max-age=<integer>`.
3. FOR ALL Max_Age_Seconds integers between 1 and 300 inclusive, formatting then parsing SHALL produce the original integer (round-trip property).

### Requirement 5: Calculate Absolute Expiration Timestamp Based on Playback State

**User Story:** As a client application, I want the proxy response to include an absolute expiration timestamp, so that I can see exactly when the cached response becomes stale without computing it from a relative max-age.

#### Acceptance Criteria

1. WHEN Playing_Now is empty or null, THE Expiration_Timestamp_Calculator SHALL return a Date equal to the next 5-minute Interval_Boundary after the current time.
2. WHEN Playing_Now is empty or null and the current time is exactly on a 5-minute Interval_Boundary, THE Expiration_Timestamp_Calculator SHALL return a Date equal to the current time plus 300 seconds.
3. WHEN Playing_Now is a non-empty string, THE Expiration_Timestamp_Calculator SHALL return a Date equal to the current time plus 5 seconds.
4. THE Expiration_Timestamp_Calculator SHALL return a valid Date object for all valid inputs.

### Requirement 6: Expiration Timestamp Calculator is a Pure Function

**User Story:** As a developer, I want the expiration timestamp calculation to be a pure, testable function, so that I can verify its correctness with property-based tests.

#### Acceptance Criteria

1. THE Expiration_Timestamp_Calculator SHALL accept exactly two parameters: the Playing_Now value (string or null) and the current time (Date object).
2. THE Expiration_Timestamp_Calculator SHALL produce the same Date output for the same Playing_Now value and current time input (deterministic).
3. THE Expiration_Timestamp_Calculator SHALL have no side effects and SHALL NOT depend on global state.
4. FOR ALL valid inputs where Playing_Now is empty or null, THE Expiration_Timestamp_Calculator SHALL return a Date whose minutes are a multiple of 5 and whose seconds are 0.
5. FOR ALL valid inputs, THE Expiration_Timestamp_Calculator SHALL return a Date that is strictly after the current time.

### Requirement 7: Format and Parse Expires Header Value

**User Story:** As a developer, I want to format and parse Expires header values in HTTP-date format, so that I can verify round-trip correctness of the header.

#### Acceptance Criteria

1. THE Expires_Header formatter SHALL produce a string in HTTP-date format per RFC 7234 (e.g., `Thu, 01 Jan 2025 08:05:00 GMT`) given a Date object.
2. THE Expires_Header parser SHALL extract a Date object from a string in HTTP-date format.
3. FOR ALL valid Date objects, formatting then parsing SHALL produce a Date with the same value truncated to whole seconds (round-trip property).

### Requirement 8: Consistency Between Cache-Control and Expires Headers

**User Story:** As a client application, I want the `Cache-Control: max-age` and `Expires` headers to agree on the same expiration moment, so that caching behavior is predictable regardless of which header my cache layer uses.

#### Acceptance Criteria

1. FOR ALL valid inputs where Playing_Now is empty or null, the Expiration_Timestamp returned by the Expiration_Timestamp_Calculator SHALL equal the current time plus the Max_Age_Seconds returned by the Cache_Duration_Calculator for the same inputs.
2. FOR ALL valid inputs where Playing_Now is a non-empty string, the Expiration_Timestamp returned by the Expiration_Timestamp_Calculator SHALL equal the current time plus 5 seconds.
