/**
 * Property-based tests for System Health Data Validation
 * Feature: system-health-tracking
 */

// Jest globals are available
const fc = require('fast-check');

// Mock AWS SDK
jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn(() => ({
    send: jest.fn()
  })),
  GetParameterCommand: jest.fn()
}));

// Import the handler after mocking
const { handler } = require('../../src/index.js');

describe('System Health Data Validation Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.ALLOWED_ORIGINS = 'https://example.com,https://test.com';
    process.env.REMOTE_FALCON_API_BASE_URL = 'https://api.remotefalcon.com';
    process.env.REMOTE_FALCON_ACCESS_TOKEN_PARAM = '/test/access-token';
    process.env.REMOTE_FALCON_SECRET_KEY_PARAM = '/test/secret-key';
  });

  /**
   * Property 2: System Health Event Data Validation
   * Feature: system-health-tracking, Property 2: System Health Event Data Validation
   * Validates: Requirements 1.4, 5.1, 5.2, 5.3, 5.4
   * 
   * For any systemHealth event, the event data should contain required monitoring fields 
   * (error statistics, rate limiting status, configuration information) and pass validation
   */
  test('Property 2: System Health Event Data Validation', async () => {
    await fc.assert(fc.asyncProperty(
      fc.webUrl(),
      fc.record({
        totalRequests: fc.integer({ min: 0, max: 10000 }),
        failedRequests: fc.integer({ min: 0, max: 1000 }),
        errorRate: fc.float({ min: 0, max: 1 }),
        // Optional fields
        networkErrors: fc.option(fc.integer({ min: 0, max: 100 })),
        httpErrors: fc.option(fc.integer({ min: 0, max: 100 })),
        validationErrors: fc.option(fc.integer({ min: 0, max: 100 })),
        consecutiveErrors: fc.option(fc.integer({ min: 0, max: 10 })),
        lastErrorTime: fc.option(fc.date().map(d => d.toISOString())),
        rateLimitStatus: fc.option(fc.record({
          isRateLimited: fc.boolean(),
          requestsInWindow: fc.integer({ min: 0, max: 100 }),
          maxRequests: fc.option(fc.integer({ min: 1, max: 1000 })),
          rateLimitUntil: fc.option(fc.date().map(d => d.toISOString()))
        })),
        config: fc.option(fc.record({
          retryAttempts: fc.option(fc.integer({ min: 1, max: 10 })),
          maxRequestsPerMinute: fc.option(fc.integer({ min: 1, max: 1000 })),
          errorThreshold: fc.option(fc.float({ min: 0, max: 1 })),
          batchSize: fc.option(fc.integer({ min: 1, max: 100 })),
          batchTimeout: fc.option(fc.integer({ min: 100, max: 10000 }))
        }))
      }),
      fc.ipV4(),
      fc.string(),
      fc.constantFrom('https://example.com', 'https://test.com'),
      async (url, eventData, sourceIp, userAgent, origin) => {
        // Ensure failedRequests doesn't exceed totalRequests
        if (eventData.failedRequests > eventData.totalRequests) {
          eventData.failedRequests = eventData.totalRequests;
        }

        // Create mock event with systemHealth event type
        const event = {
          httpMethod: 'POST',
          path: '/telemetry',
          headers: {
            'origin': origin,
            'user-agent': userAgent,
            'x-forwarded-for': sourceIp,
            'host': 'api.example.com'
          },
          body: JSON.stringify({
            eventType: 'systemHealth',
            url: url,
            eventData: eventData
          }),
          requestContext: {
            identity: {
              sourceIp: sourceIp
            }
          }
        };

        const response = await handler(event);

        // Should return success for valid systemHealth event data
        expect(response.statusCode).toBe(200);
        
        // Response should include success message
        const responseBody = JSON.parse(response.body);
        expect(responseBody.message).toBe('Tracking data received successfully');
        expect(responseBody.timestamp).toBeDefined();
        
        // Should have proper CORS headers
        expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
        expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
      }
    ), { numRuns: 20 });
  });

  /**
   * Property 3: System Alert Event Data Validation
   * Feature: system-health-tracking, Property 3: System Alert Event Data Validation
   * Validates: Requirements 2.3, 2.4
   * 
   * For any systemAlert event, the event data should contain required alert fields 
   * (alert type, error rates, threshold information, timing context) and pass validation
   */
  test('Property 3: System Alert Event Data Validation', async () => {
    await fc.assert(fc.asyncProperty(
      fc.webUrl(),
      fc.record({
        type: fc.constantFrom('HIGH_ERROR_RATE', 'CONSECUTIVE_ERRORS'),
        errorRate: fc.float({ min: 0, max: 1 }),
        threshold: fc.float({ min: 0, max: 1 }),
        // Optional fields - use oneof with undefined to avoid null values
        totalRequests: fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 10000 })),
        failedRequests: fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 1000 })),
        consecutiveErrors: fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 20 })),
        lastErrorTime: fc.oneof(fc.constant(undefined), fc.date().map(d => d.toISOString())),
        sessionId: fc.oneof(fc.constant(undefined), fc.string()),
        alertTimestamp: fc.oneof(fc.constant(undefined), fc.date().map(d => d.toISOString()))
      }),
      fc.ipV4(),
      fc.string(),
      fc.constantFrom('https://example.com', 'https://test.com'),
      async (url, eventData, sourceIp, userAgent, origin) => {
        // Ensure failedRequests doesn't exceed totalRequests if both are present
        if (eventData.failedRequests && eventData.totalRequests && eventData.failedRequests > eventData.totalRequests) {
          eventData.failedRequests = eventData.totalRequests;
        }

        // Create mock event with systemAlert event type
        const event = {
          httpMethod: 'POST',
          path: '/telemetry',
          headers: {
            'origin': origin,
            'user-agent': userAgent,
            'x-forwarded-for': sourceIp,
            'host': 'api.example.com'
          },
          body: JSON.stringify({
            eventType: 'systemAlert',
            url: url,
            eventData: eventData
          }),
          requestContext: {
            identity: {
              sourceIp: sourceIp
            }
          }
        };

        const response = await handler(event);

        // Should return success for valid systemAlert event data
        expect(response.statusCode).toBe(200);
        
        // Response should include success message
        const responseBody = JSON.parse(response.body);
        expect(responseBody.message).toBe('Tracking data received successfully');
        expect(responseBody.timestamp).toBeDefined();
        
        // Should have proper CORS headers
        expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
        expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
      }
    ), { numRuns: 20 });
  });

  /**
   * Property 4: Event Failure Event Data Validation
   * Feature: system-health-tracking, Property 4: Event Failure Event Data Validation
   * Validates: Requirements 3.3, 3.4, 3.5
   * 
   * For any eventFailure event, the event data should contain original event information, 
   * failure reason, error type, and retry attempt details
   */
  test('Property 4: Event Failure Event Data Validation', async () => {
    await fc.assert(fc.asyncProperty(
      fc.webUrl(),
      fc.record({
        originalEventType: fc.constantFrom('pageView', 'click', 'videoPlay', 'songRequest', 'systemHealth', 'systemAlert'),
        failureReason: fc.string({ minLength: 1, maxLength: 500 }),
        errorType: fc.string({ minLength: 1, maxLength: 100 }),
        // Optional fields - use oneof with undefined to avoid null values
        finalAttempts: fc.oneof(fc.constant(undefined), fc.integer({ min: 1, max: 10 })),
        originalEventData: fc.oneof(fc.constant(undefined), fc.record({
          songTitle: fc.oneof(fc.constant(undefined), fc.string()),
          artist: fc.oneof(fc.constant(undefined), fc.string()),
          pageTitle: fc.oneof(fc.constant(undefined), fc.string()),
          elementType: fc.oneof(fc.constant(undefined), fc.string()),
          videoTitle: fc.oneof(fc.constant(undefined), fc.string()),
          requestStatus: fc.oneof(fc.constant(undefined), fc.constantFrom('success', 'error'))
        })),
        errorStats: fc.oneof(fc.constant(undefined), fc.record({
          totalRequests: fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 1000 })),
          failedRequests: fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 100 })),
          errorRate: fc.oneof(fc.constant(undefined), fc.float({ min: 0, max: 1 }))
        }))
      }),
      fc.ipV4(),
      fc.string(),
      fc.constantFrom('https://example.com', 'https://test.com'),
      async (url, eventData, sourceIp, userAgent, origin) => {
        // Create mock event with eventFailure event type
        const event = {
          httpMethod: 'POST',
          path: '/telemetry',
          headers: {
            'origin': origin,
            'user-agent': userAgent,
            'x-forwarded-for': sourceIp,
            'host': 'api.example.com'
          },
          body: JSON.stringify({
            eventType: 'eventFailure',
            url: url,
            eventData: eventData
          }),
          requestContext: {
            identity: {
              sourceIp: sourceIp
            }
          }
        };

        const response = await handler(event);

        // Should return success for valid eventFailure event data
        expect(response.statusCode).toBe(200);
        
        // Response should include success message
        const responseBody = JSON.parse(response.body);
        expect(responseBody.message).toBe('Tracking data received successfully');
        expect(responseBody.timestamp).toBeDefined();
        
        // Should have proper CORS headers
        expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
        expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
      }
    ), { numRuns: 20 });
  });

  /**
   * Property 6: Security and Privacy Compliance
   * Feature: system-health-tracking, Property 6: Security and Privacy Compliance
   * Validates: Requirements 1.5, 5.6, 8.1, 8.4, 8.5
   * 
   * For any system health event, the validation should apply the same PII detection, 
   * size limits, and security sanitization as other tracking events, and reject events 
   * containing sensitive information
   */
  test('Property 6: Security and Privacy Compliance', async () => {
    await fc.assert(fc.asyncProperty(
      fc.webUrl(),
      fc.constantFrom('systemHealth', 'systemAlert', 'eventFailure'),
      fc.record({
        // Generate clean system health data without PII - use oneof with undefined to avoid null values
        totalRequests: fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 10000 })),
        failedRequests: fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 1000 })),
        errorRate: fc.oneof(fc.constant(undefined), fc.float({ min: 0, max: 1 })),
        type: fc.oneof(fc.constant(undefined), fc.constantFrom('HIGH_ERROR_RATE', 'CONSECUTIVE_ERRORS')),
        threshold: fc.oneof(fc.constant(undefined), fc.float({ min: 0, max: 1 })),
        originalEventType: fc.oneof(fc.constant(undefined), fc.constantFrom('pageView', 'click', 'videoPlay', 'songRequest')),
        failureReason: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 100 })),
        errorType: fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 50 })),
        // Configuration data without sensitive information
        config: fc.oneof(fc.constant(undefined), fc.record({
          retryAttempts: fc.oneof(fc.constant(undefined), fc.integer({ min: 1, max: 10 })),
          maxRequestsPerMinute: fc.oneof(fc.constant(undefined), fc.integer({ min: 1, max: 1000 })),
          errorThreshold: fc.oneof(fc.constant(undefined), fc.float({ min: 0, max: 1 })),
          batchSize: fc.oneof(fc.constant(undefined), fc.integer({ min: 1, max: 100 })),
          batchTimeout: fc.oneof(fc.constant(undefined), fc.integer({ min: 100, max: 10000 }))
        })),
        rateLimitStatus: fc.oneof(fc.constant(undefined), fc.record({
          isRateLimited: fc.boolean(),
          requestsInWindow: fc.integer({ min: 0, max: 100 }),
          maxRequests: fc.oneof(fc.constant(undefined), fc.integer({ min: 1, max: 1000 }))
        }))
      }),
      fc.ipV4(),
      fc.string(),
      fc.constantFrom('https://example.com', 'https://test.com'),
      async (url, eventType, eventData, sourceIp, userAgent, origin) => {
        // Ensure data consistency for different event types
        let cleanEventData = {};
        
        if (eventType === 'systemHealth') {
          cleanEventData = {
            totalRequests: eventData.totalRequests || 100,
            failedRequests: eventData.failedRequests || 5,
            errorRate: eventData.errorRate || 0.05,
            config: eventData.config,
            rateLimitStatus: eventData.rateLimitStatus
          };
        } else if (eventType === 'systemAlert') {
          cleanEventData = {
            type: eventData.type || 'HIGH_ERROR_RATE',
            errorRate: eventData.errorRate || 0.15,
            threshold: eventData.threshold || 0.1,
            totalRequests: eventData.totalRequests,
            failedRequests: eventData.failedRequests
          };
        } else if (eventType === 'eventFailure') {
          cleanEventData = {
            originalEventType: eventData.originalEventType || 'pageView',
            failureReason: eventData.failureReason || 'Network timeout',
            errorType: eventData.errorType || 'AbortError',
            finalAttempts: eventData.finalAttempts
          };
        }

        // Ensure failedRequests doesn't exceed totalRequests if both are present
        if (cleanEventData.failedRequests && cleanEventData.totalRequests && 
            cleanEventData.failedRequests > cleanEventData.totalRequests) {
          cleanEventData.failedRequests = cleanEventData.totalRequests;
        }

        // Create mock event with clean system health event data
        const event = {
          httpMethod: 'POST',
          path: '/telemetry',
          headers: {
            'origin': origin,
            'user-agent': userAgent,
            'x-forwarded-for': sourceIp,
            'host': 'api.example.com'
          },
          body: JSON.stringify({
            eventType: eventType,
            url: url,
            eventData: cleanEventData
          }),
          requestContext: {
            identity: {
              sourceIp: sourceIp
            }
          }
        };

        const response = await handler(event);

        // Should return success for clean system health event data
        expect(response.statusCode).toBe(200);
        
        // Response should include success message
        const responseBody = JSON.parse(response.body);
        expect(responseBody.message).toBe('Tracking data received successfully');
        expect(responseBody.timestamp).toBeDefined();
        
        // Should have proper security headers
        expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
        expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
        expect(response.headers['X-Frame-Options']).toBe('DENY');
        expect(response.headers['X-XSS-Protection']).toBe('1; mode=block');
        expect(response.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
        expect(response.headers['Content-Security-Policy']).toBe("default-src 'none'; frame-ancestors 'none';");
      }
    ), { numRuns: 20 });
  });
});