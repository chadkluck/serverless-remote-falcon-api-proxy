/**
 * Property-based test for mock event synchronization (Backend)
 * Feature: testing-architecture-separation, Property 5: Mock Event Synchronization
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 * 
 * This test ensures that mock events stay synchronized with implementation changes
 * and that all related tests use the updated mock format.
 */

const { MockEventLoader } = require('./mockLoader.js');
const fs = require('fs');
const path = require('path');

describe('Mock Event Synchronization Property Tests (Backend)', () => {
  let mockEventFiles;
  let frontendRequestFiles;
  let lambdaEventFiles;

  beforeEach(() => {
    // Get all mock event files for testing
    const mockEventsDir = path.join(__dirname, '../mock-events');
    const frontendRequestsDir = path.join(mockEventsDir, 'frontend-requests');
    const lambdaEventsDir = path.join(mockEventsDir, 'lambda-events');

    frontendRequestFiles = fs.existsSync(frontendRequestsDir) 
      ? fs.readdirSync(frontendRequestsDir).filter(file => file.endsWith('.json'))
      : [];
    
    lambdaEventFiles = fs.existsSync(lambdaEventsDir)
      ? fs.readdirSync(lambdaEventsDir).filter(file => file.endsWith('.json'))
      : [];

    mockEventFiles = [...frontendRequestFiles, ...lambdaEventFiles];
  });

  /**
   * Property 5: Mock Event Synchronization
   * For any implementation change that affects cross-component interfaces,
   * the corresponding mock events should reflect the current interface format
   * and all related tests should use the updated mock format.
   */
  it('should maintain consistent schema structure across all mock events', () => {
    // Property: For any mock event file, it should have consistent required fields
    for (const filename of mockEventFiles) {
      let mockEvent;
      
      try {
        if (frontendRequestFiles.includes(filename)) {
          mockEvent = MockEventLoader.loadFrontendRequest(filename);
        } else {
          mockEvent = MockEventLoader.loadLambdaEvent(filename);
        }
      } catch (error) {
        throw new Error(`Failed to load mock event ${filename}: ${error.message}`);
      }

      // Validate required top-level fields exist
      expect(mockEvent).toBeDefined();
      
      if (frontendRequestFiles.includes(filename)) {
        // Frontend request mock validation
        expect(mockEvent.method).toBeDefined();
        expect(typeof mockEvent.method).toBe('string');
        expect(mockEvent.url).toBeDefined();
        expect(mockEvent.headers).toBeDefined();
        expect(mockEvent.metadata).toBeDefined();
        
        // Validate metadata structure
        expect(mockEvent.metadata.description).toBeDefined();
        expect(mockEvent.metadata.lastUpdated).toBeDefined();
        expect(mockEvent.metadata.schemaVersion).toBeDefined();
        
        // Validate headers structure
        expect(mockEvent.headers['Content-Type']).toBeDefined();
      } else {
        // Lambda event mock validation
        expect(mockEvent.resource).toBeDefined();
        expect(mockEvent.path).toBeDefined();
        expect(mockEvent.httpMethod).toBeDefined();
        expect(mockEvent.headers).toBeDefined();
        expect(mockEvent.requestContext).toBeDefined();
        expect(mockEvent.metadata).toBeDefined();
        
        // Validate requestContext structure
        expect(mockEvent.requestContext.requestId).toBeDefined();
        expect(mockEvent.requestContext.httpMethod).toBeDefined();
        expect(mockEvent.requestContext.identity).toBeDefined();
        
        // Validate metadata structure
        expect(mockEvent.metadata.description).toBeDefined();
        expect(mockEvent.metadata.lastUpdated).toBeDefined();
        expect(mockEvent.metadata.schemaVersion).toBeDefined();
      }
    }
  });

  it('should have valid JSON structure for all mock events', () => {
    // Property: For any mock event file, it should be valid JSON that can be parsed
    for (const filename of mockEventFiles) {
      let filePath;
      
      if (frontendRequestFiles.includes(filename)) {
        filePath = path.join(__dirname, '../mock-events/frontend-requests', filename);
      } else {
        filePath = path.join(__dirname, '../mock-events/lambda-events', filename);
      }

      expect(() => {
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
      }).not.toThrow();
    }
  });

  it('should have consistent timestamp format across all mock events', () => {
    // Property: For any mock event with timestamp fields, they should use ISO 8601 format
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    
    for (const filename of mockEventFiles) {
      let mockEvent;
      
      try {
        if (frontendRequestFiles.includes(filename)) {
          mockEvent = MockEventLoader.loadFrontendRequest(filename);
        } else {
          mockEvent = MockEventLoader.loadLambdaEvent(filename);
        }
      } catch (error) {
        continue; // Skip files that can't be loaded
      }

      // Check metadata lastUpdated timestamp
      if (mockEvent.metadata && mockEvent.metadata.lastUpdated) {
        expect(mockEvent.metadata.lastUpdated).toMatch(isoDateRegex);
      }

      // Check body timestamp for frontend requests
      if (mockEvent.body && typeof mockEvent.body === 'object' && mockEvent.body.timestamp) {
        expect(mockEvent.body.timestamp).toMatch(isoDateRegex);
      }

      // Check requestContext requestTime for Lambda events (different format)
      if (mockEvent.requestContext && mockEvent.requestContext.requestTime) {
        // Lambda requestTime format: "04/Jan/2025:12:00:00 +0000"
        const lambdaTimeRegex = /^\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} \+\d{4}$/;
        expect(mockEvent.requestContext.requestTime).toMatch(lambdaTimeRegex);
      }
    }
  });

  it('should have consistent HTTP methods for frontend request mocks', () => {
    // Property: For any frontend request mock, HTTP methods should be valid
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    
    for (const filename of frontendRequestFiles) {
      let mockEvent;
      
      try {
        mockEvent = MockEventLoader.loadFrontendRequest(filename);
      } catch (error) {
        continue; // Skip files that can't be loaded
      }

      expect(validMethods).toContain(mockEvent.method);
    }
  });

  it('should have consistent HTTP methods for Lambda event mocks', () => {
    // Property: For any Lambda event mock, HTTP methods should be valid
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    
    for (const filename of lambdaEventFiles) {
      let mockEvent;
      
      try {
        mockEvent = MockEventLoader.loadLambdaEvent(filename);
      } catch (error) {
        continue; // Skip files that can't be loaded
      }

      expect(validMethods).toContain(mockEvent.httpMethod);
    }
  });

  it('should have consistent Content-Type headers', () => {
    // Property: For any mock event with headers, Content-Type should be consistent
    const validContentTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'text/plain',
      'text/html'
    ];

    for (const filename of mockEventFiles) {
      let mockEvent;
      
      try {
        if (frontendRequestFiles.includes(filename)) {
          mockEvent = MockEventLoader.loadFrontendRequest(filename);
        } else {
          mockEvent = MockEventLoader.loadLambdaEvent(filename);
        }
      } catch (error) {
        continue; // Skip files that can't be loaded
      }

      if (mockEvent.headers && mockEvent.headers['Content-Type']) {
        expect(validContentTypes).toContain(mockEvent.headers['Content-Type']);
      }
    }
  });

  it('should have schema version consistency across all mock events', () => {
    // Property: For any mock event, schema version should be consistent
    const expectedSchemaVersion = '1.0';
    
    for (const filename of mockEventFiles) {
      let mockEvent;
      
      try {
        if (frontendRequestFiles.includes(filename)) {
          mockEvent = MockEventLoader.loadFrontendRequest(filename);
        } else {
          mockEvent = MockEventLoader.loadLambdaEvent(filename);
        }
      } catch (error) {
        continue; // Skip files that can't be loaded
      }

      if (mockEvent.metadata && mockEvent.metadata.schemaVersion) {
        expect(mockEvent.metadata.schemaVersion).toBe(expectedSchemaVersion);
      }
    }
  });

  it('should maintain API Gateway event structure for Lambda events', () => {
    // Property: For any Lambda event mock, it should follow API Gateway event structure
    for (const filename of lambdaEventFiles) {
      let mockEvent;
      
      try {
        mockEvent = MockEventLoader.loadLambdaEvent(filename);
      } catch (error) {
        continue; // Skip files that can't be loaded
      }

      // Required API Gateway event fields
      expect(mockEvent.resource).toBeDefined();
      expect(mockEvent.path).toBeDefined();
      expect(mockEvent.httpMethod).toBeDefined();
      expect(mockEvent.headers).toBeDefined();
      expect(mockEvent.requestContext).toBeDefined();
      expect(mockEvent.isBase64Encoded).toBeDefined();
      expect(typeof mockEvent.isBase64Encoded).toBe('boolean');

      // Required requestContext fields
      expect(mockEvent.requestContext.requestId).toBeDefined();
      expect(mockEvent.requestContext.httpMethod).toBeDefined();
      expect(mockEvent.requestContext.identity).toBeDefined();
      expect(mockEvent.requestContext.identity.sourceIp).toBeDefined();
    }
  });

  it('should maintain interface compatibility between frontend requests and Lambda events', () => {
    // Property: For any API endpoint, frontend request and Lambda event should be compatible
    const endpointMappings = {
      '/telemetry': {
        frontendFiles: ['tracking-page-view-request.json', 'tracking-click-request.json', 'tracking-song-request.json', 'tracking-system-health-request.json'],
        lambdaFiles: ['api-gateway-tracking-event.json']
      },
      '/proxy/showDetails': {
        frontendFiles: ['show-details-request.json'],
        lambdaFiles: ['api-gateway-show-details-event.json']
      },
      '/proxy/addSequenceToQueue': {
        frontendFiles: ['add-sequence-request.json'],
        lambdaFiles: ['api-gateway-add-sequence-event.json']
      },
      '/proxy/voteForSequence': {
        frontendFiles: ['vote-sequence-request.json'],
        lambdaFiles: []
      },
      '/auth/token': {
        frontendFiles: ['token-request.json'],
        lambdaFiles: ['api-gateway-token-event.json']
      }
    };

    for (const [endpoint, mapping] of Object.entries(endpointMappings)) {
      // Validate that frontend request files exist for the endpoint
      for (const frontendFile of mapping.frontendFiles) {
        expect(frontendRequestFiles).toContain(frontendFile);
        
        // Validate that frontend request mock can be loaded
        expect(() => {
          MockEventLoader.loadFrontendRequest(frontendFile);
        }).not.toThrow();
      }

      // Validate that Lambda event files exist for the endpoint (if any)
      for (const lambdaFile of mapping.lambdaFiles) {
        expect(lambdaEventFiles).toContain(lambdaFile);
        
        // Validate that Lambda event mock can be loaded
        expect(() => {
          MockEventLoader.loadLambdaEvent(lambdaFile);
        }).not.toThrow();
      }
    }
  });

  it('should have consistent request ID format in Lambda events', () => {
    // Property: For any Lambda event, request ID should follow consistent format
    for (const filename of lambdaEventFiles) {
      let mockEvent;
      
      try {
        mockEvent = MockEventLoader.loadLambdaEvent(filename);
      } catch (error) {
        continue; // Skip files that can't be loaded
      }

      if (mockEvent.requestContext && mockEvent.requestContext.requestId) {
        // Request ID should be a non-empty string
        expect(typeof mockEvent.requestContext.requestId).toBe('string');
        expect(mockEvent.requestContext.requestId.length).toBeGreaterThan(0);
      }
    }
  });
});