/**
 * Backend Mock Event Schema Validation Utilities
 * 
 * This module provides validation functions for backend mock events
 * to ensure they conform to expected Lambda event and frontend request schemas.
 */

const fs = require('fs');
const path = require('path');

/**
 * Schema definitions for different types of backend mock events
 */
const SCHEMAS = {
  lambdaEvent: {
    required: ['resource', 'path', 'httpMethod', 'headers', 'requestContext', 'body', 'isBase64Encoded', 'metadata'],
    properties: {
      resource: { type: 'string', minLength: 1 },
      path: { type: 'string', minLength: 1 },
      httpMethod: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] },
      headers: { 
        type: 'object',
        required: ['Content-Type'],
        properties: {
          'Content-Type': { type: 'string' },
          'User-Agent': { type: 'string' },
          'Origin': { type: 'string' },
          'Host': { type: 'string' }
        }
      },
      multiValueHeaders: { type: 'object' },
      queryStringParameters: { type: ['object', 'null'] },
      multiValueQueryStringParameters: { type: ['object', 'null'] },
      pathParameters: { type: ['object', 'null'] },
      stageVariables: { type: ['object', 'null'] },
      requestContext: {
        type: 'object',
        required: ['resourceId', 'resourcePath', 'httpMethod', 'requestId', 'protocol', 'stage', 'requestTimeEpoch', 'requestTime', 'identity'],
        properties: {
          resourceId: { type: 'string' },
          resourcePath: { type: 'string' },
          httpMethod: { type: 'string' },
          requestId: { type: 'string' },
          protocol: { type: 'string' },
          stage: { type: 'string' },
          requestTimeEpoch: { type: 'number' },
          requestTime: { type: 'string' },
          identity: {
            type: 'object',
            required: ['sourceIp', 'userAgent'],
            properties: {
              sourceIp: { type: 'string' },
              userAgent: { type: 'string' }
            }
          }
        }
      },
      body: { type: ['string', 'null'] },
      isBase64Encoded: { type: 'boolean' },
      metadata: {
        type: 'object',
        required: ['description', 'lastUpdated', 'eventType', 'schemaVersion'],
        properties: {
          description: { type: 'string', minLength: 1 },
          lastUpdated: { type: 'string', format: 'iso-date' },
          eventType: { type: 'string', enum: ['lambda', 'api-gateway', 'cloudwatch', 'sns', 'sqs'] },
          triggerType: { type: 'string' },
          schemaVersion: { type: 'string' }
        }
      }
    }
  },
  
  frontendRequest: {
    required: ['method', 'url', 'data', 'metadata'],
    properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      url: { type: 'string', minLength: 1 },
      data: { type: ['object', 'null'] },
      headers: { 
        type: 'object',
        properties: {
          'Content-Type': { type: 'string' },
          'Authorization': { type: 'string' },
          'User-Agent': { type: 'string' }
        }
      },
      params: { type: 'object' },
      metadata: {
        type: 'object',
        required: ['description', 'lastUpdated', 'schemaVersion'],
        properties: {
          description: { type: 'string', minLength: 1 },
          lastUpdated: { type: 'string', format: 'iso-date' },
          schemaVersion: { type: 'string' },
          endpoint: { type: 'string' },
          requestType: { type: 'string', enum: ['tracking', 'sequence', 'show-details', 'vote', 'token'] },
          expectedResponse: { type: 'string' }
        }
      }
    }
  }
};

/**
 * Validates a value against a schema property definition
 * @param {any} value - Value to validate
 * @param {Object} schema - Schema definition
 * @param {string} path - Property path for error reporting
 * @returns {Array} Array of validation errors
 */
const validateProperty = (value, schema, path = '') => {
  const errors = [];
  
  // Type validation
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const valueType = Array.isArray(value) ? 'array' : typeof value;
    
    if (!types.includes(valueType)) {
      errors.push(`${path}: Expected type ${types.join(' or ')}, got ${valueType}`);
      return errors; // Skip further validation if type is wrong
    }
  }
  
  // String validations
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(`${path}: String too short (minimum ${schema.minLength} characters)`);
    }
    
    if (schema.format === 'iso-date') {
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      if (!isoDateRegex.test(value)) {
        errors.push(`${path}: Invalid ISO date format (expected YYYY-MM-DDTHH:mm:ss.sssZ)`);
      }
    }
    
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path}: Value must be one of: ${schema.enum.join(', ')}`);
    }
  }
  
  // Number validations
  if (typeof value === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      errors.push(`${path}: Number too small (minimum ${schema.min})`);
    }
    
    if (schema.max !== undefined && value > schema.max) {
      errors.push(`${path}: Number too large (maximum ${schema.max})`);
    }
  }
  
  // Object validations
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (schema.required) {
      schema.required.forEach(requiredProp => {
        if (!(requiredProp in value)) {
          errors.push(`${path}: Missing required property '${requiredProp}'`);
        }
      });
    }
    
    if (schema.properties) {
      Object.keys(schema.properties).forEach(prop => {
        if (prop in value) {
          const propErrors = validateProperty(
            value[prop], 
            schema.properties[prop], 
            path ? `${path}.${prop}` : prop
          );
          errors.push(...propErrors);
        }
      });
    }
  }
  
  return errors;
};

/**
 * Validates a mock event against its schema
 * @param {Object} mockEvent - Mock event to validate
 * @param {string} eventType - Type of event ('lambdaEvent' or 'frontendRequest')
 * @returns {Object} Validation result
 */
const validateMockEvent = (mockEvent, eventType) => {
  const schema = SCHEMAS[eventType];
  
  if (!schema) {
    return {
      valid: false,
      errors: [`Unknown event type: ${eventType}`],
      remediation: {
        steps: [`Use one of the supported event types: ${Object.keys(SCHEMAS).join(', ')}`]
      }
    };
  }
  
  const errors = validateProperty(mockEvent, schema);
  const isValid = errors.length === 0;
  
  return {
    valid: isValid,
    eventType,
    errors,
    remediation: !isValid ? {
      steps: [
        'Fix the validation errors listed above',
        'Ensure all required fields are present',
        'Check that field types match the expected schema',
        'Verify date formats are ISO 8601 compliant',
        'For Lambda events, ensure requestContext matches AWS API Gateway format',
        'Run validation again to confirm fixes'
      ],
      schema: schema,
      examples: {
        lambdaEvent: {
          resource: '/proxy/example',
          path: '/proxy/example',
          httpMethod: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0...',
            'Origin': 'https://example.com',
            'Host': 'api.example.com'
          },
          multiValueHeaders: {},
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          pathParameters: null,
          stageVariables: null,
          requestContext: {
            resourceId: 'test-resource',
            resourcePath: '/proxy/example',
            httpMethod: 'POST',
            requestId: 'test-request-id',
            protocol: 'HTTP/1.1',
            stage: 'test',
            requestTimeEpoch: 1767576076260,
            requestTime: '04/Jan/2025:12:00:00 +0000',
            identity: {
              sourceIp: '203.0.113.12',
              userAgent: 'Mozilla/5.0...'
            }
          },
          body: '{"key": "value"}',
          isBase64Encoded: false,
          metadata: {
            description: 'Example Lambda event',
            lastUpdated: '2025-01-04T12:00:00.000Z',
            eventType: 'lambda',
            triggerType: 'API_GATEWAY',
            schemaVersion: '1.0'
          }
        },
        frontendRequest: {
          method: 'POST',
          url: '/api/example',
          data: { key: 'value' },
          headers: { 'Content-Type': 'application/json' },
          metadata: {
            description: 'Example frontend request',
            lastUpdated: '2025-01-04T12:00:00.000Z',
            schemaVersion: '1.0',
            endpoint: '/api/example',
            requestType: 'tracking',
            expectedResponse: 'success'
          }
        }
      }
    } : null
  };
};

/**
 * Validates all mock events in a directory
 * @param {string} mockEventsDir - Directory containing mock events
 * @param {string} eventType - Type of events in the directory
 * @returns {Object} Validation results for all files
 */
const validateMockEventDirectory = (mockEventsDir, eventType) => {
  const results = {
    valid: true,
    totalFiles: 0,
    validFiles: 0,
    invalidFiles: 0,
    files: {},
    errors: [],
    summary: {}
  };
  
  try {
    if (!fs.existsSync(mockEventsDir)) {
      results.valid = false;
      results.errors.push(`Mock events directory does not exist: ${mockEventsDir}`);
      return results;
    }
    
    const files = fs.readdirSync(mockEventsDir)
      .filter(file => file.endsWith('.json'));
    
    results.totalFiles = files.length;
    
    files.forEach(file => {
      const filePath = path.join(mockEventsDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const mockEvent = JSON.parse(content);
        
        const validation = validateMockEvent(mockEvent, eventType);
        results.files[file] = validation;
        
        if (validation.valid) {
          results.validFiles++;
        } else {
          results.invalidFiles++;
          results.valid = false;
        }
        
      } catch (error) {
        results.files[file] = {
          valid: false,
          errors: [`Failed to parse JSON: ${error.message}`],
          remediation: {
            steps: [
              'Check that the file contains valid JSON',
              'Verify all quotes are properly escaped',
              'Use a JSON validator to identify syntax errors'
            ]
          }
        };
        results.invalidFiles++;
        results.valid = false;
      }
    });
    
    // Generate summary
    results.summary = {
      validationRate: results.totalFiles > 0 ? (results.validFiles / results.totalFiles * 100).toFixed(1) : 0,
      commonErrors: extractCommonErrors(results.files),
      recommendations: generateRecommendations(results.files, eventType)
    };
    
  } catch (error) {
    results.valid = false;
    results.errors.push(`Directory validation error: ${error.message}`);
  }
  
  return results;
};

/**
 * Extracts common validation errors across files
 * @param {Object} fileResults - Validation results for all files
 * @returns {Array} Common error patterns
 */
const extractCommonErrors = (fileResults) => {
  const errorCounts = {};
  
  Object.values(fileResults).forEach(result => {
    if (!result.valid && result.errors) {
      result.errors.forEach(error => {
        // Extract error pattern (remove specific values)
        const pattern = error.replace(/: .+$/, ': [value]');
        errorCounts[pattern] = (errorCounts[pattern] || 0) + 1;
      });
    }
  });
  
  return Object.entries(errorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([pattern, count]) => ({ pattern, count }));
};

/**
 * Generates recommendations based on validation results
 * @param {Object} fileResults - Validation results for all files
 * @param {string} eventType - Type of events being validated
 * @returns {Array} Recommendations for improvement
 */
const generateRecommendations = (fileResults, eventType) => {
  const recommendations = [];
  const invalidCount = Object.values(fileResults).filter(r => !r.valid).length;
  
  if (invalidCount > 0) {
    recommendations.push(`Fix ${invalidCount} invalid mock event files`);
    recommendations.push('Ensure all required metadata fields are present');
    recommendations.push('Use ISO 8601 date format for lastUpdated fields');
    recommendations.push('Validate JSON syntax before committing changes');
  }
  
  if (eventType === 'lambdaEvent') {
    recommendations.push('Ensure requestContext matches AWS API Gateway event structure');
    recommendations.push('Include all required Lambda event fields');
    recommendations.push('Use valid HTTP methods and status codes');
  }
  
  if (eventType === 'frontendRequest') {
    recommendations.push('Use standard HTTP methods (GET, POST, PUT, DELETE, PATCH)');
    recommendations.push('Include complete URL paths in frontend requests');
    recommendations.push('Specify expected response types for better testing');
  }
  
  return recommendations;
};

/**
 * Validates all backend mock events
 * @returns {Object} Complete validation results for backend mock events
 */
const validateAllBackendMockEvents = () => {
  const mockEventsBase = path.resolve('tests/mock-events');
  
  const lambdaEventsDir = path.join(mockEventsBase, 'lambda-events');
  const frontendRequestsDir = path.join(mockEventsBase, 'frontend-requests');
  
  const lambdaEventsValidation = validateMockEventDirectory(lambdaEventsDir, 'lambdaEvent');
  const frontendRequestsValidation = validateMockEventDirectory(frontendRequestsDir, 'frontendRequest');
  
  const overallValid = lambdaEventsValidation.valid && frontendRequestsValidation.valid;
  
  return {
    valid: overallValid,
    components: {
      lambdaEvents: lambdaEventsValidation,
      frontendRequests: frontendRequestsValidation
    },
    summary: {
      totalFiles: lambdaEventsValidation.totalFiles + frontendRequestsValidation.totalFiles,
      validFiles: lambdaEventsValidation.validFiles + frontendRequestsValidation.validFiles,
      invalidFiles: lambdaEventsValidation.invalidFiles + frontendRequestsValidation.invalidFiles
    },
    remediation: !overallValid ? {
      priority: 'medium',
      description: 'Backend mock events have schema validation issues',
      steps: [
        'Fix Lambda event mock files first',
        'Then fix frontend request mock files',
        'Ensure all metadata fields are properly formatted',
        'Verify Lambda events match AWS API Gateway structure',
        'Run validation again to confirm fixes'
      ]
    } : null
  };
};

module.exports = {
  validateMockEvent,
  validateMockEventDirectory,
  validateAllBackendMockEvents,
  SCHEMAS
};