const fs = require('fs');
const path = require('path');

/**
 * MockEventLoader for backend testing
 * Provides utilities for loading mock frontend requests and Lambda events
 */
class MockEventLoader {
  /**
   * Load a mock frontend request from JSON file
   * @param {string} filename - Name of the mock request file (e.g., 'tracking-request.json')
   * @returns {Object} Parsed JSON mock request
   */
  static loadFrontendRequest(filename) {
    const mockPath = path.join(__dirname, '../mock-events/frontend-requests', filename);
    
    try {
      const mockData = fs.readFileSync(mockPath, 'utf8');
      return JSON.parse(mockData);
    } catch (error) {
      throw new Error(`Failed to load mock frontend request '${filename}': ${error.message}`);
    }
  }

  /**
   * Load a mock Lambda event from JSON file
   * @param {string} filename - Name of the mock Lambda event file (e.g., 'api-gateway-event.json')
   * @returns {Object} Parsed JSON mock Lambda event
   */
  static loadLambdaEvent(filename) {
    const mockPath = path.join(__dirname, '../mock-events/lambda-events', filename);
    
    try {
      const mockData = fs.readFileSync(mockPath, 'utf8');
      return JSON.parse(mockData);
    } catch (error) {
      throw new Error(`Failed to load mock Lambda event '${filename}': ${error.message}`);
    }
  }

  /**
   * Create a mock API Gateway event with custom properties
   * @param {Object} overrides - Properties to override in the base event
   * @returns {Object} Mock API Gateway event
   */
  static createMockApiGatewayEvent(overrides = {}) {
    const baseEvent = {
      resource: '/api/track',
      httpMethod: 'POST',
      path: '/api/track',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Test Browser)',
        'Accept': 'application/json'
      },
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        httpMethod: 'POST',
        path: '/api/track',
        accountId: '123456789012',
        apiId: 'test-api-id',
        resourcePath: '/api/track'
      },
      body: JSON.stringify({ event: 'test_event' }),
      isBase64Encoded: false
    };

    return { ...baseEvent, ...overrides };
  }

  /**
   * Create a mock Lambda context object
   * @param {Object} overrides - Properties to override in the base context
   * @returns {Object} Mock Lambda context
   */
  static createMockLambdaContext(overrides = {}) {
    const baseContext = {
      functionName: 'test-function',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2025/01/04/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };

    return { ...baseContext, ...overrides };
  }

  /**
   * Load and parse a mock event with error handling
   * @param {string} filename - Name of the mock file
   * @param {string} type - Type of mock ('frontend-request' or 'lambda-event')
   * @returns {Object} Parsed mock event
   */
  static loadMockEvent(filename, type = 'lambda-event') {
    if (type === 'frontend-request') {
      return this.loadFrontendRequest(filename);
    } else if (type === 'lambda-event') {
      return this.loadLambdaEvent(filename);
    } else {
      throw new Error(`Unknown mock event type: ${type}`);
    }
  }

  /**
   * Validate that a mock event file has the expected structure
   * @param {string} filename - Name of the mock file to validate
   * @param {string} type - Type of mock ('frontend-request' or 'lambda-event')
   * @returns {boolean} True if valid, throws error if invalid
   */
  static validateMockEvent(filename, type = 'lambda-event') {
    let mockData;
    
    if (type === 'frontend-request') {
      mockData = this.loadFrontendRequest(filename);
    } else if (type === 'lambda-event') {
      mockData = this.loadLambdaEvent(filename);
    } else {
      throw new Error(`Unknown mock event type: ${type}`);
    }

    // Basic validation for Lambda events
    if (type === 'lambda-event') {
      if (!mockData.httpMethod) {
        throw new Error(`Mock Lambda event '${filename}' missing httpMethod`);
      }
      if (!mockData.requestContext) {
        throw new Error(`Mock Lambda event '${filename}' missing requestContext`);
      }
    }

    // Basic validation for frontend requests
    if (type === 'frontend-request') {
      if (!mockData.method) {
        throw new Error(`Mock frontend request '${filename}' missing method`);
      }
      if (!mockData.url) {
        throw new Error(`Mock frontend request '${filename}' missing url`);
      }
    }

    return true;
  }

  /**
   * Create a mock event with specific HTTP method and body
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Request path
   * @param {Object} body - Request body
   * @param {Object} headers - Additional headers
   * @returns {Object} Mock API Gateway event
   */
  static createMockHttpEvent(method, path, body = null, headers = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Test-Agent/1.0'
    };

    const baseEvent = this.createMockApiGatewayEvent();
    
    return {
      ...baseEvent,
      httpMethod: method.toUpperCase(),
      path: path,
      resource: path,
      headers: { ...defaultHeaders, ...headers },
      requestContext: {
        ...baseEvent.requestContext,
        httpMethod: method.toUpperCase(),
        path: path,
        resourcePath: path
      },
      body: body ? JSON.stringify(body) : null
    };
  }
}

module.exports = { MockEventLoader };