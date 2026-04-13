# Add Client Status to System Health

When the post request goes to the telemetry endpoint, and the eventType is systemHealth, a client request count and error count along with rate is submitted. Please echo back those numbers in the response.

Add a new property after remoteFalcon called `clientStatus` and include the client IP, userAgent, and eventData received from the systemHealth request.

```json
{
  "statusCode": 200,
  "message": "Tracking data received successfully",
  "timestamp": "2026-04-13T03:19:42.598Z",
  "processingTime": 1,
  "remoteFalcon": {
    "isConnected": true,
    "statusCode": 200,
    "viewerControlEnabled": false,
    "viewerControlMode": "JUKEBOX",
    "playingNow": "",
    "playingNext": ""
  },
  "clientStatus": {
    "ip": "",
    "userAgent": "",
    "eventData": {
        "totalRequests": 1500,
        "failedRequests": 12,
        "errorRate": 0.008,
        "rateLimitStatus": {
            "isRateLimited": false,
            "requestsInWindow": 42
        }
    }
  }
}
```

Ask any questions, and provide any recommendations, in SPEC-QUESTIONS.md and have the user answer them there before moving on to the Spec-Driven workflow.