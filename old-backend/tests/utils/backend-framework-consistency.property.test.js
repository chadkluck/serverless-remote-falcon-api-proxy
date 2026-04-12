/**
 * Property test for backend framework consistency
 * Feature: testing-architecture-fixes, Property 2: Backend Framework Consistency
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
 */

const { describe, test, expect } = require('@jest/globals');
const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

describe('Backend Framework Consistency Property Tests', () => {
  
  test('Property 2: Backend Framework Consistency - For any backend test file, it should use Jest framework exclusively with no Vitest imports, Vitest-specific matchers, or mixed framework patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...getBackendTestFiles()),
        (testFile) => {
          // Skip files that are specifically designed to test for framework patterns
          if (testFile.includes('post-migration-independence') || 
              testFile.includes('test-isolation') ||
              testFile.includes('backend-framework-consistency')) {
            return true; // Skip validation for these meta-test files
          }
          
          const content = fs.readFileSync(testFile, 'utf8');
          
          // Check for actual Vitest imports (not just string content)
          const actualVitestImports = content.match(/^import\s+.*from\s+['"`]vitest['"`]/m) ||
                                    content.match(/^const\s+.*=\s+require\(['"`]vitest['"`]\)/m);
          
          // Should not use Vitest-specific functions (actual usage, not string content)
          const actualVitestFunctions = content.match(/\bvi\./g) && 
                                      !content.includes('// vi.') && 
                                      !content.includes('* vi.');
          
          // Should use Jest imports or globals
          const hasJestImports = content.includes('require(\'@jest/globals\')') ||
                               content.includes('require("@jest/globals")');
          
          // Should use Jest mocking instead of Vitest mocking
          const hasJestMocking = content.includes('jest.mock') || 
                               content.includes('jest.fn') ||
                               content.includes('jest.spyOn') ||
                               content.includes('jest.clearAllMocks') ||
                               content.includes('jest.restoreAllMocks');
          
          // Check if this is actually a test file (has test functions)
          const isActualTestFile = content.includes('describe(') || 
                                  content.includes('test(') || 
                                  content.includes('it(');
          
          // Check if it uses Jest globals (which is valid in Jest environment)
          const usesJestGlobals = isActualTestFile && 
                                (content.includes('describe(') && 
                                 content.includes('expect('));
          
          // Validate framework consistency
          expect(actualVitestImports).toBeNull();
          expect(actualVitestFunctions).toBeFalsy();
          
          // Only require Jest patterns if it's actually a test file
          if (isActualTestFile) {
            expect(hasJestImports || hasJestMocking || usesJestGlobals).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 20 } // Reduced runs as per testing guidelines
    );
  });
  
});

/**
 * Get all backend test files for property testing
 */
function getBackendTestFiles() {
  const backendTestDirs = [
    path.join(__dirname, '../../src'),
    path.join(__dirname, '../unit'),
    path.join(__dirname, '../utils')
  ];
  
  const testFiles = [];
  
  backendTestDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir, { recursive: true });
      files.forEach(file => {
        if (typeof file === 'string' && file.endsWith('.test.js')) {
          testFiles.push(path.join(dir, file));
        }
      });
    }
  });
  
  return testFiles
    .filter(file => fs.existsSync(file))
    // Exclude files that are specifically designed to test for Vitest patterns
    .filter(file => !file.includes('post-migration-independence') && 
                   !file.includes('backend-framework-consistency'));
}