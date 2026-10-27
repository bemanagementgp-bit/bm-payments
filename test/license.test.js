// node test/license.test.js  – offline tests for the stateless license format
process.env.LICENSE_SECRET = 'test-secret';
const assert = require('assert');
const { makeKey, parseKey, covers } = require('../lib/license');

const k = makeKey('qrforge', 'p', 123456789);
assert.match(k, /^BM-QRFORGE-P123456789-[A-Z0-9]{10}$/, 'key format');
assert.deepStrictEqual(parseKey(k), { app: 'qrforge', kind: 'p', ref: '123456789' }, 'round trip');
assert.deepStrictEqual(parseKey(k.toLowerCase()), { app: 'qrforge', kind: 'p', ref: '123456789' }, 'case-insensitive');
assert.strictEqual(parseKey(k.slice(0, -1) + (k.endsWith('A') ? 'B' : 'A')), null, 'tampered signature rejected');
assert.strictEqual(parseKey('BM-QRFORGE-P123456780-' + k.split('-')[3]), null, 'tampered ref rejected');
assert.strictEqual(parseKey('hello'), null, 'garbage rejected');
const s = makeKey('all', 's', '2c938084726fca480172750000000000');
assert.deepStrictEqual(parseKey(s), { app: 'all', kind: 's', ref: '2c938084726fca480172750000000000' }, 'subscription kind');
assert.deepStrictEqual(parseKey(s.toUpperCase()), { app: 'all', kind: 's', ref: '2c938084726fca480172750000000000' }, 'subscription key typed in uppercase');
assert.ok(covers('all', 'squish') && covers('squish', 'squish') && !covers('squish', 'qrforge'), 'coverage');
process.env.LICENSE_SECRET = 'other';
assert.strictEqual(parseKey(k), null, 'different secret rejects');
console.log('license tests passed ✓');
