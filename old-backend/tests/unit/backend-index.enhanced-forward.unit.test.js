/**
const { MockEventLoader } = require('../utils/mockLoader');
 * Unit tests for enhanced forwardToRemoteFalcon function - Error Detection and Logging
 * Feature: remote-falcon-logging-enhancement
 */

// Jest globals are available

// Mock AWS SDK
jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn(() => ({
    send: jest.fn()
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

// Mock console.log to capture log entries
const mockConsoleLog = jest.fn();
const originalConsoleLog = console.log;

// Simplified ClientInfo class for testing (ES module compatible)
class ClientInfo {
  constructor(event) {
    this.ipAddress = this.extractIpAddress(event);
    this.userAgent = this.extractUserAgent(event);
    this.host = this.extractHost(event);
  }

  extractIpAddress(event) {
    if (!event || !event.headers) {
      return event?.requestContext?.identity?.sourceIp || 'unknown';
    }

    const xForwardedFor = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',');
      for (const ip of ips) {
        const trimmedIp = ip.trim();
        if (trimmedIp && trimmedIp !== '') {
          return trimmedIp;
        }
      }
    }

    const xRealIp = event.headers['x-real-ip'] || event.headers['X-Real-IP'];
    if (xRealIp && xRealIp.trim() !== '') {
      return xRealIp.trim();
    }

    if (event.requestContext?.identity?.sourceIp) {
      return event.requestContext.identity.sourceIp;
    }

    return 'unknown';
  }

  extractUserAgent(event) {
    if (!event || !event.headers) {
      return 'unknown';
    }

    const userAgent = event.headers['user-agent'] || 
                     event.headers['User-Agent'] || 
                     event.headers['USER-AGENT'];

    if (userAgent && userAgent.trim() !== '') {
      return userAgent.trim();
    }

    return 'unknown';
  }

  extractHost(event) {
    if (!event || !event.headers) {
      return 'unknown';
    }

    const host = event.headers['host'] || 
                event.headers['Host'] || 
                event.headers['HOST'];

    if (host && host.trim() !== '') {
      return host.trim();
    }

    return 'unknown';
  }
}

// Simplified RemoteFalconLogBuilder class for testing (ES module compatible)
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

    let sanitized = message.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, 'Bearer [REDACTED]');
    sanitized = sanitized.replace(/[Aa]pi[Kk]ey[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'ApiKey [REDACTED]');
    sanitized = sanitized.replace(/[Aa]ccess[Tt]oken[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'AccessToken [REDACTED]');
    sanitized = sanitized.replace(/[Pp]assword[:\s]*[^\s]+/gi, 'Password [REDACTED]');

    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 497) + '...';
    }

    return sanitized;
  }

  static detectApplicationError(responseData) {
    if (!responseData || typeof responseData !== 'object') {
      return null;
    }

    if (responseData.message) {
      const message = responseData.message.toString().toUpperCase();
      if (message.includes('SONG_REQUESTED') || 
          message.includes('QUEUE_FULL') || 
          message.includes('ERROR') ||
          message.includes('FAILED')) {
        return {
          type: 'APPLICATION_ERROR',
          message: responseData.message
        };
      }
    }

    if (responseData.status && responseData.status.toString().toLowerCase().includes('error')) {
      return {
        type: 'APPLICATION_ERROR',
        message: responseData.status
      };
    }

    if (responseData.success === false) {
      return {
        type: 'APPLICATION_ERROR',
        message: responseData.error || responseData.message || 'Request failed'
      };
    }

    return null;
  }
}

// Enhanced forwardToRemoteFalcon function for testing
async function forwardToRemoteFalcon(path, method, body, jwt, clientInfo, requestId) {
  const url = `https://api.remotefalcon.com${path}`;
  
  const logBuilder = new RemoteFalconLogBuilder(requestId, clientInfo, path, method);
  
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const responseData = await response.json().catch(() => ({}));

    const applicationError = RemoteFalconLogBuilder.detectApplicationError(responseData);
    
    if (applicationError) {
      const errorLog = logBuilder.buildErrorLog(
        new Error(applicationError.message), 
        response.status
      );
      console.log(`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}`);
    } else {
      const successLog = logBuilder.buildSuccessLog(response, responseData);
      console.log(`REMOTE_FALCON_REQUEST: ${JSON.stringify(successLog)}`);
    }

    return {
      statusCode: response.status,
      body: responseData,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } catch (error) {
    const errorLog = logBuilder.buildErrorLog(error);
    console.log(`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}`);
    
    console.error('Failed to forward request to Remote Falcon:', error);
    throw new Error('Failed to communicate with Remote Falcon API');
  }
}

// Import the handler after mocking
const { handler } = require('../../src/index.js');

// Helper function to parse log entries
function parseLogEntry(logCall, logType) {
  const logString = logCall[0];
  const jsonStart = logString.indexOf('{');
  return JSON.parse(logString.substring(jsonStart));
}

describe('Enhanced forwardToRemoteFalcon Error Detection Unit Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    
    // Set up environment variables
    process.env.ALLOWED_ORIGINS = 'https://example.com,https://test.com';
    process.env.REMOTE_FALCON_API_BASE_URL = 'https://api.remotefalcon.com';
    process.env.REMOTE_FALCON_ACCESS_TOKEN_PARAM = '/test/access-token';
    process.env.REMOTE_FALCON_SECRET_KEY_PARAM = '/test/secret-key';
    
    // Mock SSM client to return credentials
    const { SSMClient } = await import('@aws-sdk/client-ssm');
    const mockSSMInstance = new SSMClient();
    mockSSMInstance.send.mockResolvedValue({
      Parameter: {
        Value: 'mock-credential-value'
      }
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    jest.restoreAllMocks();
  });

  /**
   * Test successful API responses with proper logging
   * Requirements: 2.1, 2.2, 3.1, 3.4, 3.5
   */
  test('should log successful API responses with proper structure', async () => {
    // Mock successful Remote Falcon API response
    const mockResponse = {
      status: 200,
      json: jest.fn().mockResolvedValue({
        success: true,
        message: 'Request processed successfully',
        data: { result: 'success', count: 5 }
      })
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    const clientInfo = new ClientInfo({
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'test-agent',
        'host': 'api.example.com'
      },
      requestContext: {
        identity: { sourceIp: '192.168.1.1' }
      }
    });

    const result = await forwardToRemoteFalcon('/showDetails', 'GET', null, 'mock-jwt', clientInfo, 'test-request-123');

    // Verify successful response
    expect(result.statusCode).toBe(200);

    // Verify logging occurred
    const logCalls = mockConsoleLog.mock.calls;
    const remoteFalconLogs = logCalls
      .filter(call => call[0] && call[0].includes('REMOTE_FALCON_REQUEST'))
      .map(call => {
        const logString = call[0];
        const jsonStart = logString.indexOf('{');
        return JSON.parse(logString.substring(jsonStart));
      });

    expect(remoteFalconLogs.length).toBe(1);
    const logEntry = remoteFalconLogs[0];

    // Verify log structure
    expect(logEntry.logType).toBe('REMOTE_FALCON_REQUEST');
    expect(logEntry.status).toBe('SUCCESS');
    expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(logEntry.requestId).toBe('test-request-123');

    // Verify request information
    expect(logEntry.request.method).toBe('GET');
    expect(logEntry.request.path).toBe('/showDetails');
    expect(logEntry.request.ip).toBe('192.168.1.1');
    expect(logEntry.request.userAgent).toBe('test-agent');
    expect(logEntry.request.host).toBe('api.example.com');

    // Verify response information
    expect(logEntry.response.status).toBe(200);
    expect(logEntry.response.processingTime).toBeGreaterThanOrEqual(0);
    expect(logEntry.response.dataSummary).toBeTypeOf('object');
  });

  /**
   * Test various HTTP error responses with error logging
   * Requirements: 2.1, 2.2, 3.1, 3.4, 3.5
   */
  test('should log HTTP error responses with proper error structure', async () => {
    // Mock HTTP error response
    const mockResponse = {
      status: 404,
      json: jest.fn().mockResolvedValue({
        error: 'Not Found',
        message: 'The requested resource was not found'
      })
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    const event = {
      httpMethod: 'POST',
      path: '/proxy/addSequenceToQueue',
      headers: {
        'x-forwarded-for': '10.0.0.1',
        'user-agent': 'test-client',
        'host': 'api.test.com',
        'origin': 'https://test.com'
      },
      requestContext: {
        requestId: 'error-request-456',
        identity: { sourceIp: '10.0.0.1' }
      },
      body: JSON.stringify({ sequenceId: 123 })
    };

    const result = await handler(event);

    // Verify error response is returned to client
    expect(result.statusCode).toBe(404);

    // Verify success logging occurred (HTTP errors are still successful HTTP responses)
    const logCalls = mockConsoleLog.mock.calls;
    const remoteFalconLogs = logCalls
      .filter(call => call[0] && call[0].includes('REMOTE_FALCON_REQUEST'))
      .map(call => parseLogEntry(call, 'REMOTE_FALCON_REQUEST'));

    expect(remoteFalconLogs.length).toBe(1);
    const logEntry = remoteFalconLogs[0];

    // Verify log structure for HTTP error
    expect(logEntry.logType).toBe('REMOTE_FALCON_REQUEST');
    expect(logEntry.status).toBe('SUCCESS');
    expect(logEntry.response.status).toBe(404);
    expect(logEntry.request.method).toBe('POST');
    expect(logEntry.request.path).toBe('/addSequenceToQueue');
  });

  /**
   * Test network errors and timeout scenarios
   * Requirements: 3.1, 3.4, 3.5
   */
  test('should log network errors with comprehensive error information', async () => {
    // Mock network error
    const networkError = new Error('Network timeout');
    networkError.name = 'TypeError';
    global.fetch.mockRejectedValueOnce(networkError);

    const event = {
      httpMethod: 'POST',
      path: '/proxy/voteForSequence',
      headers: {
        'x-forwarded-for': '172.16.0.1',
        'user-agent': 'mobile-app',
        'host': 'api.mobile.com',
        'origin': 'https://mobile.com'
      },
      requestContext: {
        requestId: 'network-error-789',
        identity: { sourceIp: '172.16.0.1' }
      },
      body: JSON.stringify({ sequenceId: 456, vote: 'up' })
    };

    // Expect the handler to throw an error due to network failure
    await expect(handler(event)).rejects.toThrow('Failed to communicate with Remote Falcon API');

    // Verify error logging occurred
    const logCalls = mockConsoleLog.mock.calls;
    const remoteFalconErrorLogs = logCalls
      .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
      .map(call => parseLogEntry(call, 'REMOTE_FALCON_ERROR'));

    expect(remoteFalconErrorLogs.length).toBe(1);
    const errorLog = remoteFalconErrorLogs[0];

    // Verify error log structure
    expect(errorLog.logType).toBe('REMOTE_FALCON_ERROR');
    expect(errorLog.status).toBe('ERROR');
    expect(errorLog.requestId).toBe('network-error-789');

    // Verify request information is still logged
    expect(errorLog.request.method).toBe('POST');
    expect(errorLog.request.path).toBe('/voteForSequence');
    expect(errorLog.request.ip).toBe('172.16.0.1');
    expect(errorLog.request.userAgent).toBe('mobile-app');
    expect(errorLog.request.host).toBe('api.mobile.com');

    // Verify error information
    expect(errorLog.error.type).toBe('NETWORK_ERROR');
    expect(errorLog.error.message).toBe('Network timeout');
    expect(errorLog.error.processingTime).toBeGreaterThanOrEqual(0);
  });

  /**
   * Test JSON parsing error handling
   * Requirements: 3.1, 3.4, 3.5
   */
  test('should handle JSON parsing errors gracefully', async () => {
    // Mock response with invalid JSON
    const mockResponse = {
      status: 200,
      json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token in JSON'))
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    const event = {
      httpMethod: 'GET',
      path: '/proxy/getQueue',
      headers: {
        'x-forwarded-for': '203.0.113.1',
        'user-agent': 'web-browser',
        'host': 'api.web.com',
        'origin': 'https://web.com'
      },
      requestContext: {
        requestId: 'json-error-101',
        identity: { sourceIp: '203.0.113.1' }
      }
    };

    const result = await handler(event);

    // Verify response is still returned (with empty object as fallback)
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({});

    // Verify success logging occurred (JSON parsing error is handled gracefully)
    const logCalls = mockConsoleLog.mock.calls;
    const remoteFalconLogs = logCalls
      .filter(call => call[0] && call[0].includes('REMOTE_FALCON_REQUEST'))
      .map(call => parseLogEntry(call));

    expect(remoteFalconLogs.length).toBe(1);
    const logEntry = remoteFalconLogs[0];

    // Verify log structure
    expect(logEntry.logType).toBe('REMOTE_FALCON_REQUEST');
    expect(logEntry.status).toBe('SUCCESS');
    expect(logEntry.response.status).toBe(200);
    expect(logEntry.response.dataSummary.hasData).toBe(false); // Empty object fallback
  });

  /**
   * Test showDetails specific logging
   * Requirements: 2.3, 2.4, 2.5
   */
  test('should generate showDetails specific data summary', async () => {
    // Mock showDetails response
    const mockResponse = {
      status: 200,
      json: jest.fn().mockResolvedValue({
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'voting'
        },
        sequences: [
          { name: 'Sequence 1', id: 1 },
          { name: 'Sequence 2', id: 2 },
          { name: 'Sequence 3', id: 3 }
        ]
      })
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    const event = {
      httpMethod: 'GET',
      path: '/proxy/showDetails',
      headers: {
        'x-forwarded-for': '198.51.100.1',
        'user-agent': 'show-controller',
        'host': 'api.show.com',
        'origin': 'https://show.com'
      },
      requestContext: {
        requestId: 'showdetails-202',
        identity: { sourceIp: '198.51.100.1' }
      }
    };

    const result = await handler(event);

    // Verify successful response
    expect(result.statusCode).toBe(200);

    // Verify showDetails specific logging
    const logCalls = mockConsoleLog.mock.calls;
    const remoteFalconLogs = logCalls
      .filter(call => call[0] && call[0].includes('REMOTE_FALCON_REQUEST'))
      .map(call => parseLogEntry(call));

    expect(remoteFalconLogs.length).toBe(1);
    const logEntry = remoteFalconLogs[0];

    // Verify showDetails specific data summary
    expect(logEntry.response.dataSummary.viewerControlEnabled).toBe(true);
    expect(logEntry.response.dataSummary.viewerControlMode).toBe('voting');
    expect(logEntry.response.dataSummary.numOfSequences).toBe(3);
  });

  /**
   * Test application error detection in HTTP 200 responses
   * Requirements: 3.2
   */
  test('should detect and log application errors in successful HTTP responses', async () => {
    // Mock HTTP 200 response with application error
    const mockResponse = {
      status: 200,
      json: jest.fn().mockResolvedValue({
        message: 'SONG_REQUESTED',
        error: 'Song already requested by this user'
      })
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    const event = {
      httpMethod: 'POST',
      path: '/proxy/addSequenceToQueue',
      headers: {
        'x-forwarded-for': '192.0.2.1',
        'user-agent': 'user-app',
        'host': 'api.user.com',
        'origin': 'https://user.com'
      },
      requestContext: {
        requestId: 'app-error-303',
        identity: { sourceIp: '192.0.2.1' }
      },
      body: JSON.stringify({ sequenceId: 789 })
    };

    const result = await handler(event);

    // Verify response is still returned to client
    expect(result.statusCode).toBe(200);

    // Verify error logging occurred for application error
    const logCalls = mockConsoleLog.mock.calls;
    const remoteFalconErrorLogs = logCalls
      .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
      .map(call => parseLogEntry(call));

    expect(remoteFalconErrorLogs.length).toBe(1);
    const errorLog = remoteFalconErrorLogs[0];

    // Verify application error logging
    expect(errorLog.logType).toBe('REMOTE_FALCON_ERROR');
    expect(errorLog.status).toBe('ERROR');
    expect(errorLog.error.type).toBe('APPLICATION_ERROR');
    expect(errorLog.error.message).toBe('SONG_REQUESTED');
    expect(errorLog.error.httpStatus).toBe(200);
  });

  /**
   * Test HTTP error status code logging
   * Requirements: 3.1
   */
  test('should log HTTP error status codes with full context', async () => {
    const testCases = [
      { status: 400, message: 'Bad Request' },
      { status: 401, message: 'Unauthorized' },
      { status: 403, message: 'Forbidden' },
      { status: 404, message: 'Not Found' },
      { status: 500, message: 'Internal Server Error' },
      { status: 502, message: 'Bad Gateway' },
      { status: 503, message: 'Service Unavailable' }
    ];

    for (const testCase of testCases) {
      jest.clearAllMocks();
      console.log = mockConsoleLog;

      // Mock HTTP error response
      const mockResponse = {
        status: testCase.status,
        json: jest.fn().mockResolvedValue({
          error: testCase.message,
          details: 'Additional error details'
        })
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const event = {
        httpMethod: 'GET',
        path: '/proxy/testEndpoint',
        headers: {
          'x-forwarded-for': '10.1.1.1',
          'user-agent': 'http-error-test',
          'host': 'api.error.com',
          'origin': 'https://error.com'
        },
        requestContext: {
          requestId: `http-error-${testCase.status}`,
          identity: { sourceIp: '10.1.1.1' }
        }
      };

      const result = await handler(event);

      // Verify HTTP error response is returned to client
      expect(result.statusCode).toBe(testCase.status);

      // Verify success logging occurred (HTTP errors are still successful HTTP responses)
      const logCalls = mockConsoleLog.mock.calls;
      const remoteFalconLogs = logCalls
        .filter(call => call[0] && call[0].includes('REMOTE_FALCON_REQUEST'))
        .map(call => parseLogEntry(call));

      expect(remoteFalconLogs.length).toBe(1);
      const logEntry = remoteFalconLogs[0];

      // Verify HTTP error is logged as successful request (since HTTP communication succeeded)
      expect(logEntry.logType).toBe('REMOTE_FALCON_REQUEST');
      expect(logEntry.status).toBe('SUCCESS');
      expect(logEntry.response.status).toBe(testCase.status);
      expect(logEntry.request.method).toBe('GET');
      expect(logEntry.request.path).toBe('/testEndpoint');
    }
  });

  /**
   * Test HTTP 200 with error message detection
   * Requirements: 3.2
   */
  test('should detect various application error patterns in HTTP 200 responses', async () => {
    const errorPatterns = [
      { message: 'SONG_REQUESTED', expectedType: 'APPLICATION_ERROR' },
      { message: 'QUEUE_FULL', expectedType: 'APPLICATION_ERROR' },
      { success: false, error: 'Validation failed', expectedType: 'APPLICATION_ERROR' },
      { status: 'error', details: 'Processing failed', expectedType: 'APPLICATION_ERROR' },
      { message: 'An error occurred during processing', expectedType: 'APPLICATION_ERROR' },
      { message: 'Request failed due to invalid parameters', expectedType: 'APPLICATION_ERROR' }
    ];

    for (let i = 0; i < errorPatterns.length; i++) {
      jest.clearAllMocks();
      console.log = mockConsoleLog;

      const errorPattern = errorPatterns[i];

      // Mock HTTP 200 response with application error
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue(errorPattern)
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const event = {
        httpMethod: 'POST',
        path: '/proxy/testError',
        headers: {
          'x-forwarded-for': '172.20.0.1',
          'user-agent': 'app-error-test',
          'host': 'api.apperror.com',
          'origin': 'https://apperror.com'
        },
        requestContext: {
          requestId: `app-error-${i}`,
          identity: { sourceIp: '172.20.0.1' }
        },
        body: JSON.stringify({ test: true })
      };

      const result = await handler(event);

      // Verify response is still returned to client
      expect(result.statusCode).toBe(200);

      // Verify error logging occurred for application error
      const logCalls = mockConsoleLog.mock.calls;
      const remoteFalconErrorLogs = logCalls
        .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
        .map(call => parseLogEntry(call));

      expect(remoteFalconErrorLogs.length).toBe(1);
      const errorLog = remoteFalconErrorLogs[0];

      // Verify application error logging
      expect(errorLog.logType).toBe('REMOTE_FALCON_ERROR');
      expect(errorLog.status).toBe('ERROR');
      expect(errorLog.error.type).toBe(errorPattern.expectedType);
      expect(errorLog.error.httpStatus).toBe(200);
      expect(errorLog.request.method).toBe('POST');
      expect(errorLog.request.path).toBe('/testError');
    }
  });

  /**
   * Test "SONG_REQUESTED" and "QUEUE_FULL" error logging
   * Requirements: 3.2, 3.3
   */
  test('should specifically handle SONG_REQUESTED and QUEUE_FULL errors', async () => {
    const specificErrors = [
      {
        name: 'SONG_REQUESTED',
        response: { message: 'SONG_REQUESTED' },
        expectedMessage: 'SONG_REQUESTED'
      },
      {
        name: 'QUEUE_FULL',
        response: { message: 'QUEUE_FULL' },
        expectedMessage: 'QUEUE_FULL'
      },
      {
        name: 'SONG_REQUESTED_DETAILED',
        response: { message: 'SONG_REQUESTED', details: 'User has already requested a song in this session' },
        expectedMessage: 'SONG_REQUESTED'
      },
      {
        name: 'QUEUE_FULL_DETAILED',
        response: { message: 'QUEUE_FULL', details: 'The request queue has reached its maximum capacity' },
        expectedMessage: 'QUEUE_FULL'
      }
    ];

    for (const errorCase of specificErrors) {
      jest.clearAllMocks();
      console.log = mockConsoleLog;

      // Mock HTTP 200 response with specific error
      const mockResponse = {
        status: 200,
        json: jest.fn().mockResolvedValue(errorCase.response)
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const event = {
        httpMethod: 'POST',
        path: '/proxy/addSequenceToQueue',
        headers: {
          'x-forwarded-for': '192.168.100.1',
          'user-agent': 'specific-error-test',
          'host': 'api.specific.com',
          'origin': 'https://specific.com'
        },
        requestContext: {
          requestId: `specific-${errorCase.name}`,
          identity: { sourceIp: '192.168.100.1' }
        },
        body: JSON.stringify({ sequenceId: 999 })
      };

      const result = await handler(event);

      // Verify response is still returned to client
      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual(errorCase.response);

      // Verify specific error logging
      const logCalls = mockConsoleLog.mock.calls;
      const remoteFalconErrorLogs = logCalls
        .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
        .map(call => parseLogEntry(call));

      expect(remoteFalconErrorLogs.length).toBe(1);
      const errorLog = remoteFalconErrorLogs[0];

      // Verify specific error details
      expect(errorLog.error.type).toBe('APPLICATION_ERROR');
      expect(errorLog.error.message).toBe(errorCase.expectedMessage);
      expect(errorLog.error.httpStatus).toBe(200);
      expect(errorLog.requestId).toBe(`specific-${errorCase.name}`);
    }
  });

  /**
   * Test network error and parsing error logging with context
   * Requirements: 3.4, 3.5
   */
  test('should log network and parsing errors with comprehensive context', async () => {
    const errorScenarios = [
      {
        name: 'NETWORK_TIMEOUT',
        error: new Error('Connection timeout'),
        expectedType: 'TIMEOUT_ERROR',
        expectedMessagePattern: /timeout/i
      },
      {
        name: 'NETWORK_FETCH_FAILED',
        error: (() => { const e = new Error('fetch failed'); e.name = 'TypeError'; return e; })(),
        expectedType: 'NETWORK_ERROR',
        expectedMessagePattern: /fetch failed/i
      },
      {
        name: 'NETWORK_CONNECTION_REFUSED',
        error: new Error('Network request failed'),
        expectedType: 'UNKNOWN_ERROR',
        expectedMessagePattern: /Network request failed/i
      },
      {
        name: 'ABORT_ERROR',
        error: (() => { const e = new Error('Request aborted'); e.name = 'AbortError'; return e; })(),
        expectedType: 'TIMEOUT_ERROR',
        expectedMessagePattern: /Request aborted/i
      }
    ];

    for (const scenario of errorScenarios) {
      jest.clearAllMocks();
      console.log = mockConsoleLog;

      // Mock network error
      global.fetch.mockRejectedValueOnce(scenario.error);

      const event = {
        httpMethod: 'GET',
        path: '/proxy/networkTest',
        headers: {
          'x-forwarded-for': '203.0.113.50',
          'user-agent': 'network-error-test',
          'host': 'api.network.com',
          'origin': 'https://network.com'
        },
        requestContext: {
          requestId: `network-${scenario.name}`,
          identity: { sourceIp: '203.0.113.50' }
        }
      };

      // Expect the handler to throw an error due to network failure
      await expect(handler(event)).rejects.toThrow('Failed to communicate with Remote Falcon API');

      // Verify comprehensive error logging
      const logCalls = mockConsoleLog.mock.calls;
      const remoteFalconErrorLogs = logCalls
        .filter(call => call[0] && call[0].includes('REMOTE_FALCON_ERROR'))
        .map(call => parseLogEntry(call));

      expect(remoteFalconErrorLogs.length).toBe(1);
      const errorLog = remoteFalconErrorLogs[0];

      // Verify comprehensive error context
      expect(errorLog.logType).toBe('REMOTE_FALCON_ERROR');
      expect(errorLog.status).toBe('ERROR');
      expect(errorLog.requestId).toBe(`network-${scenario.name}`);
      expect(errorLog.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify full request context is preserved
      expect(errorLog.request.method).toBe('GET');
      expect(errorLog.request.path).toBe('/networkTest');
      expect(errorLog.request.ip).toBe('203.0.113.50');
      expect(errorLog.request.userAgent).toBe('network-error-test');
      expect(errorLog.request.host).toBe('api.network.com');

      // Verify error classification and details
      expect(errorLog.error.type).toBe(scenario.expectedType);
      expect(errorLog.error.message).toMatch(scenario.expectedMessagePattern);
      expect(errorLog.error.processingTime).toBeGreaterThanOrEqual(0);
      expect(errorLog.error.httpStatus).toBeNull();
    }
  });

  /**
   * Test response compatibility - ensure client responses remain unchanged
   * Requirements: 6.1, 6.2, 6.3, 6.5
   */
  test('should maintain exact response structure for client compatibility', async () => {
    // Mock typical Remote Falcon response
    const expectedResponseData = {
      success: true,
      data: {
        sequences: ['seq1', 'seq2'],
        currentSequence: 'seq1'
      },
      timestamp: '2024-01-01T00:00:00Z'
    };

    const mockResponse = {
      status: 201,
      json: jest.fn().mockResolvedValue(expectedResponseData)
    };
    global.fetch.mockResolvedValueOnce(mockResponse);

    const event = {
      httpMethod: 'POST',
      path: '/proxy/updateSequence',
      headers: {
        'x-forwarded-for': '203.0.113.100',
        'user-agent': 'compatibility-test',
        'host': 'api.compat.com',
        'origin': 'https://compat.com'
      },
      requestContext: {
        requestId: 'compat-404',
        identity: { sourceIp: '203.0.113.100' }
      },
      body: JSON.stringify({ action: 'update' })
    };

    const result = await handler(event);

    // Verify exact response structure is preserved
    expect(result.statusCode).toBe(201);
    expect(result.body).toEqual(expectedResponseData);
    expect(result.headers['Content-Type']).toBe('application/json');

    // Verify no logging metadata is added to client response
    expect(result.body).not.toHaveProperty('logEntry');
    expect(result.body).not.toHaveProperty('requestId');
    expect(result.body).not.toHaveProperty('processingTime');

    // Verify logging occurred separately
    const logCalls = mockConsoleLog.mock.calls;
    const remoteFalconLogs = logCalls
      .filter(call => call[0] && call[0].includes('REMOTE_FALCON_REQUEST'));
    expect(remoteFalconLogs.length).toBe(1);
  });
});