/**
const { MockEventLoader } = require('../utils/mockLoader');
 * Unit tests for ClientInfo class
 * Feature: remote-falcon-logging-enhancement
 */

// Jest globals are available

// Mock AWS SDK
jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn(() => ({
    send: jest.fn()
  })),
  GetParameterCommand: jest.fn()
}));

// Mock jose
jest.mock('jose', () => ({
  SignJWT: jest.fn(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token')
  }))
}));

// Import the ClientInfo class and extractClientInfo function
const { ClientInfo, extractClientInfo } = require('../../src/index.js');

describe('ClientInfo Class', () => {
  describe('IP Address Extraction', () => {
    test('should extract IP from x-forwarded-for header (first IP)', () => {
      const event = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.1');
    });

    test('should extract IP from x-forwarded-for header with whitespace', () => {
      const event = {
        headers: {
          'x-forwarded-for': '  192.168.1.2  , 10.0.0.2'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.2');
    });

    test('should extract IP from X-Forwarded-For header (case insensitive)', () => {
      const event = {
        headers: {
          'X-Forwarded-For': '192.168.1.3'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.3');
    });

    test('should extract IP from x-real-ip header when x-forwarded-for is missing', () => {
      const event = {
        headers: {
          'x-real-ip': '192.168.1.4'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.4');
    });

    test('should extract IP from X-Real-IP header (case insensitive)', () => {
      const event = {
        headers: {
          'X-Real-IP': '192.168.1.5'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.5');
    });

    test('should extract IP from x-forwarded header when others are missing', () => {
      const event = {
        headers: {
          'x-forwarded': '192.168.1.6'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.6');
    });

    test('should extract IP from X-Forwarded header (case insensitive)', () => {
      const event = {
        headers: {
          'X-Forwarded': '192.168.1.7'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.7');
    });

    test('should fall back to requestContext sourceIp when headers are missing', () => {
      const event = {
        headers: {},
        requestContext: {
          identity: {
            sourceIp: '192.168.1.8'
          }
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.8');
    });

    test('should return "unknown" when no IP information is available', () => {
      const event = {
        headers: {}
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('unknown');
    });

    test('should handle missing headers object', () => {
      const event = {};
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('unknown');
    });

    test('should handle null event', () => {
      const clientInfo = new ClientInfo(null);
      expect(clientInfo.ipAddress).toBe('unknown');
    });

    test('should handle undefined event', () => {
      const clientInfo = new ClientInfo(undefined);
      expect(clientInfo.ipAddress).toBe('unknown');
    });

    test('should handle empty x-forwarded-for header', () => {
      const event = {
        headers: {
          'x-forwarded-for': ''
        },
        requestContext: {
          identity: {
            sourceIp: '192.168.1.9'
          }
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.9');
    });

    test('should handle x-forwarded-for with only commas and whitespace', () => {
      const event = {
        headers: {
          'x-forwarded-for': ' , , '
        },
        requestContext: {
          identity: {
            sourceIp: '192.168.1.10'
          }
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.10');
    });

    test('should prioritize x-forwarded-for over other headers', () => {
      const event = {
        headers: {
          'x-forwarded-for': '192.168.1.11',
          'x-real-ip': '192.168.1.12',
          'x-forwarded': '192.168.1.13'
        },
        requestContext: {
          identity: {
            sourceIp: '192.168.1.14'
          }
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.11');
    });

    test('should prioritize x-real-ip over x-forwarded when x-forwarded-for is empty', () => {
      const event = {
        headers: {
          'x-forwarded-for': '',
          'x-real-ip': '192.168.1.15',
          'x-forwarded': '192.168.1.16'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.15');
    });
  });

  describe('User Agent Extraction', () => {
    test('should extract user agent from user-agent header', () => {
      const event = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    });

    test('should extract user agent from User-Agent header (case insensitive)', () => {
      const event = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    });

    test('should extract user agent from USER-AGENT header (case insensitive)', () => {
      const event = {
        headers: {
          'USER-AGENT': 'curl/7.68.0'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('curl/7.68.0');
    });

    test('should trim whitespace from user agent', () => {
      const event = {
        headers: {
          'user-agent': '  Mozilla/5.0 Test Browser  '
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('Mozilla/5.0 Test Browser');
    });

    test('should return "unknown" when user agent header is missing', () => {
      const event = {
        headers: {}
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('unknown');
    });

    test('should return "unknown" when user agent header is empty', () => {
      const event = {
        headers: {
          'user-agent': ''
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('unknown');
    });

    test('should return "unknown" when user agent header is only whitespace', () => {
      const event = {
        headers: {
          'user-agent': '   '
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('unknown');
    });

    test('should handle missing headers object for user agent', () => {
      const event = {};
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('unknown');
    });

    test('should handle null event for user agent', () => {
      const clientInfo = new ClientInfo(null);
      expect(clientInfo.userAgent).toBe('unknown');
    });

    test('should prioritize user-agent over User-Agent', () => {
      const event = {
        headers: {
          'user-agent': 'Primary User Agent',
          'User-Agent': 'Secondary User Agent'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe('Primary User Agent');
    });
  });

  describe('Host Extraction', () => {
    test('should extract host from host header', () => {
      const event = {
        headers: {
          'host': 'api.example.com'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('api.example.com');
    });

    test('should extract host from Host header (case insensitive)', () => {
      const event = {
        headers: {
          'Host': 'api.test.com'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('api.test.com');
    });

    test('should extract host from HOST header (case insensitive)', () => {
      const event = {
        headers: {
          'HOST': 'api.prod.com'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('api.prod.com');
    });

    test('should trim whitespace from host', () => {
      const event = {
        headers: {
          'host': '  api.example.com:8080  '
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('api.example.com:8080');
    });

    test('should return "unknown" when host header is missing', () => {
      const event = {
        headers: {}
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('unknown');
    });

    test('should return "unknown" when host header is empty', () => {
      const event = {
        headers: {
          'host': ''
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('unknown');
    });

    test('should return "unknown" when host header is only whitespace', () => {
      const event = {
        headers: {
          'host': '   '
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('unknown');
    });

    test('should handle missing headers object for host', () => {
      const event = {};
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('unknown');
    });

    test('should handle null event for host', () => {
      const clientInfo = new ClientInfo(null);
      expect(clientInfo.host).toBe('unknown');
    });

    test('should prioritize host over Host', () => {
      const event = {
        headers: {
          'host': 'primary.example.com',
          'Host': 'secondary.example.com'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.host).toBe('primary.example.com');
    });
  });

  describe('Edge Cases and Malformed Headers', () => {
    test('should handle malformed x-forwarded-for with single comma', () => {
      const event = {
        headers: {
          'x-forwarded-for': ','
        },
        requestContext: {
          identity: {
            sourceIp: '192.168.1.20'
          }
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.20');
    });

    test('should handle x-forwarded-for with empty first segment', () => {
      const event = {
        headers: {
          'x-forwarded-for': ', 192.168.1.21'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.21');
    });

    test('should handle all headers being empty strings', () => {
      const event = {
        headers: {
          'x-forwarded-for': '',
          'x-real-ip': '',
          'x-forwarded': '',
          'user-agent': '',
          'host': ''
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('unknown');
      expect(clientInfo.userAgent).toBe('unknown');
      expect(clientInfo.host).toBe('unknown');
    });

    test('should handle headers with null values', () => {
      const event = {
        headers: {
          'x-forwarded-for': null,
          'user-agent': null,
          'host': null
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('unknown');
      expect(clientInfo.userAgent).toBe('unknown');
      expect(clientInfo.host).toBe('unknown');
    });

    test('should handle headers with undefined values', () => {
      const event = {
        headers: {
          'x-forwarded-for': undefined,
          'user-agent': undefined,
          'host': undefined
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('unknown');
      expect(clientInfo.userAgent).toBe('unknown');
      expect(clientInfo.host).toBe('unknown');
    });

    test('should handle complex x-forwarded-for with IPv6 addresses', () => {
      const event = {
        headers: {
          'x-forwarded-for': '2001:db8::1, 192.168.1.22, 10.0.0.1'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('2001:db8::1');
    });

    test('should handle very long user agent strings', () => {
      const longUserAgent = 'Mozilla/5.0 ' + 'A'.repeat(1000);
      const event = {
        headers: {
          'user-agent': longUserAgent
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.userAgent).toBe(longUserAgent);
    });

    test('should handle special characters in headers', () => {
      const event = {
        headers: {
          'x-forwarded-for': '192.168.1.23',
          'user-agent': 'Mozilla/5.0 (Special; Chars: @#$%^&*())',
          'host': 'api-test.example.com'
        }
      };
      const clientInfo = new ClientInfo(event);
      expect(clientInfo.ipAddress).toBe('192.168.1.23');
      expect(clientInfo.userAgent).toBe('Mozilla/5.0 (Special; Chars: @#$%^&*())');
      expect(clientInfo.host).toBe('api-test.example.com');
    });
  });

  describe('toObject Method', () => {
    test('should return plain object with all client information', () => {
      const event = {
        headers: {
          'x-forwarded-for': '192.168.1.24',
          'user-agent': 'Test Browser/1.0',
          'host': 'api.example.com'
        }
      };
      const clientInfo = new ClientInfo(event);
      const obj = clientInfo.toObject();
      
      expect(obj).toEqual({
        ipAddress: '192.168.1.24',
        userAgent: 'Test Browser/1.0',
        host: 'api.example.com'
      });
    });

    test('should return object with "unknown" values when headers are missing', () => {
      const event = {
        headers: {}
      };
      const clientInfo = new ClientInfo(event);
      const obj = clientInfo.toObject();
      
      expect(obj).toEqual({
        ipAddress: 'unknown',
        userAgent: 'unknown',
        host: 'unknown'
      });
    });

    test('should return plain object (not ClientInfo instance)', () => {
      const event = {
        headers: {
          'x-forwarded-for': '192.168.1.25',
          'user-agent': 'Test Browser/2.0',
          'host': 'api.test.com'
        }
      };
      const clientInfo = new ClientInfo(event);
      const obj = clientInfo.toObject();
      
      expect(obj).not.toBeInstanceOf(ClientInfo);
      expect(typeof obj).toBe('object');
      expect(obj.constructor).toBe(Object);
    });
  });

  describe('Backward Compatibility', () => {
    test('extractClientInfo function should work with ClientInfo class', () => {
      const event = {
        headers: {
          'x-forwarded-for': '192.168.1.26',
          'user-agent': 'Legacy Test Browser/1.0',
          'host': 'legacy.example.com'
        }
      };
      
      // Test the legacy function
      const legacyResult = extractClientInfo(event);
      
      // Test the new class
      const clientInfo = new ClientInfo(event);
      const classResult = clientInfo.toObject();
      
      // Results should be identical
      expect(legacyResult).toEqual(classResult);
      expect(legacyResult).toEqual({
        ipAddress: '192.168.1.26',
        userAgent: 'Legacy Test Browser/1.0',
        host: 'legacy.example.com'
      });
    });

    test('extractClientInfo function should handle edge cases like ClientInfo class', () => {
      const event = {
        headers: {}
      };
      
      const legacyResult = extractClientInfo(event);
      const clientInfo = new ClientInfo(event);
      const classResult = clientInfo.toObject();
      
      expect(legacyResult).toEqual(classResult);
      expect(legacyResult).toEqual({
        ipAddress: 'unknown',
        userAgent: 'unknown',
        host: 'unknown'
      });
    });
  });
});