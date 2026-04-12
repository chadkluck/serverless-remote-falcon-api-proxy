
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

module.exports = RemoteFalconLogBuilder;