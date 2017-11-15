module.exports = {
  test: function test(query) {
    return query && query.mockName === 'knex';
  },
  print: function print(query, serializer) {
    return serializer(query.toJSON());
  },
};
