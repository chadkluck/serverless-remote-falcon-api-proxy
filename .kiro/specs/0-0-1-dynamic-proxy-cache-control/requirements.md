# Requirements Document

## Introduction

The proxy endpoint currently returns responses without a `Cache-Control` header, causing clients to cache responses for too long. This feature introduces dynamic `Cache-Control` headers on proxy endpoint responses. The max-age value is determined by the `playingNow` field in the Remote Falcon API response body: short (5 seconds) when a sequence is actively playing, and aligned to the next 5-minute interval boundary when nothing is playing.

## Glossary

- **Proxy_Endpoint**: The set of routes under `/proxy/` that forward requests to the Remote Falcon API and return responses to the client. Handled by ProxyCtrl, ProxySvc, RemoteFalconDao, and ProxyView.
- **ProxyCtrl**: The proxy controller module (`controllers/proxy.controller.js`) that orchestrates proxy request handling and returns `{ statusCode, body }` (and optionally `headers`) to the Router.
- **Router**: The routing module (`routes/index.js`) that dispatches requests to controllers and merges `result.headers` onto the Response object.
- **Cache_Control_Header**: The HTTP `Cache-Control` response header that instructs clients how long to cache a response, expressed as `max-age=<seconds>`.
- **Playing_Now**: A string field at the top level of the Remote Falcon API response body. Non-empty when a sequence is actively playing; empty string or null when nothing is playing.
- **Interval_Boundary**: A clock-aligned point in time at a 5-minute interval (e.g., 08:00, 08:05, 08:10, 08:15, 08:20, 08:25, 08:30). Used to calculate cache expiration when nothing is playing.
- **Max_Age_Seconds**: The number of seconds set in the `Cache-Control: max-age=` directive, representing how long the client should cache the response.
- **Cache_Duration_Calculator**: A pure function that accepts the Playing_Now value and the current time, and returns the appropriate Max_Age_Seconds value.

## Requirements

### Requirement 1: Calculate Cache Duration Based on Playback State

**User Story:** As a client application, I want the proxy response to include a cache duration that reflects the current playback state, so that I see near-real-time updates when a sequence is playing and avoid unnecessary requests when nothing is playing.

#### Acceptance Criteria

1. WHEN Playing_Now is a non-empty string, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value of 5.
2. WHEN Playing_Now is an empty string, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value equal to the number of whole seconds remaining until the next 5-minute Interval_Boundary.
3. WHEN Playing_Now is null, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value equal to the number of whole seconds remaining until the next 5-minute Interval_Boundary.
4. WHEN the current time is exactly on a 5-minute Interval_Boundary and Playing_Now is empty or null, THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value of 300.
5. THE Cache_Duration_Calculator SHALL return a Max_Age_Seconds value that is a positive integer greater than or equal to 1.

### Requirement 2: Set Cache-Control Header on Proxy Responses

**User Story:** As a client application, I want the proxy endpoint to return a `Cache-Control` header with the calculated max-age, so that my HTTP cache layer respects the appropriate caching duration.

#### Acceptance Criteria

1. WHEN the Proxy_Endpoint returns a successful response (HTTP 2xx), THE ProxyCtrl SHALL include a `Cache-Control` header with the value `max-age=<Max_Age_Seconds>` in the result returned to the Router.
2. WHEN the Proxy_Endpoint returns a successful response, THE Router SHALL merge the `Cache-Control` header from `result.headers` onto the Response object.
3. IF the Proxy_Endpoint returns an error response (HTTP 4xx or 5xx from Remote Falcon, or an auth error), THEN THE ProxyCtrl SHALL NOT include a `Cache-Control` header in the result.

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
