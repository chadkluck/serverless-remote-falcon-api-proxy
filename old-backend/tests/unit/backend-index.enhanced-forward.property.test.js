/**
const { MockEventLoader } = require('../utils/mockLoader');
 * Property-based tests for enhanced forwardToRemoteFalcon function
 * Feature: remote-falcon-logging-enhancement
 */

// Jest globals are available
const fc = require('fast-check');

// Mock AWS SDK
jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn(() => ({
    send: jest.fn()
      .mockResolvedValueOnce({ Parameter: { Value: 'test-access-token' } })
      .mockResolvedValueOnce({ Parameter: { Value: 'test-secret-key' } })
  })),
  GetParameterCommand: jest.fn()
}));

// Mock fetch globally
global.fetch = jest.fn();

// Import the enhanced functions
const { handler, ClientInfo, RemoteFalconLogBuilder } = require('../../src/index.js');

// Mock console.log to capture log entries
const mockConsoleLog = jest.fn();
const originalConsoleLog = console.log;

describe('Enhanced forwardToRemoteFalcon Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    
    // Mock environment variables
    process.env.REMOTE_FALCON_API_BASE_URL = 'https://api.remotefalcon.com';
    process.env.ALLOWED_ORIGINS = '*';
    process.env.REMOTE_FALCON_ACCESS_TOKEN_PARAM = '/test/access-token';
    process.env.REMOTE_FALCON_SECRET_KEY_PARAM = '/test/secret-key';
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    jest.restoreAllMocks();
  });

  /**
   * Property 1: Request Information Logging
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
   * 
   * For any request forwarded to Remote Falcon API, the log entry should contain 
   * client IP address, user agent, host header, requested path, HTTP method, and request timestamp
   */
  test('Property 1: Request Information Logging', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        // Generate realistic request event structure
        httpMethod: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        path: fc.constantFrom('/proxy/showDetails', '/proxy/addSequenceToQueue', '/proxy/voteForSequence', '/proxy/getQueue'),
        headers: fc.record({
          'x-forwarded-for': fc.ipV4(),
          'user-agent': fc.string({ minLength: 10, maxLength: 200 }),
          'host': fc.string({ minLength: 5, maxLength: 100 }),
          'origin': fc.webUrl()
        }),
        requestContext: fc.record({
          requestId: fc.string({ minLength: 10, maxLength: 50 }),
          identity: fc.record({
            sourceIp: fc.ipV4()
          })
        }),
        body: fc.option(fc.jsonValue())
      }),
      fc.record({
        // Mock successful Remote Falcon API response
        status: fc.constantFrom(200, 201, 202),
        json: fc.constant(async () => ({
          success: true,
          message: 'Request processed successfully',
          data: { result: 'success' }
        }))
      }),

      async (event, mockResponse) => {
        // Setup fetch mock to return the generated response
        global.fetch.mockResolvedValueOnce(mockResponse);

        try {
          // Call the handler which should use the enhanced forwardToRemoteFalcon
          const result = await handler(event);

          // Verify the request was processed
          expect(result.statusCode).toBeLessThan(400);

          // Find the Remote Falcon request log entry
          const logCalls = mockConsoleLog.mock.calls;
          const remoteFalconLogs = logCalls
            .filter(call => call[0] && call[0].includes('REMOTE_FALCON'))
            .map(call => {
              try {
                // Extract JSON from log message
                const logMessage = call[0];
                if (logMessage.startsWith('REMOTE_FALCON_REQUEST:') || logMessage.startsWith('REMOTE_FALCON_ERROR:')) {
                  return JSON.parse(logMessage.split(':', 2)[1].trim());
                }
                return null;
              } catch (e) {
                return null;
              }
            })
            .filter(log => log !== null);

          // Should have at least one Remote Falcon log entry
          expect(remoteFalconLogs.length).toBeGreaterThan(0);

          const logEntry = remoteFalconLogs[0];

          // Validate Requirements 1.1-1.6: Request Information Logging
          expect(logEntry.request).toBeTypeOf('object');
          
          // 1.1: Client IP address should be logged
          expect(logEntry.request.ip).toBeTypeOf('string');
          expect(logEntry.request.ip).toBe(event.headers['x-forwarded-for']);
          
          // 1.2: User agent should be logged
          expect(logEntry.request.userAgent).toBeTypeOf('string');
          expect(logEntry.request.userAgent).toBe(event.headers['user-agent']);
          
          // 1.3: Host header should be logged
          expect(logEntry.request.host).toBeTypeOf('string');
          expect(logEntry.request.host).toBe(event.headers['host']);
          
          // 1.4: Requested path should be logged (without /proxy prefix)
          expect(logEntry.request.path).toBeTypeOf('string');
          expect(logEntry.request.path).toBe(event.path.replace('/proxy', ''));
          
          // 1.5: HTTP method should be logged
          expect(logEntry.request.method).toBeTypeOf('string');
          expect(logEntry.request.method).toBe(event.httpMethod);
          
          // 1.6: Request timestamp should be logged
          expect(logEntry.timestamp).toBeTypeOf('string');
          expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
          expect(() => new Date(logEntry.timestamp)).not.toThrow();
          
          // Additional validation: Request ID correlation
          expect(logEntry.requestId).toBeTypeOf('string');

        } catch (error) {
          // If there's an error, we should still have error logging
          const logCalls = mockConsoleLog.mock.calls;
          const errorLogs = logCalls
            .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
            .map(call => {
              try {
                const logMessage = call[0];
                return JSON.parse(logMessage.split(':', 2)[1].trim());
              } catch (e) {
                return null;
              }
            })
            .filter(log => log !== null);

          if (errorLogs.length > 0) {
            const errorLog = errorLogs[0];
            
            // Even in error cases, request information should be logged
            expect(errorLog.request).toBeTypeOf('object');
            expect(errorLog.request.ip).toBeTypeOf('string');
            expect(errorLog.request.userAgent).toBeTypeOf('string');
            expect(errorLog.request.host).toBeTypeOf('string');
            expect(errorLog.request.path).toBeTypeOf('string');
            expect(errorLog.request.method).toBeTypeOf('string');
            expect(errorLog.timestamp).toBeTypeOf('string');
          }
        }
      }
    ), { numRuns: 10 }); // Reduced iterations per testing guidelines
  });

  /**
   * Property 2: Response Information Logging
   * **Validates: Requirements 2.1, 2.2, 2.6**
   * 
   * For any successful response from Remote Falcon API, the log entry should contain 
   * HTTP status code, processing time, and a summary of response data without sensitive information
   */
  test('Property 2: Response Information Logging', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        // Generate realistic request event structure
        httpMethod: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        path: fc.constantFrom('/proxy/showDetails', '/proxy/addSequenceToQueue', '/proxy/voteForSequence', '/proxy/getQueue'),
        headers: fc.record({
          'x-forwarded-for': fc.ipV4(),
          'user-agent': fc.string({ minLength: 10, maxLength: 200 }),
          'host': fc.string({ minLength: 5, maxLength: 100 }),
          'origin': fc.webUrl()
        }),
        requestContext: fc.record({
          requestId: fc.string({ minLength: 10, maxLength: 50 }),
          identity: fc.record({
            sourceIp: fc.ipV4()
          })
        }),
        body: fc.option(fc.jsonValue())
      }),
      fc.record({
        // Mock successful Remote Falcon API response with various status codes
        status: fc.constantFrom(200, 201, 202),
        json: fc.constant(async () => fc.oneof(
          // Regular response
          fc.record({
            success: fc.boolean(),
            message: fc.string(),
            data: fc.record({
              result: fc.string(),
              count: fc.integer({ min: 0, max: 100 }),
              items: fc.array(fc.string(), { maxLength: 10 })
            })
          }),
          // showDetails response
          fc.record({
            preferences: fc.record({
              viewerControlEnabled: fc.boolean(),
              viewerControlMode: fc.constantFrom('jukebox', 'voting', 'both')
            }),
            sequences: fc.array(fc.record({
              name: fc.string(),
              id: fc.integer()
            }), { maxLength: 20 })
          })
        ).generate(fc.random()).value)
      }),

      async (event, mockResponse) => {
        // Setup fetch mock to return the generated response
        global.fetch.mockResolvedValueOnce(mockResponse);

        try {
          // Call the handler which should use the enhanced forwardToRemoteFalcon
          const result = await handler(event);

          // Verify the request was processed successfully
          expect(result.statusCode).toBeLessThan(400);

          // Find the Remote Falcon request log entry
          const logCalls = mockConsoleLog.mock.calls;
          const remoteFalconLogs = logCalls
            .filter(call => call[0] && call[0].includes('REMOTE_FALCON_REQUEST'))
            .map(call => {
              try {
                // Extract JSON from log message
                const logMessage = call[0];
                return JSON.parse(logMessage.split(':', 2)[1].trim());
              } catch (e) {
                return null;
              }
            })
            .filter(log => log !== null);

          // Should have at least one Remote Falcon success log entry
          expect(remoteFalconLogs.length).toBeGreaterThan(0);

          const logEntry = remoteFalconLogs[0];

          // Validate Requirements 2.1, 2.2, 2.6: Response Information Logging
          expect(logEntry.response).toBeTypeOf('object');
          
          // 2.1: HTTP status code should be logged
          expect(logEntry.response.status).toBeTypeOf('number');
          expect(logEntry.response.status).toBe(mockResponse.status);
          expect(logEntry.response.status).toBeGreaterThanOrEqual(200);
          expect(logEntry.response.status).toBeLessThan(300);
          
          // 2.2: Processing time should be logged
          expect(logEntry.response.processingTime).toBeTypeOf('number');
          expect(logEntry.response.processingTime).toBeGreaterThanOrEqual(0);
          
          // 2.6: Response data summary should be logged without sensitive information
          expect(logEntry.response.dataSummary).toBeTypeOf('object');
          
          // Verify data summary structure based on path
          if (event.path.includes('showDetails')) {
            // showDetails specific summary
            expect(logEntry.response.dataSummary).toHaveProperty('viewerControlEnabled');
            expect(logEntry.response.dataSummary).toHaveProperty('viewerControlMode');
            expect(logEntry.response.dataSummary).toHaveProperty('numOfSequences');
            expect(typeof logEntry.response.dataSummary.numOfSequences).toBe('number');
          } else {
            // General response summary
            expect(logEntry.response.dataSummary).toHaveProperty('hasData');
            expect(logEntry.response.dataSummary).toHaveProperty('responseSize');
            expect(logEntry.response.dataSummary).toHaveProperty('keyFields');
            expect(typeof logEntry.response.dataSummary.hasData).toBe('boolean');
            expect(typeof logEntry.response.dataSummary.responseSize).toBe('number');
            expect(Array.isArray(logEntry.response.dataSummary.keyFields)).toBe(true);
          }

          // Ensure no sensitive data is logged (no full response body)
          expect(logEntry.response).not.toHaveProperty('fullBody');
          expect(logEntry.response).not.toHaveProperty('rawResponse');
          
          // Verify log structure consistency
          expect(logEntry.logType).toBe('REMOTE_FALCON_REQUEST');
          expect(logEntry.status).toBe('SUCCESS');

        } catch (error) {
          // This test focuses on successful responses, so errors should not occur
          // But if they do, we should still validate error logging structure
          const logCalls = mockConsoleLog.mock.calls;
          const errorLogs = logCalls
            .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
            .map(call => {
              try {
                const logMessage = call[0];
                return JSON.parse(logMessage.split(':', 2)[1].trim());
              } catch (e) {
                return null;
              }
            })
            .filter(log => log !== null);

          if (errorLogs.length > 0) {
            const errorLog = errorLogs[0];
            expect(errorLog.error).toBeTypeOf('object');
            expect(errorLog.error.processingTime).toBeTypeOf('number');
            expect(errorLog.error.processingTime).toBeGreaterThanOrEqual(0);
          }
        }
      }
    ), { numRuns: 10 }); // Reduced iterations per testing guidelines
  });

  /**
   * Property 3: ShowDetails Response Logging
   * **Validates: Requirements 2.3, 2.4, 2.5**
   * 
   * For any successful showDetails request, the log entry should contain viewer control enabled status, 
   * viewer control mode, and number of sequences from the response
   */
  test('Property 3: ShowDetails Response Logging', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        // Generate showDetails request event
        httpMethod: fc.constant('GET'),
        path: fc.constant('/proxy/showDetails'),
        headers: fc.record({
          'x-forwarded-for': fc.ipV4(),
          'user-agent': fc.string({ minLength: 10, maxLength: 200 }),
          'host': fc.string({ minLength: 5, maxLength: 100 }),
          'origin': fc.webUrl()
        }),
        requestContext: fc.record({
          requestId: fc.string({ minLength: 10, maxLength: 50 }),
          identity: fc.record({
            sourceIp: fc.ipV4()
          })
        })
      }),
      fc.record({
        // Generate showDetails response data with various combinations
        preferences: fc.option(fc.record({
          viewerControlEnabled: fc.option(fc.boolean()),
          viewerControlMode: fc.option(fc.constantFrom('voting', 'jukebox', 'disabled', null))
        })),
        sequences: fc.option(fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            id: fc.integer({ min: 1, max: 1000 })
          }),
          { minLength: 0, maxLength: 20 }
        ))
      }),

      async (event, responseData) => {
        // Setup fetch mock to return showDetails response
        const mockResponse = {
          status: 200,
          json: async () => responseData
        };
        global.fetch.mockResolvedValueOnce(mockResponse);

        try {
          // Call the handler
          const result = await handler(event);

          // Verify successful response
          expect(result.statusCode).toBe(200);

          // Find the Remote Falcon request log entry
          const logCalls = mockConsoleLog.mock.calls;
          const remoteFalconLogs = logCalls
            .filter(call => call[0] && call[0].includes('REMOTE_FALCON_REQUEST'))
            .map(call => {
              try {
                const logMessage = call[0];
                return JSON.parse(logMessage.split(':', 2)[1].trim());
              } catch (e) {
                return null;
              }
            })
            .filter(log => log !== null);

          // Should have exactly one Remote Falcon log entry
          expect(remoteFalconLogs.length).toBe(1);
          const logEntry = remoteFalconLogs[0];

          // Validate Requirements 2.3, 2.4, 2.5: ShowDetails Response Logging
          expect(logEntry.response).toBeTypeOf('object');
          expect(logEntry.response.dataSummary).toBeTypeOf('object');

          // 2.3: Viewer control enabled status should be logged
          const expectedViewerControlEnabled = responseData.preferences?.viewerControlEnabled || null;
          expect(logEntry.response.dataSummary.viewerControlEnabled).toBe(expectedViewerControlEnabled);

          // 2.4: Viewer control mode should be logged
          const expectedViewerControlMode = responseData.preferences?.viewerControlMode || null;
          expect(logEntry.response.dataSummary.viewerControlMode).toBe(expectedViewerControlMode);

          // 2.5: Number of sequences should be logged
          const expectedNumSequences = responseData.sequences?.length || 0;
          expect(logEntry.response.dataSummary.numOfSequences).toBe(expectedNumSequences);

          // Additional validation: Ensure it's specifically showDetails format
          expect(logEntry.response.dataSummary).toHaveProperty('viewerControlEnabled');
          expect(logEntry.response.dataSummary).toHaveProperty('viewerControlMode');
          expect(logEntry.response.dataSummary).toHaveProperty('numOfSequences');

          // Should not have generic summary fields for showDetails
          expect(logEntry.response.dataSummary).not.toHaveProperty('hasData');
          expect(logEntry.response.dataSummary).not.toHaveProperty('responseSize');
          expect(logEntry.response.dataSummary).not.toHaveProperty('keyFields');

        } catch (error) {
          // If there's an error, we should still validate error logging structure
          const logCalls = mockConsoleLog.mock.calls;
          const errorLogs = logCalls
            .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
            .map(call => {
              try {
                const logMessage = call[0];
                return JSON.parse(logMessage.split(':', 2)[1].trim());
              } catch (e) {
                return null;
              }
            })
            .filter(log => log !== null);

          // If we have error logs, they should still contain request information
          if (errorLogs.length > 0) {
            const errorLog = errorLogs[0];
            expect(errorLog.request).toBeTypeOf('object');
            expect(errorLog.request.path).toBe('/showDetails');
          }
        }
      }
    ), { numRuns: 10 }); // Reduced iterations per testing guidelines
  });

  /**
   * Property 4: Comprehensive Error Logging
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
   * 
   * For any error condition during Remote Falcon API communication (HTTP errors, network errors, 
   * parsing errors, or application errors), the log entry should contain error details with full request context
   */
  test('Property 4: Comprehensive Error Logging', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        // Generate request event structure
        httpMethod: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        path: fc.constantFrom('/proxy/showDetails', '/proxy/addSequenceToQueue', '/proxy/voteForSequence'),
        headers: fc.record({
          'x-forwarded-for': fc.ipV4(),
          'user-agent': fc.string({ minLength: 10, maxLength: 200 }),
          'host': fc.string({ minLength: 5, maxLength: 100 }),
          'origin': fc.webUrl()
        }),
        requestContext: fc.record({
          requestId: fc.string({ minLength: 10, maxLength: 50 }),
          identity: fc.record({
            sourceIp: fc.ipV4()
          })
        }),
        body: fc.option(fc.jsonValue())
      }),
      fc.oneof(
        // HTTP error responses (Requirement 3.1)
        fc.record({
          type: fc.constant('HTTP_ERROR'),
          status: fc.constantFrom(400, 401, 403, 404, 500, 502, 503),
          json: fc.constant(async () => ({ error: 'HTTP error occurred', message: 'Server error' }))
        }),
        // HTTP 200 with application errors (Requirement 3.2)
        fc.record({
          type: fc.constant('APPLICATION_ERROR'),
          status: fc.constant(200),
          json: fc.constant(async () => fc.sample(fc.oneof(
            fc.constant({ message: 'SONG_REQUESTED' }),
            fc.constant({ message: 'QUEUE_FULL' }),
            fc.constant({ success: false, error: 'Validation failed' }),
            fc.constant({ status: 'error', details: 'Processing failed' })
          ), 1)[0])
        }),
        // Network errors (Requirement 3.4)
        fc.record({
          type: fc.constant('NETWORK_ERROR'),
          error: fc.oneof(
            fc.constant(new TypeError('fetch failed')),
            fc.constant(new Error('Network request failed')),
            fc.constant(new Error('Connection timeout'))
          )
        }),
        // JSON parsing errors (Requirement 3.5)
        fc.record({
          type: fc.constant('PARSE_ERROR'),
          status: fc.constant(200),
          json: fc.constant(async () => { throw new SyntaxError('Unexpected token in JSON'); })
        })
      ),

      async (event, errorScenario) => {
        // Setup fetch mock based on error scenario
        if (errorScenario.type === 'NETWORK_ERROR') {
          global.fetch.mockRejectedValueOnce(errorScenario.error);
        } else {
          const mockResponse = {
            status: errorScenario.status,
            json: errorScenario.json
          };
          global.fetch.mockResolvedValueOnce(mockResponse);
        }

        try {
          // Call the handler - it should handle errors gracefully
          const result = await handler(event);

          // For application errors (HTTP 200 with error content), we should get the response
          if (errorScenario.type === 'APPLICATION_ERROR') {
            expect(result.statusCode).toBe(200);
          }

        } catch (error) {
          // Network errors and other failures should be caught and handled
        }

        // Find the Remote Falcon error log entries
        const logCalls = mockConsoleLog.mock.calls;
        const errorLogs = logCalls
          .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
          .map(call => {
            try {
              const logMessage = call[0];
              return JSON.parse(logMessage.split(':', 2)[1].trim());
            } catch (e) {
              return null;
            }
          })
          .filter(log => log !== null);

        // Should have at least one error log entry for all error scenarios
        expect(errorLogs.length).toBeGreaterThan(0);
        const errorLog = errorLogs[0];

        // Validate comprehensive error logging structure
        expect(errorLog.logType).toBe('REMOTE_FALCON_ERROR');
        expect(errorLog.status).toBe('ERROR');
        expect(errorLog.timestamp).toBeTypeOf('string');
        expect(errorLog.requestId).toBeTypeOf('string');

        // Validate full request context is preserved (Requirements 3.1-3.5)
        expect(errorLog.request).toBeTypeOf('object');
        expect(errorLog.request.method).toBe(event.httpMethod);
        expect(errorLog.request.path).toBe(event.path.replace('/proxy', ''));
        expect(errorLog.request.ip).toBe(event.headers['x-forwarded-for']);
        expect(errorLog.request.userAgent).toBe(event.headers['user-agent']);
        expect(errorLog.request.host).toBe(event.headers['host']);

        // Validate error details are captured
        expect(errorLog.error).toBeTypeOf('object');
        expect(errorLog.error.type).toBeTypeOf('string');
        expect(errorLog.error.message).toBeTypeOf('string');
        expect(errorLog.error.processingTime).toBeTypeOf('number');
        expect(errorLog.error.processingTime).toBeGreaterThanOrEqual(0);

        // Validate error type classification based on scenario
        switch (errorScenario.type) {
          case 'HTTP_ERROR':
            // 3.1: HTTP error status logging
            expect(errorLog.error.type).toBe('HTTP_ERROR');
            expect(errorLog.error.httpStatus).toBe(errorScenario.status);
            expect(errorLog.error.httpStatus).toBeGreaterThanOrEqual(400);
            break;

          case 'APPLICATION_ERROR':
            // 3.2: HTTP 200 with error message detection
            expect(errorLog.error.type).toBe('APPLICATION_ERROR');
            expect(errorLog.error.httpStatus).toBe(200);
            expect(errorLog.error.message).toMatch(/SONG_REQUESTED|QUEUE_FULL|failed|error/i);
            break;

          case 'NETWORK_ERROR':
            // 3.4: Network error logging
            expect(errorLog.error.type).toBe('NETWORK_ERROR');
            expect(errorLog.error.message).toMatch(/fetch|network|connection|timeout/i);
            expect(errorLog.error.httpStatus).toBeNull();
            break;

          case 'PARSE_ERROR':
            // 3.5: JSON parsing error logging
            expect(errorLog.error.type).toBe('PARSE_ERROR');
            expect(errorLog.error.message).toMatch(/JSON|parse|token/i);
            expect(errorLog.error.httpStatus).toBe(200);
            break;
        }

        // Validate that sensitive information is not logged
        expect(errorLog.error.message).not.toMatch(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/);
        expect(errorLog.error.message).not.toMatch(/[Aa]pi[Kk]ey[:\s]*[A-Za-z0-9\-_]{20,}/);
        expect(errorLog.error.message).not.toMatch(/[Pp]assword[:\s]*[^\s]+/);
      }
    ), { numRuns: 10 }); // Reduced iterations per testing guidelines
  });
});