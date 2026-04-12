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

### Example Log Insights Query

```
fields @timestamp, @message
| filter @message like /REMOTE_FALCON_ERROR/
| parse @message '"status":*,' as httpStatus
| stats count() by httpStatus
| sort count desc
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
