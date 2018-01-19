/* eslint no-underscore-dangle: ["error", { "allow": ["_query", "_formatQuery"] }] */

import _ from 'lodash';
import Promise from 'bluebird';
import knex from 'knex/knex';

const trim = value => _.trim(value, '` ');
const values = value => _.map(_.split(value, ','), trim);

export const parser = (builder) => {
  const bindings = _.clone(builder.bindings);
  const sql = _.replace(builder.sql, /"|\?|\$[0-9]+/gi, (key) => {
    if (['"'].indexOf(key) > -1) return '';

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
    const result = _.split(vSQL, /(set|where|order by|group by|limit)/gi);
    for (let idx = result.length - 1; idx > 0; idx -= 2) {
      sqler[_.camelCase(result[idx - 1])] = result[idx];
    }
    if (sqler.set) {
      _.split(sqler.set, ',').forEach((item) => {
        const setResult = /^(.+)=(.+)$/i.exec(item);
        if (setResult) map[trim(setResult[1])] = vBinding(_.trim(setResult[2]));
      });
    }
    if (sqler.where) {
      _.split(sqler.where, / and | or /i).forEach((item) => {
        const whereResult = /^(.+)(>?<?!?=|<?>|<|is|in|@@)(.+)$/i.exec(item);
        if (whereResult) {
          const value = _.trim(whereResult[3], ' \'');
          const valueIn = /^\(([\w?, ]+)\)$/i.exec(value);
          map[trim(whereResult[1])] =
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

  if (!this._query) return Promise.resolve({ response: [] });

  return this.__query(connection, builder); // eslint-disable-line
}

class MockClient extends knex.Client {
  isMock = true;
  releaseConnection() { return Promise.resolve(); } // eslint-disable-line
  acquireConnection() { return Promise.resolve({ __knexUid: 1 }); } // eslint-disable-line
  processResponse({ response }) { return response; } // eslint-disable-line
  _query(...args) { return query(...args); } // eslint-disable-line
}

export default function mock(config = { client: MockClient }) {
  const db = knex(config);

  if (!db.client.isMock) {
    _.set(db, 'client.__query', db.client._query);
    db.client._query = query;
  }

  return db;
}
