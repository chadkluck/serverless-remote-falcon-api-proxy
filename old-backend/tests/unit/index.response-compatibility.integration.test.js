/**
const { MockEventLoader } = require('../utils/mockLoader');
 * Integration tests for response compatibility validation
 * Feature: remote-falcon-logging-enhancement
 * Task 8.2: Write integration tests for response compatibility
 * 
 * Tests that successful responses match original structure, error responses match original structure,
 * and response timing remains within acceptable bounds
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
 */

// Jest globals are available

// Mock AWS SDK
jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn(() => ({
    send: jest.fn()
      .mockResolvedValueOnce({ Parameter: { Value: 'test-access-token' } })
      .mockResolvedValueOnce({ Parameter: { Value: 'test-secret-key' } })
  })),
  GetParameterCommand: jest.fn()
}));

// Mock jose
jest.mock('jose', () => ({
  SignJWT: jest.fn(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token')
  }))
}));

// Mock fetch globally
global.fetch = jest.fn();

// Import the enhanced functions
const { handler, ClientInfo, RemoteFalconLogBuilder } = require('../../src/index.js');

// Mock console.log to capture log entries
const mockConsoleLog = jest.fn();
const originalConsoleLog = console.log;

describe('Response Compatibility Integration Tests', () => {
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
   * Test that successful responses match original structure
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
   */
  test('successful responses match original structure', async () => {
    // Mock successful Remote Falcon API response
    const mockResponseData = {
      success: true,
      message: 'Request processed successfully',
      data: { result: 'success', timestamp: Date.now() },
      preferences: {
        viewerControlEnabled: true,
        viewerControlMode: 'jukebox'
      },
      sequences: [
        { id: 1, name: 'Sequence 1' },
        { id: 2, name: 'Sequence 2' }
      ]
    };

    global.fetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      json: async () => mockResponseData
    });

    const event = {
      httpMethod: 'GET',
      path: '/proxy/showDetails',
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0 Test Browser',
        'host': 'api.example.com',
        'origin': 'https://example.com'
      },
      requestContext: {
        requestId: 'test-request-id-123',
        identity: {
          sourceIp: '192.168.1.1'
        }
      },
      body: null
    };

    const startTime = Date.now();
    const result = await handler(event);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

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
    expect(responseBody).toEqual(mockResponseData);
    
    // **Requirement 6.3**: Response status code should match Remote Falcon API response
    expect(result.statusCode).toBe(200);
    
    // **Requirement 6.5**: No logging metadata should be added to client responses
    expect(responseBody).not.toHaveProperty('logType');
    expect(responseBody).not.toHaveProperty('requestId');
    expect(responseBody).not.toHaveProperty('timestamp');
    expect(responseBody).not.toHaveProperty('clientInfo');
    expect(responseBody).not.toHaveProperty('processingTime');
    
    // Verify that logging occurred but didn't affect response
    expect(mockConsoleLog).toHaveBeenCalled();
    
    // Verify response timing is reasonable (should be under 1 second for mocked response)
    expect(responseTime).toBeLessThan(1000);
    
    // Verify that the logged data is separate from the client response
    const logCalls = mockConsoleLog.mock.calls;
    let foundLogEntry = false;
    for (const call of logCalls) {
      const logMessage = call[0];
      if (logMessage.includes('REMOTE_FALCON_REQUEST')) {
        foundLogEntry = true;
        const logData = JSON.parse(logMessage.split(': ')[1]);
        expect(logData).toHaveProperty('logType', 'REMOTE_FALCON_REQUEST');
        expect(logData).toHaveProperty('requestId');
        expect(logData).toHaveProperty('timestamp');
        
        // Verify log data doesn't leak into client response
        expect(responseBody).not.toEqual(logData);
      }
    }
    expect(foundLogEntry).toBe(true);
  });

  /**
   * Test that error responses match original structure
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
   */
  test('error responses match original structure', async () => {
    // Mock error Remote Falcon API response
    const mockErrorData = {
      success: false,
      message: 'Request failed',
      error: 'Something went wrong',
      code: 'INVALID_REQUEST'
    };

    global.fetch.mockResolvedValueOnce({
      status: 400,
      statusText: 'Bad Request',
      json: async () => mockErrorData
    });

    const event = {
      httpMethod: 'POST',
      path: '/proxy/addSequenceToQueue',
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0 Test Browser',
        'host': 'api.example.com',
        'origin': 'https://example.com'
      },
      requestContext: {
        requestId: 'test-request-id-456',
        identity: {
          sourceIp: '192.168.1.1'
        }
      },
      body: JSON.stringify({ sequenceId: 123 })
    };

    const startTime = Date.now();
    const result = await handler(event);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // **Requirement 6.1**: Response structure should remain unchanged
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('body');
    expect(result).toHaveProperty('headers');
    
    // **Requirement 6.2**: Response data content should not be modified
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toEqual(mockErrorData);
    
    // **Requirement 6.3**: Response status code should match Remote Falcon API response
    expect(result.statusCode).toBe(400);
    
    // **Requirement 6.5**: No logging metadata should be added to client responses
    expect(responseBody).not.toHaveProperty('logType');
    expect(responseBody).not.toHaveProperty('requestId');
    expect(responseBody).not.toHaveProperty('timestamp');
    expect(responseBody).not.toHaveProperty('clientInfo');
    expect(responseBody).not.toHaveProperty('processingTime');
    
    // Verify that error logging occurred but didn't affect response
    expect(mockConsoleLog).toHaveBeenCalled();
    
    // Verify response timing is reasonable
    expect(responseTime).toBeLessThan(1000);
    
    // Verify that the logged error data is separate from the client response
    const logCalls = mockConsoleLog.mock.calls;
    let foundErrorLogEntry = false;
    for (const call of logCalls) {
      const logMessage = call[0];
      if (logMessage.includes('REMOTE_FALCON_ERROR')) {
        foundErrorLogEntry = true;
        const logData = JSON.parse(logMessage.split(': ')[1]);
        expect(logData).toHaveProperty('logType', 'REMOTE_FALCON_ERROR');
        expect(logData).toHaveProperty('requestId');
        expect(logData).toHaveProperty('timestamp');
        
        // Verify log data doesn't leak into client response
        expect(responseBody).not.toEqual(logData);
      }
    }
    expect(foundErrorLogEntry).toBe(true);
  });

  /**
   * Test that application error responses (HTTP 200 with error message) match original structure
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
   */
  test('application error responses match original structure', async () => {
    // Mock application error response (HTTP 200 but with error message)
    const mockAppErrorData = {
      message: 'SONG_REQUESTED',
      details: 'User has already requested a song'
    };

    global.fetch.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      json: async () => mockAppErrorData
    });

    const event = {
      httpMethod: 'POST',
      path: '/proxy/addSequenceToQueue',
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0 Test Browser',
        'host': 'api.example.com',
        'origin': 'https://example.com'
      },
      requestContext: {
        requestId: 'test-request-id-789',
        identity: {
          sourceIp: '192.168.1.1'
        }
      },
      body: JSON.stringify({ sequenceId: 456 })
    };

    const startTime = Date.now();
    const result = await handler(event);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // **Requirement 6.1**: Response structure should remain unchanged
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('body');
    expect(result).toHaveProperty('headers');
    
    // **Requirement 6.2**: Response data content should not be modified
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toEqual(mockAppErrorData);
    
    // **Requirement 6.3**: Response status code should match Remote Falcon API response (200)
    expect(result.statusCode).toBe(200);
    
    // **Requirement 6.5**: No logging metadata should be added to client responses
    expect(responseBody).not.toHaveProperty('logType');
    expect(responseBody).not.toHaveProperty('requestId');
    expect(responseBody).not.toHaveProperty('timestamp');
    expect(responseBody).not.toHaveProperty('clientInfo');
    expect(responseBody).not.toHaveProperty('processingTime');
    
    // Verify that application error logging occurred but didn't affect response
    expect(mockConsoleLog).toHaveBeenCalled();
    
    // Verify response timing is reasonable
    expect(responseTime).toBeLessThan(1000);
    
    // Verify that the logged error data is separate from the client response
    const logCalls = mockConsoleLog.mock.calls;
    let foundErrorLogEntry = false;
    for (const call of logCalls) {
      const logMessage = call[0];
      if (logMessage.includes('REMOTE_FALCON_ERROR')) {
        foundErrorLogEntry = true;
        const logData = JSON.parse(logMessage.split(': ')[1]);
        expect(logData).toHaveProperty('logType', 'REMOTE_FALCON_ERROR');
        expect(logData).toHaveProperty('requestId');
        expect(logData).toHaveProperty('timestamp');
        
        // Verify log data doesn't leak into client response
        expect(responseBody).not.toEqual(logData);
      }
    }
    expect(foundErrorLogEntry).toBe(true);
  });

  /**
   * Test that response timing remains within acceptable bounds
   * **Validates: Requirements 6.5**
   */
  test('response timing remains within acceptable bounds', async () => {
    // Mock multiple different response scenarios to test timing consistency
    const testCases = [
      {
        name: 'successful response',
        mockResponse: {
          status: 200,
          statusText: 'OK',
          json: async () => ({ success: true, data: 'test' })
        }
      },
      {
        name: 'error response',
        mockResponse: {
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ success: false, error: 'Server error' })
        }
      },
      {
        name: 'application error',
        mockResponse: {
          status: 200,
          statusText: 'OK',
          json: async () => ({ message: 'QUEUE_FULL' })
        }
      }
    ];

    const responseTimes = [];

    for (const testCase of testCases) {
      // Reset mocks for each test case
      jest.clearAllMocks();
      console.log = mockConsoleLog;
      
      global.fetch.mockResolvedValueOnce(testCase.mockResponse);

      const event = {
        httpMethod: 'GET',
        path: '/proxy/showDetails',
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 Test Browser',
          'host': 'api.example.com',
          'origin': 'https://example.com'
        },
        requestContext: {
          requestId: `test-timing-${testCase.name}`,
          identity: {
            sourceIp: '192.168.1.1'
          }
        },
        body: null
      };

      const startTime = Date.now();
      const result = await handler(event);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      responseTimes.push(responseTime);

      // Verify response structure is maintained regardless of timing
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('headers');
      
      // Verify response time is reasonable (under 1 second for mocked responses)
      expect(responseTime).toBeLessThan(1000);
      
      // Verify logging occurred without affecting response timing significantly
      expect(mockConsoleLog).toHaveBeenCalled();
    }

    // Verify that response times are consistent across different response types
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const maxDeviation = Math.max(...responseTimes.map(time => Math.abs(time - avgResponseTime)));
    
    // Response times should be consistent (within 500ms of average for mocked responses)
    expect(maxDeviation).toBeLessThan(500);
    
    // All response times should be reasonable
    responseTimes.forEach(time => {
      expect(time).toBeLessThan(1000);
      expect(time).toBeGreaterThan(0);
    });
  });

  /**
   * Test network error handling preserves error behavior
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
   */
  test('network error handling preserves error behavior', async () => {
    // Mock network error
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const event = {
      httpMethod: 'GET',
      path: '/proxy/showDetails',
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0 Test Browser',
        'host': 'api.example.com',
        'origin': 'https://example.com'
      },
      requestContext: {
        requestId: 'test-network-error',
        identity: {
          sourceIp: '192.168.1.1'
        }
      },
      body: null
    };

    // Network errors should be thrown as expected
    await expect(handler(event)).rejects.toThrow('Failed to communicate with Remote Falcon API');
    
    // Verify error logging occurred
    expect(mockConsoleLog).toHaveBeenCalled();
    
    // Verify that the logged error data contains expected structure
    const logCalls = mockConsoleLog.mock.calls;
    let foundErrorLogEntry = false;
    for (const call of logCalls) {
      const logMessage = call[0];
      if (logMessage.includes('REMOTE_FALCON_ERROR')) {
        foundErrorLogEntry = true;
        const logData = JSON.parse(logMessage.split(': ')[1]);
        expect(logData).toHaveProperty('logType', 'REMOTE_FALCON_ERROR');
        expect(logData).toHaveProperty('requestId');
        expect(logData).toHaveProperty('timestamp');
        expect(logData).toHaveProperty('error');
        expect(logData.error).toHaveProperty('type', 'NETWORK_ERROR');
      }
    }
    expect(foundErrorLogEntry).toBe(true);
  });
});