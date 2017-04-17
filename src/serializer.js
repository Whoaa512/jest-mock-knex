module.exports = {
  test(query) {
    return query && query.mockName === 'knex';
  },
  print(query, serializer) {
    return serializer(query.toJSON());
  },
};
