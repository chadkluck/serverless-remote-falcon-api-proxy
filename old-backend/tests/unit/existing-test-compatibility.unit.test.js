/**
const { MockEventLoader } = require('../utils/mockLoader');
 * Unit tests for existing test compatibility with enhanced forwardToRemoteFalcon function
 * Task 10.1: Write unit tests for existing test compatibility
 * 
 * Tests that existing mocks work with enhanced function signature,
 * existing error handling tests still pass, and existing response validation tests still pass.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

// Jest globals are available

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn().mockImplementation(() => ({
    send: mockSend
  })),
  GetParameterCommand: jest.fn()
}));

// Mock jose
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token')
  }))
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock console.log to capture log entries
const mockConsoleLog = jest.fn();
const originalConsoleLog = console.log;

// Import the enhanced functions after mocking
const { handler, ClientInfo, RemoteFalconLogBuilder } = require('../../src/index.js');

describe('Existing Test Compatibility Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    
    // Set up environment variables
    process.env.REMOTE_FALCON_API_BASE_URL = 'https://api.remotefalcon.com';
    process.env.REMOTE_FALCON_ACCESS_TOKEN_PARAM = '/test/access-token';
    process.env.REMOTE_FALCON_SECRET_KEY_PARAM = '/test/secret-key';
    process.env.ALLOWED_ORIGINS = 'https://example.com,https://test.com';
    
    // Set up default SSM mock responses
    mockSend
      .mockResolvedValueOnce({ Parameter: { Value: 'test-access-token' } })
      .mockResolvedValueOnce({ Parameter: { Value: 'test-secret-key' } });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Enhanced Function Signature Compatibility', () => {
    test('should work with existing mocks that expect 6-parameter function signature', async () => {
      // **Requirement 7.1**: Test that existing mocks work with enhanced function signature
      
      // Mock fetch for successful response
      global.fetch.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ 
          success: true, 
          data: 'test-data',
          preferences: { viewerControlEnabled: true, viewerControlMode: 'jukebox' },
          sequences: [{ id: 1, name: 'Test Sequence' }]
        })
      });

      const event = {
        httpMethod: 'GET',
        path: '/proxy/showDetails',
        headers: {
          'origin': 'https://example.com',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Mozilla/5.0 (Test Browser)',
          'host': 'api.example.com'
        },
        requestContext: {
          requestId: 'test-request-123',
          identity: { sourceIp: '192.168.1.100' }
        }
      };

      const response = await handler(event);

      // Verify response structure is maintained
      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('data', 'test-data');

      // Verify fetch was called with correct parameters (enhanced signature should work)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.remotefalcon.com/showDetails',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Bearer /),
            'Content-Type': 'application/json'
          })
        })
      );

      // Verify enhanced logging occurred (new functionality)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/REMOTE_FALCON_REQUEST:/),
        expect.stringContaining('"status":"SUCCESS"')
      );
    });

    test('should maintain backward compatibility with existing ClientInfo usage', async () => {
      // **Requirement 7.1**: Test that existing ClientInfo usage still works
      
      const event = {
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1',
          'user-agent': 'Mozilla/5.0 (Test Browser)',
          'host': 'api.example.com'
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.100' }
        }
      };

      // Test that ClientInfo class works as expected
      const clientInfo = new ClientInfo(event);
      
      expect(clientInfo.ipAddress).toBe('192.168.1.100');
      expect(clientInfo.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      expect(clientInfo.host).toBe('api.example.com');

      // Test that toObject() method works (backward compatibility)
      const clientInfoObj = clientInfo.toObject();
      expect(clientInfoObj).toEqual({
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        host: 'api.example.com'
      });
    });
  });

  describe('Error Handling Compatibility', () => {
    test('should maintain existing error handling behavior for network errors', async () => {
      // **Requirement 7.2**: Test that existing error handling tests still pass
      
      // Mock fetch to throw network error
      global.fetch.mockRejectedValue(new Error('Network error'));

      const event = {
        httpMethod: 'POST',
        path: '/proxy/addSequenceToQueue',
        headers: {
          'origin': 'https://example.com',
          'x-forwarded-for': '192.168.1.101',
          'user-agent': 'Test Client/1.0',
          'host': 'api.test.com'
        },
        body: JSON.stringify({ sequenceId: 123 }),
        requestContext: {
          requestId: 'test-request-456',
          identity: { sourceIp: '192.168.1.101' }
        }
      };

      const response = await handler(event);

      // Verify error response maintains existing structure
      expect(response.statusCode).toBe(500);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toHaveProperty('message', 'Internal server error');
      expect(responseBody).toHaveProperty('error', 'INTERNAL_ERROR');
      expect(responseBody).toHaveProperty('requestId', 'test-request-456');
      expect(responseBody).toHaveProperty('timestamp');

      // Verify enhanced error logging occurred (new functionality)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/REMOTE_FALCON_ERROR:/),
        expect.stringContaining('"status":"ERROR"')
      );
    });

    test('should maintain existing error handling for HTTP error responses', async () => {
      // **Requirement 7.2**: Test that existing error handling tests still pass
      
      // Mock fetch for HTTP error response
      global.fetch.mockResolvedValue({
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ error: 'Invalid request' })
      });

      const event = {
        httpMethod: 'POST',
        path: '/proxy/addSequenceToQueue',
        headers: {
          'origin': 'https://example.com',
          'x-forwarded-for': '192.168.1.102',
          'user-agent': 'Test Client/1.0',
          'host': 'api.test.com'
        },
        body: JSON.stringify({ sequenceId: 999 }),
        requestContext: {
          requestId: 'test-request-789',
          identity: { sourceIp: '192.168.1.102' }
        }
      };

      const response = await handler(event);

      // Verify HTTP error response is returned to client (existing behavior)
      expect(response.statusCode).toBe(400);
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toHaveProperty('error', 'Invalid request');

      // Verify enhanced error logging occurred (new functionality)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/REMOTE_FALCON_ERROR:/),
        expect.stringContaining('"httpStatus":400')
      );
    });

    test('should maintain existing JWT token generation error handling', async () => {
      // **Requirement 7.2**: Test that existing error handling tests still pass
      
      // Mock SSM client to fail
      mockSend.mockReset().mockRejectedValue(new Error('SSM access denied'));

      const event = {
        httpMethod: 'GET',
        path: '/proxy/showDetails',
        headers: {
          'origin': 'https://example.com'
        },
        requestContext: {
          requestId: 'test-request-jwt-fail',
          identity: { sourceIp: '192.168.1.103' }
        }
      };

      const response = await handler(event);

      // Verify JWT error response maintains existing structure
      expect(response.statusCode).toBe(500);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toHaveProperty('message', 'Authentication service unavailable');
      expect(responseBody).toHaveProperty('error', 'AUTH_ERROR');
      expect(responseBody).toHaveProperty('requestId', 'test-request-jwt-fail');
    });
  });

  describe('Response Validation Compatibility', () => {
    test('should maintain existing response structure for successful requests', async () => {
      // **Requirement 7.3**: Test that existing response validation tests still pass
      
      const mockResponseData = {
        success: true,
        data: { result: 'success', timestamp: Date.now() },
        preferences: { viewerControlEnabled: true, viewerControlMode: 'jukebox' },
        sequences: [
          { id: 1, name: 'Sequence 1' },
          { id: 2, name: 'Sequence 2' }
        ]
      };

      // Mock fetch for successful response
      global.fetch.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponseData)
      });

      const event = {
        httpMethod: 'GET',
        path: '/proxy/showDetails',
        headers: {
          'origin': 'https://example.com',
          'x-forwarded-for': '192.168.1.104',
          'user-agent': 'Test Browser/1.0',
          'host': 'api.example.com'
        },
        requestContext: {
          requestId: 'test-response-structure',
          identity: { sourceIp: '192.168.1.104' }
        }
      };

      const response = await handler(event);

      // Verify response structure matches existing expectations
      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toEqual(mockResponseData);

      // Verify enhanced logging doesn't affect response structure
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/REMOTE_FALCON_REQUEST:/),
        expect.stringContaining('"viewerControlEnabled":true')
      );
    });

    test('should maintain existing CORS header behavior', async () => {
      // **Requirement 7.3**: Test that existing response validation tests still pass
      
      const event = {
        httpMethod: 'OPTIONS',
        path: '/proxy/showDetails',
        headers: {
          'origin': 'https://example.com'
        },
        requestContext: {
          requestId: 'test-cors-options'
        }
      };

      const response = await handler(event);

      // Verify CORS headers are maintained as expected
      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://example.com');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
      expect(response.body).toBe('');
    });

    test('should maintain existing endpoint routing behavior', async () => {
      // **Requirement 7.3**: Test that existing response validation tests still pass
      
      const event = {
        httpMethod: 'GET',
        path: '/unknown-endpoint',
        headers: {
          'origin': 'https://example.com'
        },
        requestContext: {
          requestId: 'test-unknown-endpoint'
        }
      };

      const response = await handler(event);

      // Verify unknown endpoint response maintains existing structure
      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody).toHaveProperty('message', 'Endpoint not found');
      expect(responseBody).toHaveProperty('error', 'NOT_FOUND');
      expect(responseBody).toHaveProperty('requestId', 'test-unknown-endpoint');
      expect(responseBody).toHaveProperty('availableEndpoints');
      expect(Array.isArray(responseBody.availableEndpoints)).toBe(true);
    });
  });

  describe('Legacy Function Compatibility', () => {
    test('should maintain extractClientInfo function backward compatibility', async () => {
      // **Requirement 7.4**: Test backward compatibility with legacy functions
      
      // Import the legacy extractClientInfo function
      const { extractClientInfo } = require('../../src/index.js');

      const event = {
        headers: {
          'x-forwarded-for': '192.168.1.105, 10.0.0.1',
          'user-agent': 'Legacy Test Browser',
          'host': 'legacy.example.com'
        },
        requestContext: {
          identity: { sourceIp: '192.168.1.105' }
        }
      };

      const clientInfo = extractClientInfo(event);

      // Verify legacy function returns expected object structure
      expect(clientInfo).toEqual({
        ipAddress: '192.168.1.105',
        userAgent: 'Legacy Test Browser',
        host: 'legacy.example.com'
      });
    });

    test('should maintain RemoteFalconLogBuilder class compatibility', async () => {
      // **Requirement 7.4**: Test that RemoteFalconLogBuilder class works as expected
      
      const clientInfo = {
        ipAddress: '192.168.1.106',
        userAgent: 'Test Builder Browser',
        host: 'builder.example.com'
      };

      const logBuilder = new RemoteFalconLogBuilder('test-request-builder', clientInfo, '/showDetails', 'GET');

      // Test success log generation
      const mockResponse = { status: 200 };
      const mockResponseData = {
        preferences: { viewerControlEnabled: true, viewerControlMode: 'voting' },
        sequences: [{ id: 1, name: 'Test Sequence' }]
      };

      const successLog = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      expect(successLog).toHaveProperty('timestamp');
      expect(successLog).toHaveProperty('requestId', 'test-request-builder');
      expect(successLog).toHaveProperty('logType', 'REMOTE_FALCON_REQUEST');
      expect(successLog).toHaveProperty('status', 'SUCCESS');
      expect(successLog.request).toEqual({
        method: 'GET',
        path: '/showDetails',
        ip: '192.168.1.106',
        userAgent: 'Test Builder Browser',
        host: 'builder.example.com'
      });
      expect(successLog.response).toHaveProperty('status', 200);
      expect(successLog.response).toHaveProperty('processingTime');
      expect(successLog.response.dataSummary).toHaveProperty('viewerControlEnabled', true);
      expect(successLog.response.dataSummary).toHaveProperty('numOfSequences', 1);

      // Test error log generation
      const mockError = new Error('Test error');
      const errorLog = logBuilder.buildErrorLog(mockError, 500);

      expect(errorLog).toHaveProperty('timestamp');
      expect(errorLog).toHaveProperty('requestId', 'test-request-builder');
      expect(errorLog).toHaveProperty('logType', 'REMOTE_FALCON_ERROR');
      expect(errorLog).toHaveProperty('status', 'ERROR');
      expect(errorLog.error).toHaveProperty('type', 'UNKNOWN_ERROR');
      expect(errorLog.error).toHaveProperty('message', 'Test error');
      expect(errorLog.error).toHaveProperty('httpStatus', 500);
    });
  });

  describe('Integration with Existing Test Patterns', () => {
    test('should work with existing mock patterns for successful responses', async () => {
      // **Requirement 7.5**: Test integration with existing test patterns
      
      global.fetch.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ 
          success: true, 
          data: 'integration-test-data',
          preferences: { viewerControlEnabled: false, viewerControlMode: 'disabled' },
          sequences: []
        })
      });

      const event = {
        httpMethod: 'GET',
        path: '/proxy/showDetails',
        headers: {
          'origin': 'https://example.com',
          'x-forwarded-for': '192.168.1.107',
          'user-agent': 'Integration Test Browser',
          'host': 'integration.example.com'
        },
        requestContext: {
          requestId: 'test-integration-pattern',
          identity: { sourceIp: '192.168.1.107' }
        }
      };

      const response = await handler(event);

      // Verify response follows existing test expectations
      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toBe('integration-test-data');

      // Verify fetch call follows existing pattern
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.remotefalcon.com/showDetails',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Bearer /),
            'Content-Type': 'application/json'
          })
        })
      );

      // Verify enhanced logging works alongside existing patterns
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/REMOTE_FALCON_REQUEST:/),
        expect.stringContaining('"requestId":"test-integration-pattern"')
      );
    });

    test('should work with existing mock patterns for error responses', async () => {
      // **Requirement 7.5**: Test integration with existing test patterns for errors
      
      // Mock application error response (HTTP 200 but with error message)
      global.fetch.mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({ 
          message: 'SONG_REQUESTED',
          details: 'User has already requested a song'
        })
      });

      const event = {
        httpMethod: 'POST',
        path: '/proxy/addSequenceToQueue',
        headers: {
          'origin': 'https://example.com',
          'x-forwarded-for': '192.168.1.108',
          'user-agent': 'Error Test Browser',
          'host': 'error.example.com'
        },
        body: JSON.stringify({ sequenceId: 123 }),
        requestContext: {
          requestId: 'test-app-error-pattern',
          identity: { sourceIp: '192.168.1.108' }
        }
      };

      const response = await handler(event);

      // Verify response follows existing error handling pattern
      expect(response.statusCode).toBe(200); // HTTP 200 but application error
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('SONG_REQUESTED');

      // Verify enhanced error logging detects application errors
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/REMOTE_FALCON_ERROR:/),
        expect.stringContaining('"message":"SONG_REQUESTED"')
      );
    });
  });
});