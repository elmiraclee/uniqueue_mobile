
// Minimal util polyfill for Metro (avoids broken node util support/types)
function inherits(ctor, superCtor) {
  if (superCtor) {
    ctor.super_ = superCtor;
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  }
}
function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, result) => (err ? reject(err) : resolve(result)));
    });
  };
}
module.exports = {
  inherits,
  promisify,
  deprecate: (fn) => fn,
  format: (...args) => args.map(String).join(' '),
  inspect: (obj) => {
    try { return JSON.stringify(obj); } catch { return String(obj); }
  },
  types: {
    isDate: (v) => v instanceof Date,
    isRegExp: (v) => v instanceof RegExp,
    isArray: Array.isArray,
    isBoolean: (v) => typeof v === 'boolean',
    isNull: (v) => v === null,
    isNullOrUndefined: (v) => v == null,
    isNumber: (v) => typeof v === 'number',
    isString: (v) => typeof v === 'string',
    isSymbol: (v) => typeof v === 'symbol',
    isUndefined: (v) => v === undefined,
    isObject: (v) => typeof v === 'object' && v !== null,
    isError: (v) => v instanceof Error,
    isFunction: (v) => typeof v === 'function',
    isBuffer: () => false,
  },
};
