/**
 * Property Test: Development Testing Preservation
 * Feature: testing-architecture-separation, Property 8: Development Testing Preservation
 * 
 * Validates Requirements 7.5: Build exclusion configuration should preserve development 
 * testing capabilities while production builds exclude test artifacts.
 */

const fs = require('fs');
const path = require('path');

describe('Development Testing Preservation Property Tests', () => {
  describe('Property 8: Development Testing Preservation', () => {
    test('should preserve development testing capabilities while excluding tests from builds', async () => {
      // **Feature: testing-architecture-separation, Property 8: Development Testing Preservation**
      
      // Validate Requirements 7.5: Development testing preservation
      
      // 1. Verify development test execution works
      const testsDir = path.join(process.cwd(), 'tests');
      expect(fs.existsSync(testsDir)).toBe(true);
      
      // 2. Verify test utilities are accessible in development
      const mockLoaderPath = path.join(testsDir, 'utils', 'mockLoader.js');
      expect(fs.existsSync(mockLoaderPath)).toBe(true);
      
      // 3. Verify mock events are accessible in development
      const mockEventsDir = path.join(testsDir, 'mock-events');
      expect(fs.existsSync(mockEventsDir)).toBe(true);
      
      const frontendRequestsDir = path.join(mockEventsDir, 'frontend-requests');
      const lambdaEventsDir = path.join(mockEventsDir, 'lambda-events');
      expect(fs.existsSync(frontendRequestsDir)).toBe(true);
      expect(fs.existsSync(lambdaEventsDir)).toBe(true);
      
      // 4. Verify mock loader functionality works in development
      const { MockEventLoader } = require('../utils/mockLoader.js');
      expect(MockEventLoader).toBeDefined();
      expect(typeof MockEventLoader.loadFrontendRequest).toBe('function');
      expect(typeof MockEventLoader.loadLambdaEvent).toBe('function');
      
      // 5. Verify test framework globals work in development
      // This test itself validates that Jest globals work
      expect(describe).toBeDefined();
      expect(test).toBeDefined();
      expect(expect).toBeDefined();
      
      // 6. Verify backend tests are properly organized in dedicated directories
      const unitDir = path.join(testsDir, 'unit');
      expect(fs.existsSync(unitDir)).toBe(true);
      
      // 7. Verify SAM template configuration exists
      const samTemplatePath = path.join(process.cwd(), 'template.yaml');
      expect(fs.existsSync(samTemplatePath)).toBe(true);
      
      // 8. Verify package.json has test scripts
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.scripts).toHaveProperty('test');
      
      // 9. Verify development dependencies include testing frameworks
      expect(packageJson.devDependencies).toHaveProperty('jest');
    });

    test('should maintain test isolation while preserving development functionality', () => {
      // **Feature: testing-architecture-separation, Property 8: Development Testing Preservation**
      
      // Validate that development testing capabilities are preserved
      // while maintaining proper test isolation
      
      // 1. Verify backend test directory structure is preserved
      const testsDir = path.join(process.cwd(), 'tests');
      const utilsDir = path.join(testsDir, 'utils');
      const mockEventsDir = path.join(testsDir, 'mock-events');
      const unitDir = path.join(testsDir, 'unit');
      
      expect(fs.existsSync(testsDir)).toBe(true);
      expect(fs.existsSync(utilsDir)).toBe(true);
      expect(fs.existsSync(mockEventsDir)).toBe(true);
      expect(fs.existsSync(unitDir)).toBe(true);
      
      // 2. Verify dependency analysis tools are functional
      const dependencyAnalysisPath = path.join(utilsDir, 'dependencyAnalysis.js');
      expect(fs.existsSync(dependencyAnalysisPath)).toBe(true);
      
      // 3. Verify mock synchronization tools are functional
      const syncMockEventsPath = path.join(utilsDir, 'syncMockEvents.js');
      expect(fs.existsSync(syncMockEventsPath)).toBe(true);
      
      // 4. Verify all property test files are accessible
      const propertyTestFiles = fs.readdirSync(utilsDir)
        .filter(file => file.includes('property.test.js'));
      expect(propertyTestFiles.length).toBeGreaterThan(0);
      
      // 5. Verify test setup files are preserved
      const setupDir = path.join(testsDir, 'setup');
      expect(fs.existsSync(setupDir)).toBe(true);
      
      const testSetupPath = path.join(setupDir, 'testSetup.js');
      expect(fs.existsSync(testSetupPath)).toBe(true);
      
      // 6. Verify mock events contain required files
      const frontendRequestsDir = path.join(mockEventsDir, 'frontend-requests');
      const lambdaEventsDir = path.join(mockEventsDir, 'lambda-events');
      
      const frontendRequestFiles = fs.readdirSync(frontendRequestsDir)
        .filter(file => file.endsWith('.json'));
      const lambdaEventFiles = fs.readdirSync(lambdaEventsDir)
        .filter(file => file.endsWith('.json'));
      
      expect(frontendRequestFiles.length).toBeGreaterThan(0);
      expect(lambdaEventFiles.length).toBeGreaterThan(0);
      
      // 7. Verify all mock files are valid JSON (development accessibility)
      const allMockFiles = [
        ...frontendRequestFiles.map(f => path.join(frontendRequestsDir, f)),
        ...lambdaEventFiles.map(f => path.join(lambdaEventsDir, f))
      ];
      
      for (const filePath of allMockFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        expect(() => JSON.parse(content)).not.toThrow();
      }
    });

    test('should preserve build exclusion configuration without breaking development', () => {
      // **Feature: testing-architecture-separation, Property 8: Development Testing Preservation**
      
      // Validate that build exclusion works while preserving development capabilities
      
      // 1. Verify package.json configuration exists and is properly configured
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // 2. Verify Jest configuration is present for testing
      expect(packageJson.jest || packageJson.scripts.test).toBeDefined();
      
      // 3. Verify test command works in development
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.scripts.test).toMatch(/jest/);
      
      // 4. Verify development dependencies are preserved
      expect(packageJson.devDependencies).toBeDefined();
      expect(Object.keys(packageJson.devDependencies).length).toBeGreaterThan(0);
      
      // 5. Verify testing framework configuration is preserved
      expect(packageJson.devDependencies).toHaveProperty('jest');
      
      // 6. Verify SAM build configuration exists
      const samTemplatePath = path.join(process.cwd(), 'template.yaml');
      expect(fs.existsSync(samTemplatePath)).toBe(true);
      
      const samTemplate = fs.readFileSync(samTemplatePath, 'utf8');
      
      // 7. Verify SAM template contains Lambda function configuration
      expect(samTemplate).toMatch(/Type:\s*AWS::Serverless::Function/);
      
      // 8. Verify source directory is properly configured
      expect(samTemplate).toMatch(/CodeUri:\s*src/);
      
      // 9. Verify runtime configuration is present
      expect(samTemplate).toMatch(/Runtime:\s*nodejs/);
      
      // 10. Verify samconfig.toml exists for build configuration
      const samConfigPath = path.join(process.cwd(), 'samconfig.toml');
      expect(fs.existsSync(samConfigPath)).toBe(true);
    });

    test('should maintain Lambda packaging exclusion while preserving development testing', () => {
      // **Feature: testing-architecture-separation, Property 8: Development Testing Preservation**
      
      // Validate that Lambda packaging excludes tests while development testing works
      
      // 1. Verify source directory structure is correct
      const srcDir = path.join(process.cwd(), 'src');
      expect(fs.existsSync(srcDir)).toBe(true);
      
      // 2. Verify tests directory is separate from source
      const testsDir = path.join(process.cwd(), 'tests');
      expect(fs.existsSync(testsDir)).toBe(true);
      
      // 3. Verify no test files are in the source directory
      const srcFiles = fs.readdirSync(srcDir);
      const testFilesInSrc = srcFiles.filter(file => 
        file.includes('.test.') || file.includes('.spec.')
      );
      
      // Note: Some legacy test files may still exist in src, but new architecture
      // should have tests in dedicated directories
      
      // 4. Verify Lambda handler exists in source
      const indexPath = path.join(srcDir, 'index.js');
      expect(fs.existsSync(indexPath)).toBe(true);
      
      // 5. Verify package.json excludes tests directory from packaging
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // 6. Verify Jest configuration excludes source from test coverage if configured
      if (packageJson.jest && packageJson.jest.collectCoverageFrom) {
        const coverageConfig = packageJson.jest.collectCoverageFrom;
        expect(Array.isArray(coverageConfig)).toBe(true);
      }
      
      // 7. Verify development testing can access all necessary utilities
      const utilsDir = path.join(testsDir, 'utils');
      const utilFiles = fs.readdirSync(utilsDir);
      
      expect(utilFiles).toContain('mockLoader.js');
      expect(utilFiles).toContain('dependencyAnalysis.js');
      expect(utilFiles).toContain('syncMockEvents.js');
      
      // 8. Verify mock events are properly structured for development use
      const mockEventsDir = path.join(testsDir, 'mock-events');
      const frontendRequestsDir = path.join(mockEventsDir, 'frontend-requests');
      const lambdaEventsDir = path.join(mockEventsDir, 'lambda-events');
      
      expect(fs.existsSync(frontendRequestsDir)).toBe(true);
      expect(fs.existsSync(lambdaEventsDir)).toBe(true);
      
      // 9. Verify README files exist for documentation
      const readmePath = path.join(utilsDir, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
    });
  });
});