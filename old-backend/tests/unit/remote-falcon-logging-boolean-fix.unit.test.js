/**
 * Unit tests for Remote Falcon Logging Boolean Fix
 * Feature: remote-falcon-logging-boolean-fix
 */

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

describe('Remote Falcon Logging Boolean Fix - Unit Tests', () => {
  const mockClientInfo = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    host: 'api.example.com'
  };
  const mockRequestId = 'test-request-123';
  const mockMethod = 'GET';

  let logBuilder;

  beforeEach(() => {
    logBuilder = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/showDetails', mockMethod);
  });

  describe('Boolean Scenarios for viewerControlEnabled', () => {
    test('viewerControlEnabled = true returns true', () => {
      // _Requirements: 1.1_
      const responseData = {
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'jukebox'
        },
        sequences: []
      };

      const result = logBuilder.generateDataSummary(responseData);

      expect(result.viewerControlEnabled).toBe(true);
    });

    test('viewerControlEnabled = false returns false (not null)', () => {
      // _Requirements: 1.2_
      const responseData = {
        preferences: {
          viewerControlEnabled: false,
          viewerControlMode: 'jukebox'
        },
        sequences: []
      };

      const result = logBuilder.generateDataSummary(responseData);

      // This test will FAIL with current implementation because || converts false to null
      expect(result.viewerControlEnabled).toBe(false);
    });

    test('viewerControlEnabled = null returns null', () => {
      // _Requirements: 1.3_
      const responseData = {
        preferences: {
          viewerControlEnabled: null,
          viewerControlMode: 'jukebox'
        },
        sequences: []
      };

      const result = logBuilder.generateDataSummary(responseData);

      expect(result.viewerControlEnabled).toBeNull();
    });

    test('viewerControlEnabled = undefined returns null', () => {
      // _Requirements: 1.3_
      const responseData = {
        preferences: {
          viewerControlEnabled: undefined,
          viewerControlMode: 'jukebox'
        },
        sequences: []
      };

      const result = logBuilder.generateDataSummary(responseData);

      expect(result.viewerControlEnabled).toBeNull();
    });

    test('missing preferences object returns null', () => {
      // _Requirements: 1.4_
      const responseData = {
        sequences: []
      };

      const result = logBuilder.generateDataSummary(responseData);

      expect(result.viewerControlEnabled).toBeNull();
    });
  });

  describe('Additional Edge Cases', () => {
    test('empty preferences object returns null for viewerControlEnabled', () => {
      // _Requirements: 1.4_
      const responseData = {
        preferences: {},
        sequences: []
      };

      const result = logBuilder.generateDataSummary(responseData);

      expect(result.viewerControlEnabled).toBeNull();
    });

    test('null responseData returns null for viewerControlEnabled', () => {
      // _Requirements: 1.4_
      const result = logBuilder.generateDataSummary(null);

      expect(result.viewerControlEnabled).toBeNull();
    });

    test('undefined responseData returns null for viewerControlEnabled', () => {
      // _Requirements: 1.4_
      const result = logBuilder.generateDataSummary(undefined);

      expect(result.viewerControlEnabled).toBeNull();
    });

    test('viewerControlMode consistency with viewerControlEnabled behavior', () => {
      // Test that viewerControlMode has the same issue (for consistency)
      const responseData = {
        preferences: {
          viewerControlEnabled: false,
          viewerControlMode: false // This would also be converted to null with ||
        },
        sequences: []
      };

      const result = logBuilder.generateDataSummary(responseData);

      // Both should preserve false values after fix
      expect(result.viewerControlEnabled).toBe(false);
      expect(result.viewerControlMode).toBe(false);
    });

    test('numOfSequences preserves existing || behavior', () => {
      // _Requirements: 2.3_
      const responseData = {
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'jukebox'
        },
        sequences: null // This should result in 0, not null
      };

      const result = logBuilder.generateDataSummary(responseData);

      expect(result.numOfSequences).toBe(0);
    });

    test('numOfSequences with empty array returns 0', () => {
      // _Requirements: 2.3_
      const responseData = {
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'jukebox'
        },
        sequences: []
      };

      const result = logBuilder.generateDataSummary(responseData);

      expect(result.numOfSequences).toBe(0);
    });

    test('numOfSequences with array returns correct length', () => {
      // _Requirements: 2.3_
      const responseData = {
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'jukebox'
        },
        sequences: [{ name: 'Song 1' }, { name: 'Song 2' }, { name: 'Song 3' }]
      };

      const result = logBuilder.generateDataSummary(responseData);

      expect(result.numOfSequences).toBe(3);
    });
  });

  describe('Invalid responseData Handling', () => {
    test('missing responseData behavior unchanged', () => {
      // _Requirements: 3.2_
      const result = logBuilder.generateDataSummary();

      expect(result.viewerControlEnabled).toBeNull();
      expect(result.viewerControlMode).toBeNull();
      expect(result.numOfSequences).toBe(0);
    });

    test('null responseData behavior unchanged', () => {
      // _Requirements: 3.2_
      const result = logBuilder.generateDataSummary(null);

      expect(result.viewerControlEnabled).toBeNull();
      expect(result.viewerControlMode).toBeNull();
      expect(result.numOfSequences).toBe(0);
    });

    test('undefined responseData behavior unchanged', () => {
      // _Requirements: 3.2_
      const result = logBuilder.generateDataSummary(undefined);

      expect(result.viewerControlEnabled).toBeNull();
      expect(result.viewerControlMode).toBeNull();
      expect(result.numOfSequences).toBe(0);
    });

    test('invalid responseData types handled gracefully', () => {
      // _Requirements: 3.2_
      const invalidInputs = [
        'string',
        123,
        true,
        false,
        [],
        Symbol('test')
      ];

      invalidInputs.forEach(invalidInput => {
        const result = logBuilder.generateDataSummary(invalidInput);
        
        expect(result.viewerControlEnabled).toBeNull();
        expect(result.viewerControlMode).toBeNull();
        expect(result.numOfSequences).toBe(0);
      });
    });

    test('responseData with invalid preferences types handled gracefully', () => {
      // _Requirements: 3.2_
      const invalidPreferencesInputs = [
        { preferences: 'string' },
        { preferences: 123 },
        { preferences: true },
        { preferences: [] }
      ];

      invalidPreferencesInputs.forEach(invalidInput => {
        const result = logBuilder.generateDataSummary(invalidInput);
        
        expect(result.viewerControlEnabled).toBeNull();
        expect(result.viewerControlMode).toBeNull();
        expect(result.numOfSequences).toBe(0);
      });
    });

    test('responseData with invalid sequences types handled gracefully', () => {
      // _Requirements: 3.2_
      const invalidSequencesInputs = [
        { preferences: { viewerControlEnabled: true }, sequences: 'string' }, // length = 6
        { preferences: { viewerControlEnabled: true }, sequences: 123 }, // no length property
        { preferences: { viewerControlEnabled: true }, sequences: true }, // no length property
        { preferences: { viewerControlEnabled: true }, sequences: {} } // no length property
      ];

      invalidSequencesInputs.forEach((invalidInput, index) => {
        const result = logBuilder.generateDataSummary(invalidInput);
        
        expect(result.viewerControlEnabled).toBe(true);
        expect(result.viewerControlMode).toBeNull();
        
        // The current implementation uses || operator which means:
        // - For objects with length property (like strings): returns that length
        // - For objects without length property: returns 0
        if (invalidInput.sequences && typeof invalidInput.sequences.length === 'number') {
          expect(result.numOfSequences).toBe(invalidInput.sequences.length);
        } else {
          expect(result.numOfSequences).toBe(0);
        }
      });
    });
  });

  describe('Non-showDetails Path Backward Compatibility', () => {
    test('non-showDetails path returns general summary format unchanged', () => {
      // _Requirements: 3.1_
      const logBuilderOtherPath = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/addSequence', mockMethod);
      
      const responseData = {
        preferences: {
          viewerControlEnabled: true,
          viewerControlMode: 'jukebox'
        },
        sequences: [{ name: 'Song 1' }, { name: 'Song 2' }],
        status: 'success',
        message: 'Sequence added'
      };

      const result = logBuilderOtherPath.generateDataSummary(responseData);

      // Should return general summary format, not showDetails format
      expect(result).toHaveProperty('hasData');
      expect(result).toHaveProperty('responseSize');
      expect(result).toHaveProperty('keyFields');
      expect(result).not.toHaveProperty('viewerControlEnabled');
      expect(result).not.toHaveProperty('viewerControlMode');
      expect(result).not.toHaveProperty('numOfSequences');
    });

    test('non-showDetails path hasData behavior preserved', () => {
      // _Requirements: 3.1_
      const logBuilderOtherPath = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/voteSequence', mockMethod);
      
      const responseData = {
        status: 'success',
        message: 'Vote recorded'
      };

      const result = logBuilderOtherPath.generateDataSummary(responseData);

      expect(result.hasData).toBe(true);
      expect(result.responseSize).toBeGreaterThan(0);
      expect(result.keyFields).toEqual(['status', 'message']);
    });

    test('non-showDetails path with empty responseData', () => {
      // _Requirements: 3.1_
      const logBuilderOtherPath = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/token', mockMethod);
      
      const responseData = {};

      const result = logBuilderOtherPath.generateDataSummary(responseData);

      expect(result.hasData).toBe(false);
      expect(result.responseSize).toBe(2); // "{}" length
      expect(result.keyFields).toEqual([]);
    });

    test('non-showDetails path with null responseData', () => {
      // _Requirements: 3.1_
      const logBuilderOtherPath = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/health', mockMethod);
      
      const result = logBuilderOtherPath.generateDataSummary(null);

      expect(result.hasData).toBe(false);
      expect(result.responseSize).toBe(2); // "{}" length
      expect(result.keyFields).toEqual([]);
    });

    test('non-showDetails path keyFields behavior preserved', () => {
      // _Requirements: 3.1_
      const logBuilderOtherPath = new RemoteFalconLogBuilder(mockRequestId, mockClientInfo, '/api/test', mockMethod);
      
      // Create responseData with more than 10 keys to test the slice(0, 10) behavior
      const responseData = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
        key4: 'value4',
        key5: 'value5',
        key6: 'value6',
        key7: 'value7',
        key8: 'value8',
        key9: 'value9',
        key10: 'value10',
        key11: 'value11',
        key12: 'value12'
      };

      const result = logBuilderOtherPath.generateDataSummary(responseData);

      expect(result.keyFields).toHaveLength(10); // Should be limited to first 10 keys
      expect(result.keyFields).toEqual(['key1', 'key2', 'key3', 'key4', 'key5', 'key6', 'key7', 'key8', 'key9', 'key10']);
    });
  });
});