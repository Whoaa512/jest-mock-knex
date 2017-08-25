/* eslint no-underscore-dangle: ["error", { "allow": ["_query", "_formatQuery"] }] */

import _ from 'lodash';
import Promise from 'bluebird';
import knex from 'knex/knex';

const values = value => _.map(_.split(value, ','), _.trim);

export const parser = (builder) => {
  const bindings = _.clone(builder.bindings);
  const sql = _.replace(builder.sql, /"|\?/gi, (key) => {
    if (key !== '?') return '';

    const value = bindings.shift();

    if (_.isDate(value)) return 'DATE';
    if (_.isArray(value)) return `[${value.join(',')}]`;
    if (_.isPlainObject(value)) return JSON.stringify(value);
    return value;
  });

  const vSQL = builder.sql.replace(/"/g, '');
  const method = /^(select|insert|update|delete) (.*from |into |)([\w_-]+)/i.exec(vSQL);

  if (!method) return { method: builder.method, sql };

  const vBindings = _.clone(builder.bindings);
  const vBinding = (key) => {
    if (key !== '?') return key;

    const value = vBindings.shift();
    return _.isDate(value) ? 'DATE' : value;
  };

  const map = {};

  if (method[1] === 'insert') {
    const result = /\(([^)]+)\) values \(([^)]+)\)/i.exec(vSQL);
    _.assign(map, _.zipObject(values(result[1]), _.map(values(result[2]), vBinding)));
  } else {
    const sqler = {};
    const regex = /(set|where|order by|group by|limit)(.+)(?=where|order by|group by|limit|offset)/gi;
    let lastIndex = 0;
    let result;
    do {
      result = regex.exec(vSQL);
      if (result) sqler[_.camelCase(result[1])] = result[2];
      if (regex.lastIndex > lastIndex) lastIndex = regex.lastIndex;
    } while (result);

    const lastRegex = /(set|where|order by|group by|limit|offset)(.+)$/gi;
    lastRegex.lastIndex = lastIndex;
    const lastResult = lastRegex.exec(vSQL);
    if (lastResult) sqler[_.camelCase(lastResult[1])] = lastResult[2];

    if (sqler.set) {
      _.split(sqler.set, ',').forEach((item) => {
        const setResult = /^(.+)=(.+)$/i.exec(item);
        if (setResult) map[_.trim(setResult[1])] = vBinding(_.trim(setResult[2]));
      });
    }
    if (sqler.where) {
      _.split(sqler.where, /(and|or)/i).forEach((item) => {
        const whereResult = /^(.+)(>?<?!?=|<?>|<|is|in|@@)(.+)$/i.exec(item);
        if (whereResult) {
          const value = _.trim(whereResult[3], ' \'');
          const valueIn = /^\(([\w?, ]+)\)$/i.exec(value);
          map[_.trim(whereResult[1])] =
            valueIn ? _.map(values(valueIn[1]), vBinding) : vBinding(value);
        }
      });
    }
    if (sqler.orderBy) map.orderBy = _.trim(sqler.orderBy).replace(/\?/g, vBinding);
    if (sqler.groupBy) map.groupBy = _.trim(sqler.groupBy).replace(/\?/g, vBinding);
    if (sqler.limit) map.limit = Number(_.trim(sqler.limit).replace(/\?/g, vBinding));
    if (sqler.offset) map.offset = Number(_.trim(sqler.offset).replace(/\?/g, vBinding));
  }

  return {
    ...map,
    method: method[1],
    table: method[3],
    sql,
  };
};

export const client = jest.fn(() => false);
client.mockName = 'knex';
client.toJSON = () => _.map(client.mock.calls, item => item[0].sql);

function query(connection, builder) {
  const fn = client(parser(builder));

  if (_.isArray(fn)) {
    return Promise.resolve({ response: fn });
  }

  if (fn instanceof Error) {
    return Promise.reject(fn);
  }

  return this.__query(connection, builder); // eslint-disable-line
}

class MockClient extends knex.Client {
  async acquireConnection() { return { __knexUid: 1 }; } // eslint-disable-line
  async releaseConnection() { } // eslint-disable-line
  processResponse({ response }) { return response; } // eslint-disable-line
  _query() { return Promise.resolve({ response: [] }); } // eslint-disable-line
}

export default function mock(config = { client: MockClient }) {
  const db = knex(config);

  _.set(db, 'client.__query', db.client._query);
  db.client._query = query;

  return db;
}
