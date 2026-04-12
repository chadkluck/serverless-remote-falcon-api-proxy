/**
 * Property-based tests for response compatibility validation
 * Feature: remote-falcon-logging-enhancement
 * Task 8.1: Write property test for response compatibility
 * 
 * **Property 7: Response Compatibility**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
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

// Import the enhanced functions from backend-index.js (which has the enhanced version)
const { handler, ClientInfo, RemoteFalconLogBuilder } = require('../../src/index.js');

// Mock console.log to capture log entries
const mockConsoleLog = jest.fn();
const originalConsoleLog = console.log;

describe('Response Compatibility Property Tests', () => {
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
   * Property 7: Response Compatibility
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
   * 
   * For any Remote Falcon API request, the client response structure, data content, 
   * and error handling behavior should remain unchanged from the original implementation
   */
  test('Property 7: Response Compatibility', async () => {
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
      fc.oneof(
        // Success response scenarios
        fc.record({
          status: fc.constantFrom(200, 201, 202),
          statusText: fc.constant('OK'),
          json: fc.constant(async () => ({
            success: true,
            message: 'Request processed successfully',
            data: { result: 'success', timestamp: Date.now() },
            preferences: {
              viewerControlEnabled: fc.sample(fc.boolean(), 1)[0],
              viewerControlMode: fc.sample(fc.constantFrom('jukebox', 'voting'), 1)[0]
            },
            sequences: fc.sample(fc.array(fc.record({
              id: fc.integer(),
              name: fc.string()
            })), 1)[0]
          }))
        }),
        // Error response scenarios
        fc.record({
          status: fc.constantFrom(400, 401, 403, 404, 500, 502, 503),
          statusText: fc.constantFrom('Bad Request', 'Unauthorized', 'Forbidden', 'Not Found', 'Internal Server Error'),
          json: fc.constant(async () => ({
            success: false,
            message: 'Request failed',
            error: 'Something went wrong'
          }))
        }),
        // Application error scenarios (HTTP 200 with error message)
        fc.record({
          status: fc.constant(200),
          statusText: fc.constant('OK'),
          json: fc.constant(async () => ({
            message: fc.sample(fc.constantFrom('SONG_REQUESTED', 'QUEUE_FULL', 'ERROR'), 1)[0]
          }))
        })
      ),

      async (event, mockResponse) => {
        // Setup fetch mock to return the generated response
        global.fetch.mockResolvedValueOnce(mockResponse);

        try {
          // Call the enhanced handler
          const result = await handler(event);

          // **Requirement 6.1**: Response structure should remain unchanged
          expect(result).toHaveProperty('statusCode');
          expect(result).toHaveProperty('body');
          expect(result).toHaveProperty('headers');
          
          // Verify the response structure matches expected format
          expect(typeof result.statusCode).toBe('number');
          expect(typeof result.body).toBe('string'); // Should be JSON string
          expect(typeof result.headers).toBe('object');
          
          // **Requirement 6.2**: Response data content should not be modified
          const responseBody = JSON.parse(result.body);
          const expectedResponseData = await mockResponse.json();
          
          // The response body should contain the same data as the mock response
          // (logging should not modify the actual response data)
          if (mockResponse.status >= 400) {
            // For error responses, verify error structure is preserved
            expect(responseBody).toEqual(expectedResponseData);
          } else {
            // For success responses, verify data structure is preserved
            expect(responseBody).toEqual(expectedResponseData);
          }
          
          // **Requirement 6.3**: Response status code should match Remote Falcon API response
          expect(result.statusCode).toBe(mockResponse.status);
          
          // **Requirement 6.5**: No logging metadata should be added to client responses
          expect(responseBody).not.toHaveProperty('logType');
          expect(responseBody).not.toHaveProperty('requestId');
          expect(responseBody).not.toHaveProperty('timestamp');
          expect(responseBody).not.toHaveProperty('clientInfo');
          expect(responseBody).not.toHaveProperty('processingTime');
          
          // Verify that logging occurred (should have console.log calls) but didn't affect response
          expect(mockConsoleLog).toHaveBeenCalled();
          
          // Verify that the logged data is separate from the client response
          const logCalls = mockConsoleLog.mock.calls;
          for (const call of logCalls) {
            const logMessage = call[0];
            if (logMessage.includes('REMOTE_FALCON_REQUEST') || logMessage.includes('REMOTE_FALCON_ERROR')) {
              // Parse the log entry to verify it's separate from client response
              const logData = JSON.parse(logMessage.split(': ')[1]);
              expect(logData).toHaveProperty('logType');
              expect(logData).toHaveProperty('requestId');
              expect(logData).toHaveProperty('timestamp');
              
              // Verify log data doesn't leak into client response
              expect(responseBody).not.toEqual(logData);
            }
          }

        } catch (error) {
          // For network errors or other exceptions, verify error handling behavior is preserved
          expect(error.message).toBe('Failed to communicate with Remote Falcon API');
          
          // Verify error logging occurred
          expect(mockConsoleLog).toHaveBeenCalled();
          
          // Verify the error thrown to client is the expected generic error
          // (not exposing internal logging details)
          expect(error.message).not.toContain('logType');
          expect(error.message).not.toContain('requestId');
          expect(error.message).not.toContain('clientInfo');
        }
      }
    ), { numRuns: 20 }); // Reduced iterations for performance per testing guidelines
  });
});