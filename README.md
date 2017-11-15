# jest-mock-knex

[![npm Version](https://img.shields.io/npm/v/jest-mock-knex.svg?style=flat-square)](https://www.npmjs.com/package/jest-mock-knex)
[![License](https://img.shields.io/npm/l/jest-mock-knex.svg?style=flat-square)](https://www.npmjs.com/package/jest-mock-knex)
[![Downloads](https://img.shields.io/npm/dm/jest-mock-knex.svg?style=flat-square)](https://npm-stat.com/charts.html?package=jest-mock-knex)

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg?style=flat-square)](http://commitizen.github.io/cz-cli/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)](https://github.com/semantic-release/semantic-release)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

## How to use

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

## mock flow

```
client.mockReturnValueOnce(results);

if (typeof results === 'array') return results;
else if (results instanceof Error) return Promise.reject / Error;
else return (call knex native client)
```
