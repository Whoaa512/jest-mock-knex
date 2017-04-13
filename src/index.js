/* eslint no-underscore-dangle: ["error", { "allow": ["_query", "_formatQuery"] }] */

import _ from 'lodash';
import sqlite3 from 'knex/lib/dialects/sqlite3';

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

export const query = jest.fn(() => false);

export class client extends sqlite3 {

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

  constructor(config) {
    _.defaults(config, {
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    super(config);
  }

  async _query(connection, builder) {
    client.sql.push(this._formatQuery(builder.sql, _.map(
      builder.bindings,
      value => (value instanceof Date ? 'DATE' : value),
    )).replace(/"/gi, ''));

    const reply = query(parser(builder));

    if (_.isArray(reply)) {
      return reply;
    }

    return super.processResponse(await super._query(connection, builder));
  }

  processResponse = resp => resp;
}

export { client as default };
