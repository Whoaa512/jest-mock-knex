/* eslint no-underscore-dangle: ["error", { "allow": ["_query", "_formatQuery"] }] */

import _ from 'lodash';
import knex from 'knex/knex';

export const parser = (builder, sql) => {
  const data = {};
  const bindings = _.clone(builder.bindings);

  if (/^insert /i.test(builder.sql)) {
    const valueRegex = /"?([\w_]+)"?[,)]/gi;
    do {
      const valueColumn = valueRegex.exec(builder.sql);
      if (valueColumn) data[valueColumn[1]] = bindings.shift();
    } while (valueRegex.lastIndex !== 0);
  } else if (/^(select|update|delete) /i.test(builder.sql)) {
    const whereRegex = /"?([\w_]+)"?( = | in | )([(?, )]+)/gi;
    do {
      const whereColumn = whereRegex.exec(builder.sql);
      if (whereColumn) {
        const values = _.toArray(whereColumn[3].match(/\?/gi)).map(() => bindings.shift());
        data[whereColumn[1]] = values.length > 1 ? values : values[0];
      }
    } while (whereRegex.lastIndex !== 0);

    const nullRegex = /"?([\w_]+)"? (is not null|is null)/gi;
    do {
      const nullColumn = nullRegex.exec(builder.sql);
      if (nullColumn) data[nullColumn[1]] = (nullColumn[2] === 'is null' ? 'NULL' : 'NOT NULL');
    } while (nullRegex.lastIndex !== 0);
  }

  const table = /(insert into|update|from) "([^"]+)"/i.exec(builder.sql);

  return {
    ...data,
    table: table && table[2],
    method: builder.method === 'del' ? 'delete' : builder.method,
    sql,
  };
};

export const client = jest.fn(() => false);
client.mockName = 'knex';
client.toJSON = () => _.map(client.mock.calls, item => item[0].sql);

async function query(connection, builder) {
  const sql = this._formatQuery(builder.sql, _.map(
    builder.bindings,
    value => (value instanceof Date ? 'DATE' : value),
  )).replace(/"/gi, '');

  const fn = client(parser(builder, sql));

  if (_.isArray(fn)) {
    return { response: fn };
  }

  return this.__query(connection, builder); // eslint-disable-line
}

class MockClient extends knex.Client {
  async acquireConnection() { return { __knexUid: 1 }; } // eslint-disable-line
  async releaseConnection() { } // eslint-disable-line
  processResponse({ response }) { return response; } // eslint-disable-line
}

export default function mock(config = { client: MockClient }) {
  const db = knex(config);

  _.set(db, 'client.__query', db.client._query);
  db.client._query = query;

  return db;
}
