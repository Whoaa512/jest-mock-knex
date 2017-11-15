# jest-mock-knex

## Install

```
  npm install jest-mock-knex
```

## How to use

setup jest configs: `/package.json`

```
{
  ...
  "jest": {
    "snapshotSerializers": [
      "<rootDir>/node_modules/jest-mock-knex/serializer"
    ]
  }
}
```

create mock file: `/__mocks__/knex.js`

```
import knex from 'jest-mock-knex';

export { client } from 'jest-mock-knex';

export default knex;

process.setMaxListeners(0);
```

create testing file: `*/__tests__/*.test.js`

```
import knex, { client } from 'knex';
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
  client.mockReturnValueOnce([1]);
  await pg(tableName).insert({ name });

  expect(client).toHaveBeenLastCalledWith(expect.objectContaining({
    method: 'insert', table: tableName, naem, created_at: 'DATE',
  }));
  expect(client).toHaveBeenCalledTimes(1);
  expect(client).toMatchSnapshot();
});

it(`when mock failed`, () => {
  client.mockReturnValueOnce(new Error('sql error'));
  await expect(pg(tableName).insert({ name })).rejects.toMatchSnapshot();
});
```

## Mock flow

```
client.mockReturnValueOnce(results);

if (typeof results === 'array') return results;
else if (results instanceof Error) return Promise.reject / Error;
else return (call knex native client)
```
