/* eslint no-underscore-dangle: ["error", { "allow": ["_isMockFunction"] }] */

module.exports = {
  test: function test(fn) {
    return fn && fn._isMockFunction;
  },
  print: function print(fn, serializer) {
    return serializer(
      `\n${fn.mock.calls.map(args => JSON.stringify(args).replace(/"/g, '')).join('\n')}\n`,
    );
  },
};
