/* eslint no-underscore-dangle: ["error", { "allow": ["_query", "_formatQuery"] }] */

import _ from 'lodash';

const knex = require.requireActual('knex');

export const parser = (builder, sql) => {
  const regex = /^insert /i.test(builder.sql) ? /"[\w_-]+"[,)]/gi : /"?([\w_]+)"?[ =]+\?/gi;
  const keys = _.map(builder.sql.match(regex), key => /([\w_]+)/gi.exec(key)[1]);

  const whereNull = {};
  const nullRegex = /"?([\w_]+)" (is not null|is null)/gi;
  do {
    const nullColumn = nullRegex.exec(builder.sql);
    if (nullColumn) whereNull[nullColumn[1]] = (nullColumn[2] === 'is null' ? 'NULL' : 'NOT NULL');
  } while (nullRegex.lastIndex !== 0);

  const table = /(insert into|update|from) "([^"]+)"/i.exec(builder.sql);

  return {
    ..._.mapValues(_.invert(keys), index => builder.bindings[index]),
    ...whereNull,
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

export default function mock(config) {
  const db = knex(config);

  _.set(db, 'client.__query', db.client._query);
  db.client._query = query;

  return db;
}
