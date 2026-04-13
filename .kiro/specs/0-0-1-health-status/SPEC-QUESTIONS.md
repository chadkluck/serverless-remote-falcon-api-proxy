# SPEC Questions — Health Status

## Q1: Which Remote Falcon endpoint should be used for the health check?

**Answer:** The `GET /showDetails` endpoint is the best candidate. It is the only GET endpoint available in the Remote Falcon External API, it already has authentication wired up via `ProxySvc.forwardToRemoteFalcon()`, and a successful response confirms both network connectivity and valid credentials. We do not need to use `addSequenceToQueue` or `voteForSequence` as those are POST mutations.

## Q2: What "minor details" from Remote Falcon should be included in the response?

**Answer:** Since the spec says we do not need songs, music, or playlists, we should return lightweight metadata from the `showDetails` response that confirms the connection is live and the show is configured. Reasonable fields to include:
- `preferences.viewerControlEnabled` (boolean) — confirms show preferences are accessible
- `preferences.viewerControlMode` (string, e.g. "jukebox") — confirms the show mode
- `playingNow` (string or null) — indicates current show activity
- `playingNext` (string or null) — indicates upcoming show activity

These are small, non-sensitive fields that confirm the Remote Falcon integration is working without exposing the full sequence/playlist data.

## Q3: Should the health check only run for `systemHealth` events, or for all telemetry events?

**Answer:** Only for `systemHealth` events. The spec says "update the response to a health event," which maps to the existing `eventType: 'systemHealth'` telemetry event. Other event types (pageView, click, songRequest, etc.) should continue to behave as they do today.

## Q4: What should happen if the Remote Falcon health check fails (network error, auth failure, etc.)?

**Answer:** The telemetry event itself should still succeed (200 response). The Remote Falcon connectivity status should be reported as `{ isConnected: false }` with an error message in the sub-object. The health check is informational — a failure to reach Remote Falcon should not cause the telemetry endpoint to return an error status code.

## Q5: Should the Remote Falcon check add a timeout to avoid slowing down the telemetry response?

**Answer:** Yes. The Remote Falcon API call should have a reasonable timeout (e.g. 5 seconds) so that a slow or unresponsive Remote Falcon service does not cause the telemetry endpoint to hang. If the timeout is exceeded, the response should report `isConnected: false` with a timeout indication.

## Q6: What is the shape of the `remoteFalcon` sub-object in the response?

**Answer:** The sub-object should be nested within the existing success response body:

```json
{
  "message": "Tracking data received successfully",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "processingTime": 123,
  "remoteFalcon": {
    "isConnected": true,
    "statusCode": 200,
    "viewerControlEnabled": true,
    "viewerControlMode": "jukebox",
    "playingNow": "Let It Go",
    "playingNext": "Into the Unknown"
  }
}
```

On failure:

```json
{
  "message": "Tracking data received successfully",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "processingTime": 123,
  "remoteFalcon": {
    "isConnected": false,
    "statusCode": 500,
    "error": "Failed to communicate with Remote Falcon API"
  }
}
```

## Q7: Do we need backwards compatibility for the telemetry response?

**Answer:** No. The spec explicitly states: "We do not need to worry about backwards compatibility." The response shape can change freely.
