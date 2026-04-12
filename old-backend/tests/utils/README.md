# Mock Event Synchronization Utilities

This directory contains utilities for synchronizing mock events between frontend and backend components to maintain testing architecture separation.

## Backend Mock Event Synchronization

### Script: `syncMockEvents.js`

Updates backend mock events (frontend requests and Lambda events) based on changes in the frontend implementation.

#### Usage

```bash
# Update mock events from frontend changes
node syncMockEvents.js sync

# Validate existing mock events
node syncMockEvents.js validate

# Run sync then validate
node syncMockEvents.js both
```

#### What it does

- Analyzes frontend API utilities (`amplifyapp/src/utils/remoteFalconApi.js`, `amplifyapp/src/utils/tracking.js`)
- Extracts request formats for different API calls
- Updates mock request files in `backend/tests/mock-events/frontend-requests/`
- Updates Lambda event files in `backend/tests/mock-events/lambda-events/`
- Validates that mock events match current frontend interface
- Ensures schema versions are up to date

#### Mock Events Generated

##### Frontend Request Events (`frontend-requests/`)

- `token-request.json` - JWT token generation request
- `show-details-request.json` - Show details request
- `add-sequence-request.json` - Add sequence to queue request
- `vote-sequence-request.json` - Vote for sequence request
- `tracking-page-view-request.json` - Page view tracking request
- `tracking-click-request.json` - Click tracking request
- `tracking-song-request.json` - Song request tracking request
- `tracking-system-health-request.json` - System health tracking request
- `test-request.json` - Test endpoint request

##### Lambda Event Events (`lambda-events/`)

- `api-gateway-token-event.json` - API Gateway event for token endpoint
- `api-gateway-show-details-event.json` - API Gateway event for show details
- `api-gateway-add-sequence-event.json` - API Gateway event for add sequence
- `api-gateway-tracking-event.json` - API Gateway event for tracking
- `api-gateway-options-event.json` - API Gateway CORS preflight event
- `test-event.json` - Test Lambda event

## When to Run

### Automatic Synchronization

Run the synchronization script when:

1. **Frontend API changes**: When request formats change in frontend utilities
2. **New API calls added**: When new API calls are added to the frontend
3. **Tracking changes**: When tracking event formats are modified
4. **Schema updates**: When the mock event schema version is updated

### Manual Validation

Run validation when:

1. **Before running tests**: To ensure mock events are current
2. **After pulling changes**: To verify mock events match the current codebase
3. **Debugging test failures**: To check if mock events are out of sync

## Integration with CI/CD

Consider adding these commands to your CI/CD pipeline:

```bash
# In your test script
cd backend/tests/utils
node syncMockEvents.js validate

# Or automatically sync and validate
node syncMockEvents.js both
```

## Configuration

The script configuration is in `SYNC_CONFIG`:

- `frontendSourcePaths`: Array of paths to frontend source files
- `mockEventsPath`: Base path to mock events directory
- `frontendRequestsPath`: Path to frontend request mock events
- `lambdaEventsPath`: Path to Lambda event mock events
- `schemaVersion`: Current schema version for mock events
- `lastUpdated`: Timestamp for when events were last updated

## Mock Event Structure

### Frontend Request Format

```json
{
  "method": "POST",
  "url": "/api/endpoint",
  "headers": {
    "Content-Type": "application/json",
    "User-Agent": "...",
    "Origin": "https://example.com"
  },
  "body": {
    // Request payload
  },
  "metadata": {
    "description": "Description of the request",
    "lastUpdated": "2025-01-04T12:00:00Z",
    "component": "ComponentName",
    "schemaVersion": "1.0"
  }
}
```

### Lambda Event Format

```json
{
  "resource": "/api/endpoint",
  "path": "/api/endpoint",
  "httpMethod": "POST",
  "headers": {
    // Request headers
  },
  "requestContext": {
    // API Gateway request context
  },
  "body": "{\"key\":\"value\"}",
  "isBase64Encoded": false,
  "metadata": {
    "description": "API Gateway event description",
    "lastUpdated": "2025-01-04T12:00:00Z",
    "triggerType": "API_GATEWAY",
    "schemaVersion": "1.0"
  }
}
```

## Error Handling

The script provides detailed error messages for:

- Missing frontend source files
- Parse errors in existing mock events
- Structure mismatches between current and expected formats
- Schema version conflicts
- File system errors

## Output

The script provides comprehensive output including:

- ✓ Files that are up to date
- ⚠️ Files that need updates with reasons
- ❌ Files that failed to process with error details
- 📊 Summary statistics for both frontend requests and Lambda events
- 📋 Complete file listings with modification times

## Testing Integration

These mock events are used by:

- Backend unit tests via `MockEventLoader.loadFrontendRequest()`
- Backend integration tests via `MockEventLoader.loadLambdaEvent()`
- Test isolation validation to ensure no cross-component dependencies