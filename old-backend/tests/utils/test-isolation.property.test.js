/**
 * Property Test: Test Isolation
 * Feature: testing-architecture-separation, Property 1: Test Isolation
 * Validates: Requirements 1.1, 1.2
 * 
 * Property: For any test execution (frontend or backend), running tests should complete 
 * successfully without requiring dependencies from the other component, and all imports 
 * should resolve to components within the same architectural layer.
 */

const fc = require('fast-check');
const { BackendDependencyAnalyzer } = require('./dependencyAnalysis');
const fs = require('fs');
const path = require('path');

describe('Property Test: Test Isolation', () => {
  test('Property 1: Test Isolation - Backend tests should be isolated from frontend dependencies', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // We don't need random input for this property
        () => {
          const analyzer = new BackendDependencyAnalyzer();
          const results = analyzer.analyzeAllTests();
          
          // Property: All backend tests should be isolated from frontend dependencies
          expect(results.hasViolations).toBe(false);
          expect(results.violations).toHaveLength(0);
          
          // Additional property: Should analyze at least some files
          expect(results.totalFilesAnalyzed).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { 
        numRuns: 10, // Reduced runs since this is deterministic
        verbose: true 
      }
    );
  });

  test('Property 1: Test Isolation - All test files should exist and be readable', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const backendRoot = path.resolve(__dirname, '../../');
          const testDirectories = [
            path.join(backendRoot, 'tests'),
            path.join(backendRoot, 'src') // Legacy test files
          ];
          
          let allTestFiles = [];
          
          // Collect all test files
          const collectTestFiles = (dir) => {
            if (!fs.existsSync(dir)) return;
            
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory() && !['node_modules', 'build', 'dist', '.aws-sam'].includes(entry.name)) {
                collectTestFiles(fullPath);
              } else if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
                allTestFiles.push(fullPath);
              }
            }
          };
          
          testDirectories.forEach(collectTestFiles);
          
          // Property: All test files should be readable and parseable
          for (const testFile of allTestFiles) {
            expect(fs.existsSync(testFile)).toBe(true);
            
            // Should be able to read the file
            const content = fs.readFileSync(testFile, 'utf8');
            expect(content).toBeDefined();
            expect(content.length).toBeGreaterThan(0);
            
            // Should not contain obvious frontend imports
            const frontendImportPatterns = [
              /from\s+['"`][^'"`]*amplifyapp[^'"`]*['"`]/,
              /require\(['"`][^'"`]*amplifyapp[^'"`]*['"`]\)/,
              /from\s+['"`]\.\.\/\.\.\/\.\.\/amplifyapp/,
              /require\(['"`]\.\.\/\.\.\/\.\.\/amplifyapp/,
              /from\s+['"`]react['"`]/,
              /require\(['"`]react['"`]\)/,
              /from\s+['"`]vitest['"`]/,
              /require\(['"`]vitest['"`]\)/
            ];
            
            // Skip meta-test files that are used for testing the testing architecture itself
            const isMetaTest = testFile.includes('post-migration-independence') ||
                              testFile.includes('test-isolation') ||
                              testFile.includes('framework-consistency');
            
            if (!isMetaTest) {
              for (const pattern of frontendImportPatterns) {
                expect(content.match(pattern)).toBeNull();
              }
            }
          }
          
          return true;
        }
      ),
      { 
        numRuns: 5,
        verbose: true 
      }
    );
  });

  test('Property 1: Test Isolation - Test files should use appropriate testing framework imports', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const analyzer = new BackendDependencyAnalyzer();
          const backendRoot = analyzer.backendRoot;
          
          // Collect all test files, excluding meta-test files
          const testFiles = [];
          const collectTestFiles = (dir) => {
            if (!fs.existsSync(dir)) return;
            
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory() && !['node_modules', 'build', 'dist', '.aws-sam'].includes(entry.name)) {
                collectTestFiles(fullPath);
              } else if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
                // Exclude meta-test files that are used for testing the testing architecture itself
                const isMetaTest = entry.name.includes('post-migration-independence') ||
                                  entry.name.includes('test-isolation') ||
                                  entry.name.includes('framework-consistency');
                if (!isMetaTest) {
                  testFiles.push(fullPath);
                }
              }
            }
          };
          
          collectTestFiles(path.join(backendRoot, 'tests'));
          collectTestFiles(path.join(backendRoot, 'src'));
          
          // Property: Backend test files should use Jest, not Vitest
          for (const testFile of testFiles) {
            const content = fs.readFileSync(testFile, 'utf8');
            
            // Should not import Vitest-specific functions
            expect(content).not.toMatch(/require\(['"`]vitest['"`]\)/);
            expect(content).not.toMatch(/from\s+['"`]vitest['"`]/);
            
            // Should not import React testing utilities
            expect(content).not.toMatch(/require\(['"`]@testing-library\/react['"`]\)/);
            expect(content).not.toMatch(/from\s+['"`]@testing-library\/react['"`]/);
            
            // Should not import React itself
            expect(content).not.toMatch(/require\(['"`]react['"`]\)/);
            expect(content).not.toMatch(/from\s+['"`]react['"`]/);
            
            // If it uses testing functions, should use Jest globals or explicit imports
            const testFunctionLines = content.split('\n').filter(line => 
              line.includes('describe(') || 
              line.includes('test(') || 
              line.includes('it(') ||
              line.includes('expect(')
            );
            
            // Jest functions should be available as globals or from jest
            for (const line of testFunctionLines) {
              if (line.includes('from ') && (line.includes('describe') || line.includes('test') || line.includes('expect'))) {
                // If explicitly imported, should be from jest or testing utilities compatible with Node.js
                expect(line).not.toMatch(/from\s+['"`]vitest['"`]/);
                expect(line).not.toMatch(/from\s+['"`]@testing-library\/react['"`]/);
              }
            }
          }
          
          return true;
        }
      ),
      { 
        numRuns: 5,
        verbose: true 
      }
    );
  });

  test('Property 1: Test Isolation - Backend tests should only import Node.js compatible modules', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const analyzer = new BackendDependencyAnalyzer();
          const backendRoot = analyzer.backendRoot;
          
          // Collect all test files, excluding meta-test files
          const testFiles = [];
          const collectTestFiles = (dir) => {
            if (!fs.existsSync(dir)) return;
            
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory() && !['node_modules', 'build', 'dist', '.aws-sam'].includes(entry.name)) {
                collectTestFiles(fullPath);
              } else if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
                // Exclude meta-test files that are used for testing the testing architecture itself
                const isMetaTest = entry.name.includes('post-migration-independence') ||
                                  entry.name.includes('test-isolation') ||
                                  entry.name.includes('framework-consistency');
                if (!isMetaTest) {
                  testFiles.push(fullPath);
                }
              }
            }
          };
          
          collectTestFiles(path.join(backendRoot, 'tests'));
          collectTestFiles(path.join(backendRoot, 'src'));
          
          // Property: Backend tests should only use Node.js compatible imports
          const browserOnlyModules = [
            'jsdom', // Should not be imported directly in backend tests
            'vite',
            'vitest',
            'react',
            'react-dom',
            'react-router',
            '@vitejs/',
            'video.js'
          ];
          
          for (const testFile of testFiles) {
            const content = fs.readFileSync(testFile, 'utf8');
            
            // Skip meta-test files that are used for testing the testing architecture itself
            const isMetaTest = testFile.includes('post-migration-independence') ||
                              testFile.includes('test-isolation') ||
                              testFile.includes('framework-consistency');
            
            if (!isMetaTest) {
              for (const browserModule of browserOnlyModules) {
                expect(content).not.toMatch(new RegExp(`require\\(['"\`][^'"\`]*${browserModule}[^'"\`]*['"\`]\\)`));
                expect(content).not.toMatch(new RegExp(`from\\s+['"\`][^'"\`]*${browserModule}[^'"\`]*['"\`]`));
              }
            }
          }
          
          return true;
        }
      ),
      { 
        numRuns: 5,
        verbose: true 
      }
    );
  });
});