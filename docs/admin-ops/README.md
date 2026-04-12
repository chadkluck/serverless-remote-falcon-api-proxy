# Documentation for Operations

## SSM Parameter Management

The application requires two SSM SecureString parameters for Remote Falcon API authentication. These must exist before the application can process proxy requests.

### Parameter Paths

Parameters follow the Atlantis hierarchy:

```
${ParameterStoreHierarchy}${DeployEnvironment}/${Prefix}-${ProjectId}-${StageId}/RemoteFalcon/access-token
${ParameterStoreHierarchy}${DeployEnvironment}/${Prefix}-${ProjectId}-${StageId}/RemoteFalcon/secret-key
```

### Creating Parameters

```bash
aws ssm put-parameter \
  --name "/<Hierarchy>/<Env>/<Prefix>-<ProjectId>-<StageId>/RemoteFalcon/access-token" \
  --type SecureString \
  --value "YOUR_ACCESS_TOKEN"

aws ssm put-parameter \
  --name "/<Hierarchy>/<Env>/<Prefix>-<ProjectId>-<StageId>/RemoteFalcon/secret-key" \
  --type SecureString \
  --value "YOUR_SECRET_KEY"
```

### Rotating Credentials

1. Update the SSM parameters with new values using `--overwrite`
2. The application caches credentials for 12 hours (`refreshAfter: 43200`)
3. After updating, the new credentials will be picked up within 12 hours, or you can redeploy to force a cold start

## Monitoring

### Log format

All structured log entries use the `DebugAndLog` utility and follow the format:

```
[TAG] message | {"key":"value",...}
```

Where `TAG` is one of the log types below, `message` is a human-readable description, and the JSON object contains the structured fields. For error and warning entries the tag is `ERROR` or `WARN` respectively, with the log type embedded in the message.

### CloudWatch Log Types

The application emits structured JSON log entries that can be used with CloudWatch Log Insights and metric filters:

| Log Type | Description |
|----------|-------------|
| `REMOTE_FALCON_REQUEST` | Successful proxy requests to Remote Falcon API |
| `REMOTE_FALCON_ERROR` | Failed proxy requests (HTTP errors, network errors, application errors) |
| `TELEMETRY_EVENT` | Telemetry events received from the frontend |
| `TELEMETRY_METRICS` | Telemetry processing metrics |
| `REQUEST_METRICS` | Per-request metrics (method, path, status, timing) |
| `LAMBDA_ERROR` | Unhandled exceptions in the Lambda handler |

### Log Insights queries

Each query below filters by the tag format and parses the structured JSON fields from the log message.

#### REMOTE_FALCON_REQUEST

Successful proxy requests with response status and timing:

```
fields @timestamp, @message
| filter @message like /\[REMOTE_FALCON_REQUEST\]/
| parse @message '"status":"*"' as reqStatus
| parse @message '"method":"*"' as method
| parse @message '"path":"*"' as path
| parse @message '"processingTime":*,' as processingTime
| stats count() as requests, avg(processingTime) as avgTime by method, path
| sort requests desc
```

#### REMOTE_FALCON_ERROR

Failed proxy requests grouped by error type and HTTP status:

```
fields @timestamp, @message
| filter @message like /REMOTE_FALCON_ERROR/
| parse @message '"type":"*"' as errorType
| parse @message '"httpStatus":*,' as httpStatus
| parse @message '"message":"*"' as errorMessage
| parse @message '"path":"*"' as path
| stats count() as errors by errorType, httpStatus
| sort errors desc
```

#### TELEMETRY_EVENT

Telemetry events received from the frontend grouped by event type:

```
fields @timestamp, @message
| filter @message like /\[TELEMETRY_EVENT\]/
| parse @message '"eventType":"*"' as eventType
| parse @message '"host":"*"' as host
| parse @message '"url":"*"' as url
| parse @message '"processingTime":*,' as processingTime
| stats count() as events, avg(processingTime) as avgTime by eventType
| sort events desc
```

#### TELEMETRY_METRICS

Telemetry processing metrics with success rate:

```
fields @timestamp, @message
| filter @message like /\[TELEMETRY_METRICS\]/
| parse @message '"eventType":"*"' as eventType
| parse @message '"processingTime":*,' as processingTime
| parse @message '"success":*,' as success
| stats count() as total,
        sum(success) as succeeded,
        avg(processingTime) as avgTime
  by eventType
| sort total desc
```

#### REQUEST_METRICS

Per-request metrics with status codes and timing:

```
fields @timestamp, @message
| filter @message like /\[REQUEST_METRICS\]/
| parse @message '"method":"*"' as method
| parse @message '"path":"*"' as path
| parse @message '"statusCode":*,' as statusCode
| parse @message '"processingTime":*,' as processingTime
| parse @message '"totalTime":*,' as totalTime
| stats count() as requests, avg(totalTime) as avgTotal by method, path, statusCode
| sort requests desc
```

#### LAMBDA_ERROR

Unhandled exceptions with error details and request context:

```
fields @timestamp, @message
| filter @message like /LAMBDA_ERROR/
| parse @message '"message":"*"' as errorMessage
| parse @message '"name":"*"' as errorName
| parse @message '"method":"*"' as method
| parse @message '"path":"*"' as path
| parse @message '"totalTime":*}' as totalTime
| stats count() as errors by errorName, errorMessage
| sort errors desc
```

### Alarms

CloudWatch Alarms are created only in PROD (`DeployEnvironment: PROD`). The alarm monitors Lambda function errors and notifies via SNS email.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `REMOTE_FALCON_API_BASE_URL` | Remote Falcon API base URL |
| `ALLOWED_ORIGINS` | Comma-delimited CORS allowed origins |
| `PARAM_STORE_PATH` | SSM Parameter Store hierarchy path |
| `DEPLOY_ENVIRONMENT` | `PROD`, `TEST`, or `DEV` |
| `LOG_LEVEL` | `INFO` (PROD) or `DEBUG` (non-PROD) |
