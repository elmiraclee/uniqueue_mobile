
function assert(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
}
assert.ok = assert;
assert.equal = (a, b, msg) => assert(a == b, msg);
assert.strictEqual = (a, b, msg) => assert(a === b, msg);
assert.deepEqual = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), msg);
assert.notEqual = (a, b, msg) => assert(a != b, msg);
assert.fail = (msg) => { throw new Error(msg || 'Failed'); };
module.exports = assert;
