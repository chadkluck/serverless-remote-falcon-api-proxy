/**
 * Unit Tests for Mock Event Endpoint Validation
 * 
 * These tests verify that all mock events use correct endpoint structure
 * and that no mock events reference deprecated endpoints.
 * 
 * Requirements: 4.3, 4.4 - Update mock events to use /telemetry endpoint
 */

const fs = require('fs');
const path = require('path');
const { MockEventLoader } = require('../utils/mockLoader');

describe('Mock Event Endpoint Validation (Unit Tests)', () => {
  const mockEventsDir = path.join(__dirname, '../mock-events');
  const frontendRequestsDir = path.join(mockEventsDir, 'frontend-requests');
  const lambdaEventsDir = path.join(mockEventsDir, 'lambda-events');

  let frontendRequestFiles = [];
  let lambdaEventFiles = [];

  beforeAll(() => {
    // Get all mock event files
    if (fs.existsSync(frontendRequestsDir)) {
      frontendRequestFiles = fs.readdirSync(frontendRequestsDir)
        .filter(file => file.endsWith('.json'));
    }

    if (fs.existsSync(lambdaEventsDir)) {
      lambdaEventFiles = fs.readdirSync(lambdaEventsDir)
        .filter(file => file.endsWith('.json'));
    }
  });

  describe('Frontend Request Mock Events', () => {
    it('should not contain any deprecated /proxy/track endpoints', () => {
      frontendRequestFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadFrontendRequest(filename);
        
        expect(mockEvent.url).toBeDefined();
        expect(mockEvent.url).not.toBe('/proxy/track');
        expect(mockEvent.url).not.toContain('/proxy/track');
      });
    });

    it('should not contain any deprecated /auth/token endpoints', () => {
      frontendRequestFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadFrontendRequest(filename);
        
        expect(mockEvent.url).toBeDefined();
        expect(mockEvent.url).not.toBe('/auth/token');
        expect(mockEvent.url).not.toContain('/auth/token');
      });
    });

    it('should use /telemetry for all tracking requests', () => {
      const trackingFiles = frontendRequestFiles.filter(filename => 
        filename.includes('tracking-')
      );

      expect(trackingFiles.length).toBeGreaterThan(0);

      trackingFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadFrontendRequest(filename);
        
        expect(mockEvent.url).toBe('/telemetry');
        expect(mockEvent.method).toBe('POST');
      });
    });

    it('should maintain /proxy prefix only for Remote Falcon API endpoints', () => {
      const proxyFiles = frontendRequestFiles.filter(filename => {
        const mockEvent = MockEventLoader.loadFrontendRequest(filename);
        return mockEvent.url.startsWith('/proxy/');
      });

      // Valid proxy endpoints for Remote Falcon API
      const validProxyEndpoints = [
        '/proxy/showDetails',
        '/proxy/addSequenceToQueue', 
        '/proxy/voteForSequence'
      ];

      proxyFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadFrontendRequest(filename);
        
        expect(validProxyEndpoints).toContain(mockEvent.url);
      });
    });

    it('should have valid HTTP methods for all endpoints', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

      frontendRequestFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadFrontendRequest(filename);
        
        expect(mockEvent.method).toBeDefined();
        expect(validMethods).toContain(mockEvent.method);
      });
    });

    it('should have proper Content-Type headers for POST requests', () => {
      frontendRequestFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadFrontendRequest(filename);
        
        if (mockEvent.method === 'POST') {
          expect(mockEvent.headers).toBeDefined();
          expect(mockEvent.headers['Content-Type']).toBeDefined();
          expect(mockEvent.headers['Content-Type']).toBe('application/json');
        }
      });
    });
  });

  describe('Lambda Event Mock Events', () => {
    it('should not contain any deprecated /proxy/track paths', () => {
      lambdaEventFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        
        expect(mockEvent.path).toBeDefined();
        expect(mockEvent.resource).toBeDefined();
        
        expect(mockEvent.path).not.toBe('/proxy/track');
        expect(mockEvent.resource).not.toBe('/proxy/track');
        expect(mockEvent.path).not.toContain('/proxy/track');
        expect(mockEvent.resource).not.toContain('/proxy/track');
      });
    });

    it('should not contain any deprecated /auth/token paths', () => {
      lambdaEventFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        
        expect(mockEvent.path).toBeDefined();
        expect(mockEvent.resource).toBeDefined();
        
        expect(mockEvent.path).not.toBe('/auth/token');
        expect(mockEvent.resource).not.toBe('/auth/token');
        expect(mockEvent.path).not.toContain('/auth/token');
        expect(mockEvent.resource).not.toContain('/auth/token');
      });
    });

    it('should use /telemetry for all tracking Lambda events', () => {
      const trackingFiles = lambdaEventFiles.filter(filename => 
        filename.includes('tracking')
      );

      expect(trackingFiles.length).toBeGreaterThan(0);

      trackingFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        
        expect(mockEvent.path).toBe('/telemetry');
        expect(mockEvent.resource).toBe('/telemetry');
        expect(mockEvent.httpMethod).toBe('POST');
        expect(mockEvent.requestContext.resourcePath).toBe('/telemetry');
        expect(mockEvent.requestContext.httpMethod).toBe('POST');
      });
    });

    it('should maintain /proxy prefix only for Remote Falcon API Lambda events', () => {
      const proxyFiles = lambdaEventFiles.filter(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        return mockEvent.path.startsWith('/proxy/');
      });

      // Valid proxy endpoints for Remote Falcon API
      const validProxyEndpoints = [
        '/proxy/showDetails',
        '/proxy/addSequenceToQueue', 
        '/proxy/voteForSequence'
      ];

      proxyFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        
        expect(validProxyEndpoints).toContain(mockEvent.path);
        expect(validProxyEndpoints).toContain(mockEvent.resource);
      });
    });

    it('should have consistent path and resource values', () => {
      lambdaEventFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        
        expect(mockEvent.path).toBeDefined();
        expect(mockEvent.resource).toBeDefined();
        expect(mockEvent.path).toBe(mockEvent.resource);
      });
    });

    it('should have matching httpMethod in event and requestContext', () => {
      lambdaEventFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        
        expect(mockEvent.httpMethod).toBeDefined();
        expect(mockEvent.requestContext.httpMethod).toBeDefined();
        expect(mockEvent.httpMethod).toBe(mockEvent.requestContext.httpMethod);
      });
    });

    it('should have matching resourcePath in requestContext', () => {
      lambdaEventFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        
        expect(mockEvent.requestContext.resourcePath).toBeDefined();
        expect(mockEvent.requestContext.resourcePath).toBe(mockEvent.resource);
      });
    });
  });

  describe('Mock Event File Structure', () => {
    it('should not have any auth token related files', () => {
      // Check that no auth token files exist
      expect(frontendRequestFiles).not.toContain('token-request.json');
      expect(lambdaEventFiles).not.toContain('api-gateway-token-event.json');
      
      // Also check that no files contain 'token' in their name (except for legitimate uses)
      const suspiciousFiles = [
        ...frontendRequestFiles.filter(f => f.includes('token')),
        ...lambdaEventFiles.filter(f => f.includes('token'))
      ];
      
      expect(suspiciousFiles).toHaveLength(0);
    });

    it('should have all expected tracking mock event files', () => {
      const expectedTrackingFiles = [
        'tracking-page-view-request.json',
        'tracking-click-request.json', 
        'tracking-song-request.json',
        'tracking-system-health-request.json'
      ];

      expectedTrackingFiles.forEach(expectedFile => {
        expect(frontendRequestFiles).toContain(expectedFile);
      });

      // Should have at least one tracking Lambda event
      const trackingLambdaFiles = lambdaEventFiles.filter(f => f.includes('tracking'));
      expect(trackingLambdaFiles.length).toBeGreaterThan(0);
    });

    it('should have all expected Remote Falcon proxy mock event files', () => {
      const expectedProxyFiles = [
        'show-details-request.json',
        'add-sequence-request.json',
        'vote-sequence-request.json'
      ];

      expectedProxyFiles.forEach(expectedFile => {
        expect(frontendRequestFiles).toContain(expectedFile);
      });

      // Should have corresponding Lambda events
      const expectedLambdaFiles = [
        'api-gateway-show-details-event.json',
        'api-gateway-add-sequence-event.json'
      ];

      expectedLambdaFiles.forEach(expectedFile => {
        expect(lambdaEventFiles).toContain(expectedFile);
      });
    });
  });

  describe('Mock Event Metadata Validation', () => {
    it('should have valid metadata in all frontend request files', () => {
      frontendRequestFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadFrontendRequest(filename);
        
        expect(mockEvent.metadata).toBeDefined();
        expect(mockEvent.metadata.description).toBeDefined();
        expect(mockEvent.metadata.lastUpdated).toBeDefined();
        expect(mockEvent.metadata.schemaVersion).toBeDefined();
        
        // Validate ISO date format
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        expect(mockEvent.metadata.lastUpdated).toMatch(isoDateRegex);
      });
    });

    it('should have valid metadata in all Lambda event files', () => {
      lambdaEventFiles.forEach(filename => {
        const mockEvent = MockEventLoader.loadLambdaEvent(filename);
        
        expect(mockEvent.metadata).toBeDefined();
        expect(mockEvent.metadata.description).toBeDefined();
        expect(mockEvent.metadata.lastUpdated).toBeDefined();
        expect(mockEvent.metadata.schemaVersion).toBeDefined();
        
        // Validate ISO date format
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        expect(mockEvent.metadata.lastUpdated).toMatch(isoDateRegex);
      });
    });

    it('should have consistent schema versions across all mock events', () => {
      const allFiles = [
        ...frontendRequestFiles.map(f => ({ type: 'frontend', file: f })),
        ...lambdaEventFiles.map(f => ({ type: 'lambda', file: f }))
      ];

      const schemaVersions = new Set();

      allFiles.forEach(({ type, file }) => {
        const mockEvent = type === 'frontend' 
          ? MockEventLoader.loadFrontendRequest(file)
          : MockEventLoader.loadLambdaEvent(file);
        
        schemaVersions.add(mockEvent.metadata.schemaVersion);
      });

      // All files should use the same schema version
      expect(schemaVersions.size).toBe(1);
      expect(Array.from(schemaVersions)[0]).toBe('1.0');
    });
  });
});