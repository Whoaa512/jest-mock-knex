/* eslint no-underscore-dangle: ["error", { "allow": ["_query", "_formatQuery"] }] */

import _ from 'lodash';
import Client from 'knex/lib/client';

export const parser = (builder) => {
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
  };
};

export const query = jest.fn(() => []);

export class client extends Client {

  static mockName = 'knex';

  static query = query;

  static sql = [];

  static mock = query.mock;

  static _isMockFunction = true;

  static mockClear = () => {
    query.mockClear();
    client.mock = query.mock;
    client.sql = [];
  }

  static mockReset = () => {
    query.mockReset();
    client.mock = query.mock;
    client.sql = [];
  }

  static mockImplementation = (...args) => query.mockImplementation(...args);

  static mockImplementationOnce = (...args) => query.mockImplementationOnce(...args);

  static mockReturnThis = (...args) => query.mockReturnThis(...args);

  static mockReturnValue = (...args) => query.mockReturnValue(...args);

  static mockReturnValueOnce = (...args) => query.mockReturnValueOnce(...args);

  static toJSON = () => client.sql;

  constructor(...args) {
    super(...args);

    this._query = (connection, builder) => {
      client.sql.push(this._formatQuery(builder.sql, _.map(
        builder.bindings,
        value => (value instanceof Date ? 'DATE' : value),
      )).replace(/"/gi, ''));

      return Promise.resolve(query(parser(builder)));
    };
  }

  acquireConnection = () => Promise.resolve({});

  processResponse = resp => resp;

  releaseConnection = () => Promise.resolve();
}
