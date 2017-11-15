import bookshelf from 'bookshelf';
import faker from 'faker';
import knex, { client } from '../';

const db = knex({
  client: 'sqlite',
  connection: { filename: ':memory:' },
  useNullAsDefault: true,
});
const { Model } = bookshelf(db);

const User = Model.extend({
  tableName: 'user',
  hasTimestamps: true,
});

describe('serializer', () => {
  it('client', async () => {
    const id = 99;
    const table = 'table';
    const limit = 100;
    const name = 'justin';
    const value = 'caffee';
    const at = faker.date.future();

    client.mockClear();
    client.mockReturnValueOnce([]);
    client.mockReturnValueOnce([]);
    client.mockReturnValueOnce([]);
    client.mockReturnValueOnce([]);

    const builder = db(table)
      .where({ id, at })
      .whereNull('deleted_at')
      .whereNotNull('nickname')
      .limit(limit);

    await builder.select('*');
    await builder.insert({ name, value, at });
    await builder.update({ name, value, at });
    await builder.delete();

    expect(client).toMatchSnapshot();
  });

  it('bookshelf', async () => {
    const id = 99;
    const name = 'justin';
    const value = 'caffee';
    const at = faker.date.future();

    client.mockClear();
    client.mockReturnValueOnce([]);
    client.mockReturnValueOnce([]);
    client.mockReturnValueOnce([]);
    client.mockReturnValueOnce([]);

    await User.fetchAll();
    await new User({ at, name, value }).save();
    await new User({ id, at, name, value }).save();
    await new User({ id }).destroy();

    expect(client).toMatchSnapshot();
  });
});
