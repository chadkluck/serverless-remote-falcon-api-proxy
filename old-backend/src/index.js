/**
 * Remote Falcon JWT Proxy Lambda Function
 * CommonJS version for AWS Lambda deployment
 */

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { SignJWT } = require('jose');

const ssmClient = new SSMClient({ region: process.env.AWS_REGION });

// Cache for credentials to avoid repeated SSM calls
let credentialsCache = {
  accessToken: null,
  secretKey: null,
  expiresAt: null
};

// Cache for JWT tokens to avoid repeated generation
let jwtCache = {
  token: null,
  expiresAt: null
};

/**
 * Get CORS headers based on request origin
 */
function getCorsHeaders(origin) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'];
  
  // console.log('ALLOWED_ORIGINS env var:', process.env.ALLOWED_ORIGINS);
  // console.log('Parsed allowedOrigins:', allowedOrigins);
  // console.log('Request origin:', origin);


  // Check if the origin is allowed
  const isAllowed = allowedOrigins.includes('*') || 
    allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {

        let pattern = allowed
          .replace(/\./g, '\\.')  // Escape dots: *.mysite.com → *\.mysite\.com  
          .replace(/\*/g, '.*');  // Replace *: *\.mysite\.com → .*\.mysite\.com

        // console.log(`Testing wildcard - Pattern: ${pattern}, Origin: ${origin}, Match: ${new RegExp(`^${pattern}$`).test(origin)}`);

        return new RegExp(`^${pattern}$`).test(origin);
      }
      // console.log(`Testing exact match - Allowed: ${allowed}, Origin: ${origin}, Match: ${allowed === origin}`);
      return allowed === origin;
    });

  // console.log('Final isAllowed result:', isAllowed);
  
  // For requests without Origin header (like direct navigation), use a default allowed origin
  // For CORS requests with Origin header, use the origin if allowed, otherwise reject
  let allowedOrigin;
  let allowCredentials = 'false';
  
  if (!origin) {
    // No origin header - this is likely a direct navigation, not a CORS request
    allowedOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins[0];
  } else {
    // Origin header present - this is a CORS request
    if (isAllowed) {
      allowedOrigin = origin;
      // Only allow credentials for specific origins, not wildcards
      if (!allowedOrigins.includes('*') && !origin.includes('*')) {
        allowCredentials = 'true';
      }
    } else {
      // Origin not allowed - still need to return CORS headers but with restricted origin
      allowedOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins[0];
    }
  }
  
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Credentials': allowCredentials,
    'Vary': 'Origin',
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
  };

  return headers;
}

/**
 * Get credentials from AWS Systems Manager Parameter Store
 */
async function getCredentials() {
  const now = Date.now();
  
  // Return cached credentials if still valid (cache for 5 minutes)
  if (credentialsCache.accessToken && credentialsCache.expiresAt > now) {
    return {
      accessToken: credentialsCache.accessToken,
      secretKey: credentialsCache.secretKey
    };
  }

  try {
    // Get access token from Parameter Store
    const accessTokenCommand = new GetParameterCommand({
      Name: process.env.REMOTE_FALCON_ACCESS_TOKEN_PARAM,
      WithDecryption: true
    });
    const accessTokenResponse = await ssmClient.send(accessTokenCommand);

    // Get secret key from Parameter Store
    const secretKeyCommand = new GetParameterCommand({
      Name: process.env.REMOTE_FALCON_SECRET_KEY_PARAM,
      WithDecryption: true
    });
    const secretKeyResponse = await ssmClient.send(secretKeyCommand);

    const credentials = {
      accessToken: accessTokenResponse.Parameter.Value,
      secretKey: secretKeyResponse.Parameter.Value
    };

    // Cache credentials for 5 minutes
    credentialsCache = {
      ...credentials,
      expiresAt: now + (5 * 60 * 1000)
    };

    return credentials;
  } catch (error) {
    console.error('Failed to retrieve credentials from Parameter Store:', error);
    throw new Error('Failed to retrieve credentials');
  }
}

/**
 * Generate JWT token using Remote Falcon credentials
 */
async function generateJWT(accessToken, secretKey) {
  try {
    const payload = {
      accessToken: accessToken
    };

    const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60); // 1 hour
    const secret = new TextEncoder().encode(secretKey);
    
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(secret);

    return jwt;
  } catch (error) {
    console.error('Failed to generate JWT token:', error);
    throw new Error('Failed to generate JWT token');
  }
}

/**
 * Get cached JWT token or generate a new one
 */
async function getJWTToken() {
  const now = Date.now();
  
  // Return cached token if still valid (cache for 55 minutes)
  if (jwtCache.token && jwtCache.expiresAt > now) {
    return jwtCache.token;
  }

  // Get credentials and generate new token
  const { accessToken, secretKey } = await getCredentials();
  const jwt = await generateJWT(accessToken, secretKey);
  
  // Cache the token for 55 minutes
  jwtCache = {
    token: jwt,
    expiresAt: now + (55 * 60 * 1000)
  };

  return jwt;
}


/**
 * ClientInfo class for extracting and managing client information from request events
 */
class ClientInfo {
  constructor(event) {
    this.ipAddress = this.extractIpAddress(event);
    this.userAgent = this.extractUserAgent(event);
    this.host = this.extractHost(event);
  }

  /**
   * Extract IP address from various possible headers with proper fallback handling
   */
  extractIpAddress(event) {
    // Handle missing event or headers
    if (!event || !event.headers) {
      return event?.requestContext?.identity?.sourceIp || 'unknown';
    }

    // Try x-forwarded-for first (most common for load balancers)
    const xForwardedFor = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
    if (xForwardedFor) {
      // Split by comma and find the first non-empty IP
      const ips = xForwardedFor.split(',');
      for (const ip of ips) {
        const trimmedIp = ip.trim();
        if (trimmedIp && trimmedIp !== '') {
          return trimmedIp;
        }
      }
    }

    // Try x-real-ip header
    const xRealIp = event.headers['x-real-ip'] || event.headers['X-Real-IP'];
    if (xRealIp && xRealIp.trim() !== '') {
      return xRealIp.trim();
    }

    // Try x-forwarded header
    const xForwarded = event.headers['x-forwarded'] || event.headers['X-Forwarded'];
    if (xForwarded && xForwarded.trim() !== '') {
      return xForwarded.trim();
    }

    // Fall back to request context
    if (event.requestContext?.identity?.sourceIp) {
      return event.requestContext.identity.sourceIp;
    }

    return 'unknown';
  }

  /**
   * Extract user agent with proper fallback handling for missing headers
   */
  extractUserAgent(event) {
    // Handle missing event or headers
    if (!event || !event.headers) {
      return 'unknown';
    }

    // Try various case variations of user-agent header
    const userAgent = event.headers['user-agent'] || 
                     event.headers['User-Agent'] || 
                     event.headers['USER-AGENT'];

    if (userAgent && userAgent.trim() !== '') {
      return userAgent.trim();
    }

    return 'unknown';
  }

  /**
   * Extract host with proper fallback handling for missing headers
   */
  extractHost(event) {
    // Handle missing event or headers
    if (!event || !event.headers) {
      return 'unknown';
    }

    // Try various case variations of host header
    const host = event.headers['host'] || 
                event.headers['Host'] || 
                event.headers['HOST'];

    if (host && host.trim() !== '') {
      return host.trim();
    }

    return 'unknown';
  }

  /**
   * Convert to plain object for logging
   */
  toObject() {
    return {
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      host: this.host
    };
  }
}


/**
 * RemoteFalconLogBuilder class for generating structured log entries for Remote Falcon API requests
 */
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

	// Apply log entry size limits and PII sanitization
	return this.sanitizeAndLimitLogEntry(logEntry);
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

	// Apply log entry size limits and PII sanitization
	return this.sanitizeAndLimitLogEntry(logEntry);
  }

  /**
   * Generate data summary for different API paths without exposing sensitive information
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
   * Sanitize error messages to prevent credential logging
   */
  sanitizeErrorMessage(message) {
	if (!message || typeof message !== 'string') {
	  return 'Unknown error';
	}

	// Remove potential JWT tokens (Bearer tokens)
	let sanitized = message.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, 'Bearer [REDACTED]');
	
	// Remove potential API keys
	sanitized = sanitized.replace(/[Aa]pi[Kk]ey[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'ApiKey [REDACTED]');
	
	// Remove potential access tokens
	sanitized = sanitized.replace(/[Aa]ccess[Tt]oken[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'AccessToken [REDACTED]');
	
	// Remove potential passwords
	sanitized = sanitized.replace(/[Pp]assword[:\s]*[^\s]+/gi, 'Password [REDACTED]');
	
	// Remove potential email addresses (PII)
	sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, 'email [REDACTED]');
	
	// Limit message length to prevent excessive logging
	if (sanitized.length > 500) {
	  sanitized = sanitized.substring(0, 497) + '...';
	}

	return sanitized;
  }

  /**
   * Sanitize client information to prevent PII logging
   */
  sanitizeClientInfo(info) {
	if (!info || typeof info !== 'string') {
	  return info;
	}

	// Remove potential email addresses from user agents or other client info
	let sanitized = info.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL_REDACTED]');
	
	// Remove potential phone numbers
	sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi, '[PHONE_REDACTED]');
	
	// Remove potential credit card numbers
	sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi, '[CARD_REDACTED]');
	
	// Remove potential SSN patterns
	sanitized = sanitized.replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/gi, '[SSN_REDACTED]');
	
	// Limit length to prevent excessive logging
	if (sanitized.length > 200) {
	  sanitized = sanitized.substring(0, 197) + '...';
	}

	return sanitized;
  }

  /**
   * Sanitize and limit log entry size to prevent excessive storage usage
   */
  sanitizeAndLimitLogEntry(logEntry) {
	// Deep clone to avoid modifying original
	const sanitized = JSON.parse(JSON.stringify(logEntry));
	
	// Apply PII detection and removal to all string fields recursively
	this.sanitizeObjectRecursively(sanitized);
	
	// Check total log entry size and truncate if necessary
	const logEntryString = JSON.stringify(sanitized);
	if (logEntryString.length > 10000) { // 10KB limit
	  // Truncate data summary or error message if too large
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
	  
	  // Add truncation indicator
	  sanitized._truncated = true;
	  sanitized._originalSize = logEntryString.length;
	}
	
	return sanitized;
  }

  /**
   * Recursively sanitize all string values in an object to remove PII
   */
  sanitizeObjectRecursively(obj) {
	if (!obj || typeof obj !== 'object') {
	  return;
	}

	for (const [key, value] of Object.entries(obj)) {
	  if (typeof value === 'string') {
		// Apply PII sanitization to string values
		obj[key] = this.sanitizePII(value);
	  } else if (typeof value === 'object' && value !== null) {
		// Recursively sanitize nested objects
		this.sanitizeObjectRecursively(value);
	  }
	}
  }

  /**
   * Sanitize PII from any string value
   */
  sanitizePII(text) {
	if (!text || typeof text !== 'string') {
	  return text;
	}

	let sanitized = text;
	
	// Remove email addresses
	sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL_REDACTED]');
	
	// Remove phone numbers
	sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi, '[PHONE_REDACTED]');
	
	// Remove credit card numbers
	sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi, '[CARD_REDACTED]');
	
	// Remove SSN patterns
	sanitized = sanitized.replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/gi, '[SSN_REDACTED]');
	
	// Remove JWT tokens
	sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, 'Bearer [REDACTED]');
	
	// Remove API keys
	sanitized = sanitized.replace(/[Aa]pi[Kk]ey[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'ApiKey [REDACTED]');
	
	// Remove access tokens
	sanitized = sanitized.replace(/[Aa]ccess[Tt]oken[:\s]*[A-Za-z0-9\-_]{20,}/gi, 'AccessToken [REDACTED]');
	
	// Remove passwords
	sanitized = sanitized.replace(/[Pp]assword[:\s]*[^\s]+/gi, 'Password [REDACTED]');
	
	return sanitized;
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

/**
 * Forward request to Remote Falcon API with JWT authentication and comprehensive logging
 */
async function forwardToRemoteFalcon(path, method, body, jwt, clientInfo, requestId) {
  const url = `${process.env.REMOTE_FALCON_API_BASE_URL}${path}`;
  
  // Create log builder for this request
  const logBuilder = new RemoteFalconLogBuilder(requestId, clientInfo, path, method);
  
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const responseData = await response.json().catch(() => ({}));

    // Check for HTTP error status codes (4xx, 5xx) - Requirement 3.1
    if (response.status >= 400) {
      // Log HTTP error status codes as errors
      const httpError = new Error(`HTTP ${response.status}: ${response.statusText || 'Error'}`);
      httpError.name = 'HTTPError';
      const errorLog = logBuilder.buildErrorLog(httpError, response.status);
      console.log(`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}`);
    } else {
      // Check for application-level errors in successful HTTP responses (2xx)
      const applicationError = RemoteFalconLogBuilder.detectApplicationError(responseData);
      
      if (applicationError) {
        // Log as error even though HTTP status is successful
        const errorLog = logBuilder.buildErrorLog(
          new Error(applicationError.message), 
          response.status
        );
        console.log(`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}`);
      } else {
        // Log successful request
        const successLog = logBuilder.buildSuccessLog(response, responseData);
        console.log(`REMOTE_FALCON_REQUEST: ${JSON.stringify(successLog)}`);
      }
    }

    return {
      statusCode: response.status,
      body: responseData,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } catch (error) {
    // Log error with comprehensive context
    const errorLog = logBuilder.buildErrorLog(error);
    console.log(`REMOTE_FALCON_ERROR: ${JSON.stringify(errorLog)}`);
    
    console.error('Failed to forward request to Remote Falcon:', error);
    throw new Error('Failed to communicate with Remote Falcon API');
  }
}

/**
 * Handle token generation endpoint
 */
async function handleTokenRequest() {
  try {
    const jwt = await getJWTToken();
    
    return {
      statusCode: 200,
      body: {
        token: jwt,
        expiresIn: 3600 // 1 hour in seconds
      }
    };
  } catch (error) {
    console.error('Token generation error:', error);
    throw error;
  }
}

/**
 * Extract client information from the request event (legacy function for backward compatibility)
 */
function extractClientInfo(event) {
  const clientInfo = new ClientInfo(event);
  return clientInfo.toObject();
}

/**
 * Validate system health event data structure
 */
function validateSystemHealthData(eventData) {
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {
    return { isValid: false, error: 'System health event data must be an object' };
  }

  // Required fields for systemHealth events
  const requiredFields = ['totalRequests', 'failedRequests', 'errorRate'];
  for (const field of requiredFields) {
    if (eventData[field] === undefined || eventData[field] === null) {
      return { isValid: false, error: `Missing required field in system health data: ${field}` };
    }
  }

  // Validate numeric fields
  if (typeof eventData.totalRequests !== 'number' || eventData.totalRequests < 0) {
    return { isValid: false, error: 'totalRequests must be a non-negative number' };
  }

  if (typeof eventData.failedRequests !== 'number' || eventData.failedRequests < 0) {
    return { isValid: false, error: 'failedRequests must be a non-negative number' };
  }

  if (typeof eventData.errorRate !== 'number' || eventData.errorRate < 0 || eventData.errorRate > 1) {
    return { isValid: false, error: 'errorRate must be a number between 0 and 1' };
  }

  // Validate that failedRequests doesn't exceed totalRequests
  if (eventData.failedRequests > eventData.totalRequests) {
    return { isValid: false, error: 'failedRequests cannot exceed totalRequests' };
  }

  // Validate optional rate limiting status if present
  if (eventData.rateLimitStatus && typeof eventData.rateLimitStatus === 'object') {
    const rateLimitStatus = eventData.rateLimitStatus;
    if (rateLimitStatus.isRateLimited !== undefined && typeof rateLimitStatus.isRateLimited !== 'boolean') {
      return { isValid: false, error: 'rateLimitStatus.isRateLimited must be a boolean' };
    }
    if (rateLimitStatus.requestsInWindow !== undefined && (typeof rateLimitStatus.requestsInWindow !== 'number' || rateLimitStatus.requestsInWindow < 0)) {
      return { isValid: false, error: 'rateLimitStatus.requestsInWindow must be a non-negative number' };
    }
  }

  return { isValid: true };
}

/**
 * Validate system alert event data structure
 */
function validateSystemAlertData(eventData) {
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {
    return { isValid: false, error: 'System alert event data must be an object' };
  }

  // Required fields for systemAlert events
  const requiredFields = ['type', 'errorRate', 'threshold'];
  for (const field of requiredFields) {
    if (eventData[field] === undefined || eventData[field] === null) {
      return { isValid: false, error: `Missing required field in system alert data: ${field}` };
    }
  }

  // Validate alert type
  const validAlertTypes = ['HIGH_ERROR_RATE', 'CONSECUTIVE_ERRORS'];
  if (!validAlertTypes.includes(eventData.type)) {
    return { isValid: false, error: `Invalid alert type. Must be one of: ${validAlertTypes.join(', ')}` };
  }

  // Validate numeric fields
  if (typeof eventData.errorRate !== 'number' || eventData.errorRate < 0 || eventData.errorRate > 1) {
    return { isValid: false, error: 'errorRate must be a number between 0 and 1' };
  }

  if (typeof eventData.threshold !== 'number' || eventData.threshold < 0 || eventData.threshold > 1) {
    return { isValid: false, error: 'threshold must be a number between 0 and 1' };
  }

  // Validate optional fields if present
  if (eventData.totalRequests !== undefined && (typeof eventData.totalRequests !== 'number' || eventData.totalRequests < 0)) {
    return { isValid: false, error: 'totalRequests must be a non-negative number' };
  }

  if (eventData.failedRequests !== undefined && (typeof eventData.failedRequests !== 'number' || eventData.failedRequests < 0)) {
    return { isValid: false, error: 'failedRequests must be a non-negative number' };
  }

  if (eventData.consecutiveErrors !== undefined && (typeof eventData.consecutiveErrors !== 'number' || eventData.consecutiveErrors < 0)) {
    return { isValid: false, error: 'consecutiveErrors must be a non-negative number' };
  }

  return { isValid: true };
}

/**
 * Validate event failure event data structure
 */
function validateEventFailureData(eventData) {
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {
    return { isValid: false, error: 'Event failure event data must be an object' };
  }

  // Required fields for eventFailure events
  const requiredFields = ['originalEventType', 'failureReason', 'errorType'];
  for (const field of requiredFields) {
    if (!eventData[field] || eventData[field] === '') {
      return { isValid: false, error: `Missing required field in event failure data: ${field}` };
    }
  }

  // Validate originalEventType
  const validOriginalEventTypes = ['pageView', 'click', 'videoPlay', 'songRequest', 'systemHealth', 'systemAlert'];
  if (!validOriginalEventTypes.includes(eventData.originalEventType)) {
    return { isValid: false, error: `Invalid originalEventType. Must be one of: ${validOriginalEventTypes.join(', ')}` };
  }

  // Validate string fields
  if (typeof eventData.failureReason !== 'string') {
    return { isValid: false, error: 'failureReason must be a string' };
  }

  if (typeof eventData.errorType !== 'string') {
    return { isValid: false, error: 'errorType must be a string' };
  }

  // Validate optional fields if present
  if (eventData.finalAttempts !== undefined && (typeof eventData.finalAttempts !== 'number' || eventData.finalAttempts < 0)) {
    return { isValid: false, error: 'finalAttempts must be a non-negative number' };
  }

  // Validate originalEventData if present (should be an object)
  if (eventData.originalEventData !== undefined && (typeof eventData.originalEventData !== 'object' || eventData.originalEventData === null)) {
    return { isValid: false, error: 'originalEventData must be an object' };
  }

  return { isValid: true };
}

/**
 * Validate tracking data structure
 */
function validateTrackingData(data) {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Tracking data must be an object' };
  }

  // Check if required fields exist and are not empty strings
  if (!data.eventType || data.eventType === '') {
    return { isValid: false, error: 'Missing required field: eventType' };
  }
  
  if (!data.url || data.url === '') {
    return { isValid: false, error: 'Missing required field: url' };
  }

  // Validate eventType (check for valid values)
  const validEventTypes = ['pageView', 'click', 'videoPlay', 'songRequest', 'systemHealth', 'systemAlert', 'eventFailure'];
  if (!validEventTypes.includes(data.eventType)) {
    return { 
      isValid: false, 
      error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` 
    };
  }

  // Validate URL format
  try {
    new URL(data.url);
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }

  // Validate system health event data if present or required
  if (data.eventType === 'systemHealth' || data.eventType === 'systemAlert' || data.eventType === 'eventFailure') {
    // System health events require eventData
    if (!data.eventData || typeof data.eventData !== 'object' || Array.isArray(data.eventData)) {
      return { isValid: false, error: `${data.eventType} events require eventData object` };
    }
    
    let systemHealthValidation;
    
    if (data.eventType === 'systemHealth') {
      systemHealthValidation = validateSystemHealthData(data.eventData);
      if (!systemHealthValidation.isValid) {
        return systemHealthValidation;
      }
    } else if (data.eventType === 'systemAlert') {
      systemHealthValidation = validateSystemAlertData(data.eventData);
      if (!systemHealthValidation.isValid) {
        return systemHealthValidation;
      }
    } else if (data.eventType === 'eventFailure') {
      systemHealthValidation = validateEventFailureData(data.eventData);
      if (!systemHealthValidation.isValid) {
        return systemHealthValidation;
      }
    }
  }

  // Security validation: Check for potential PII in event data
  if (data.eventData && typeof data.eventData === 'object') {
    const piiFields = [
      'email', 'phone', 'phoneNumber', 'address', 'firstName', 'lastName',
      'fullName', 'name', 'username', 'userId', 'ssn', 'creditCard',
      'password', 'token', 'apiKey', 'personalInfo'
    ];
    
    const checkForPII = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        const fullPath = path ? `${path}.${key}` : key;
        
        // Check if key name suggests PII
        const containsPII = piiFields.some(piiField => 
          keyLower.includes(piiField.toLowerCase())
        );
        
        if (containsPII) {
          return { 
            isValid: false, 
            error: `Potential PII detected in field: ${fullPath}. PII is not allowed in tracking data.` 
          };
        }
        
        // Recursively check nested objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const nestedCheck = checkForPII(value, fullPath);
          if (!nestedCheck.isValid) {
            return nestedCheck;
          }
        }
      }
      return { isValid: true };
    };
    
    const piiCheck = checkForPII(data.eventData);
    if (!piiCheck.isValid) {
      return piiCheck;
    }
  }

  // Validate data size to prevent abuse
  const jsonString = JSON.stringify(data);
  if (jsonString.length > 10000) { // 10KB limit
    return { 
      isValid: false, 
      error: 'Tracking data too large. Maximum size is 10KB.' 
    };
  }

  return { isValid: true };
}

/**
 * Handle deprecated endpoint requests with migration information
 */
async function handleDeprecatedEndpoint(newEndpoint, event) {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();
  
  // Extract client information
  const clientInfo = new ClientInfo(event);
  
  // Parse request body to get event data
  let eventData = {};
  let eventType = 'unknown';
  let url = 'unknown';
  
  try {
    if (event.body) {
      const body = JSON.parse(event.body);
      eventType = body.eventType || 'unknown';
      url = body.url || 'unknown';
      eventData = body.eventData || {};
    }
  } catch (error) {
    // If body parsing fails, continue with defaults
  }
  
  // Log deprecated endpoint usage for monitoring with comprehensive details
  console.log('DEPRECATED_ENDPOINT_ACCESS:', JSON.stringify({
    timestamp: timestamp,
    oldEndpoint: '/proxy/track',
    newEndpoint: newEndpoint,
    message: 'Deprecated endpoint accessed',
    requestId: event.requestContext?.requestId || 'unknown',
    sourceIp: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    host: clientInfo.host,
    origin: event.headers?.origin || event.headers?.Origin || 'unknown',
    eventType: eventType,
    url: url,
    eventData: eventData,
    migrationInfo: {
      action: 'Update client to use /telemetry endpoint',
      documentation: 'See API documentation for endpoint migration details'
    }
  }));

  // Log metrics for monitoring dashboard
  const processingTime = Date.now() - startTime;
  console.log('DEPRECATED_ENDPOINT_METRICS:', JSON.stringify({
    timestamp: timestamp,
    endpoint: '/proxy/track',
    eventType: eventType,
    origin: event.headers?.origin || event.headers?.Origin || 'unknown',
    userAgent: clientInfo.userAgent,
    requestId: event.requestContext?.requestId || 'unknown',
    responseStatus: 404,
    processingTime: processingTime
  }));

  return {
    statusCode: 404,
    body: {
      message: 'Endpoint has been moved',
      error: 'ENDPOINT_MOVED',
      oldEndpoint: '/proxy/track',
      newEndpoint: newEndpoint,
      migration: {
        action: 'Update your client to use the new endpoint',
        documentation: 'See API documentation for details'
      },
      timestamp: timestamp
    }
  };
}

/**
 * Handle tracking endpoint with enhanced error handling and monitoring
 */
async function handleTrackRequest(event) {
  const startTime = Date.now();
  
  try {
    // Parse request body with enhanced error handling
    let trackingData;
    try {
      trackingData = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error('JSON parsing error:', {
        error: parseError.message,
        body: event.body?.substring(0, 500), // Log first 500 chars for debugging
        timestamp: new Date().toISOString(),
        requestId: event.requestContext?.requestId
      });
      
      return {
        statusCode: 400,
        body: {
          message: 'Invalid JSON in request body',
          error: 'PARSE_ERROR',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Enhanced validation with detailed error reporting
    const validation = validateTrackingData(trackingData);
    if (!validation.isValid) {
      console.error('Validation error:', {
        error: validation.error,
        data: trackingData,
        timestamp: new Date().toISOString(),
        requestId: event.requestContext?.requestId
      });
      
      return {
        statusCode: 400,
        body: {
          message: validation.error,
          error: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Extract client information with enhanced error handling
    const clientInfo = extractClientInfo(event);

    // Create standardized JSON log entry with processing time
    const processingTime = Date.now() - startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: trackingData.eventType,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      host: clientInfo.host,
      url: trackingData.url,
      eventData: trackingData.eventData || {},
      processingTime: processingTime,
      requestId: event.requestContext?.requestId
    };

    // Log to CloudWatch with enhanced formatting
    console.log('TELEMETRY_EVENT:', JSON.stringify(logEntry));

    // Log processing metrics for monitoring
    console.log('TELEMETRY_METRICS:', JSON.stringify({
      timestamp: new Date().toISOString(),
      eventType: trackingData.eventType,
      processingTime: processingTime,
      success: true,
      requestId: event.requestContext?.requestId
    }));

    return {
      statusCode: 200,
      body: {
        message: 'Tracking data received successfully',
        timestamp: logEntry.timestamp,
        processingTime: processingTime
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Enhanced error logging with full context
    console.error('TELEMETRY_ERROR:', JSON.stringify({
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      requestContext: {
        requestId: event.requestContext?.requestId,
        sourceIp: event.requestContext?.identity?.sourceIp,
        userAgent: event.requestContext?.identity?.userAgent
      },
      processingTime: processingTime,
      requestBody: event.body?.substring(0, 1000) // Log first 1000 chars for debugging
    }));

    // Log error metrics for monitoring
    console.log('TELEMETRY_METRICS:', JSON.stringify({
      timestamp: new Date().toISOString(),
      processingTime: processingTime,
      success: false,
      errorType: error.name,
      errorMessage: error.message,
      requestId: event.requestContext?.requestId
    }));

    return {
      statusCode: 500,
      body: {
        message: 'Internal server error processing tracking data',
        error: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        requestId: event.requestContext?.requestId
      }
    };
  }
}

/**
 * Lambda handler function with enhanced error handling and monitoring
 */
async function handler(event) {
  const startTime = Date.now();
  const requestId = event.requestContext?.requestId || 'unknown';
  
  // Get origin from request headers (check multiple possible header names)
  const origin = event.headers?.origin || 
                 event.headers?.Origin || 
                 event.headers?.['Origin'] ||
                 event.headers?.['origin'];
  
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Extract path and method from event
    const path = event.path || '';
    const method = event.httpMethod;
    let body = null;
    
    // Enhanced body parsing with error handling
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        console.error('Failed to parse request body:', {
          error: parseError.message,
          body: event.body?.substring(0, 500),
          requestId: requestId
        });
        
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Invalid JSON in request body',
            error: 'PARSE_ERROR',
            requestId: requestId,
            timestamp: new Date().toISOString()
          })
        };
      }
    }

    let result;
    const processingStartTime = Date.now();

    // Handle token generation endpoint
    if (path.endsWith('/auth/token') && method === 'POST') {
      result = await handleTokenRequest();
    }
    // Handle new telemetry endpoint
    else if (path === '/telemetry' && method === 'POST') {
      result = await handleTrackRequest(event);
    }
    // Handle deprecated tracking endpoint
    else if (path === '/proxy/track' && method === 'POST') {
      result = await handleDeprecatedEndpoint('/telemetry', event);
    }
    // Handle Remote Falcon API proxy requests
    else if (path.startsWith('/proxy/')) {
      try {
        // Get JWT token for API authentication
        const jwt = await getJWTToken();
        
        // Extract client information for logging
        const clientInfo = new ClientInfo(event);
        
        // Remove /proxy prefix from path
        const remoteFalconPath = path.replace('/proxy', '');
        
        // Forward request to Remote Falcon API with logging
        result = await forwardToRemoteFalcon(remoteFalconPath, method, body, jwt, clientInfo, requestId);
      } catch (jwtError) {
        console.error('JWT token generation failed:', {
          error: jwtError.message,
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
        
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Authentication service unavailable',
            error: 'AUTH_ERROR',
            requestId: requestId,
            timestamp: new Date().toISOString()
          })
        };
      }
    }
    // Unknown endpoint
    else {
      console.warn('Unknown endpoint requested:', {
        path: path,
        method: method,
        requestId: requestId
      });
      
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Endpoint not found',
          error: 'NOT_FOUND',
          requestId: requestId,
          availableEndpoints: [
            'POST /telemetry - Track user events',
            'GET /proxy/showDetails - Get show details',
            'POST /proxy/addSequenceToQueue - Add sequence to queue',
            'POST /proxy/voteForSequence - Vote for sequence'
          ],
          timestamp: new Date().toISOString()
        })
      };
    }

    const processingTime = Date.now() - processingStartTime;
    const totalTime = Date.now() - startTime;

    // Log success metrics
    console.log('REQUEST_METRICS:', JSON.stringify({
      requestId: requestId,
      timestamp: new Date().toISOString(),
      method: method,
      path: path,
      statusCode: result.statusCode,
      processingTime: processingTime,
      totalTime: totalTime,
      success: result.statusCode < 400
    }));

    return {
      statusCode: result.statusCode,
      headers: {
        ...corsHeaders,
        ...result.headers
      },
      body: JSON.stringify(result.body)
    };

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // Enhanced error logging with full context
    console.error('LAMBDA_ERROR:', JSON.stringify({
      requestId: requestId,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      request: {
        method: event.httpMethod,
        path: event.path,
        origin: origin,
        userAgent: event.headers?.['user-agent']
      },
      totalTime: totalTime
    }));

    // Log error metrics
    console.log('REQUEST_METRICS:', JSON.stringify({
      requestId: requestId,
      timestamp: new Date().toISOString(),
      method: event.httpMethod,
      path: event.path,
      statusCode: 500,
      totalTime: totalTime,
      success: false,
      errorType: error.name,
      errorMessage: error.message
    }));

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Internal server error',
        error: 'INTERNAL_ERROR',
        requestId: requestId,
        timestamp: new Date().toISOString()
      })
    };
  }
}

// Export the handler function, ClientInfo class, RemoteFalconLogBuilder class, and extractClientInfo function for CommonJS
module.exports = { handler, extractClientInfo, RemoteFalconLogBuilder, ClientInfo };