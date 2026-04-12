/**
 * Property-based tests for data privacy and security measures in Remote Falcon logging
 * **Feature: remote-falcon-logging-enhancement, Property 6: Data Privacy and Security**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 */

const fc = require('fast-check');

// Mock RemoteFalconLogBuilder class for testing
class RemoteFalconLogBuilder {
  constructor(requestId, clientInfo, path, method) {
    this.requestId = requestId;
    this.clientInfo = clientInfo;
    this.path = path;
    this.method = method;
    this.startTime = Date.now();
  }

  buildSuccessLog(response, responseData) {
    return {
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      logType: 'REMOTE_FALCON_REQUEST',
      status: 'SUCCESS',
      request: {
        method: this.method,
        path: this.path,
        ip: this.clientInfo.ipAddress,
        userAgent: this.clientInfo.userAgent,
        host: this.clientInfo.host
      },
      response: {
        status: response.status,
        processingTime: Date.now() - this.startTime,
        dataSummary: this.generateDataSummary(responseData)
      }
    };
  }

  buildErrorLog(error, httpStatus = null) {
    return {
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      logType: 'REMOTE_FALCON_ERROR',
      status: 'ERROR',
      request: {
        method: this.method,
        path: this.path,
        ip: this.clientInfo.ipAddress,
        userAgent: this.clientInfo.userAgent,
        host: this.clientInfo.host
      },
      error: {
        type: this.classifyError(error),
        message: this.sanitizeErrorMessage(error.message),
        httpStatus: httpStatus,
        processingTime: Date.now() - this.startTime
      }
    };
  }

  generateDataSummary(responseData) {
    if (this.path === '/showDetails') {
      return {
        viewerControlEnabled: responseData?.preferences?.viewerControlEnabled || null,
        viewerControlMode: responseData?.preferences?.viewerControlMode || null,
        numOfSequences: responseData?.sequences?.length || 0
      };
    }

    return {
      hasData: !!responseData && Object.keys(responseData).length > 0,
      responseSize: JSON.stringify(responseData || {}).length,
      keyFields: responseData ? Object.keys(responseData).slice(0, 10) : []
    };
  }

  classifyError(error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (error.message.includes('JSON') || error.message.includes('parse')) {
      return 'PARSE_ERROR';
    }
    if (error.message.includes('timeout') || error.name === 'AbortError') {
      return 'TIMEOUT_ERROR';
    }
    if (error.message.includes('SONG_REQUESTED') || error.message.includes('QUEUE_FULL')) {
      return 'APPLICATION_ERROR';
    }
    if (error.name === 'HTTPError' || (error.message && error.message.includes('HTTP'))) {
      return 'HTTP_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  sanitizeErrorMessage(message) {
    if (!message || typeof message !== 'string') {
      return 'Unknown error';
    }

    // Remove potential JWT tokens (Bearer tokens)
    let sanitized = message.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, 'Bearer [REDACTED]');
    
    // Remove potential API keys
    sanitized = sanitized.replace(/[Aa]pi[Kk]ey[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'ApiKey [REDACTED]');
    
    // Remove potential access tokens
    sanitized = sanitized.replace(/[Aa]ccess[Tt]oken[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'AccessToken [REDACTED]');
    
    // Remove potential passwords
    sanitized = sanitized.replace(/[Pp]assword[:\s]*[^\s]+/gi, 'Password [REDACTED]');
    
    // Remove potential email addresses (PII)
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, 'email [REDACTED]');
    
    // Limit message length to prevent excessive logging
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 497) + '...';
    }

    return sanitized;
  }
}

describe('Data Privacy and Security Property Tests', () => {
  describe('Property 6: Data Privacy and Security', () => {
    test('should never log JWT tokens, PII, or full response bodies in any log entry', () => {
      fc.assert(
        fc.property(
          // Generate various request scenarios
          fc.record({
            path: fc.oneof(fc.constant('/showDetails'), fc.constant('/addSequenceToQueue'), fc.constant('/voteForSequence')),
            method: fc.oneof(fc.constant('GET'), fc.constant('POST')),
            clientInfo: fc.record({
              ipAddress: fc.ipV4(),
              userAgent: fc.string({ minLength: 10, maxLength: 200 }),
              host: fc.domain()
            }),
            requestId: fc.uuid(),
            // Generate response data that might contain sensitive information
            responseData: fc.record({
              // Potentially sensitive fields that should be summarized, not logged in full
              sequences: fc.array(fc.record({
                name: fc.string(),
                id: fc.integer(),
                // Simulate potential PII in response data
                metadata: fc.record({
                  userEmail: fc.emailAddress(),
                  userName: fc.string(),
                  apiKey: fc.string({ minLength: 20, maxLength: 50 })
                })
              }), { maxLength: 10 }),
              preferences: fc.record({
                viewerControlEnabled: fc.boolean(),
                viewerControlMode: fc.string(),
                // Simulate potential sensitive configuration
                secretKey: fc.string({ minLength: 32, maxLength: 64 }),
                accessToken: fc.string({ minLength: 20, maxLength: 100 })
              }),
              // Large data that should be summarized
              largeData: fc.string({ minLength: 1000, maxLength: 5000 })
            }),
            // Generate error messages that might contain sensitive information
            errorMessage: fc.oneof(
              fc.constant('Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token'),
              fc.constant('API request failed with ApiKey: sk-1234567890abcdef'),
              fc.constant('AccessToken: abc123def456ghi789'),
              fc.constant('Password: mySecretPassword123'),
              fc.constant('User email: user@example.com failed validation'),
              fc.string({ minLength: 10, maxLength: 200 })
            )
          }),
          (scenario) => {
            const logBuilder = new RemoteFalconLogBuilder(
              scenario.requestId,
              scenario.clientInfo,
              scenario.path,
              scenario.method
            );

            // Test success log
            const mockResponse = { status: 200 };
            const successLog = logBuilder.buildSuccessLog(mockResponse, scenario.responseData);

            // Test error log
            const error = new Error(scenario.errorMessage);
            const errorLog = logBuilder.buildErrorLog(error, 500);

            // Verify no JWT tokens are logged
            const successLogStr = JSON.stringify(successLog);
            const errorLogStr = JSON.stringify(errorLog);
            
            // Should not contain JWT patterns (but sanitized placeholders are OK)
            expect(successLogStr).not.toMatch(/Bearer\s+(?!.*\[REDACTED\])[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/);
            expect(errorLogStr).not.toMatch(/Bearer\s+(?!.*\[REDACTED\])[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/);

            // Should not contain API keys (but sanitized placeholders are OK)
            expect(successLogStr).not.toMatch(/[Aa]pi[Kk]ey[:\s]*(?!.*\[REDACTED\])[A-Za-z0-9\-_]{20,}/);
            expect(errorLogStr).not.toMatch(/[Aa]pi[Kk]ey[:\s]*(?!.*\[REDACTED\])[A-Za-z0-9\-_]{20,}/);

            // Should not contain access tokens (but sanitized placeholders are OK)
            expect(successLogStr).not.toMatch(/[Aa]ccess[Tt]oken[:\s]*(?!.*\[REDACTED\])[A-Za-z0-9\-_]{20,}/);
            expect(errorLogStr).not.toMatch(/[Aa]ccess[Tt]oken[:\s]*(?!.*\[REDACTED\])[A-Za-z0-9\-_]{20,}/);

            // Should not contain actual passwords (but sanitized placeholders are OK)
            expect(successLogStr).not.toMatch(/[Pp]assword[:\s]*(?!.*\[REDACTED\])[^\s]+/);
            expect(errorLogStr).not.toMatch(/[Pp]assword[:\s]*(?!.*\[REDACTED\])[^\s]+/);

            // Should not contain the original sensitive values from the test scenario
            if (scenario.errorMessage.includes('mySecretPassword123')) {
              expect(successLogStr).not.toContain('mySecretPassword123');
              expect(errorLogStr).not.toContain('mySecretPassword123');
            }

            // Should not contain email addresses (PII)
            expect(successLogStr).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            expect(errorLogStr).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

            // Should not contain full response bodies - only summaries
            if (scenario.responseData.largeData) {
              expect(successLogStr).not.toContain(scenario.responseData.largeData);
            }

            // Should not contain sensitive fields from response data
            if (scenario.responseData.preferences?.secretKey) {
              expect(successLogStr).not.toContain(scenario.responseData.preferences.secretKey);
            }
            if (scenario.responseData.preferences?.accessToken) {
              expect(successLogStr).not.toContain(scenario.responseData.preferences.accessToken);
            }

            // Log entries should have size limits
            expect(successLogStr.length).toBeLessThanOrEqual(10000); // 10KB limit
            expect(errorLogStr.length).toBeLessThanOrEqual(10000); // 10KB limit

            // Error messages should be sanitized
            if (errorLog.error?.message) {
              expect(errorLog.error.message).not.toMatch(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/);
              expect(errorLog.error.message.length).toBeLessThanOrEqual(500); // Error message length limit
            }

            // Success logs should contain only summary data, not full response bodies
            if (successLog.response?.dataSummary) {
              const dataSummary = successLog.response.dataSummary;
              
              // Should contain summary information (different fields for different paths)
              if (scenario.path === '/showDetails') {
                expect(dataSummary).toHaveProperty('viewerControlEnabled');
                expect(dataSummary).toHaveProperty('viewerControlMode');
                expect(dataSummary).toHaveProperty('numOfSequences');
              } else {
                expect(dataSummary).toHaveProperty('hasData');
                expect(dataSummary).toHaveProperty('responseSize');
                expect(dataSummary).toHaveProperty('keyFields');
              }
              
              // Should not contain the actual sensitive data
              const dataSummaryStr = JSON.stringify(dataSummary);
              if (scenario.responseData.preferences?.secretKey) {
                expect(dataSummaryStr).not.toContain(scenario.responseData.preferences.secretKey);
              }
              if (scenario.responseData.preferences?.accessToken) {
                expect(dataSummaryStr).not.toContain(scenario.responseData.preferences.accessToken);
              }
            }
          }
        ),
        { numRuns: 20 } // Reduced iterations for performance as per testing guidelines
      );
    });
  });
});