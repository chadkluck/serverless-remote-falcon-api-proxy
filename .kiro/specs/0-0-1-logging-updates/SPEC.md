# Logging Updates

Use DebugAndLog.log() for logging instead of console.log for logging the following:

| Log Type | Outputs Example | DebugAndLog usage |
|----------|-------------|-------------|
| `REMOTE_FALCON_REQUEST` | `[REMOTE_FALCON_REQUEST] message, obj` | DebugAndLog.log(message, "REMOTE_FALCON_REQUEST", obj) |
| `REMOTE_FALCON_ERROR` | `[REMOTE_FALCON_ERROR] message, obj` | DebugAndLog.error(`REMOTE_FALCON_ERROR: ${message}`, obj) |
| `TELEMETRY_EVENT` | `[TELEMETRY_EVENT] message, obj` | DebugAndLog.log(message, "TELEMETRY_EVENT", obj) |
| `TELEMETRY_METRICS` | `[TELEMETRY_METRICS] message, obj` | DebugAndLog.log(message, "TELEMETRY_METRICS", obj) |
| `REQUEST_METRICS` | `[REQUEST_METRICS] message, obj` | DebugAndLog.log(message, "REQUEST_METRICS", obj) |
| `LAMBDA_ERROR` | `[ERROR] message, obj` | DebugAndLog.error(message, obj) |

Examples:
- DebugAndLog.log(message, tag, obj)
- DebugAndLog.error(message, obj)
- DebugAndLog.warn(message, obj)

DebugAndLog.log is the only one with the positional parameter `tag`.

Add instructions to docs/admin-ops/README.md Example Log Insights Query section to search by each of these log types similar to what is there now.

Since this is internal logging not accessed outside of the application we do not need to worry about backwards compatibility.

Ask any questions in SPEC-QUESTIONS.md and have them answered there before moving on to the Spec-Driven workflow.