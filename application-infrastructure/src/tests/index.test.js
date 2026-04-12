/**
 * Handler integration and utility tests.
 *
 * Keeps existing hash utility tests (they still work).
 * Adds module structure verification.
 *
 * Requirements: 16.1, 16.2
 */

const { tools } = require("@63klabs/cache-data");
const utils = require('../utils/index.js');

console.log(`Testing Against Node version ${tools.nodeVerMajor} (${tools.nodeVer})`);
if (tools.nodeVerMajor < 22) {
	console.log("Node version is too low, skipping tests");
	process.exit(0);
}

console.log(`Node ${tools.AWS.NODE_VER} MAJOR ${tools.AWS.NODE_VER_MAJOR} MINOR ${tools.AWS.NODE_VER_MINOR} PATCH ${tools.AWS.NODE_VER_PATCH} MAJOR MINOR ${tools.AWS.NODE_VER_MAJOR_MINOR} SDK ${tools.AWS.SDK_VER} REGION ${tools.AWS.REGION} V2 ${tools.AWS.SDK_V2} V3 ${tools.AWS.SDK_V3}`, tools.AWS.nodeVersionArray);
console.log(`tools.AWS.INFO`, tools.AWS.INFO);

/* ****************************************************************************
 * Utils
 */

describe('Test utils', () => {
	describe('utils.hash.takeLast', () => {
		test('should return a string of length 8', () => {
			const input = 'example';
			const result = utils.hash.takeLast(input);
			expect(typeof result).toBe('string');
			expect(result).toHaveLength(8);
		});

		test('should return a string of length 6', () => {
			const input = 'example';
			const result = utils.hash.takeLast(input, 6);
			expect(typeof result).toBe('string');
			expect(result).toHaveLength(6);
		});

		test('should return a different string for different inputs', () => {
			const input1 = 'example1';
			const input2 = 'example2';
			const result1 = utils.hash.takeLast(input1);
			const result2 = utils.hash.takeLast(input2);
			expect(result1).not.toBe(result2);
		});

		test('should return the same string for the same input', () => {
			const input = 'example';
			const result1 = utils.hash.takeLast(input);
			const result2 = utils.hash.takeLast(input);
			expect(result1).toBe(result2);
		});

		test('should return a string containing only valid characters', () => {
			const input = 'example';
			const result = utils.hash.takeLast(input, 20);
			expect(result).toMatch(/^[a-f0-9]+$/);
		});
	});

	describe('utils.hash.takeFirst', () => {
		test('should return a string of length 8', () => {
			const input = 'example';
			const result = utils.hash.takeFirst(input);
			expect(typeof result).toBe('string');
			expect(result).toHaveLength(8);
		});

		test('should return a string of length 6', () => {
			const input = 'example';
			const result = utils.hash.takeFirst(input, 6);
			expect(typeof result).toBe('string');
			expect(result).toHaveLength(6);
		});

		test('should return a different string for different inputs', () => {
			const input1 = 'example1';
			const input2 = 'example2';
			const result1 = utils.hash.takeFirst(input1);
			const result2 = utils.hash.takeFirst(input2);
			expect(result1).not.toBe(result2);
		});

		test('should return the same string for the same input', () => {
			const input = 'example';
			const result1 = utils.hash.takeFirst(input);
			const result2 = utils.hash.takeFirst(input);
			expect(result1).toBe(result2);
		});

		test('should return a string containing only valid characters', () => {
			const input = 'example';
			const result = utils.hash.takeFirst(input, 20);
			expect(result).toMatch(/^[a-f0-9]+$/);
		});
	});
});

/* ****************************************************************************
 * Module structure verification
 */

describe('Module structure', () => {
	test('utils exports cors, hash, and func', () => {
		expect(utils).toHaveProperty('cors');
		expect(utils).toHaveProperty('hash');
		expect(utils).toHaveProperty('func');
	});

	test('cors module exports getCorsHeaders function', () => {
		expect(typeof utils.cors.getCorsHeaders).toBe('function');
	});

	test('hash module exports takeLast and takeFirst functions', () => {
		expect(typeof utils.hash.takeLast).toBe('function');
		expect(typeof utils.hash.takeFirst).toBe('function');
	});
});
