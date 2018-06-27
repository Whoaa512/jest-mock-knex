# @whoaa/jest-mock-knex

## Install

```
  npm install @whoaa/jest-mock-knex
```

## How to use

setup jest configs: `/package.json`

```
{
  ...
  "jest": {
    "snapshotSerializers": [
      "<rootDir>/node_modules/@whoaa/jest-mock-knex/serializer"
    ]
  }
}
```

create mock file: `/__mocks__/knex.js`

```
import knex from '@whoaa/jest-mock-knex';

export { client } from '@whoaa/jest-mock-knex';

export default knex;

process.setMaxListeners(0);
```

create testing file: `*/__tests__/*.test.js`

```
import knex from 'knex';
import { client } from '@whoaa/jest-mock-knex';
const pg = knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: null,
    database: 'mock',
  },
});

it(`successfully insert`, () => {
  client.mockImplementationOnce((parsedArgs, rawKnexSql) => {
    const { sql, method, table, ...queryVariables } = parsedArgs
    expect(sql).toMatchSnapshot();
    expect(method).toBe('insert');
    expect(table).toBe('tableName');
    return [1];
  });
  const name = 'foo';
  await pg('tableName').insert({ name });

  expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
    method: 'insert', table: 'tableName', name, created_at: 'DATE',
  }));
  expect(client).toHaveBeenCalledTimes(1);
  expect(client).toMatchSnapshot();
});

it(`when mock failed`, () => {
  client.mockImplementationOnce((parsedArgs, rawKnexSql) => {
    const { sql, method, table, ...queryVariables } = parsedArgs
    expect(sql).toMatchSnapshot();
    expect(method).toBe('insert');
    expect(table).toBe('tableName');
    return new Error('sql error');
  });
  await expect(pg('tableName').insert({ name })).rejects.toMatchSnapshot();
});
```

## Mock flow

```
client.mockReturnValueOnce(results);

if (typeof results === 'array') return results;
else if (results instanceof Error) return Promise.reject / Error;
else return (call knex native client)
```

## Debugging

By default the base mock implementation will log to the console so you can
see when DB queries pass through without a mock response. To disable this behavior
you can call
```
client.toggleDefaultLog()
```

To enable more verbose debug logging you can call
```
client.debug()
```
