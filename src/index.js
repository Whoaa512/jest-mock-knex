/* eslint no-underscore-dangle: ["error",
  { "allow": ["_query", "_formatQuery", "_debug", "_defaultQueryLog"] }] */

import _ from 'lodash';
import Promise from 'bluebird';
import knex from 'knex/knex';

let _debug = false;
let _defaultQueryLog = true;
const trim = value => _.trim(value, '` ');
const values = value => _.map(_.split(value, ','), trim);
const debugLog = (...args) => {
  if (_debug) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

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

export const client = jest.fn((parsedArgs, rawKnexSql) => {
  if (_defaultQueryLog) {
    // eslint-disable-next-line no-console
    console.log(
      "If you see this, you're not handing a db query somewhere!!!",
      { parsedArgs, rawKnexSql },
    );
  }
  return false;
});
client.mockName = 'knex';
client.toJSON = () => _.map(client.mock.calls, item => item[0].sql);
client.debug = () => {
  _debug = !_debug;
};
client.toggleDefaultLog = () => {
  _defaultQueryLog = !_defaultQueryLog;
};

function query(connection, builder) {
  debugLog('Knex sql', builder);

  const mockResponse = client(parser(builder), builder);

  debugLog('Mock response', mockResponse);

  if (_.isArray(mockResponse)) {
    const response = builder.method === 'first' ? mockResponse[0] : mockResponse;

    return Promise.resolve({ response });
  }

  if (mockResponse instanceof Error) {
    return Promise.reject(mockResponse);
  }

  if (!this._query) {
    debugLog('No query available. Returning empty response');
    return Promise.resolve({ response: [] });
  }

  debugLog('Falling back to the default knex implementation');
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
