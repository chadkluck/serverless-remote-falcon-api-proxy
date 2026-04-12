# Documentation for End-Users

## API Endpoints

Base URL: `https://<api-gateway-id>.execute-api.<region>.amazonaws.com/<ApiPathBase>`

### Proxy Endpoints

These endpoints forward requests to the Remote Falcon API with server-side JWT authentication.

#### GET /proxy/showDetails

Retrieve show details from Remote Falcon.

```bash
curl -X GET https://<base-url>/proxy/showDetails
```

Response: JSON body from Remote Falcon API (pass-through).

#### POST /proxy/addSequenceToQueue

Add a sequence to the queue.

```bash
curl -X POST https://<base-url>/proxy/addSequenceToQueue \
  -H "Content-Type: application/json" \
  -d '{"sequenceName": "example-sequence"}'
```

Response: JSON body from Remote Falcon API (pass-through).

#### POST /proxy/voteForSequence

Vote for a sequence.

```bash
curl -X POST https://<base-url>/proxy/voteForSequence \
  -H "Content-Type: application/json" \
  -d '{"sequenceName": "example-sequence"}'
```

Response: JSON body from Remote Falcon API (pass-through).

#### ANY /proxy/{path}

Catch-all proxy for additional Remote Falcon API paths. The `/proxy` prefix is stripped before forwarding.

### Telemetry Endpoint

#### POST /telemetry

Submit a telemetry event for analytics tracking.

```bash
curl -X POST https://<base-url>/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "pageView",
    "url": "https://example.com/show"
  }'
```

Request body:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventType` | string | Yes | One of: `pageView`, `click`, `videoPlay`, `songRequest`, `systemHealth`, `systemAlert`, `eventFailure` |
| `url` | string | Yes | Valid URL where the event occurred |
| `eventData` | object | Conditional | Required for `systemHealth`, `systemAlert`, `eventFailure` |

Success response (200):

```json
{
  "message": "Tracking data received and logged",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "processingTime": 5
}
```

Validation error response (400):

```json
{
  "message": "Invalid eventType. Must be one of: pageView, click, ...",
  "error": "VALIDATION_ERROR",
  "requestId": "abc-123",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

### CORS

All responses include CORS headers. The `ALLOWED_ORIGINS` configuration controls which origins receive credentials. OPTIONS preflight requests return 200 with CORS headers and an empty body.

### Error Responses

All errors follow this structure:

```json
{
  "message": "Human-readable error message",
  "error": "ERROR_CODE",
  "requestId": "lambda-request-id",
  "timestamp": "ISO-8601 timestamp"
}
```

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `PARSE_ERROR` | Invalid JSON in request body |
| 400 | `VALIDATION_ERROR` | Telemetry data validation failure |
| 404 | `NOT_FOUND` | Unknown endpoint (includes `availableEndpoints` list) |
| 500 | `AUTH_ERROR` | Credential retrieval failure |
| 500 | `INTERNAL_ERROR` | Unhandled server error |
