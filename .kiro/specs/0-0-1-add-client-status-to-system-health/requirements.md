# Requirements Document

## Introduction

Add a `clientStatus` property to the telemetry endpoint response for `systemHealth` events. The `clientStatus` object echoes back the requesting client's IP address, user agent string, and the validated `eventData` from the request body. This property appears after `remoteFalcon` in the response and only applies to `systemHealth` event types. All other event types remain unchanged.

## Glossary

- **Telemetry_Controller**: The controller module (`telemetry.controller.js`) that orchestrates telemetry request processing, assembles view data, and delegates response formatting to the Telemetry_View.
- **Telemetry_View**: The view module (`telemetry.view.js`) that formats success and error response bodies for the telemetry endpoint.
- **Telemetry_Service**: The service module (`telemetry.service.js`) that validates tracking data including systemHealth eventData structure.
- **Client_Status**: A response object containing `ip`, `userAgent`, and `eventData` fields that echoes back client request information for systemHealth events.
- **System_Health_Event**: A tracking event with `eventType` set to `'systemHealth'` that includes validated `eventData` containing `totalRequests`, `failedRequests`, `errorRate`, and optionally `rateLimitStatus`.
- **Client_Info**: An object provided by the router containing `ipAddress`, `userAgent`, and `host` properties extracted from the incoming HTTP request.
- **View_Data**: The data object assembled by the Telemetry_Controller and passed to the Telemetry_View for response formatting, containing `processingTime`, optional `remoteFalcon`, and optional `clientStatus`.

## Requirements

### Requirement 1: Assemble Client Status Data in Controller

**User Story:** As a client application developer, I want the systemHealth response to include my client's IP, user agent, and submitted event data, so that I can verify what the server received and confirm my client's identity.

#### Acceptance Criteria

1. WHEN the Telemetry_Service returns a successful result and the request `eventType` equals `'systemHealth'`, THE Telemetry_Controller SHALL add a `clientStatus` object to the View_Data containing `ip` from `clientInfo.ipAddress`, `userAgent` from `clientInfo.userAgent`, and `eventData` from the request body.
2. WHEN the request `eventType` does not equal `'systemHealth'`, THE Telemetry_Controller SHALL omit the `clientStatus` property from the View_Data.
3. WHEN the Telemetry_Service returns a validation error, THE Telemetry_Controller SHALL omit the `clientStatus` property from the error response.

### Requirement 2: Format Client Status in View Layer

**User Story:** As a maintainer, I want the clientStatus formatting to live in the view layer alongside remoteFalcon formatting, so that the separation of concerns between controller orchestration and response formatting is preserved.

#### Acceptance Criteria

1. WHEN View_Data contains a `clientStatus` object, THE Telemetry_View SHALL include a `clientStatus` property in the success response body positioned after the `remoteFalcon` property.
2. WHEN View_Data does not contain a `clientStatus` object, THE Telemetry_View SHALL omit the `clientStatus` property from the success response body.
3. THE Telemetry_View SHALL pass through the `clientStatus.eventData` object as-is from the View_Data without modifying, filtering, or adding default values to its contents.

### Requirement 3: Client Status Response Shape

**User Story:** As a client application developer, I want the clientStatus response to follow a predictable structure, so that I can reliably parse and use the echoed data.

#### Acceptance Criteria

1. THE Telemetry_View SHALL format the Client_Status object with exactly three top-level keys: `ip` (string), `userAgent` (string), and `eventData` (object).
2. WHEN the `clientInfo.ipAddress` value is available, THE Telemetry_Controller SHALL pass the IP address as-is to the Client_Status `ip` field without masking or truncation.
3. WHEN the request body `eventData` contains optional fields such as `rateLimitStatus`, THE Telemetry_View SHALL include those fields in the `clientStatus.eventData` response.
4. WHEN the request body `eventData` does not contain optional fields such as `rateLimitStatus`, THE Telemetry_View SHALL omit those fields from the `clientStatus.eventData` response.

### Requirement 4: Non-systemHealth Event Responses Remain Unchanged

**User Story:** As a client application developer, I want non-systemHealth event responses to remain identical to their current format, so that existing client integrations are not disrupted.

#### Acceptance Criteria

1. WHEN the request `eventType` equals `'pageView'`, `'click'`, `'videoPlay'`, `'songRequest'`, `'systemAlert'`, or `'eventFailure'`, THE Telemetry_Controller SHALL produce a response body that does not contain a `clientStatus` property.
2. WHEN the request `eventType` equals `'pageView'`, `'click'`, `'videoPlay'`, or `'songRequest'`, THE Telemetry_View SHALL produce a response body containing only `message`, `timestamp`, and `processingTime` properties.

### Requirement 5: Round-Trip Fidelity of eventData

**User Story:** As a client application developer, I want the echoed eventData to exactly match what I submitted, so that I can use the response for client-side reconciliation.

#### Acceptance Criteria

1. FOR ALL valid System_Health_Event requests, THE Telemetry_Controller SHALL pass the `eventData` from the request body to the Client_Status without adding, removing, or modifying any fields.
2. FOR ALL valid System_Health_Event requests containing extra fields beyond `totalRequests`, `failedRequests`, `errorRate`, and `rateLimitStatus` in the `eventData`, THE Telemetry_View SHALL include those extra fields in the `clientStatus.eventData` response.
