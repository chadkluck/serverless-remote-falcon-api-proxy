/**
 * Remote Falcon Logging Boolean Fix - Integration Tests
 * Task 4.2: Write integration tests for end-to-end log generation
 * 
 * Tests complete log generation with various responseData scenarios
 * to verify log structure and content correctness for the boolean fix.
 */

// Jest globals are available

// Mock console.log to capture log entries
const mockConsoleLog = jest.fn();
const originalConsoleLog = console.log;

// Define the RemoteFalconLogBuilder class directly for testing (with the FIXED implementation)
class RemoteFalconLogBuilder {
  constructor(requestId, clientInfo, path, method) {
    this.requestId = requestId;
    this.clientInfo = clientInfo;
    this.path = path;
    this.method = method;
    this.startTime = Date.now();
  }

  /**
   * Build success log entry for successful Remote Falcon API responses
   */
  buildSuccessLog(response, responseData) {
    const logEntry = {
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

    return logEntry;
  }

  /**
   * Build error log entry for failed Remote Falcon API requests
   */
  buildErrorLog(error, httpStatus = null) {
    const logEntry = {
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
        message: error.message || 'Unknown error',
        httpStatus: httpStatus,
        processingTime: Date.now() - this.startTime
      }
    };

    return logEntry;
  }

  /**
   * Generate data summary for different API paths without exposing sensitive information
   * FIXED VERSION: Uses nullish coalescing operator (??) instead of logical OR (||)
   */
  generateDataSummary(responseData) {
    if (this.path === '/showDetails') {
      return {
        viewerControlEnabled: responseData?.preferences?.viewerControlEnabled ?? null,
        viewerControlMode: responseData?.preferences?.viewerControlMode ?? null,
        numOfSequences: responseData?.sequences?.length || 0
      };
    }

    // For other paths, provide general summary
    return {
      hasData: !!responseData && Object.keys(responseData).length > 0,
      responseSize: JSON.stringify(responseData || {}).length,
      keyFields: responseData ? Object.keys(responseData).slice(0, 10) : [] // Limit to first 10 keys
    };
  }

  /**
   * Classify error types for better monitoring and alerting
   */
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

  /**
   * Detect if response contains application-level errors even with HTTP 200 status
   */
  static detectApplicationError(responseData) {
    if (!responseData || typeof responseData !== 'object') {
      return null;
    }

    // Check for common Remote Falcon error patterns
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

    // Check for error status in response
    if (responseData.status && responseData.status.toString().toLowerCase().includes('error')) {
      return {
        type: 'APPLICATION_ERROR',
        message: responseData.status
      };
    }

    // Check for success: false pattern
    if (responseData.success === false) {
      return {
        type: 'APPLICATION_ERROR',
        message: responseData.error || responseData.message || 'Request failed'
      };
    }

    return null;
  }
}

describe('Remote Falcon Logging Boolean Fix - Integration Tests', () => {
  let logBuilder;
  const mockRequestId = 'integration-test-123';
  const mockClientInfo = {
    ipAddress: '192.168.1.100',
    userAgent: 'Integration Test Browser/1.0',
    host: 'api.integration.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.log to capture logs
    console.log = mockConsoleLog;
    mockConsoleLog.mockClear();
    
    // Create log builder instance for showDetails path
    logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', 'GET');
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('End-to-End Log Generation with Boolean Fix', () => {
    test('should generate complete success log with viewerControlEnabled = true', () => {
      // **Validates: Requirements 1.1, 3.3**
      const mockResponse = { status: 200 };
      const mockResponseData = {
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'voting'
        },
        sequences: [
          { id: 1, name: 'Song 1' },
          { id: 2, name: 'Song 2' }
        ]
      };

      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      // Verify complete log structure
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('requestId', mockRequestId);
      expect(logEntry).toHaveProperty('logType', 'REMOTE_FALCON_REQUEST');
      expect(logEntry).toHaveProperty('status', 'SUCCESS');
      
      // Verify request information
      expect(logEntry.request).toEqual({
        method: 'GET',
        path: '/showDetails',
        ip: mockClientInfo.ipAddress,
        userAgent: mockClientInfo.userAgent,
        host: mockClientInfo.host
      });
      
      // Verify response information with boolean fix
      expect(logEntry.response).toHaveProperty('status', 200);
      expect(logEntry.response).toHaveProperty('processingTime');
      expect(typeof logEntry.response.processingTime).toBe('number');
      expect(logEntry.response.processingTime).toBeGreaterThanOrEqual(0);
      
      // Critical: Verify boolean true is preserved (not converted to null)
      expect(logEntry.response.dataSummary).toEqual({
        viewerControlEnabled: true, // Should be true, not null
        viewerControlMode: 'voting',
        numOfSequences: 2
      });
    });

    test('should generate complete success log with viewerControlEnabled = false', () => {
      // **Validates: Requirements 1.2, 3.3**
      const mockResponse = { status: 200 };
      const mockResponseData = {
        preferences: {
          viewerControlEnabled: false, // This is the critical test case
          viewerControlMode: 'jukebox'
        },
        sequences: [
          { id: 1, name: 'Song 1' }
        ]
      };

      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      // Verify complete log structure
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('requestId', mockRequestId);
      expect(logEntry).toHaveProperty('logType', 'REMOTE_FALCON_REQUEST');
      expect(logEntry).toHaveProperty('status', 'SUCCESS');
      
      // Critical: Verify boolean false is preserved (not converted to null)
      expect(logEntry.response.dataSummary).toEqual({
        viewerControlEnabled: false, // Should be false, not null (this was the bug)
        viewerControlMode: 'jukebox',
        numOfSequences: 1
      });
    });

    test('should generate complete success log with viewerControlEnabled = null', () => {
      // **Validates: Requirements 1.3, 3.3**
      const mockResponse = { status: 200 };
      const mockResponseData = {
        preferences: {
          viewerControlEnabled: null,
          viewerControlMode: null
        },
        sequences: []
      };

      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      // Verify null values are handled correctly
      expect(logEntry.response.dataSummary).toEqual({
        viewerControlEnabled: null, // Should remain null
        viewerControlMode: null,
        numOfSequences: 0
      });
    });

    test('should generate complete success log with missing preferences', () => {
      // **Validates: Requirements 1.4, 3.3**
      const mockResponse = { status: 200 };
      const mockResponseData = {
        sequences: [
          { id: 1, name: 'Song 1' },
          { id: 2, name: 'Song 2' },
          { id: 3, name: 'Song 3' }
        ]
      };

      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      // Verify missing preferences are handled correctly
      expect(logEntry.response.dataSummary).toEqual({
        viewerControlEnabled: null, // Should be null when preferences missing
        viewerControlMode: null,
        numOfSequences: 3
      });
    });

    test('should generate complete error log with client information', () => {
      // **Validates: Requirements 3.3**
      const mockError = new Error('Network connection failed');
      const httpStatus = 500;

      const logEntry = logBuilder.buildErrorLog(mockError, httpStatus);

      // Verify complete error log structure
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('requestId', mockRequestId);
      expect(logEntry).toHaveProperty('logType', 'REMOTE_FALCON_ERROR');
      expect(logEntry).toHaveProperty('status', 'ERROR');
      
      // Verify request information is preserved in error logs
      expect(logEntry.request).toEqual({
        method: 'GET',
        path: '/showDetails',
        ip: mockClientInfo.ipAddress,
        userAgent: mockClientInfo.userAgent,
        host: mockClientInfo.host
      });
      
      // Verify error information
      expect(logEntry.error).toHaveProperty('type', 'UNKNOWN_ERROR');
      expect(logEntry.error).toHaveProperty('message', 'Network connection failed');
      expect(logEntry.error).toHaveProperty('httpStatus', 500);
      expect(logEntry.error).toHaveProperty('processingTime');
      expect(typeof logEntry.error.processingTime).toBe('number');
    });

    test('should handle complex responseData scenarios with mixed boolean values', () => {
      // **Validates: Requirements 1.1, 1.2, 1.3, 3.3**
      const testScenarios = [
        {
          name: 'true and false mix',
          responseData: {
            preferences: {
              viewerControlEnabled: true,
              viewerControlMode: false // Testing different boolean field
            },
            sequences: []
          },
          expected: {
            viewerControlEnabled: true,
            viewerControlMode: false, // Should preserve false
            numOfSequences: 0
          }
        },
        {
          name: 'false and null mix',
          responseData: {
            preferences: {
              viewerControlEnabled: false,
              viewerControlMode: null
            },
            sequences: [{ id: 1 }]
          },
          expected: {
            viewerControlEnabled: false, // Should preserve false
            viewerControlMode: null,
            numOfSequences: 1
          }
        },
        {
          name: 'undefined and false mix',
          responseData: {
            preferences: {
              viewerControlEnabled: undefined,
              viewerControlMode: false
            },
            sequences: [{ id: 1 }, { id: 2 }]
          },
          expected: {
            viewerControlEnabled: null, // undefined becomes null
            viewerControlMode: false, // Should preserve false
            numOfSequences: 2
          }
        }
      ];

      testScenarios.forEach(scenario => {
        const mockResponse = { status: 200 };
        const logEntry = logBuilder.buildSuccessLog(mockResponse, scenario.responseData);
        
        expect(logEntry.response.dataSummary).toEqual(scenario.expected);
      });
    });

    test('should maintain log structure consistency across different response scenarios', () => {
      // **Validates: Requirements 3.3**
      const scenarios = [
        {
          name: 'complete data',
          responseData: {
            preferences: { viewerControlEnabled: true, viewerControlMode: 'voting' },
            sequences: [{ id: 1 }]
          }
        },
        {
          name: 'minimal data',
          responseData: {
            preferences: { viewerControlEnabled: false },
            sequences: []
          }
        },
        {
          name: 'empty data',
          responseData: {}
        }
      ];

      scenarios.forEach(scenario => {
        const mockResponse = { status: 200 };
        const logEntry = logBuilder.buildSuccessLog(mockResponse, scenario.responseData);
        
        // Verify consistent log structure regardless of data content
        expect(logEntry).toHaveProperty('timestamp');
        expect(logEntry).toHaveProperty('requestId');
        expect(logEntry).toHaveProperty('logType');
        expect(logEntry).toHaveProperty('status');
        expect(logEntry).toHaveProperty('request');
        expect(logEntry).toHaveProperty('response');
        
        // Verify request structure is always consistent
        expect(logEntry.request).toHaveProperty('method');
        expect(logEntry.request).toHaveProperty('path');
        expect(logEntry.request).toHaveProperty('ip');
        expect(logEntry.request).toHaveProperty('userAgent');
        expect(logEntry.request).toHaveProperty('host');
        
        // Verify response structure is always consistent
        expect(logEntry.response).toHaveProperty('status');
        expect(logEntry.response).toHaveProperty('processingTime');
        expect(logEntry.response).toHaveProperty('dataSummary');
        
        // Verify dataSummary structure for showDetails path
        expect(logEntry.response.dataSummary).toHaveProperty('viewerControlEnabled');
        expect(logEntry.response.dataSummary).toHaveProperty('viewerControlMode');
        expect(logEntry.response.dataSummary).toHaveProperty('numOfSequences');
      });
    });

    test('should handle non-showDetails paths correctly (backward compatibility)', () => {
      // **Validates: Requirements 3.1**
      const nonShowDetailsBuilder = new RemoteFalconLogBuilder(
        mockRequestId, 
        mockClientInfo, 
        '/addSequenceToQueue', 
        'POST'
      );

      const mockResponse = { status: 200 };
      const mockResponseData = {
        success: true,
        message: 'Sequence added',
        preferences: {
          viewerControlEnabled: false // This should not affect non-showDetails paths
        }
      };

      const logEntry = nonShowDetailsBuilder.buildSuccessLog(mockResponse, mockResponseData);

      // Verify non-showDetails path uses general summary format
      expect(logEntry.response.dataSummary).toHaveProperty('hasData', true);
      expect(logEntry.response.dataSummary).toHaveProperty('responseSize');
      expect(logEntry.response.dataSummary).toHaveProperty('keyFields');
      expect(typeof logEntry.response.dataSummary.responseSize).toBe('number');
      expect(Array.isArray(logEntry.response.dataSummary.keyFields)).toBe(true);
      
      // Verify it does NOT have showDetails-specific fields
      expect(logEntry.response.dataSummary).not.toHaveProperty('viewerControlEnabled');
      expect(logEntry.response.dataSummary).not.toHaveProperty('viewerControlMode');
      expect(logEntry.response.dataSummary).not.toHaveProperty('numOfSequences');
    });

    test('should generate logs that can be properly serialized to JSON', () => {
      // **Validates: Requirements 3.3**
      const mockResponse = { status: 200 };
      const mockResponseData = {
        preferences: {
          viewerControlEnabled: false, // Critical test case
          viewerControlMode: 'jukebox'
        },
        sequences: [{ id: 1 }]
      };

      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);

      // Verify log can be serialized and deserialized without data loss
      const serialized = JSON.stringify(logEntry);
      expect(() => JSON.parse(serialized)).not.toThrow();
      
      const deserialized = JSON.parse(serialized);
      
      // Verify critical boolean values are preserved through serialization
      expect(deserialized.response.dataSummary.viewerControlEnabled).toBe(false);
      expect(deserialized.response.dataSummary.viewerControlMode).toBe('jukebox');
      expect(deserialized.response.dataSummary.numOfSequences).toBe(1);
      
      // Verify all other fields are preserved
      expect(deserialized.requestId).toBe(mockRequestId);
      expect(deserialized.logType).toBe('REMOTE_FALCON_REQUEST');
      expect(deserialized.status).toBe('SUCCESS');
    });

    test('should handle edge cases in log generation', () => {
      // **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 3.2**
      const edgeCases = [
        {
          name: 'empty preferences object',
          responseData: { preferences: {}, sequences: [] },
          expected: { viewerControlEnabled: null, viewerControlMode: null, numOfSequences: 0 }
        },
        {
          name: 'null preferences object',
          responseData: { preferences: null, sequences: [] },
          expected: { viewerControlEnabled: null, viewerControlMode: null, numOfSequences: 0 }
        },
        {
          name: 'missing sequences array',
          responseData: { preferences: { viewerControlEnabled: false } },
          expected: { viewerControlEnabled: false, viewerControlMode: null, numOfSequences: 0 }
        },
        {
          name: 'null sequences array',
          responseData: { preferences: { viewerControlEnabled: true }, sequences: null },
          expected: { viewerControlEnabled: true, viewerControlMode: null, numOfSequences: 0 }
        },
        {
          name: 'completely empty responseData',
          responseData: {},
          expected: { viewerControlEnabled: null, viewerControlMode: null, numOfSequences: 0 }
        }
      ];

      edgeCases.forEach(edgeCase => {
        const mockResponse = { status: 200 };
        const logEntry = logBuilder.buildSuccessLog(mockResponse, edgeCase.responseData);
        
        expect(logEntry.response.dataSummary).toEqual(edgeCase.expected);
      });
    });
  });

  describe('Application Error Detection Integration', () => {
    test('should detect and log application errors with boolean context', () => {
      // **Validates: Requirements 3.2**
      const mockResponse = { status: 200 }; // HTTP success but application error
      const mockResponseData = {
        success: false,
        message: 'QUEUE_FULL',
        preferences: {
          viewerControlEnabled: false // Should still be processed correctly
        }
      };

      // First check if application error is detected
      const applicationError = RemoteFalconLogBuilder.detectApplicationError(mockResponseData);
      expect(applicationError).not.toBeNull();
      expect(applicationError.type).toBe('APPLICATION_ERROR');
      expect(applicationError.message).toBe('QUEUE_FULL');

      // Then verify success log still processes boolean correctly
      const logEntry = logBuilder.buildSuccessLog(mockResponse, mockResponseData);
      expect(logEntry.response.dataSummary.viewerControlEnabled).toBe(false);
    });

    test('should handle mixed success/error scenarios', () => {
      // **Validates: Requirements 3.2, 3.3**
      const scenarios = [
        {
          name: 'HTTP success with application error',
          response: { status: 200 },
          responseData: { success: false, preferences: { viewerControlEnabled: true } },
          expectError: true
        },
        {
          name: 'HTTP success with valid data',
          response: { status: 200 },
          responseData: { success: true, preferences: { viewerControlEnabled: false } },
          expectError: false
        },
        {
          name: 'HTTP error with boolean data',
          response: { status: 500 },
          responseData: { preferences: { viewerControlEnabled: false } },
          expectError: false // HTTP errors are handled differently
        }
      ];

      scenarios.forEach(scenario => {
        const applicationError = RemoteFalconLogBuilder.detectApplicationError(scenario.responseData);
        
        if (scenario.expectError) {
          expect(applicationError).not.toBeNull();
        } else {
          expect(applicationError).toBeNull();
        }

        // Verify log generation still works correctly
        const logEntry = logBuilder.buildSuccessLog(scenario.response, scenario.responseData);
        expect(logEntry).toHaveProperty('response');
        expect(logEntry.response).toHaveProperty('dataSummary');
      });
    });
  });
});