const { _ } = require('@feathersjs/commons');
const { AdapterService } = require('@feathersjs/adapter-commons');
const { isPlainObject } = require('is-plain-object');
const errors = require('@feathersjs/errors');

const errorHandler = require('./error-handler');
const hooks = require('./hooks');

const debug = require('debug')('feathers-knex');

const METHODS = {
  $or: 'orWhere',
  $and: 'andWhere',
  $ne: 'whereNot',
  $in: 'whereIn',
  $nin: 'whereNotIn'
};

const OPERATORS = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $like: 'like',
  $notlike: 'not like',
  $ilike: 'ilike'
};

// Create the service.
class Service extends AdapterService {
  constructor (options) {
    if (!options || !options.Model) {
      throw new Error('You must provide a Model (the initialized knex object)');
    }

    if (typeof options.name !== 'string') {
      throw new Error('No table name specified.');
    }

    const { whitelist = [] } = options;

    super(Object.assign({
      id: 'id'
    }, options, {
      whitelist: whitelist.concat(['$like', '$notlike', '$ilike', '$and'])
    }));

    this.table = options.name;
    this.schema = options.schema;
  }

  get Model () {
    return this.options.Model;
  }

  get knex () {
    return this.Model;
  }

  get fullName () {
    return this.schema ? `${this.schema}.${this.table}` : this.table;
  }

  // NOTE (EK): We need this method so that we return a new query
  // instance each time, otherwise it will reuse the same query.
  db (params = {}) {
    const { knex, table, schema, fullName } = this;
    if (params.transaction) {
      const { trx, id } = params.transaction;
      debug('ran %s with transaction %s', fullName, id);
      return schema ? trx.withSchema(schema).table(table) : trx(table);
    }
    return schema ? knex.withSchema(schema).table(table) : knex(table);
  }

  knexify (query, params, parentKey) {
    Object.keys(params || {}).forEach(key => {
      const value = params[key];

      if (isPlainObject(value)) {
        return this.knexify(query, value, key);
      }

      // const self = this;
      const column = parentKey || key;
      const method = METHODS[key];
      const operator = OPERATORS[key] || '=';

      if (method) {
        if (key === '$or' || key === '$and') {
          const self = this;

          return query.where(function () {
            return value.forEach((condition) => {
              this[method](function () {
                self.knexify(this, condition);
              });
            });
          });
        }
        // eslint-disable-next-line no-useless-call
        return query[method].call(query, column, value);
      }

      return operator === '='
        ? query.where(column, value)
        : query.where(column, operator, value);
    });

    return query;
  }

  createQuery (params = {}) {
    const { schema, table, id } = this;
    const { filters, query } = this.filterQuery(params);
    let q = this.db(params);

    if (schema) {
      q = q.withSchema(schema).from(`${table} as ${table}`);
    }

    // $select uses a specific find syntax, so it has to come first.
    q = filters.$select
      // always select the id field, but make sure we only select it once
      ? q.select([...new Set([...filters.$select, `${table}.${id}`])])
      : q.select([`${table}.*`]);

    // build up the knex query out of the query params
    this.knexify(q, query);

    // Handle $sort
    if (filters.$sort) {
      Object.keys(filters.$sort).forEach(key => {
        q = q.orderBy(key, filters.$sort[key] === 1 ? 'asc' : 'desc');
      });
    }

    return q;
  }

  _find (params = {}) {
    const { filters, query, paginate } = this.filterQuery(params);
    const q = params.knex ? params.knex.clone() : this.createQuery(params);

    // Handle $limit
    if (filters.$limit) {
      q.limit(filters.$limit);
    }

    // Handle $skip
    if (filters.$skip) {
      q.offset(filters.$skip);

      // provide default sorting if its not set
      if (!filters.$sort) {
        q.orderBy(this.id, 'asc');
      }
    }

    let executeQuery = total => q.then(data => {
      return {
        total: parseInt(total, 10),
        limit: filters.$limit,
        skip: filters.$skip || 0,
        data
      };
    });

    if (filters.$limit === 0) {
      executeQuery = total => Promise.resolve({
        total: parseInt(total, 10),
        limit: filters.$limit,
        skip: filters.$skip || 0,
        data: []
      });
    }

    if (paginate && paginate.default) {
      const countQuery = (params.knex || this.db(params))
        .clone().clearSelect().clearOrder()
        .count(`${this.table}.${this.id} as total`);

      if (!params.knex) {
        this.knexify(countQuery, query);
      }

      return countQuery.then(count => count[0] ? count[0].total : 0)
        .then(executeQuery)
        .catch(errorHandler);
    }

    return executeQuery().then(page => page.data).catch(errorHandler);
  }

  _findOrGet (id, params = {}) {
    const findParams = Object.assign({}, params, {
      paginate: false,
      query: Object.assign({}, params.query)
    });

    if (id === null) {
      return this._find(findParams);
    }

    findParams.query.$and = [
      ...(findParams.query.$and || []),
      { [`${this.table}.${this.id}`]: id }
    ];

    return this._find(findParams);
  }

  _get (id, params = {}) {
    return this._findOrGet(id, params).then(data => {
      if (data.length !== 1) {
        throw new errors.NotFound(`No record found for id '${id}'`);
      }

      return data[0];
    }).catch(errorHandler);
  }

  _create (data, params = {}) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this._create(current, params)));
    }

    const client = this.db(params).client.config.client;
    const returning = client === 'pg' || client === 'oracledb' || client === 'mssql' ? [this.id] : [];

    return this.db(params)
      .insert(data, returning)
      .then(rows => {
        let id;

        if (data[this.id] !== undefined) {
          id = data[this.id];
        } else if (rows[0]) {
          id = rows[0][this.id] !== undefined ? rows[0][this.id] : rows[0];
        }

        if (!id) return rows;

        return this._get(id, params);
      })
      .catch(errorHandler);
  }

  _patch (id, raw, params = {}) {
    // Do not allow to patch the id
    const data = _.omit(raw, this.id);
    // By default we will just query for the one id. For multi patch
    // we create a list of the ids of all items that will be changed
    // to re-query them after the update
    return this._findOrGet(id, Object.assign({}, params, {
      query: _.extend({}, params.query, { $select: [`${this.table}.${this.id}`] })
    })).then(results => {
      const idList = results.map(current => current[this.id]);
      const query = {
        [`${this.table}.${this.id}`]: { $in: idList }
      };
      const q = this.knexify(this.db(params), query);
      const originalQuerySubset = params.query && params.query.$select ? { $select: params.query.$select } : {};
      const findParams = Object.assign({}, params, {
        query: Object.assign(originalQuerySubset, query)
      });

      return q.update(data).then((rows) => {
        return this._findOrGet(null, findParams).then(items => {
          if (id !== null) {
            if (items.length === 1) {
              return items[0];
            } else {
              throw new errors.NotFound(`No record found for id '${id}'`);
            }
          }

          return items;
        });
      });
    }).catch(errorHandler);
  }

  _update (id, data, params = {}) {
    return this._get(id, params).then(oldData => {
      const newObject = Object.keys(oldData).reduce((result, key) => {
        if (key !== this.id) { // We don't want the id field to be changed
          result[key] = data[key] === undefined ? null : data[key];
        }

        return result;
      }, {});

      return this.db(params).update(newObject).where(this.id, id).then(() =>
        this._get(id, params)
      );
    }).catch(errorHandler);
  }

  _remove (id, params = {}) {
    return this._findOrGet(id, params).then(items => {
      const { query } = this.filterQuery(params);
      const q = this.db(params);
      const idList = items.map(current => current[this.id]);

      query[this.id] = { $in: idList };

      // build up the knex query out of the query params
      this.knexify(q, query);

      return q.del().then((...args) => {
        if (id !== null) {
          if (items.length === 1) {
            return items[0];
          }

          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return items;
      });
    }).catch(errorHandler);
  }
}

module.exports = function init (options) {
  return new Service(options);
};

Object.assign(module.exports, {
  hooks,
  Service,
  ERROR: errorHandler.ERROR
});
