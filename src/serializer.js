module.exports = {
  test(client) {
    return client && client.mockName === 'knex';
  },
  print(client, serializer) {
    return serializer(client.toJSON());
  },
};
