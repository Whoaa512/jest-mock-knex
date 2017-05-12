import bookshelf from 'bookshelf';
import faker from 'faker';
import knex, { parser, client } from '../';

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

describe('jest-mock-knex', () => {
  it('parser', async () => {
    const id = faker.random.number();
    const at = faker.date.future();
    const table = faker.lorem.word();
    const limit = faker.random.number();
    const name = faker.lorem.word();
    const value = faker.random.number();

    const builder = db(table)
      .where({ id, at })
      .whereNull('deleted_at')
      .whereNotNull('nickname')
      .limit(limit);

    expect(parser(builder.select('*').toSQL())).toEqual({
      method: 'select', table, id, at, limit, deleted_at: 'NULL', nickname: 'NOT NULL',
    });

    expect(parser(builder.insert({ name, value, at }).toSQL())).toEqual({
      method: 'insert', table, name, value, at,
    });

    expect(parser(builder.update({ name, value, at }).toSQL())).toEqual({
      method: 'update', table, id, name, value, at, deleted_at: 'NULL', nickname: 'NOT NULL',
    });

    expect(parser(builder.delete().toSQL())).toEqual({
      method: 'delete', table, id, at, deleted_at: 'NULL', nickname: 'NOT NULL',
    });
  });

  it('client', async () => {
    const id = faker.random.number();
    const at = faker.date.future();
    const table = faker.lorem.word();
    const limit = faker.random.number();
    const name = faker.lorem.word();
    const value = faker.random.number();

    const builder = db(table)
      .where({ id, at })
      .limit(limit)
      .whereNull('deleted_at')
      .whereNotNull('nickname');

    client.mockClear();
    client.mockImplementation(() => [{ id, name, value }]);
    expect(await builder.select('*')).toEqual([{ id, name, value }]);
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
      method: 'select', table, id, at: expect.any(Date), limit, deleted_at: 'NULL', nickname: 'NOT NULL',
    }));

    client.mockReset();
    client.mockImplementationOnce(() => [id]);
    expect(await builder.insert({ name, value, at })).toEqual([id]);
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
      method: 'insert', table, name, value, at: expect.any(Date),
    }));

    client.mockClear();
    client.mockReturnValue([1]);
    expect(await builder.update({ name, value, at })).toEqual([1]);
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
      method: 'update', table, id, name, value, at: expect.any(Date), deleted_at: 'NULL', nickname: 'NOT NULL',
    }));

    client.mockReset();
    client.mockReturnValueOnce([1]);
    expect(await builder.delete()).toEqual([1]);
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
      method: 'delete', table, id, at: expect.any(Date), deleted_at: 'NULL', nickname: 'NOT NULL',
    }));
  });

  it('bookshelf', async () => {
    const id = faker.random.number();
    const name = faker.lorem.word();
    const value = faker.random.number();

    client.mockClear();
    client.mockImplementation(() => [id]);
    expect(
      (await new User({ name, value }).save()).toJSON(),
    ).toMatchObject({ id, name, value });
    expect(client).toHaveBeenCalledTimes(1);

    client.mockReset();
    client.mockImplementationOnce(() => [{ id, name, value }]);
    expect(
      (await User.fetchAll()).toJSON(),
    ).toEqual([{ id, name, value }]);
    expect(client).toHaveBeenCalledTimes(1);

    client.mockClear();
    client.mockReturnValue([1]);
    expect(
      (await new User({ id, name, value }).save()).toJSON(),
    ).toMatchObject({ id, name, value });
    expect(client).toHaveBeenCalledTimes(1);

    client.mockReset();
    client.mockReturnValueOnce([1]);
    expect(
      (await new User({ id }).destroy()).toJSON(),
    ).toEqual({});
    expect(client).toHaveBeenCalledTimes(1);

    client.mockReturnThis();
  });

  it('Sqlite3', async () => {
    const tableName = faker.lorem.word();
    const name = faker.lorem.word();

    client.mockClear();

    await db.schema.createTable(tableName, (table) => {
      table.increments();
      table.string('name');
      table.timestamps();
    });

    await db(tableName).insert({ name });

    expect(await db(tableName).where({ id: 1 })).toEqual([{
      id: 1, name, created_at: null, updated_at: null,
    }]);
  });

  it('PostgreSQL', async () => {
    const pg = knex({
      client: 'pg',
      connection: process.env.DATABASE_URL || {
        host: '127.0.0.1',
        user: 'postgres',
        password: null,
        database: 'mock',
      },
    });

    const tableName = 'mtable';
    const name = faker.lorem.word();

    client.mockClear();

    await pg.schema.dropTableIfExists(tableName);

    await pg.schema.createTable(tableName, (table) => {
      table.increments();
      table.string('name');
      table.timestamps();
    });

    await pg(tableName).insert({ name });

    expect(await pg(tableName).where({ id: 1 })).toEqual([{
      id: 1, name, created_at: null, updated_at: null,
    }]);
  });
});
