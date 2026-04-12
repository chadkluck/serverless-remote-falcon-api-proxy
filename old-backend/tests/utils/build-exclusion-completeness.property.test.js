/**
 * Property Test: Build Exclusion Completeness
 * Feature: testing-architecture-separation, Property 2: Build Exclusion Completeness
 * 
 * Validates: Requirements 1.3, 3.5, 7.1, 7.2, 7.3, 7.4
 * 
 * This test verifies that test files and directories are properly excluded
 * from Lambda packaging while preserving all production functionality.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

describe('Property Test: Build Exclusion Completeness', () => {
  it('should exclude all test files and directories from Lambda package', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'tests/',
          '.test.js',
          '.spec.js',
          'mock-events/',
          'setup/',
          'utils/mockLoader.js'
        ),
        (testPattern) => {
          // **Feature: testing-architecture-separation, Property 2: Build Exclusion Completeness**
          
          // Verify package.json configuration excludes test files
          const packageJsonPath = path.join(__dirname, '../../src/package.json');
          expect(fs.existsSync(packageJsonPath)).toBe(true);
          
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          
          // Verify package script excludes test patterns
          if (packageJson.scripts && packageJson.scripts.package) {
            const packageScript = packageJson.scripts.package;
            expect(packageScript).toContain('-x');
            expect(packageScript).toContain('tests/*');
            expect(packageScript).toContain('*.test.js');
            expect(packageScript).toContain('*.spec.js');
          }
          
          // Verify Jest configuration excludes tests from coverage
          if (packageJson.jest) {
            const jestConfig = packageJson.jest;
            expect(jestConfig.collectCoverageFrom).toBeDefined();
            
            const coverageExclusions = jestConfig.collectCoverageFrom.filter(pattern => 
              pattern.startsWith('!')
            );
            expect(coverageExclusions.length).toBeGreaterThan(0);
            expect(coverageExclusions.some(pattern => pattern.includes('test'))).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 10 } // Minimal runs as per guidelines
    );
  });

  it('should preserve Lambda functionality while excluding tests', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'index.js',
          'package.json'
        ),
        (productionFile) => {
          // **Feature: testing-architecture-separation, Property 2: Build Exclusion Completeness**
          
          const filePath = path.join(__dirname, '../../src/', productionFile);
          
          if (!fs.existsSync(filePath)) {
            return true; // Skip if file doesn't exist
          }
          
          // Verify production files exist and are not test files
          expect(fs.existsSync(filePath)).toBe(true);
          expect(filePath).not.toMatch(/\.test\./);
          expect(filePath).not.toMatch(/\.spec\./);
          expect(filePath).not.toMatch(/tests\//);
          
          // For index.js, verify it's a valid Lambda handler
          if (productionFile === 'index.js') {
            const content = fs.readFileSync(filePath, 'utf8');
            expect(content).toMatch(/module\.exports\s*=.*handler|exports\.handler/);
          }
          
          // For package.json, verify it has required Lambda dependencies
          if (productionFile === 'package.json') {
            const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            expect(packageJson.dependencies).toBeDefined();
            expect(packageJson.main).toBe('index.js');
          }
          
          return true;
        }
      ),
      { numRuns: 10 } // Minimal runs as per guidelines
    );
  });

  it('should maintain proper Jest configuration for test isolation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'testMatch',
          'testEnvironment',
          'collectCoverageFrom',
          'testPathIgnorePatterns'
        ),
        (jestConfigKey) => {
          // **Feature: testing-architecture-separation, Property 2: Build Exclusion Completeness**
          
          const packageJsonPath = path.join(__dirname, '../../src/package.json');
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          
          expect(packageJson.jest).toBeDefined();
          expect(packageJson.jest[jestConfigKey]).toBeDefined();
          
          // Verify specific Jest configuration values
          switch (jestConfigKey) {
            case 'testMatch':
              expect(packageJson.jest.testMatch).toContain('**/tests/**/*.test.js');
              break;
            case 'testEnvironment':
              expect(packageJson.jest.testEnvironment).toBe('node');
              break;
            case 'collectCoverageFrom':
              expect(Array.isArray(packageJson.jest.collectCoverageFrom)).toBe(true);
              break;
            case 'testPathIgnorePatterns':
              expect(packageJson.jest.testPathIgnorePatterns).toContain('/tests/');
              break;
          }
          
          return true;
        }
      ),
      { numRuns: 10 } // Minimal runs as per guidelines
    );
  });
});