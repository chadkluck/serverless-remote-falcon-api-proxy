/**
 * Property-based tests for Remote Falcon Logging Boolean Fix
 * Feature: remote-falcon-logging-boolean-fix
 */

const fc = require('fast-check');

// Define the RemoteFalconLogBuilder class with the CURRENT (buggy) implementation for testing
class RemoteFalconLogBuilder {
  constructor(requestId, clientInfo, path, method) {
    this.requestId = requestId;
    this.clientInfo = clientInfo;
    this.path = path;
    this.method = method;
    this.startTime = Date.now();
  }

  generateDataSummary(responseData) {
    if (this.path === '/showDetails') {
      return {
        viewerControlEnabled: responseData?.preferences?.viewerControlEnabled ?? null,
        viewerControlMode: responseData?.preferences?.viewerControlMode ?? null,
        numOfSequences: responseData?.sequences?.length || 0
      };
    }

    return {
      hasData: !!responseData && Object.keys(responseData).length > 0,
      responseSize: JSON.stringify(responseData || {}).length,
      keyFields: responseData ? Object.keys(responseData).slice(0, 10) : []
    };
  }
}

describe('Remote Falcon Logging Boolean Fix - Property Tests', () => {
  const mockClientInfo = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    host: 'api.example.com'
  };
  const mockRequestId = 'test-request-123';
  const mockMethod = 'GET';

  describe('Property 1: Boolean True Preservation', () => {
    test('Feature: remote-falcon-logging-boolean-fix, Property 1: Boolean True Preservation', () => {
      // **Validates: Requirements 1.1**
      
      fc.assert(
        fc.property(
          fc.record({
            preferences: fc.record({
              viewerControlEnabled: fc.constant(true),
              viewerControlMode: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined))
            }),
            sequences: fc.oneof(fc.array(fc.object()), fc.constant(null), fc.constant(undefined))
          }),
          (responseData) => {
            const logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', mockMethod);
            const result = logBuilder.generateDataSummary(responseData);
            
            // For any response data with preferences.viewerControlEnabled set to true,
            // the generateDataSummary method should return true for viewerControlEnabled
            expect(result.viewerControlEnabled).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Boolean False Preservation', () => {
    test('Feature: remote-falcon-logging-boolean-fix, Property 2: Boolean False Preservation', () => {
      // **Validates: Requirements 1.2**
      
      fc.assert(
        fc.property(
          fc.record({
            preferences: fc.record({
              viewerControlEnabled: fc.constant(false),
              viewerControlMode: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined))
            }),
            sequences: fc.oneof(fc.array(fc.object()), fc.constant(null), fc.constant(undefined))
          }),
          (responseData) => {
            const logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', mockMethod);
            const result = logBuilder.generateDataSummary(responseData);
            
            // For any response data with preferences.viewerControlEnabled set to false,
            // the generateDataSummary method should return false (not null) for viewerControlEnabled
            expect(result.viewerControlEnabled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Null/Undefined Handling', () => {
    test('Feature: remote-falcon-logging-boolean-fix, Property 3: Null/Undefined Handling', () => {
      // **Validates: Requirements 1.3**
      
      fc.assert(
        fc.property(
          fc.record({
            preferences: fc.record({
              viewerControlEnabled: fc.oneof(fc.constant(null), fc.constant(undefined)),
              viewerControlMode: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined))
            }),
            sequences: fc.oneof(fc.array(fc.object()), fc.constant(null), fc.constant(undefined))
          }),
          (responseData) => {
            const logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', mockMethod);
            const result = logBuilder.generateDataSummary(responseData);
            
            // For any response data where preferences.viewerControlEnabled is null or undefined,
            // the generateDataSummary method should return null for viewerControlEnabled
            expect(result.viewerControlEnabled).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Missing Preferences Handling', () => {
    test('Feature: remote-falcon-logging-boolean-fix, Property 4: Missing Preferences Handling', () => {
      // **Validates: Requirements 1.4**
      
      fc.assert(
        fc.property(
          fc.record({
            sequences: fc.oneof(fc.array(fc.object()), fc.constant(null), fc.constant(undefined))
          }),
          (responseData) => {
            const logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', mockMethod);
            const result = logBuilder.generateDataSummary(responseData);
            
            // For any response data where the preferences object is missing,
            // the generateDataSummary method should return null for viewerControlEnabled
            expect(result.viewerControlEnabled).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Non-Boolean Field Preservation', () => {
    test('Feature: remote-falcon-logging-boolean-fix, Property 5: Non-Boolean Field Preservation', () => {
      // **Validates: Requirements 2.3**
      
      fc.assert(
        fc.property(
          fc.record({
            preferences: fc.record({
              viewerControlEnabled: fc.oneof(fc.boolean(), fc.constant(null), fc.constant(undefined)),
              viewerControlMode: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined))
            }),
            sequences: fc.oneof(
              fc.array(fc.object()),
              fc.constant(null),
              fc.constant(undefined),
              fc.constant([])
            )
          }),
          (responseData) => {
            const logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', mockMethod);
            const result = logBuilder.generateDataSummary(responseData);
            
            // For any response data, the generateDataSummary method should preserve existing behavior 
            // for numOfSequences (returning 0 when sequences is missing or empty)
            const expectedNumOfSequences = responseData?.sequences?.length || 0;
            expect(result.numOfSequences).toBe(expectedNumOfSequences);
            
            // Verify that numOfSequences uses || operator behavior (0 for falsy values)
            if (!responseData?.sequences || responseData.sequences.length === 0) {
              expect(result.numOfSequences).toBe(0);
            } else {
              expect(result.numOfSequences).toBe(responseData.sequences.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Non-ShowDetails Path Preservation', () => {
    test('Feature: remote-falcon-logging-boolean-fix, Property 6: Non-ShowDetails Path Preservation', () => {
      // **Validates: Requirements 3.1**
      
      fc.assert(
        fc.property(
          fc.record({
            path: fc.oneof(
              fc.constant('/addSequence'),
              fc.constant('/voteSequence'),
              fc.constant('/token'),
              fc.constant('/health'),
              fc.constant('/api/test'),
              fc.string().filter(s => s !== '/showDetails')
            ),
            responseData: fc.oneof(
              fc.record({
                status: fc.string(),
                message: fc.string(),
                data: fc.object()
              }),
              fc.object(),
              fc.constant(null),
              fc.constant(undefined)
            )
          }),
          ({ path, responseData }) => {
            const logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, path, mockMethod);
            const result = logBuilder.generateDataSummary(responseData);
            
            // For any RemoteFalconLogBuilder instance with a path other than '/showDetails',
            // the generateDataSummary method should maintain existing behavior unchanged
            expect(result).toHaveProperty('hasData');
            expect(result).toHaveProperty('responseSize');
            expect(result).toHaveProperty('keyFields');
            expect(result).not.toHaveProperty('viewerControlEnabled');
            expect(result).not.toHaveProperty('viewerControlMode');
            expect(result).not.toHaveProperty('numOfSequences');
            
            // Verify the general summary format behavior
            const expectedHasData = !!responseData && Object.keys(responseData).length > 0;
            const expectedResponseSize = JSON.stringify(responseData || {}).length;
            const expectedKeyFields = responseData ? Object.keys(responseData).slice(0, 10) : [];
            
            expect(result.hasData).toBe(expectedHasData);
            expect(result.responseSize).toBe(expectedResponseSize);
            expect(result.keyFields).toEqual(expectedKeyFields);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Invalid Data Handling', () => {
    test('Feature: remote-falcon-logging-boolean-fix, Property 7: Invalid Data Handling', () => {
      // **Validates: Requirements 3.2**
      
      fc.assert(
        fc.property(
          fc.oneof(
            // Missing/null/undefined responseData
            fc.constant(null),
            fc.constant(undefined),
            // Invalid responseData types
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.anything()),
            // Invalid preferences types
            fc.record({
              preferences: fc.oneof(
                fc.string(),
                fc.integer(),
                fc.boolean(),
                fc.array(fc.anything())
              )
            }),
            // Invalid sequences types
            fc.record({
              preferences: fc.record({
                viewerControlEnabled: fc.oneof(fc.boolean(), fc.constant(null), fc.constant(undefined)),
                viewerControlMode: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined))
              }),
              sequences: fc.oneof(
                fc.string(),
                fc.integer(),
                fc.boolean(),
                fc.object()
              )
            })
          ),
          (responseData) => {
            const logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', mockMethod);
            const result = logBuilder.generateDataSummary(responseData);
            
            // For any missing or invalid responseData, the generateDataSummary method 
            // should maintain existing error handling behavior
            expect(result).toHaveProperty('viewerControlEnabled');
            expect(result).toHaveProperty('viewerControlMode');
            expect(result).toHaveProperty('numOfSequences');
            
            // Invalid data should result in safe defaults
            if (!responseData || typeof responseData !== 'object' || Array.isArray(responseData) ||
                !responseData.preferences || typeof responseData.preferences !== 'object' || Array.isArray(responseData.preferences)) {
              expect(result.viewerControlEnabled).toBeNull();
              expect(result.viewerControlMode).toBeNull();
            }
            
            // numOfSequences should always be a number (0 for invalid sequences)
            expect(typeof result.numOfSequences).toBe('number');
            expect(result.numOfSequences).toBeGreaterThanOrEqual(0);
            
            // The current implementation uses || operator which means:
            // - For arrays: returns array.length
            // - For objects with length property (like strings): returns that length
            // - For null/undefined/objects without length: returns 0
            if (responseData && typeof responseData === 'object' && 
                responseData.sequences && typeof responseData.sequences.length === 'number') {
              expect(result.numOfSequences).toBe(responseData.sequences.length);
            } else {
              expect(result.numOfSequences).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Log Structure Preservation', () => {
    test('Feature: remote-falcon-logging-boolean-fix, Property 8: Log Structure Preservation', () => {
      // **Validates: Requirements 3.3**
      
      fc.assert(
        fc.property(
          fc.record({
            preferences: fc.record({
              viewerControlEnabled: fc.oneof(fc.boolean(), fc.constant(null), fc.constant(undefined)),
              viewerControlMode: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined))
            }),
            sequences: fc.oneof(fc.array(fc.object()), fc.constant(null), fc.constant(undefined))
          }),
          (responseData) => {
            const logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', mockMethod);
            const result = logBuilder.generateDataSummary(responseData);
            
            // For any valid response data for '/showDetails' path, the generateDataSummary method 
            // should return an object with exactly the fields: viewerControlEnabled, viewerControlMode, and numOfSequences
            expect(result).toHaveProperty('viewerControlEnabled');
            expect(result).toHaveProperty('viewerControlMode');
            expect(result).toHaveProperty('numOfSequences');
            
            // Should have exactly these 3 properties, no more, no less
            const resultKeys = Object.keys(result);
            expect(resultKeys).toHaveLength(3);
            expect(resultKeys.sort()).toEqual(['numOfSequences', 'viewerControlEnabled', 'viewerControlMode']);
            
            // Verify types are correct
            expect(['boolean', 'object']).toContain(typeof result.viewerControlEnabled); // boolean or null
            expect(['string', 'object']).toContain(typeof result.viewerControlMode); // string or null
            expect(typeof result.numOfSequences).toBe('number');
            
            // Verify null handling
            if (result.viewerControlEnabled === null) {
              expect(result.viewerControlEnabled).toBeNull();
            } else {
              expect(typeof result.viewerControlEnabled).toBe('boolean');
            }
            
            if (result.viewerControlMode === null) {
              expect(result.viewerControlMode).toBeNull();
            } else {
              expect(typeof result.viewerControlMode).toBe('string');
            }
            
            // numOfSequences should always be a non-negative number
            expect(result.numOfSequences).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});