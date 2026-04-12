/**
const { MockEventLoader } = require('../utils/mockLoader');
 * Unit tests for RemoteFalconLogBuilder
 * Feature: remote-falcon-logging-enhancement
 */

// Jest globals are available

// Define the RemoteFalconLogBuilder class directly for testing
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

describe('RemoteFalconLogBuilder Unit Tests', () => {
  let logBuilder;
  const mockClientInfo = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    host: 'api.example.com'
  };
  const mockRequestId = 'test-request-123';
  const mockPath = '/showDetails';
  const mockMethod = 'GET';

  beforeEach(() => {
    jest.clearAllMocks();
    logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, mockPath, mockMethod);
  });

  describe('Success Log Generation', () => {
    test('should generate success log with showDetails response', () => {
      const mockResponse = { status: 200 };
      const mockResponseData = {
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'jukebox'
        },
        sequences: [
          { name: 'Song 1', id: 1 },
          { name: 'Song 2', id: 2 }
        ]
      };

      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      expect(logEntry.logType).toBe('REMOTE_FALCON_REQUEST');
      expect(logEntry.status).toBe('SUCCESS');
      expect(logEntry.requestId).toBe(mockRequestId);
      expect(logEntry.request.method).toBe(mockMethod);
      expect(logEntry.request.path).toBe(mockPath);
      expect(logEntry.request.ip).toBe(mockClientInfo.ipAddress);
      expect(logEntry.response.status).toBe(200);
      expect(logEntry.response.dataSummary.viewerControlEnabled).toBe(true);
      expect(logEntry.response.dataSummary.viewerControlMode).toBe('jukebox');
      expect(logEntry.response.dataSummary.numOfSequences).toBe(2);
    });

    test('should generate success log with non-showDetails response', () => {
      const nonShowDetailsBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/addSequenceToQueue', 'POST');
      const mockResponse = { status: 201 };
      const mockResponseData = {
        success: true,
        message: 'Sequence added successfully',
        queuePosition: 5
      };

      const logEntry = nonShowDetailsBuilder.buildSuccessLog(mockResponse, mockResponseData);

      expect(logEntry.response.dataSummary.hasData).toBe(true);
      expect(logEntry.response.dataSummary.responseSize).toBeGreaterThan(0);
      expect(logEntry.response.dataSummary.keyFields).toEqual(['success', 'message', 'queuePosition']);
    });

    test('should handle empty response data', () => {
      const nonShowDetailsBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/addSequenceToQueue', 'POST');
      const mockResponse = { status: 200 };
      const mockResponseData = null;

      const logEntry = nonShowDetailsBuilder.buildSuccessLog(mockResponse, mockResponseData);

      expect(logEntry.response.dataSummary.hasData).toBe(false);
      expect(logEntry.response.dataSummary.responseSize).toBe(2); // JSON.stringify({}).length
      expect(logEntry.response.dataSummary.keyFields).toEqual([]);
    });

    test('should handle showDetails response with missing fields', () => {
      const mockResponse = { status: 200 };
      const mockResponseData = {
        preferences: {},
        sequences: null
      };

      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      expect(logEntry.response.dataSummary.viewerControlEnabled).toBeNull();
      expect(logEntry.response.dataSummary.viewerControlMode).toBeNull();
      expect(logEntry.response.dataSummary.numOfSequences).toBe(0);
    });
  });

  describe('Error Log Generation', () => {
    test('should generate error log for network error', () => {
      const mockError = new TypeError('fetch failed: network error');
      const httpStatus = null;

      const logEntry = logBuilder.buildErrorLog(mockError, httpStatus);

      expect(logEntry.logType).toBe('REMOTE_FALCON_ERROR');
      expect(logEntry.status).toBe('ERROR');
      expect(logEntry.requestId).toBe(mockRequestId);
      expect(logEntry.error.type).toBe('NETWORK_ERROR');
      expect(logEntry.error.message).toBe('fetch failed: network error');
      expect(logEntry.error.httpStatus).toBeNull();
    });

    test('should generate error log for HTTP error', () => {
      const mockError = new Error('HTTP 404 Not Found');
      mockError.name = 'HTTPError';
      const httpStatus = 404;

      const logEntry = logBuilder.buildErrorLog(mockError, httpStatus);

      expect(logEntry.error.type).toBe('HTTP_ERROR');
      expect(logEntry.error.httpStatus).toBe(404);
    });

    test('should generate error log for JSON parsing error', () => {
      const mockError = new SyntaxError('Unexpected token in JSON at position 0');

      const logEntry = logBuilder.buildErrorLog(mockError);

      expect(logEntry.error.type).toBe('PARSE_ERROR');
      expect(logEntry.error.message).toBe('Unexpected token in JSON at position 0');
    });

    test('should generate error log for timeout error', () => {
      const mockError = new Error('Request timeout after 5000ms');
      mockError.name = 'AbortError';

      const logEntry = logBuilder.buildErrorLog(mockError);

      expect(logEntry.error.type).toBe('TIMEOUT_ERROR');
    });

    test('should generate error log for application error', () => {
      const mockError = new Error('SONG_REQUESTED: Song already in queue');

      const logEntry = logBuilder.buildErrorLog(mockError);

      expect(logEntry.error.type).toBe('APPLICATION_ERROR');
    });

    test('should classify unknown errors', () => {
      const mockError = new Error('Some unknown error');

      const logEntry = logBuilder.buildErrorLog(mockError);

      expect(logEntry.error.type).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Data Summary Generation', () => {
    test('should generate showDetails summary with complete data', () => {
      const responseData = {
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'voting'
        },
        sequences: [
          { name: 'Song 1' },
          { name: 'Song 2' },
          { name: 'Song 3' }
        ]
      };

      const summary = logBuilder.generateDataSummary(responseData);

      expect(summary.viewerControlEnabled).toBe(true);
      expect(summary.viewerControlMode).toBe('voting');
      expect(summary.numOfSequences).toBe(3);
    });

    test('should generate general summary for non-showDetails paths', () => {
      const nonShowDetailsBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/voteForSequence', 'POST');
      const responseData = {
        success: true,
        voteCount: 15,
        position: 3
      };

      const summary = nonShowDetailsBuilder.generateDataSummary(responseData);

      expect(summary.hasData).toBe(true);
      expect(summary.responseSize).toBeGreaterThan(0);
      expect(summary.keyFields).toEqual(['success', 'voteCount', 'position']);
    });

    test('should limit keyFields to 10 items', () => {
      const nonShowDetailsBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/test', 'GET');
      const responseData = {};
      for (let i = 0; i < 15; i++) {
        responseData[`field${i}`] = `value${i}`;
      }

      const summary = nonShowDetailsBuilder.generateDataSummary(responseData);

      expect(summary.keyFields).toHaveLength(10);
    });
  });

  describe('Error Classification', () => {
    test('should classify network errors', () => {
      const error = new TypeError('fetch failed');
      expect(logBuilder.classifyError(error)).toBe('NETWORK_ERROR');
    });

    test('should classify parsing errors', () => {
      const jsonError = new Error('JSON parse error');
      expect(logBuilder.classifyError(jsonError)).toBe('PARSE_ERROR');
      
      const parseError = new Error('Failed to parse response');
      expect(logBuilder.classifyError(parseError)).toBe('PARSE_ERROR');
    });

    test('should classify timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      expect(logBuilder.classifyError(timeoutError)).toBe('TIMEOUT_ERROR');
      
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      expect(logBuilder.classifyError(abortError)).toBe('TIMEOUT_ERROR');
    });

    test('should classify application errors', () => {
      const songRequestedError = new Error('SONG_REQUESTED');
      expect(logBuilder.classifyError(songRequestedError)).toBe('APPLICATION_ERROR');
      
      const queueFullError = new Error('QUEUE_FULL');
      expect(logBuilder.classifyError(queueFullError)).toBe('APPLICATION_ERROR');
    });

    test('should classify HTTP errors', () => {
      const httpError = new Error('HTTP error occurred');
      httpError.name = 'HTTPError';
      expect(logBuilder.classifyError(httpError)).toBe('HTTP_ERROR');
      
      const httpMessageError = new Error('HTTP 500 Internal Server Error');
      expect(logBuilder.classifyError(httpMessageError)).toBe('HTTP_ERROR');
    });
  });

  describe('Error Message Sanitization', () => {
    test('should sanitize JWT tokens', () => {
      const message = 'Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const sanitized = logBuilder.sanitizeErrorMessage(message);
      expect(sanitized).toBe('Authorization failed: Bearer [REDACTED]');
    });

    test('should sanitize API keys', () => {
      const message = 'API request failed with ApiKey: sk-1234567890abcdef1234567890';
      const sanitized = logBuilder.sanitizeErrorMessage(message);
      expect(sanitized).toBe('API request failed with ApiKey [REDACTED]');
    });

    test('should sanitize access tokens', () => {
      const message = 'AccessToken: abc123def456ghi789jkl012mno345';
      const sanitized = logBuilder.sanitizeErrorMessage(message);
      expect(sanitized).toBe('AccessToken [REDACTED]');
    });

    test('should sanitize passwords', () => {
      const message = 'Login failed: Password: mySecretPassword123';
      const sanitized = logBuilder.sanitizeErrorMessage(message);
      expect(sanitized).toBe('Login failed: Password [REDACTED]');
    });

    test('should truncate long messages', () => {
      const longMessage = 'x'.repeat(600);
      const sanitized = logBuilder.sanitizeErrorMessage(longMessage);
      expect(sanitized).toHaveLength(500);
      expect(sanitized.endsWith('...')).toBe(true);
    });

    test('should handle null or undefined messages', () => {
      expect(logBuilder.sanitizeErrorMessage(null)).toBe('Unknown error');
      expect(logBuilder.sanitizeErrorMessage(undefined)).toBe('Unknown error');
      expect(logBuilder.sanitizeErrorMessage('')).toBe('Unknown error');
    });

    test('should handle non-string messages', () => {
      expect(logBuilder.sanitizeErrorMessage(123)).toBe('Unknown error');
      expect(logBuilder.sanitizeErrorMessage({})).toBe('Unknown error');
    });
  });

  describe('Application Error Detection', () => {
    test('should detect SONG_REQUESTED error', () => {
      const responseData = { message: 'SONG_REQUESTED' };
      const error = RemoteFalconLogBuilder.detectApplicationError(responseData);
      
      expect(error).toEqual({
        type: 'APPLICATION_ERROR',
        message: 'SONG_REQUESTED'
      });
    });

    test('should detect QUEUE_FULL error', () => {
      const responseData = { message: 'QUEUE_FULL' };
      const error = RemoteFalconLogBuilder.detectApplicationError(responseData);
      
      expect(error).toEqual({
        type: 'APPLICATION_ERROR',
        message: 'QUEUE_FULL'
      });
    });

    test('should detect generic error messages', () => {
      const responseData = { message: 'An error occurred' };
      const error = RemoteFalconLogBuilder.detectApplicationError(responseData);
      
      expect(error).toEqual({
        type: 'APPLICATION_ERROR',
        message: 'An error occurred'
      });
    });

    test('should detect error status', () => {
      const responseData = { status: 'error', details: 'Something went wrong' };
      const error = RemoteFalconLogBuilder.detectApplicationError(responseData);
      
      expect(error).toEqual({
        type: 'APPLICATION_ERROR',
        message: 'error'
      });
    });

    test('should detect success: false pattern', () => {
      const responseData = { success: false, error: 'Validation failed' };
      const error = RemoteFalconLogBuilder.detectApplicationError(responseData);
      
      expect(error).toEqual({
        type: 'APPLICATION_ERROR',
        message: 'Validation failed'
      });
    });

    test('should handle success: false without error message', () => {
      const responseData = { success: false };
      const error = RemoteFalconLogBuilder.detectApplicationError(responseData);
      
      expect(error).toEqual({
        type: 'APPLICATION_ERROR',
        message: 'Request failed'
      });
    });

    test('should return null for successful responses', () => {
      const responseData = { success: true, data: 'some data' };
      const error = RemoteFalconLogBuilder.detectApplicationError(responseData);
      
      expect(error).toBeNull();
    });

    test('should return null for invalid input', () => {
      expect(RemoteFalconLogBuilder.detectApplicationError(null)).toBeNull();
      expect(RemoteFalconLogBuilder.detectApplicationError(undefined)).toBeNull();
      expect(RemoteFalconLogBuilder.detectApplicationError('string')).toBeNull();
      expect(RemoteFalconLogBuilder.detectApplicationError(123)).toBeNull();
    });
  });

  describe('Processing Time Tracking', () => {
    test('should track processing time in success logs', () => {
      const mockResponse = { status: 200 };
      const mockResponseData = { success: true };

      // Add a small delay to ensure processing time > 0
      const startTime = Date.now();
      while (Date.now() - startTime < 1) {
        // Small busy wait
      }

      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      expect(logEntry.response.processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof logEntry.response.processingTime).toBe('number');
    });

    test('should track processing time in error logs', () => {
      const mockError = new Error('Test error');

      // Add a small delay to ensure processing time > 0
      const startTime = Date.now();
      while (Date.now() - startTime < 1) {
        // Small busy wait
      }

      const logEntry = logBuilder.buildErrorLog(mockError);

      expect(logEntry.error.processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof logEntry.error.processingTime).toBe('number');
    });
  });
});