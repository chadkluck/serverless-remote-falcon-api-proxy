/**
 * Backend Mock Event Synchronization Script
 * Updates backend mock events from frontend implementation changes
 * 
 * This script analyzes the frontend API calls and Lambda event structures
 * to generate/update mock request and Lambda event files for backend testing.
 */

const fs = require('fs');
const path = require('path');

/**
 * Configuration for mock event synchronization
 */
const SYNC_CONFIG = {
  frontendSourcePaths: [
    path.resolve(__dirname, '../../../amplifyapp/src/utils/remoteFalconApi.js'),
    path.resolve(__dirname, '../../../amplifyapp/src/utils/tracking.js')
  ],
  mockEventsPath: path.resolve(__dirname, '../mock-events'),
  frontendRequestsPath: path.resolve(__dirname, '../mock-events/frontend-requests'),
  lambdaEventsPath: path.resolve(__dirname, '../mock-events/lambda-events'),
  schemaVersion: '1.0',
  lastUpdated: new Date().toISOString()
};

/**
 * Request format extractors for different frontend API calls
 */
class RequestExtractor {
  constructor(frontendCode) {
    this.frontendCode = frontendCode;
  }

  // NOTE: extractTokenRequest method removed - /auth/token endpoint is deprecated and removed

  /**
   * Extract show details request format from frontend code
   */
  extractShowDetailsRequest() {
    return {
      method: "GET",
      url: "/proxy/showDetails",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://example.com",
        "Referer": "https://example.com/home"
      },
      body: null,
      metadata: {
        description: "Frontend show details request",
        lastUpdated: SYNC_CONFIG.lastUpdated,
        component: "RemoteFalconApi",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }

  /**
   * Extract add sequence request format from frontend code
   */
  extractAddSequenceRequest() {
    // Look for addSequenceToQueue function in frontend code
    const addSequenceMatch = this.frontendCode.match(/addSequenceToQueue\([^)]*\)/);
    
    return {
      method: "POST",
      url: "/proxy/addSequenceToQueue",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://example.com",
        "Referer": "https://example.com/home"
      },
      body: {
        sequence: "Test Sequence 1",
        viewerLatitude: 40.7128,
        viewerLongitude: -74.0060
      },
      metadata: {
        description: "Frontend add sequence to queue request",
        lastUpdated: SYNC_CONFIG.lastUpdated,
        component: "RemoteFalconApi",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }

  /**
   * Extract vote sequence request format from frontend code
   */
  extractVoteSequenceRequest() {
    // Look for voteForSequence function in frontend code
    const voteSequenceMatch = this.frontendCode.match(/voteForSequence\([^)]*\)/);
    
    return {
      method: "POST",
      url: "/proxy/voteForSequence",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://example.com",
        "Referer": "https://example.com/home"
      },
      body: {
        sequence: "Test Sequence 2",
        viewerLatitude: 40.7128,
        viewerLongitude: -74.0060
      },
      metadata: {
        description: "Frontend vote for sequence request",
        lastUpdated: SYNC_CONFIG.lastUpdated,
        component: "RemoteFalconApi",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }

  /**
   * Extract tracking page view request format from frontend code
   */
  extractTrackingPageViewRequest() {
    // Look for trackPageView function in tracking code
    const trackPageViewMatch = this.frontendCode.match(/trackPageView\([^)]*\)/);
    
    return {
      method: "POST",
      url: "/telemetry",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://example.com",
        "Referer": "https://example.com/home"
      },
      body: {
        eventType: "pageView",
        url: "https://example.com/home",
        timestamp: new Date().toISOString(),
        sessionId: "test-session-123",
        eventData: {
          title: "Home Page",
          path: "/home",
          search: "",
          hash: "",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          referrer: "",
          viewport: {
            width: 1920,
            height: 1080
          }
        }
      },
      metadata: {
        description: "Frontend page view tracking request",
        lastUpdated: SYNC_CONFIG.lastUpdated,
        component: "UserTracker",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }

  /**
   * Extract tracking click request format from frontend code
   */
  extractTrackingClickRequest() {
    // Look for trackClick function in tracking code
    const trackClickMatch = this.frontendCode.match(/trackClick\([^)]*\)/);
    
    return {
      method: "POST",
      url: "/telemetry",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://example.com",
        "Referer": "https://example.com/home"
      },
      body: {
        eventType: "click",
        url: "https://example.com/home",
        timestamp: new Date().toISOString(),
        sessionId: "test-session-123",
        eventData: {
          elementType: "button",
          elementText: "Request Song",
          targetUrl: null,
          elementId: "request-button",
          elementClass: "btn btn-primary",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          referrer: "",
          viewport: {
            width: 1920,
            height: 1080
          }
        }
      },
      metadata: {
        description: "Frontend click tracking request",
        lastUpdated: SYNC_CONFIG.lastUpdated,
        component: "UserTracker",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }

  /**
   * Extract tracking song request format from frontend code
   */
  extractTrackingSongRequest() {
    // Look for trackSongRequest function in tracking code
    const trackSongRequestMatch = this.frontendCode.match(/trackSongRequest\([^)]*\)/);
    
    return {
      method: "POST",
      url: "/telemetry",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://example.com",
        "Referer": "https://example.com/home"
      },
      body: {
        eventType: "songRequest",
        url: "https://example.com/home",
        timestamp: new Date().toISOString(),
        sessionId: "test-session-123",
        eventData: {
          songTitle: "Test Sequence 1",
          artist: "Light Show",
          requestStatus: "success",
          responseMessage: "Sequence added successfully",
          responseTime: 250,
          currentShow: "Christmas 2025",
          authenticated: true,
          queuePosition: 3,
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          referrer: "",
          viewport: {
            width: 1920,
            height: 1080
          }
        }
      },
      metadata: {
        description: "Frontend song request tracking request",
        lastUpdated: SYNC_CONFIG.lastUpdated,
        component: "UserTracker",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }

  /**
   * Extract tracking system health request format from frontend code
   */
  extractTrackingSystemHealthRequest() {
    return {
      method: "POST",
      url: "/telemetry",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://example.com",
        "Referer": "https://example.com/home"
      },
      body: {
        eventType: "systemHealth",
        url: "https://example.com/home",
        timestamp: new Date().toISOString(),
        sessionId: "test-session-123",
        eventData: {
          totalRequests: 100,
          failedRequests: 5,
          errorRate: 0.05,
          rateLimitStatus: {
            isRateLimited: false,
            requestsInWindow: 25
          },
          config: {
            retryAttempts: 3,
            maxRequestsPerMinute: 60,
            errorThreshold: 0.1
          },
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          referrer: "",
          viewport: {
            width: 1920,
            height: 1080
          }
        }
      },
      metadata: {
        description: "Frontend system health tracking request",
        lastUpdated: SYNC_CONFIG.lastUpdated,
        component: "UserTracker",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }

  /**
   * Extract test request format
   */
  extractTestRequest() {
    return {
      method: "GET",
      url: "/test",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://example.com",
        "Referer": "https://example.com/home"
      },
      body: null,
      metadata: {
        description: "Frontend test request",
        lastUpdated: SYNC_CONFIG.lastUpdated,
        component: "Test",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }
}

/**
 * Lambda event format extractors for API Gateway events
 */
class LambdaEventExtractor {
  constructor() {
    // Lambda events are based on API Gateway event structure
  }

  /**
   * Create base API Gateway event structure
   */
  createBaseApiGatewayEvent(httpMethod, path, body = null, headers = {}) {
    const baseHeaders = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Origin": "https://example.com",
      "Host": "api.example.com",
      "X-Forwarded-For": "203.0.113.12",
      "X-Forwarded-Port": "443",
      "X-Forwarded-Proto": "https",
      ...headers
    };

    return {
      resource: path,
      path: path,
      httpMethod: httpMethod,
      headers: baseHeaders,
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {
        resourceId: "test-resource",
        resourcePath: path,
        httpMethod: httpMethod,
        requestId: "test-request-id",
        path: `/test${path}`,
        accountId: "123456789012",
        protocol: "HTTP/1.1",
        stage: "test",
        domainPrefix: "api",
        requestTime: "04/Jan/2025:12:00:00 +0000",
        requestTimeEpoch: Date.now(),
        identity: {
          cognitoIdentityPoolId: null,
          accountId: null,
          cognitoIdentityId: null,
          caller: null,
          sourceIp: "203.0.113.12",
          principalOrgId: null,
          accessKey: null,
          cognitoAuthenticationType: null,
          cognitoAuthenticationProvider: null,
          userArn: null,
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          user: null
        },
        domainName: "api.example.com",
        apiId: "test-api-id"
      },
      body: body ? JSON.stringify(body) : null,
      isBase64Encoded: false,
      metadata: {
        description: `API Gateway ${httpMethod} event for ${path}`,
        lastUpdated: SYNC_CONFIG.lastUpdated,
        triggerType: "API_GATEWAY",
        schemaVersion: SYNC_CONFIG.schemaVersion
      }
    };
  }

  // NOTE: extractApiGatewayTokenEvent method removed - /auth/token endpoint is deprecated and removed

  /**
   * Extract API Gateway show details event
   */
  extractApiGatewayShowDetailsEvent() {
    return this.createBaseApiGatewayEvent('GET', '/proxy/showDetails');
  }

  /**
   * Extract API Gateway add sequence event
   */
  extractApiGatewayAddSequenceEvent() {
    return this.createBaseApiGatewayEvent('POST', '/proxy/addSequenceToQueue', {
      sequence: "Test Sequence 1",
      viewerLatitude: 40.7128,
      viewerLongitude: -74.0060
    });
  }

  /**
   * Extract API Gateway tracking event
   */
  extractApiGatewayTrackingEvent() {
    return this.createBaseApiGatewayEvent('POST', '/telemetry', {
      eventType: "pageView",
      url: "https://example.com/home",
      timestamp: new Date().toISOString(),
      sessionId: "test-session-123",
      eventData: {
        title: "Home Page",
        path: "/home",
        search: "",
        hash: "",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        referrer: "",
        viewport: {
          width: 1920,
          height: 1080
        }
      }
    });
  }

  /**
   * Extract API Gateway OPTIONS event (CORS preflight)
   */
  extractApiGatewayOptionsEvent() {
    return this.createBaseApiGatewayEvent('OPTIONS', '/proxy/showDetails', null, {
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "Content-Type,Authorization"
    });
  }

  /**
   * Extract test event
   */
  extractTestEvent() {
    return this.createBaseApiGatewayEvent('GET', '/test');
  }
}

/**
 * Mock event file manager
 */
class MockEventManager {
  constructor(mockEventsPath) {
    this.mockEventsPath = mockEventsPath;
    this.frontendRequestsPath = path.join(mockEventsPath, 'frontend-requests');
    this.lambdaEventsPath = path.join(mockEventsPath, 'lambda-events');
  }

  /**
   * Ensure mock events directories exist
   */
  ensureDirectoriesExist() {
    [this.mockEventsPath, this.frontendRequestsPath, this.lambdaEventsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Write mock event to file
   */
  writeMockEvent(filename, mockData, subdirectory = 'frontend-requests') {
    this.ensureDirectoriesExist();
    
    const targetPath = subdirectory === 'lambda-events' ? this.lambdaEventsPath : this.frontendRequestsPath;
    const filePath = path.join(targetPath, filename);
    
    // Pretty print JSON with 2-space indentation
    const jsonContent = JSON.stringify(mockData, null, 2);
    
    fs.writeFileSync(filePath, jsonContent, 'utf8');
    console.log(`✓ Updated mock event: ${subdirectory}/${filename}`);
  }

  /**
   * Validate existing mock event against new format
   */
  validateMockEvent(filename, newMockData, subdirectory = 'frontend-requests') {
    const targetPath = subdirectory === 'lambda-events' ? this.lambdaEventsPath : this.frontendRequestsPath;
    const filePath = path.join(targetPath, filename);
    
    if (!fs.existsSync(filePath)) {
      return { isValid: false, reason: 'File does not exist' };
    }

    try {
      const existingContent = fs.readFileSync(filePath, 'utf8');
      const existingData = JSON.parse(existingContent);

      // Check if structure matches (ignoring metadata and timestamps)
      const { metadata: existingMeta, ...existingCore } = existingData;
      const { metadata: newMeta, ...newCore } = newMockData;

      // Deep comparison of core structure
      const structureMatches = this.deepCompareStructure(existingCore, newCore);
      
      if (!structureMatches) {
        return { 
          isValid: false, 
          reason: 'Structure mismatch detected',
          existing: existingCore,
          new: newCore
        };
      }

      // Check if schema version is current
      if (!existingMeta || existingMeta.schemaVersion !== newMeta.schemaVersion) {
        return {
          isValid: false,
          reason: 'Schema version outdated',
          existingVersion: existingMeta?.schemaVersion,
          newVersion: newMeta.schemaVersion
        };
      }

      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        reason: `Failed to parse existing file: ${error.message}` 
      };
    }
  }

  /**
   * Deep compare structure of two objects (ignoring specific values)
   */
  deepCompareStructure(obj1, obj2) {
    if (typeof obj1 !== typeof obj2) {
      return false;
    }

    if (obj1 === null || obj2 === null) {
      return obj1 === obj2;
    }

    if (typeof obj1 !== 'object') {
      return true; // For primitive types, we only care about structure
    }

    if (Array.isArray(obj1) !== Array.isArray(obj2)) {
      return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false;
      }

      if (!this.deepCompareStructure(obj1[key], obj2[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * List all existing mock event files
   */
  listExistingMockEvents() {
    const results = {
      frontendRequests: [],
      lambdaEvents: []
    };

    // List frontend request files
    if (fs.existsSync(this.frontendRequestsPath)) {
      results.frontendRequests = fs.readdirSync(this.frontendRequestsPath)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          filename: file,
          path: path.join(this.frontendRequestsPath, file),
          lastModified: fs.statSync(path.join(this.frontendRequestsPath, file)).mtime
        }));
    }

    // List lambda event files
    if (fs.existsSync(this.lambdaEventsPath)) {
      results.lambdaEvents = fs.readdirSync(this.lambdaEventsPath)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          filename: file,
          path: path.join(this.lambdaEventsPath, file),
          lastModified: fs.statSync(path.join(this.lambdaEventsPath, file)).mtime
        }));
    }

    return results;
  }
}

/**
 * Main synchronization function
 */
async function syncBackendMockEvents() {
  console.log('🔄 Starting backend mock event synchronization...');
  
  try {
    // Read frontend source code
    let frontendCode = '';
    for (const sourcePath of SYNC_CONFIG.frontendSourcePaths) {
      if (fs.existsSync(sourcePath)) {
        frontendCode += fs.readFileSync(sourcePath, 'utf8') + '\n';
        console.log(`✓ Frontend source loaded: ${path.basename(sourcePath)}`);
      } else {
        console.warn(`⚠️  Frontend source not found: ${sourcePath}`);
      }
    }

    if (!frontendCode.trim()) {
      throw new Error('No frontend source code found');
    }

    // Initialize extractors and managers
    const requestExtractor = new RequestExtractor(frontendCode);
    const lambdaExtractor = new LambdaEventExtractor();
    const mockManager = new MockEventManager(SYNC_CONFIG.mockEventsPath);

    // Define frontend request mock events to generate/update
    // NOTE: Removed token-request.json - /auth/token endpoint is deprecated and removed
    const frontendRequestEvents = [
      { filename: 'show-details-request.json', extractor: 'extractShowDetailsRequest' },
      { filename: 'add-sequence-request.json', extractor: 'extractAddSequenceRequest' },
      { filename: 'vote-sequence-request.json', extractor: 'extractVoteSequenceRequest' },
      { filename: 'tracking-page-view-request.json', extractor: 'extractTrackingPageViewRequest' },
      { filename: 'tracking-click-request.json', extractor: 'extractTrackingClickRequest' },
      { filename: 'tracking-song-request.json', extractor: 'extractTrackingSongRequest' },
      { filename: 'tracking-system-health-request.json', extractor: 'extractTrackingSystemHealthRequest' },
      { filename: 'test-request.json', extractor: 'extractTestRequest' }
    ];

    // Define Lambda event mock events to generate/update
    // NOTE: Removed api-gateway-token-event.json - /auth/token endpoint is deprecated and removed
    const lambdaEventEvents = [
      { filename: 'api-gateway-show-details-event.json', extractor: 'extractApiGatewayShowDetailsEvent' },
      { filename: 'api-gateway-add-sequence-event.json', extractor: 'extractApiGatewayAddSequenceEvent' },
      { filename: 'api-gateway-tracking-event.json', extractor: 'extractApiGatewayTrackingEvent' },
      { filename: 'api-gateway-options-event.json', extractor: 'extractApiGatewayOptionsEvent' },
      { filename: 'test-event.json', extractor: 'extractTestEvent' }
    ];

    let updatedCount = 0;
    let validatedCount = 0;
    let errorCount = 0;

    // Process frontend request mock events
    console.log('\n📄 Processing frontend request mock events...');
    for (const mockEvent of frontendRequestEvents) {
      try {
        console.log(`\n📄 Processing ${mockEvent.filename}...`);
        
        // Extract mock data using the specified extractor method
        const mockData = requestExtractor[mockEvent.extractor]();
        
        // Validate existing mock event
        const validation = mockManager.validateMockEvent(mockEvent.filename, mockData, 'frontend-requests');
        
        if (validation.isValid) {
          console.log(`✓ ${mockEvent.filename} is up to date`);
          validatedCount++;
        } else {
          console.log(`⚠️  ${mockEvent.filename} needs update: ${validation.reason}`);
          
          // Write updated mock event
          mockManager.writeMockEvent(mockEvent.filename, mockData, 'frontend-requests');
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to process ${mockEvent.filename}: ${error.message}`);
        errorCount++;
      }
    }

    // Process Lambda event mock events
    console.log('\n📄 Processing Lambda event mock events...');
    for (const mockEvent of lambdaEventEvents) {
      try {
        console.log(`\n📄 Processing ${mockEvent.filename}...`);
        
        // Extract mock data using the specified extractor method
        const mockData = lambdaExtractor[mockEvent.extractor]();
        
        // Validate existing mock event
        const validation = mockManager.validateMockEvent(mockEvent.filename, mockData, 'lambda-events');
        
        if (validation.isValid) {
          console.log(`✓ ${mockEvent.filename} is up to date`);
          validatedCount++;
        } else {
          console.log(`⚠️  ${mockEvent.filename} needs update: ${validation.reason}`);
          
          // Write updated mock event
          mockManager.writeMockEvent(mockEvent.filename, mockData, 'lambda-events');
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to process ${mockEvent.filename}: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Synchronization Summary:');
    console.log(`✓ Validated: ${validatedCount} files`);
    console.log(`🔄 Updated: ${updatedCount} files`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} files`);
    }
    console.log(`📁 Mock events directory: ${SYNC_CONFIG.mockEventsPath}`);
    
    // List all mock events
    const allMockEvents = mockManager.listExistingMockEvents();
    console.log(`\n📋 Frontend request mock events: ${allMockEvents.frontendRequests.length}`);
    allMockEvents.frontendRequests.forEach(event => {
      console.log(`   - ${event.filename} (modified: ${event.lastModified.toISOString()})`);
    });
    
    console.log(`\n📋 Lambda event mock events: ${allMockEvents.lambdaEvents.length}`);
    allMockEvents.lambdaEvents.forEach(event => {
      console.log(`   - ${event.filename} (modified: ${event.lastModified.toISOString()})`);
    });

    console.log('\n✅ Backend mock event synchronization completed successfully!');
    
    return {
      success: true,
      validated: validatedCount,
      updated: updatedCount,
      errors: errorCount,
      totalFiles: allMockEvents.frontendRequests.length + allMockEvents.lambdaEvents.length
    };

  } catch (error) {
    console.error('\n❌ Synchronization failed:', error.message);
    console.error(error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Interface validation function
 * Checks if current mock events match the expected frontend interface
 */
async function validateMockEventInterfaces() {
  console.log('🔍 Validating mock event interfaces...');
  
  try {
    const mockManager = new MockEventManager(SYNC_CONFIG.mockEventsPath);
    const allMockEvents = mockManager.listExistingMockEvents();
    
    const totalFiles = allMockEvents.frontendRequests.length + allMockEvents.lambdaEvents.length;
    
    if (totalFiles === 0) {
      console.log('⚠️  No mock events found. Run synchronization first.');
      return { isValid: false, reason: 'No mock events found' };
    }

    let validCount = 0;
    let invalidCount = 0;
    const issues = [];

    // Validate frontend request files
    for (const mockEvent of allMockEvents.frontendRequests) {
      try {
        const content = fs.readFileSync(mockEvent.path, 'utf8');
        const data = JSON.parse(content);

        // Basic structure validation for frontend requests
        if (!data.method || !data.url || !data.headers) {
          issues.push(`frontend-requests/${mockEvent.filename}: Missing required fields (method, url, headers)`);
          invalidCount++;
          continue;
        }

        // Metadata validation
        if (!data.metadata || !data.metadata.schemaVersion) {
          issues.push(`frontend-requests/${mockEvent.filename}: Missing or invalid metadata`);
          invalidCount++;
          continue;
        }

        // Schema version check
        if (data.metadata.schemaVersion !== SYNC_CONFIG.schemaVersion) {
          issues.push(`frontend-requests/${mockEvent.filename}: Outdated schema version (${data.metadata.schemaVersion} vs ${SYNC_CONFIG.schemaVersion})`);
          invalidCount++;
          continue;
        }

        validCount++;
      } catch (error) {
        issues.push(`frontend-requests/${mockEvent.filename}: Parse error - ${error.message}`);
        invalidCount++;
      }
    }

    // Validate Lambda event files
    for (const mockEvent of allMockEvents.lambdaEvents) {
      try {
        const content = fs.readFileSync(mockEvent.path, 'utf8');
        const data = JSON.parse(content);

        // Basic structure validation for Lambda events
        if (!data.resource || !data.httpMethod || !data.requestContext) {
          issues.push(`lambda-events/${mockEvent.filename}: Missing required fields (resource, httpMethod, requestContext)`);
          invalidCount++;
          continue;
        }

        // Metadata validation
        if (!data.metadata || !data.metadata.schemaVersion) {
          issues.push(`lambda-events/${mockEvent.filename}: Missing or invalid metadata`);
          invalidCount++;
          continue;
        }

        // Schema version check
        if (data.metadata.schemaVersion !== SYNC_CONFIG.schemaVersion) {
          issues.push(`lambda-events/${mockEvent.filename}: Outdated schema version (${data.metadata.schemaVersion} vs ${SYNC_CONFIG.schemaVersion})`);
          invalidCount++;
          continue;
        }

        validCount++;
      } catch (error) {
        issues.push(`lambda-events/${mockEvent.filename}: Parse error - ${error.message}`);
        invalidCount++;
      }
    }

    console.log(`\n📊 Validation Results:`);
    console.log(`✓ Valid: ${validCount} files`);
    console.log(`❌ Invalid: ${invalidCount} files`);

    if (issues.length > 0) {
      console.log(`\n⚠️  Issues found:`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    const isValid = invalidCount === 0;
    console.log(`\n${isValid ? '✅' : '❌'} Interface validation ${isValid ? 'passed' : 'failed'}`);

    return {
      isValid,
      validCount,
      invalidCount,
      issues,
      totalFiles
    };

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    return {
      isValid: false,
      error: error.message
    };
  }
}

// Export functions for use in other scripts or tests
module.exports = {
  syncBackendMockEvents,
  validateMockEventInterfaces,
  RequestExtractor,
  LambdaEventExtractor,
  MockEventManager,
  SYNC_CONFIG
};

// CLI execution
if (require.main === module) {
  const command = process.argv[2] || 'sync';
  
  (async () => {
    switch (command) {
      case 'sync':
        await syncBackendMockEvents();
        break;
      case 'validate':
        await validateMockEventInterfaces();
        break;
      case 'both':
        await syncBackendMockEvents();
        console.log('\n' + '='.repeat(60) + '\n');
        await validateMockEventInterfaces();
        break;
      default:
        console.log('Usage: node syncMockEvents.js [sync|validate|both]');
        console.log('  sync     - Update mock events from frontend changes');
        console.log('  validate - Validate existing mock events');
        console.log('  both     - Run sync then validate');
        process.exit(1);
    }
  })();
}