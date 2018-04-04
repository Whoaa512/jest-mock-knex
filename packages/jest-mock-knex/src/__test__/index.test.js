import bookshelf from 'bookshelf';
import faker from 'faker';
import knex, { parser, client } from '../';

const db = knex();
const { Model } = bookshelf(db);

const User = Model.extend({
  tableName: 'user',
  hasTimestamps: true,
});

describe('jest-mock-knex', () => {
  it('parser', async () => {
    const id = [faker.random.number(), faker.random.number()].map(String);
    const at = faker.date.future();
    const table = faker.lorem.word();
    const limit = faker.random.number();
    const name = faker.lorem.word();
    const value = [faker.random.number(), faker.random.number()];

    const builder = db(table)
      .where({ at })
      .whereIn('id', id)
      .whereNull('deleted_at')
      .whereNotNull('nickname')
      .limit(limit);

    expect(parser(builder.select('*').toSQL())).toEqual(expect.objectContaining({
      method: 'select', table, id, at: 'DATE', limit, deleted_at: 'null', nickname: 'not null',
    }));

    expect(parser(builder.insert({ name, value, at }).toSQL())).toEqual(expect.objectContaining({
      method: 'insert', table, name, value, at: 'DATE',
    }));

    expect(parser(builder.update({ name, value, at }).toSQL())).toEqual(expect.objectContaining({
      method: 'update', table, id, name, value, at: 'DATE', deleted_at: 'null', nickname: 'not null',
    }));

    expect(parser(builder.delete().toSQL())).toEqual(expect.objectContaining({
      method: 'delete', table, id, at: 'DATE', deleted_at: 'null', nickname: 'not null',
    }));
  });

  it('client', async () => {
    const id = faker.random.number().toString();
    const at = faker.date.future();
    const table = faker.lorem.word();
    const limit = faker.random.number();
    const name = faker.lorem.word();
    const value = [faker.random.number(), faker.random.number()];

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
      method: 'select', table, id, at: 'DATE', limit, deleted_at: 'null', nickname: 'not null',
    }));

    client.mockReset();
    client.mockImplementationOnce(() => [id]);
    expect(await builder.insert({ name, value, at })).toEqual([id]);
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
      method: 'insert', table, name, value, at: 'DATE',
    }));

    client.mockClear();
    client.mockReturnValue([1]);
    expect(await builder.update({ name, value, at })).toEqual([1]);
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
      method: 'update', table, id, name, value, at: 'DATE', deleted_at: 'null', nickname: 'not null',
    }));

    client.mockReset();
    client.mockReturnValueOnce([1]);
    expect(await builder.delete()).toEqual([1]);
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
      method: 'delete', table, id, at: 'DATE', deleted_at: 'null', nickname: 'not null',
    }));
  });

  it('increment', async () => {
    await db('batch_tnsert_table').increment('total', 10);
    expect(client).toMatchSnapshot();
  });

  it('batchInsert', async () => {
    await db.batchInsert('batch_tnsert_table', [{ name: 'xxx' }, { name: 'yyy' }]);
    await db.batchInsert('batch_tnsert_table', [{ name: 'xxx' }, { name: 'yyy' }, { name: 'zzz' }], 2);
    expect(client).toMatchSnapshot();
  });

  it('first', async () => {
    client.mockReturnValueOnce([123]);
    const result = await db.first('id').where({ id: '123' });
    expect(result).toEqual(123);
    expect(client).toMatchSnapshot();
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

  it('bookshelf when throw error', async () => {
    const name = 'I\'m error';

    const Table = Model.extend({
      tableName: 'table',
      hasTimestamps: false,
    });

    client.mockClear();
    client.mockReturnValueOnce(new Error('sql error'));
    const user = new Table({ name });
    await expect(user.save()).rejects.toMatchSnapshot();
    expect(client).toHaveBeenCalledTimes(1);
  });

  it('Sqlite3', async () => {
    const sqlite = knex({
      client: 'sqlite',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });

    const tableName = 'mtable';
    const name = 'yutin';

    client.mockReset();
    client.mockClear();

    await sqlite.schema.createTable(tableName, (table) => {
      table.increments();
      table.string('name');
      table.timestamps();
    });

    await sqlite(tableName).insert({ name });

    expect(await sqlite(tableName).where({ id: 1 })).toEqual([{
      id: 1, name, created_at: null, updated_at: null,
    }]);
    expect(client).toMatchSnapshot();
  });

  it('PostgreSQL', async () => {
    const pg = knex({
      client: 'pg',
      connection: {
        host: '127.0.0.1',
        user: 'postgres',
        password: null,
        database: 'mock',
      },
    });

    const tableName = 'mtable';
    const name = 'yutin';

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
    expect(client).toMatchSnapshot();
  });
});
