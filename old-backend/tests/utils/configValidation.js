/**
 * Backend Configuration Validation Utilities
 * 
 * This module provides validation functions for backend Jest configuration
 * and AWS SDK dependency validation to ensure proper testing environment setup.
 */

const fs = require('fs');
const path = require('path');

/**
 * Validates Jest configuration and environment setup
 * @returns {Object} Validation result with status and details
 */
const validateJestConfiguration = () => {
  const errors = [];
  const warnings = [];
  const configChecks = {
    jestGlobals: false,
    nodeEnvironment: false,
    setupFiles: false,
    mockSupport: false,
    testMatching: false
  };
  
  try {
    // Check if we're in a Jest environment
    if (typeof jest !== 'undefined' && typeof expect !== 'undefined') {
      configChecks.jestGlobals = true;
    } else {
      errors.push('Jest globals not available - check Jest configuration');
    }
    
    // Check Node.js environment
    if (typeof process !== 'undefined' && process.env.NODE_ENV) {
      configChecks.nodeEnvironment = true;
    } else {
      errors.push('Node.js environment not properly configured');
    }
    
    // Check if global test config exists (from testSetup.js)
    if (typeof global.testConfig !== 'undefined') {
      configChecks.setupFiles = true;
      
      if (global.testConfig.testEnvironment === 'node') {
        // Additional validation passed
      }
    } else {
      errors.push('Global test configuration not found - check testSetup.js is loaded');
    }
    
    // Check mock support
    try {
      if (typeof jest !== 'undefined' && typeof jest.fn === 'function') {
        configChecks.mockSupport = true;
      }
    } catch (e) {
      errors.push('Jest mocking functions not available');
    }
    
    // Check test matching configuration
    const packageJsonPath = path.resolve('package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (packageJson.jest && packageJson.jest.testMatch) {
        configChecks.testMatching = true;
      } else {
        warnings.push('Jest testMatch configuration not found in package.json');
      }
      
      if (!packageJson.jest || !packageJson.jest.setupFilesAfterEnv) {
        warnings.push('Jest setupFilesAfterEnv configuration may be missing');
      }
      
      if (!packageJson.jest || packageJson.jest.testEnvironment !== 'node') {
        warnings.push('Jest testEnvironment should be set to "node" for backend tests');
      }
    } else {
      errors.push('package.json not found in expected location');
    }
    
  } catch (error) {
    errors.push(`Jest configuration validation error: ${error.message}`);
  }
  
  const isValid = errors.length === 0;
  
  return {
    valid: isValid,
    checks: configChecks,
    errors,
    warnings,
    remediation: errors.length > 0 ? {
      steps: [
        'Verify package.json includes Jest configuration with testEnvironment: "node"',
        'Check that setupFilesAfterEnv points to correct testSetup.js path',
        'Ensure Jest is properly installed and configured',
        'Verify testSetup.js is properly importing and configuring required modules'
      ],
      files: [
        'package.json',
        'backend/tests/setup/testSetup.js'
      ]
    } : null
  };
};

/**
 * Validates AWS SDK dependencies are properly installed and available
 * @returns {Object} Validation result with status and details
 */
const validateAwsSdkDependencies = () => {
  const requiredAwsSdkPackages = [
    '@aws-sdk/client-ssm',
    '@aws-sdk/client-lambda'
  ];
  
  const optionalAwsSdkPackages = [
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-cloudwatch'
  ];
  
  const missingRequired = [];
  const availableRequired = [];
  const availableOptional = [];
  const packageVersions = {};
  
  // Check required AWS SDK packages
  requiredAwsSdkPackages.forEach(pkg => {
    try {
      const packagePath = require.resolve(pkg);
      availableRequired.push(pkg);
      
      // Try to get version info
      try {
        const packageJsonPath = path.join(packagePath, '../../package.json');
        if (fs.existsSync(packageJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          packageVersions[pkg] = pkgJson.version;
        }
      } catch (e) {
        // Version info not critical
      }
    } catch (error) {
      missingRequired.push(pkg);
    }
  });
  
  // Check optional AWS SDK packages
  optionalAwsSdkPackages.forEach(pkg => {
    try {
      require.resolve(pkg);
      availableOptional.push(pkg);
    } catch (error) {
      // Optional packages don't cause validation failure
    }
  });
  
  // Validate AWS SDK client functionality
  const functionalityChecks = {
    ssmClient: false,
    lambdaClient: false
  };
  
  try {
    const { SSMClient } = require('@aws-sdk/client-ssm');
    if (typeof SSMClient === 'function') {
      functionalityChecks.ssmClient = true;
    }
  } catch (error) {
    // Will be caught by missing required packages check
  }
  
  try {
    const { LambdaClient } = require('@aws-sdk/client-lambda');
    if (typeof LambdaClient === 'function') {
      functionalityChecks.lambdaClient = true;
    }
  } catch (error) {
    // Will be caught by missing required packages check
  }
  
  const isValid = missingRequired.length === 0;
  
  return {
    valid: isValid,
    packages: {
      required: {
        available: availableRequired,
        missing: missingRequired,
        total: requiredAwsSdkPackages.length
      },
      optional: {
        available: availableOptional,
        total: optionalAwsSdkPackages.length
      },
      versions: packageVersions
    },
    functionality: functionalityChecks,
    errors: missingRequired.length > 0 ? [
      `Missing required AWS SDK packages: ${missingRequired.join(', ')}`,
      'These packages are required for backend Lambda testing'
    ] : [],
    remediation: missingRequired.length > 0 ? {
      steps: [
        `Install missing AWS SDK packages: npm install ${missingRequired.join(' ')}`,
        'Verify package.json includes AWS SDK dependencies',
        'Check that AWS SDK versions are compatible with Lambda runtime',
        'Run npm list to verify dependency tree'
      ],
      commands: [
        `npm install ${missingRequired.join(' ')}`,
        'npm list @aws-sdk/client-ssm @aws-sdk/client-lambda'
      ]
    } : null
  };
};

/**
 * Validates backend framework consistency (no Vitest imports/usage)
 * @returns {Object} Validation result with status and details
 */
const validateBackendFrameworkConsistency = () => {
  const errors = [];
  const warnings = [];
  const frameworkChecks = {
    jestOnly: false,
    noVitestImports: false,
    correctMatchers: false,
    properMocking: false
  };
  
  try {
    // Check that Jest is available and Vitest is not
    if (typeof jest !== 'undefined' && typeof expect !== 'undefined') {
      frameworkChecks.jestOnly = true;
    } else {
      errors.push('Jest framework not available');
    }
    
    // Check for Vitest globals (should not be present)
    if (typeof vi === 'undefined' && typeof vitest === 'undefined') {
      frameworkChecks.noVitestImports = true;
    } else {
      errors.push('Vitest globals detected - backend should use Jest exclusively');
    }
    
    // Check Jest matchers are available
    try {
      if (typeof expect.extend === 'function' && 
          typeof expect.any === 'function' &&
          typeof expect.objectContaining === 'function') {
        frameworkChecks.correctMatchers = true;
      }
    } catch (e) {
      errors.push('Jest matchers not properly available');
    }
    
    // Check Jest mocking is available
    try {
      if (typeof jest.fn === 'function' && 
          typeof jest.mock === 'function' &&
          typeof jest.clearAllMocks === 'function') {
        frameworkChecks.properMocking = true;
      }
    } catch (e) {
      errors.push('Jest mocking functions not available');
    }
    
    // Scan test files for Vitest imports (basic check)
    const testDir = path.resolve('tests');
    if (fs.existsSync(testDir)) {
      const scanForVitestImports = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            scanForVitestImports(filePath);
          } else if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              if (content.includes('from \'vitest\'') || 
                  content.includes('import { vi }') ||
                  content.includes('import { describe, it, expect } from \'vitest\'')) {
                warnings.push(`Potential Vitest import found in ${filePath}`);
              }
            } catch (e) {
              // File read error, skip
            }
          }
        });
      };
      
      scanForVitestImports(testDir);
    }
    
  } catch (error) {
    errors.push(`Framework consistency validation error: ${error.message}`);
  }
  
  const isValid = errors.length === 0;
  
  return {
    valid: isValid,
    checks: frameworkChecks,
    errors,
    warnings,
    remediation: errors.length > 0 ? {
      steps: [
        'Remove any Vitest imports from backend test files',
        'Replace Vitest-specific matchers with Jest equivalents',
        'Ensure Jest is properly configured in package.json',
        'Update test files to use Jest globals instead of Vitest'
      ],
      examples: {
        'Remove Vitest imports': 'Remove: import { describe, it, expect, vi } from \'vitest\'',
        'Use Jest globals': 'Use: describe, it, expect (Jest globals)',
        'Replace vi.fn()': 'Replace vi.fn() with jest.fn()',
        'Replace vi.mock()': 'Replace vi.mock() with jest.mock()'
      }
    } : null
  };
};

/**
 * Comprehensive backend configuration validation
 * @returns {Object} Complete validation result
 */
const validateBackendConfiguration = () => {
  const jestValidation = validateJestConfiguration();
  const awsSdkValidation = validateAwsSdkDependencies();
  const frameworkValidation = validateBackendFrameworkConsistency();
  
  const allErrors = [
    ...jestValidation.errors,
    ...awsSdkValidation.errors,
    ...frameworkValidation.errors
  ];
  
  const allWarnings = [
    ...(jestValidation.warnings || []),
    ...(awsSdkValidation.warnings || []),
    ...(frameworkValidation.warnings || [])
  ];
  
  const isValid = jestValidation.valid && awsSdkValidation.valid && frameworkValidation.valid;
  
  return {
    valid: isValid,
    components: {
      jest: jestValidation,
      awsSdk: awsSdkValidation,
      framework: frameworkValidation
    },
    summary: {
      totalErrors: allErrors.length,
      totalWarnings: allWarnings.length,
      validComponents: [
        jestValidation.valid ? 'jest' : null,
        awsSdkValidation.valid ? 'awsSdk' : null,
        frameworkValidation.valid ? 'framework' : null
      ].filter(Boolean)
    },
    errors: allErrors,
    warnings: allWarnings,
    remediation: !isValid ? {
      priority: 'high',
      description: 'Backend testing configuration has critical issues that prevent proper test execution',
      steps: [
        'Fix AWS SDK dependency issues first',
        'Then resolve Jest configuration problems',
        'Remove any Vitest framework remnants',
        'Run validation again to confirm fixes'
      ]
    } : null
  };
};

module.exports = {
  validateJestConfiguration,
  validateAwsSdkDependencies,
  validateBackendFrameworkConsistency,
  validateBackendConfiguration
};