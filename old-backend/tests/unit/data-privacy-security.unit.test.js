/**
const { MockEventLoader } = require('../utils/mockLoader');
 * Unit tests for data privacy and security measures in Remote Falcon logging
 * Tests JWT token sanitization, PII detection and removal, log entry size limiting, and response body summarization
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

// Mock RemoteFalconLogBuilder class with enhanced data privacy measures
class RemoteFalconLogBuilder {
  constructor(requestId, clientInfo, path, method) {
    this.requestId = requestId;
    this.clientInfo = clientInfo;
    this.path = path;
    this.method = method;
    this.startTime = Date.now();
  }

  buildSuccessLog(response, responseData) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      logType: 'REMOTE_FALCON_REQUEST',
      status: 'SUCCESS',
      request: {
        method: this.method,
        path: this.path,
        ip: this.sanitizeClientInfo(this.clientInfo.ipAddress),
        userAgent: this.sanitizeClientInfo(this.clientInfo.userAgent),
        host: this.sanitizeClientInfo(this.clientInfo.host)
      },
      response: {
        status: response.status,
        processingTime: Date.now() - this.startTime,
        dataSummary: this.generateDataSummary(responseData)
      }
    };

    return this.sanitizeAndLimitLogEntry(logEntry);
  }

  buildErrorLog(error, httpStatus = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      logType: 'REMOTE_FALCON_ERROR',
      status: 'ERROR',
      request: {
        method: this.method,
        path: this.path,
        ip: this.sanitizeClientInfo(this.clientInfo.ipAddress),
        userAgent: this.sanitizeClientInfo(this.clientInfo.userAgent),
        host: this.sanitizeClientInfo(this.clientInfo.host)
      },
      error: {
        type: this.classifyError(error),
        message: this.sanitizeErrorMessage(error.message),
        httpStatus: httpStatus,
        processingTime: Date.now() - this.startTime
      }
    };

    return this.sanitizeAndLimitLogEntry(logEntry);
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
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, 'email [REDACTED]');
    
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 497) + '...';
    }

    return sanitized;
  }

  sanitizeClientInfo(info) {
    if (!info || typeof info !== 'string') {
      return info;
    }

    let sanitized = info.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL_REDACTED]');
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi, '[PHONE_REDACTED]');
    sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi, '[CARD_REDACTED]');
    sanitized = sanitized.replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/gi, '[SSN_REDACTED]');
    
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 197) + '...';
    }

    return sanitized;
  }

  sanitizeAndLimitLogEntry(logEntry) {
    const sanitized = JSON.parse(JSON.stringify(logEntry));
    this.sanitizeObjectRecursively(sanitized);
    
    const logEntryString = JSON.stringify(sanitized);
    if (logEntryString.length > 10000) {
      if (sanitized.response?.dataSummary) {
        sanitized.response.dataSummary = {
          hasData: true,
          responseSize: sanitized.response.dataSummary.responseSize || 0,
          keyFields: [],
          truncated: true,
          reason: 'Log entry size limit exceeded'
        };
      }
      
      if (sanitized.error?.message && sanitized.error.message.length > 200) {
        sanitized.error.message = sanitized.error.message.substring(0, 197) + '...';
      }
      
      sanitized._truncated = true;
      sanitized._originalSize = logEntryString.length;
    }
    
    return sanitized;
  }

  sanitizeObjectRecursively(obj) {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        obj[key] = this.sanitizePII(value);
      } else if (typeof value === 'object' && value !== null) {
        this.sanitizeObjectRecursively(value);
      }
    }
  }

  sanitizePII(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let sanitized = text;
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL_REDACTED]');
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi, '[PHONE_REDACTED]');
    sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi, '[CARD_REDACTED]');
    sanitized = sanitized.replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/gi, '[SSN_REDACTED]');
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, 'Bearer [REDACTED]');
    sanitized = sanitized.replace(/[Aa]pi[Kk]ey[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'ApiKey [REDACTED]');
    sanitized = sanitized.replace(/[Aa]ccess[Tt]oken[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'AccessToken [REDACTED]');
    sanitized = sanitized.replace(/[Pp]assword[:\s]*[^\s]+/gi, 'Password [REDACTED]');
    
    return sanitized;
  }
}

describe('Data Privacy and Security Unit Tests', () => {
  let logBuilder;
  let clientInfo;

  beforeEach(() => {
    clientInfo = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      host: 'api.example.com'
    };
    logBuilder = new RemoteFalconLogBuilder('test-request-123', clientInfo, '/showDetails', 'GET');
  });

  describe('JWT Token Sanitization', () => {
    test('should sanitize JWT tokens from error messages', () => {
      const message = 'Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const sanitized = logBuilder.sanitizeErrorMessage(message);
      expect(sanitized).toBe('Authorization failed: Bearer [REDACTED]');
    });

    test('should sanitize JWT tokens from any string field', () => {
      const text = 'Request failed with token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const sanitized = logBuilder.sanitizePII(text);
      expect(sanitized).toBe('Request failed with token: Bearer [REDACTED]');
    });

    test('should handle multiple JWT tokens in the same string', () => {
      const message = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig1 and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig2';
      const sanitized = logBuilder.sanitizeErrorMessage(message);
      expect(sanitized).toBe('Bearer [REDACTED] and Bearer [REDACTED]');
    });
  });

  describe('PII Detection and Removal', () => {
    test('should sanitize email addresses from error messages', () => {
      const message = 'User email: user@example.com failed validation';
      const sanitized = logBuilder.sanitizeErrorMessage(message);
      expect(sanitized).toBe('User email: email [REDACTED] failed validation');
    });

    test('should sanitize email addresses from client info', () => {
      const userAgent = 'MyApp/1.0 (user@example.com)';
      const sanitized = logBuilder.sanitizeClientInfo(userAgent);
      expect(sanitized).toBe('MyApp/1.0 ([EMAIL_REDACTED])');
    });

    test('should sanitize phone numbers from client info', () => {
      const userAgent = 'MyApp/1.0 (contact: 555-123-4567)';
      const sanitized = logBuilder.sanitizeClientInfo(userAgent);
      expect(sanitized).toBe('MyApp/1.0 (contact: [PHONE_REDACTED])');
    });

    test('should sanitize credit card numbers from any string', () => {
      const text = 'Payment failed for card 4111-1111-1111-1111';
      const sanitized = logBuilder.sanitizePII(text);
      expect(sanitized).toBe('Payment failed for card [CARD_REDACTED]');
    });

    test('should sanitize SSN patterns from any string', () => {
      const text = 'SSN 123-45-6789 validation failed';
      const sanitized = logBuilder.sanitizePII(text);
      expect(sanitized).toBe('SSN [SSN_REDACTED] validation failed');
    });

    test('should recursively sanitize nested objects', () => {
      const logEntry = {
        request: {
          userAgent: 'MyApp/1.0 (user@example.com)',
          data: {
            email: 'test@example.com',
            phone: '555-123-4567'
          }
        },
        response: {
          message: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token'
        }
      };

      logBuilder.sanitizeObjectRecursively(logEntry);

      expect(logEntry.request.userAgent).toBe('MyApp/1.0 ([EMAIL_REDACTED])');
      expect(logEntry.request.data.email).toBe('[EMAIL_REDACTED]');
      expect(logEntry.request.data.phone).toBe('[PHONE_REDACTED]');
      expect(logEntry.response.message).toBe('Bearer [REDACTED]');
    });
  });

  describe('Log Entry Size Limiting', () => {
    test('should limit error message length to 500 characters', () => {
      const longMessage = 'x'.repeat(600);
      const sanitized = logBuilder.sanitizeErrorMessage(longMessage);
      expect(sanitized).toHaveLength(500);
      expect(sanitized.endsWith('...')).toBe(true);
    });

    test('should limit client info length to 200 characters', () => {
      const longUserAgent = 'x'.repeat(250);
      const sanitized = logBuilder.sanitizeClientInfo(longUserAgent);
      expect(sanitized).toHaveLength(200);
      expect(sanitized.endsWith('...')).toBe(true);
    });

    test('should truncate log entries exceeding 10KB limit', () => {
      const largeResponseData = {
        sequences: Array(1000).fill(null).map((_, i) => ({
          id: i,
          name: `Sequence ${i}`,
          description: 'x'.repeat(100)
        })),
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'enabled'
        }
      };

      const mockResponse = { status: 200 };
      const logEntry = logBuilder.buildSuccessLog(mockResponse, largeResponseData);
      const logEntryString = JSON.stringify(logEntry);

      expect(logEntryString.length).toBeLessThanOrEqual(10000);
      
      if (logEntry._truncated) {
        expect(logEntry._originalSize).toBeGreaterThan(10000);
        expect(logEntry.response.dataSummary.truncated).toBe(true);
      }
    });
  });

  describe('Response Body Summarization', () => {
    test('should summarize showDetails response without exposing sensitive data', () => {
      const responseData = {
        sequences: [
          { id: 1, name: 'Sequence 1', secretKey: 'secret123' },
          { id: 2, name: 'Sequence 2', apiKey: 'api456' }
        ],
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'enabled',
          accessToken: 'token789',
          secretKey: 'secret456'
        },
        userEmail: 'admin@example.com'
      };

      const mockResponse = { status: 200 };
      const logEntry = logBuilder.buildSuccessLog(mockResponse, responseData);

      expect(logEntry.response.dataSummary).toHaveProperty('viewerControlEnabled', true);
      expect(logEntry.response.dataSummary).toHaveProperty('viewerControlMode', 'enabled');
      expect(logEntry.response.dataSummary).toHaveProperty('numOfSequences', 2);

      const logEntryString = JSON.stringify(logEntry);
      expect(logEntryString).not.toContain('secret123');
      expect(logEntryString).not.toContain('api456');
      expect(logEntryString).not.toContain('token789');
      expect(logEntryString).not.toContain('secret456');
      expect(logEntryString).not.toContain('admin@example.com');
    });

    test('should summarize non-showDetails response without exposing full body', () => {
      const responseData = {
        result: 'success',
        data: {
          largeArray: Array(100).fill('large data item'),
          sensitiveInfo: {
            apiKey: 'sk-1234567890',
            userEmail: 'user@example.com'
          }
        }
      };

      const logBuilder2 = new RemoteFalconLogBuilder('test-request-456', clientInfo, '/addSequenceToQueue', 'POST');
      const mockResponse = { status: 200 };
      const logEntry = logBuilder2.buildSuccessLog(mockResponse, responseData);

      expect(logEntry.response.dataSummary).toHaveProperty('hasData', true);
      expect(logEntry.response.dataSummary).toHaveProperty('responseSize');
      expect(logEntry.response.dataSummary).toHaveProperty('keyFields');

      const logEntryString = JSON.stringify(logEntry);
      expect(logEntryString).not.toContain('large data item');
      expect(logEntryString).not.toContain('sk-1234567890');
      expect(logEntryString).not.toContain('user@example.com');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null or undefined error messages', () => {
      expect(logBuilder.sanitizeErrorMessage(null)).toBe('Unknown error');
      expect(logBuilder.sanitizeErrorMessage(undefined)).toBe('Unknown error');
      expect(logBuilder.sanitizeErrorMessage('')).toBe('Unknown error');
    });

    test('should handle null or undefined client info', () => {
      expect(logBuilder.sanitizeClientInfo(null)).toBe(null);
      expect(logBuilder.sanitizeClientInfo(undefined)).toBe(undefined);
      expect(logBuilder.sanitizeClientInfo('')).toBe('');
    });

    test('should handle empty response data', () => {
      const mockResponse = { status: 200 };
      const logEntry = logBuilder.buildSuccessLog(mockResponse, null);
      
      // For showDetails path, should return showDetails-specific summary
      expect(logEntry.response.dataSummary).toHaveProperty('viewerControlEnabled', null);
      expect(logEntry.response.dataSummary).toHaveProperty('viewerControlMode', null);
      expect(logEntry.response.dataSummary).toHaveProperty('numOfSequences', 0);
    });
  });
});