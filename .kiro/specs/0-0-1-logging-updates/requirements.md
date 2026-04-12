# Requirements Document

## Introduction

This feature migrates all application logging from direct `console.log`, `console.error`, and `console.warn` calls to the `DebugAndLog` utility provided by `@63klabs/cache-data`. The migration standardizes log output formatting across the application, leveraging the structured `[TAG] message | obj` format that DebugAndLog produces. Since this is internal logging not accessed outside of the application, backwards compatibility is not a concern. The feature also adds per-log-type CloudWatch Log Insights query examples to the admin-ops documentation.

## Glossary

- **DebugAndLog**: A static logging utility class from the `@63klabs/cache-data` package that provides structured log output in the format `[TAG] message` or `[TAG] message | obj`. It supports log levels and multiple methods: `log(message, tag, obj)`, `error(message, obj)`, `warn(message, obj)`, and `debug(message, obj)`.
- **Log_Tag**: A string identifier passed to `DebugAndLog.log()` as the second positional parameter. The tag appears in the log output between square brackets (e.g., `[REMOTE_FALCON_REQUEST]`). Only the `log` method accepts a tag parameter.
- **RemoteFalcon_Dao**: The data access module (`RemoteFalcon.dao.js`) that forwards authenticated HTTP requests to the Remote Falcon external API and logs request outcomes.
- **Telemetry_Service**: The service module (`telemetry.service.js`) that validates and processes frontend telemetry tracking events and logs telemetry data.
- **Router**: The routing module (`routes/index.js`) that dispatches incoming API Gateway events to controllers and logs per-request metrics and unhandled errors.
- **Handler**: The Lambda entry point module (`index.js`) that initializes configuration and delegates to the Router.
- **Admin_Ops_Documentation**: The operations documentation file (`docs/admin-ops/README.md`) that provides CloudWatch Log Insights query examples and monitoring guidance for operators.
- **Log_Insights_Query**: A CloudWatch Logs Insights query used by operators to search, filter, and analyze structured log entries.

## Requirements

### Requirement 1: Migrate REMOTE_FALCON_REQUEST logging to DebugAndLog

**User Story:** As a developer, I want successful Remote Falcon API request logs to use DebugAndLog.log(), so that log output follows the standardized `[TAG] message | obj` format.

#### Acceptance Criteria

1. WHEN a successful Remote Falcon API response is received, THE RemoteFalcon_Dao SHALL call `DebugAndLog.log(message, "REMOTE_FALCON_REQUEST", obj)` where `message` is a descriptive string and `obj` is the structured log entry object.
2. WHEN a successful Remote Falcon API response is received, THE RemoteFalcon_Dao SHALL NOT call `console.log` for the REMOTE_FALCON_REQUEST log entry.

### Requirement 2: Migrate REMOTE_FALCON_ERROR logging to DebugAndLog

**User Story:** As a developer, I want failed Remote Falcon API request logs to use DebugAndLog.error(), so that error log output follows the standardized format and uses the error log level.

#### Acceptance Criteria

1. WHEN a Remote Falcon API request fails with an HTTP error status, THE RemoteFalcon_Dao SHALL call `DebugAndLog.error()` with a message prefixed by `REMOTE_FALCON_ERROR:` and the structured error log entry object.
2. WHEN a Remote Falcon API response contains an application-level error, THE RemoteFalcon_Dao SHALL call `DebugAndLog.error()` with a message prefixed by `REMOTE_FALCON_ERROR:` and the structured error log entry object.
3. WHEN a Remote Falcon API request fails with a network error, THE RemoteFalcon_Dao SHALL call `DebugAndLog.error()` with a message prefixed by `REMOTE_FALCON_ERROR:` and the structured error log entry object.
4. WHEN a Remote Falcon API request fails with a network error, THE RemoteFalcon_Dao SHALL NOT call `console.error` for the supplementary error log.
5. WHEN a Remote Falcon API request fails, THE RemoteFalcon_Dao SHALL NOT call `console.log` for the REMOTE_FALCON_ERROR log entry.

### Requirement 3: Migrate TELEMETRY_EVENT logging to DebugAndLog

**User Story:** As a developer, I want telemetry event logs to use DebugAndLog.log(), so that telemetry log output follows the standardized `[TAG] message | obj` format.

#### Acceptance Criteria

1. WHEN a valid telemetry tracking event is processed, THE Telemetry_Service SHALL call `DebugAndLog.log(message, "TELEMETRY_EVENT", obj)` where `message` is a descriptive string and `obj` is the structured telemetry log entry object.
2. WHEN a valid telemetry tracking event is processed, THE Telemetry_Service SHALL NOT call `console.log` for the TELEMETRY_EVENT log entry.

### Requirement 4: Migrate TELEMETRY_METRICS logging to DebugAndLog

**User Story:** As a developer, I want telemetry metrics logs to use DebugAndLog.log(), so that metrics log output follows the standardized `[TAG] message | obj` format.

#### Acceptance Criteria

1. WHEN a valid telemetry tracking event is processed, THE Telemetry_Service SHALL call `DebugAndLog.log(message, "TELEMETRY_METRICS", obj)` where `message` is a descriptive string and `obj` is the structured telemetry metrics object.
2. WHEN a valid telemetry tracking event is processed, THE Telemetry_Service SHALL NOT call `console.log` for the TELEMETRY_METRICS log entry.

### Requirement 5: Migrate REQUEST_METRICS logging to DebugAndLog

**User Story:** As a developer, I want per-request metrics logs to use DebugAndLog.log(), so that request metrics log output follows the standardized `[TAG] message | obj` format.

#### Acceptance Criteria

1. WHEN a request completes successfully, THE Router SHALL call `DebugAndLog.log(message, "REQUEST_METRICS", obj)` where `message` is a descriptive string and `obj` is the structured request metrics object.
2. WHEN a request results in a 404 response, THE Router SHALL call `DebugAndLog.log(message, "REQUEST_METRICS", obj)` where `message` is a descriptive string and `obj` is the structured request metrics object.
3. WHEN a request results in an unhandled error, THE Router SHALL call `DebugAndLog.log(message, "REQUEST_METRICS", obj)` where `message` is a descriptive string and `obj` is the structured request metrics object.
4. THE Router SHALL NOT call `console.log` for any REQUEST_METRICS log entries.

### Requirement 6: Migrate LAMBDA_ERROR logging to DebugAndLog

**User Story:** As a developer, I want unhandled Lambda error logs to use DebugAndLog.error(), so that error log output follows the standardized format and uses the error log level.

#### Acceptance Criteria

1. WHEN an unhandled error occurs during request processing, THE Router SHALL call `DebugAndLog.error(message, obj)` where `message` is a descriptive error string and `obj` is the structured error log entry object containing requestId, timestamp, error details, and request context.
2. WHEN an unhandled error occurs during request processing, THE Router SHALL NOT call `console.error` for the LAMBDA_ERROR log entry.

### Requirement 7: Migrate unknown endpoint warning to DebugAndLog

**User Story:** As a developer, I want unknown endpoint warnings to use DebugAndLog.warn(), so that warning log output follows the standardized format and uses the warn log level.

#### Acceptance Criteria

1. WHEN an unknown endpoint is requested, THE Router SHALL call `DebugAndLog.warn(message, obj)` where `message` is a descriptive string and `obj` contains the path, method, and requestId.
2. WHEN an unknown endpoint is requested, THE Router SHALL NOT call `console.warn` for the unknown endpoint warning.

### Requirement 8: Import DebugAndLog in migrated modules

**User Story:** As a developer, I want all modules that emit structured logs to import DebugAndLog, so that the logging utility is available where needed.

#### Acceptance Criteria

1. THE Telemetry_Service SHALL import DebugAndLog from the `@63klabs/cache-data` package.
2. THE RemoteFalcon_Dao SHALL import DebugAndLog from the `@63klabs/cache-data` package.
3. THE Router SHALL continue to use its existing DebugAndLog import for the migrated log calls.

### Requirement 9: Preserve structured log data

**User Story:** As a developer, I want the migration to preserve all structured data currently included in log entries, so that existing CloudWatch queries and monitoring continue to function.

#### Acceptance Criteria

1. WHEN a REMOTE_FALCON_REQUEST log is emitted, THE RemoteFalcon_Dao SHALL include the same structured fields (timestamp, requestId, logType, status, request details, response details) in the object parameter as the current log entry.
2. WHEN a REMOTE_FALCON_ERROR log is emitted, THE RemoteFalcon_Dao SHALL include the same structured fields (timestamp, requestId, logType, status, request details, error details) in the object parameter as the current log entry.
3. WHEN a TELEMETRY_EVENT log is emitted, THE Telemetry_Service SHALL include the same structured fields (timestamp, eventType, ipAddress, userAgent, host, url, eventData, processingTime, requestId) in the object parameter as the current log entry.
4. WHEN a TELEMETRY_METRICS log is emitted, THE Telemetry_Service SHALL include the same structured fields (timestamp, eventType, processingTime, success, requestId) in the object parameter as the current log entry.
5. WHEN a REQUEST_METRICS log is emitted, THE Router SHALL include the same structured fields (requestId, timestamp, method, path, statusCode, processingTime, totalTime, success) in the object parameter as the current log entry.
6. WHEN a LAMBDA_ERROR log is emitted, THE Router SHALL include the same structured fields (requestId, timestamp, error details, request context, totalTime) in the object parameter as the current log entry.

### Requirement 10: Document per-log-type CloudWatch Log Insights queries

**User Story:** As an operator, I want example CloudWatch Log Insights queries for each log type, so that I can quickly search and analyze specific categories of log entries.

#### Acceptance Criteria

1. THE Admin_Ops_Documentation SHALL include an example Log_Insights_Query for searching REMOTE_FALCON_REQUEST entries.
2. THE Admin_Ops_Documentation SHALL include an example Log_Insights_Query for searching REMOTE_FALCON_ERROR entries.
3. THE Admin_Ops_Documentation SHALL include an example Log_Insights_Query for searching TELEMETRY_EVENT entries.
4. THE Admin_Ops_Documentation SHALL include an example Log_Insights_Query for searching TELEMETRY_METRICS entries.
5. THE Admin_Ops_Documentation SHALL include an example Log_Insights_Query for searching REQUEST_METRICS entries.
6. THE Admin_Ops_Documentation SHALL include an example Log_Insights_Query for searching LAMBDA_ERROR entries.
7. WHEN the DebugAndLog migration is complete, THE Admin_Ops_Documentation SHALL note that log entries follow the `[TAG] message | obj` format produced by DebugAndLog.

### Requirement 11: No console.log, console.error, or console.warn for structured application logs

**User Story:** As a developer, I want all structured application log calls to use DebugAndLog exclusively, so that the codebase has a single consistent logging approach.

#### Acceptance Criteria

1. THE RemoteFalcon_Dao SHALL contain zero `console.log` calls for structured log entries after migration.
2. THE RemoteFalcon_Dao SHALL contain zero `console.error` calls for structured log entries after migration.
3. THE Telemetry_Service SHALL contain zero `console.log` calls for structured log entries after migration.
4. THE Router SHALL contain zero `console.log` calls for structured log entries after migration.
5. THE Router SHALL contain zero `console.error` calls for structured log entries after migration.
6. THE Router SHALL contain zero `console.warn` calls for structured log entries after migration.
