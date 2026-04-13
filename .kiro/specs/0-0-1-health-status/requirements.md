# Requirements Document

## Introduction

This feature enhances the `POST /telemetry` endpoint so that `systemHealth` events include a Remote Falcon connectivity check in the response. When a `systemHealth` telemetry event is processed, the system contacts the Remote Falcon External API via the existing `GET /showDetails` endpoint and returns a `remoteFalcon` sub-object in the response body. The sub-object contains a boolean connectivity flag and lightweight metadata from Remote Falcon (excluding songs, music, and playlists). No backwards compatibility is required.

## Glossary

- **Telemetry_Endpoint**: The `POST /telemetry` API Gateway endpoint that receives and processes telemetry events from the frontend application.
- **Telemetry_Service**: The service layer (`TelemetrySvc`) responsible for validating and processing telemetry tracking data.
- **Telemetry_Controller**: The controller layer (`TelemetryCtrl`) that coordinates request parsing, service delegation, and response formatting for the telemetry endpoint.
- **Telemetry_View**: The view layer (`TelemetryView`) responsible for formatting telemetry success and error response bodies.
- **Health_Check_Service**: A new service component responsible for performing the Remote Falcon connectivity check during `systemHealth` event processing.
- **Remote_Falcon_Api**: The Remote Falcon External API at `https://remotefalcon.com/remote-falcon-external-api`, accessed via JWT-authenticated HTTP requests.
- **Show_Details_Endpoint**: The `GET /showDetails` endpoint on the Remote Falcon External API that returns show preferences, sequences, and playback status.
- **Proxy_Service**: The existing service (`ProxySvc`) that handles JWT authentication and request forwarding to the Remote Falcon External API.
- **Remote_Falcon_Dao**: The data access object (`RemoteFalconDao`) that executes authenticated HTTP requests to the Remote Falcon External API.
- **Remote_Falcon_Status**: The `remoteFalcon` sub-object included in the `systemHealth` telemetry response, containing connectivity and metadata fields.
- **System_Health_Event**: A telemetry event with `eventType` set to `systemHealth`, containing `totalRequests`, `failedRequests`, `errorRate`, and optional `rateLimitStatus` in its `eventData`.

## Requirements

### Requirement 1: Remote Falcon Connectivity Check on System Health Events

**User Story:** As a system operator, I want the telemetry health response to include Remote Falcon connectivity status, so that I can monitor whether the application can successfully communicate with the Remote Falcon service.

#### Acceptance Criteria

1. WHEN a valid `systemHealth` telemetry event is received, THE Health_Check_Service SHALL contact the Show_Details_Endpoint via the Proxy_Service to determine Remote Falcon connectivity.
2. WHEN a valid `systemHealth` telemetry event is received, THE Telemetry_Endpoint SHALL include a `remoteFalcon` sub-object of type Remote_Falcon_Status in the response body alongside the existing `message`, `timestamp`, and `processingTime` fields.
3. WHEN the Show_Details_Endpoint returns an HTTP status code in the range 200–299, THE Health_Check_Service SHALL report `isConnected` as `true` in the Remote_Falcon_Status.
4. WHEN the Show_Details_Endpoint returns an HTTP status code of 400 or greater, THE Health_Check_Service SHALL report `isConnected` as `false` in the Remote_Falcon_Status.
5. WHEN a telemetry event with an `eventType` other than `systemHealth` is received, THE Telemetry_Endpoint SHALL return the response without a `remoteFalcon` sub-object.

### Requirement 2: Remote Falcon Status Response Structure

**User Story:** As a system operator, I want the Remote Falcon status to include lightweight metadata from the show details, so that I can confirm the integration is functional beyond simple connectivity.

#### Acceptance Criteria

1. WHEN the Remote Falcon connectivity check succeeds, THE Remote_Falcon_Status SHALL contain the following fields: `isConnected` (boolean), `statusCode` (number), `viewerControlEnabled` (boolean), `viewerControlMode` (string), `playingNow` (string or null), and `playingNext` (string or null).
2. WHEN the Remote Falcon connectivity check succeeds, THE Remote_Falcon_Status SHALL extract `viewerControlEnabled` and `viewerControlMode` from the `preferences` object of the Show_Details_Endpoint response.
3. WHEN the Remote Falcon connectivity check succeeds, THE Remote_Falcon_Status SHALL extract `playingNow` and `playingNext` from the top-level fields of the Show_Details_Endpoint response.
4. THE Remote_Falcon_Status SHALL NOT include `sequences`, `sequenceGroups`, `requests`, or `votes` data from the Show_Details_Endpoint response.

### Requirement 3: Remote Falcon Connectivity Failure Handling

**User Story:** As a system operator, I want the health response to report Remote Falcon failures gracefully, so that a Remote Falcon outage does not prevent me from receiving telemetry data.

#### Acceptance Criteria

1. IF the Show_Details_Endpoint returns an HTTP error status code (400 or greater), THEN THE Telemetry_Endpoint SHALL return a 200 status code with the Remote_Falcon_Status containing `isConnected` as `false`, the `statusCode` from the Remote Falcon response, and an `error` field with a descriptive message.
2. IF the Health_Check_Service encounters a network error or the Remote_Falcon_Api is unreachable, THEN THE Telemetry_Endpoint SHALL return a 200 status code with the Remote_Falcon_Status containing `isConnected` as `false`, `statusCode` as `0`, and an `error` field describing the network failure.
3. IF the Health_Check_Service encounters a timeout while contacting the Remote_Falcon_Api, THEN THE Telemetry_Endpoint SHALL return a 200 status code with the Remote_Falcon_Status containing `isConnected` as `false`, `statusCode` as `0`, and an `error` field indicating a timeout occurred.
4. IF the Remote Falcon connectivity check fails for any reason, THEN THE Remote_Falcon_Status SHALL NOT contain the `viewerControlEnabled`, `viewerControlMode`, `playingNow`, or `playingNext` fields.

### Requirement 4: Health Check Timeout

**User Story:** As a system operator, I want the Remote Falcon health check to have a bounded execution time, so that a slow or unresponsive Remote Falcon service does not cause the telemetry endpoint to hang.

#### Acceptance Criteria

1. WHEN the Health_Check_Service contacts the Show_Details_Endpoint, THE Health_Check_Service SHALL enforce a maximum timeout of 5000 milliseconds for the complete request-response cycle.
2. WHEN the timeout is exceeded, THE Health_Check_Service SHALL abort the request and return a failure result with a timeout indication.

### Requirement 5: Telemetry View Formatting for Health Status

**User Story:** As a developer, I want the telemetry view to format the Remote Falcon status consistently, so that the response structure is predictable for consumers.

#### Acceptance Criteria

1. WHEN a `systemHealth` event is processed successfully, THE Telemetry_View SHALL format the response body as an object containing `message` (string), `timestamp` (ISO 8601 string), `processingTime` (number in milliseconds), and `remoteFalcon` (Remote_Falcon_Status object).
2. WHEN a non-`systemHealth` event is processed successfully, THE Telemetry_View SHALL format the response body as an object containing `message` (string), `timestamp` (ISO 8601 string), and `processingTime` (number in milliseconds) without a `remoteFalcon` field.
3. FOR ALL valid `systemHealth` events, formatting the response then parsing the JSON output SHALL produce an object with a `remoteFalcon` property that contains an `isConnected` boolean field (round-trip property).
