const Proto = require('uberproto');
const { filterQuery } = require('@feathersjs/commons');
const isPlainObject = require('is-plain-object');
const errors = require('@feathersjs/errors');

const errorHandler = require('./error-handler');
const hooks = require('./hooks');

const debug = require('debug')('feathers-knex');

const METHODS = {
  $or: 'orWhere',
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
  $ilike: 'ilike'
};

// Create the service.
class Service {
  constructor (options) {
    if (!options) {
      throw new Error('Knex options have to be provided');
    }

    if (!options.Model) {
      throw new Error('You must provide a Model (the initialized knex object)');
    }

    if (typeof options.name !== 'string') {
      throw new Error('No table name specified.');
    }

    this.knex = this.Model = options.Model;
    this.id = options.id || 'id';
    this.paginate = options.paginate || {};
    this.table = options.name;
    this.schema = options.schema;
    this.events = options.events || [];
  }

  get fullName () {
    return (this.schema) ? `${this.schema}.${this.table}` : this.table;
  }

  // NOTE (EK): We need this method so that we return a new query
  // instance each time, otherwise it will reuse the same query.
  db (params = {}) {
    const { knex, table, schema, fullName } = this;
    if (params.transaction) {
      const { trx, id } = params.transaction;
      debug('ran %s with transaction %s', fullName, id);
      return (schema) ? trx.withSchema(schema).table(table) : trx(table);
    }
    return (schema) ? knex.withSchema(schema).table(table) : knex(table);
  }

  extend (obj) {
    return Proto.extend(obj, this);
  }

  init (opts, cb) {
    const k = this.knex;
    const { table, schema, fullName } = this;

    return k.schema.hasTable(fullName).then(exists => {
      if (!exists) {
        debug(`creating ${fullName}`);
        return (schema)
          ? k.schema.withSchema(schema).createTable(table, cb).then(res => res)
          : k.schema.createTable(table, cb).then(res => res);
      } else {
        debug(`${fullName} already exists`);
        return null;
      }
    });
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
        if (key === '$or') {
          const self = this;

          return query.where(function () {
            return value.forEach((condition) => {
              this.orWhere(function () {
                self.knexify(this, condition);
              });
            });
          });
        }
        // eslint-disable-next-line no-useless-call
        return query[method].call(query, column, value);
      }

      return operator === '=' ? query.where(column, value) : query.where(column, operator, value);
    });
  }

  createQuery (params = {}) {
    const { schema, table, id } = this;
    const { filters, query } = filterQuery(params.query || {});
    let q = this.db(params);

    if (schema) { q = q.withSchema(schema).from(`${table} as ${table}`); }

    q = (filters.$select)
      // $select uses a specific find syntax, so it has to come first.
      ? q.select(...filters.$select.concat(`${table}.${id}`))
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

  _find (params, count, getFilter = filterQuery) {
    const { filters, query } = getFilter(params.query || {});
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

    let executeQuery = total => {
      return q.then(data => {
        return {
          total: parseInt(total, 10),
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data
        };
      });
    };

    if (filters.$limit === 0) {
      executeQuery = total => {
        return Promise.resolve({
          total: parseInt(total, 10),
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data: []
        });
      };
    }

    if (count) {
      let countQuery =
        (params.knex || this.db(params))
          .clone()
          .clearSelect()
          .clearOrder()
          .count(`${this.table}.${this.id} as total`);

      if (!params.knex) { this.knexify(countQuery, query); }

      return countQuery.then(count => count[0] ? count[0].total : 0).then(executeQuery).catch(errorHandler);
    }

    return executeQuery().catch(errorHandler);
  }

  find (params) {
    const paginate = (params && typeof params.paginate !== 'undefined') ? params.paginate : this.paginate;
    const result = this._find(params, !!paginate.default,
      query => filterQuery(query, paginate)
    );

    if (!paginate.default) {
      return result.then(page => page.data);
    }

    return result;
  }

  _get (id, params) {
    const query = Object.assign({}, params.query);

    query[this.id] = id;

    return this._find(Object.assign({}, params, { query }))
      .then(page => {
        if (page.data.length !== 1) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return page.data[0];
      }).catch(errorHandler);
  }

  get (...args) {
    return this._get(...args);
  }

  _create (data, params) {
    return this.db(params).insert(data, this.id).then(rows => {
      const id = typeof data[this.id] !== 'undefined' ? data[this.id] : rows[0];
      return this._get(id, params);
    }).catch(errorHandler);
  }

  create (data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this._create(current, params)));
    }

    return this._create(data, params);
  }

  patch (id, raw, params) {
    const query = filterQuery(params.query || {}).query;
    const data = Object.assign({}, raw);
    const mapIds = page => page.data.map(current => current[this.id]);

    // By default we will just query for the one id. For multi patch
    // we create a list of the ids of all items that will be changed
    // to re-query them after the update
    const ids = id === null ? this._find(params)
      .then(mapIds) : Promise.resolve([ id ]);

    if (id !== null) {
      query[this.id] = id;
    }

    const q = this.db(params);

    this.knexify(q, query);

    delete data[this.id];

    return ids.then(idList => {
      // Create a new query that re-queries all ids that
      // were originally changed
      const findParams = Object.assign({}, params, {
        query: {
          [this.id]: { $in: idList },
          $select: params.query && params.query.$select
        }
      });

      return q.update(data).then(() => {
        return this._find(findParams).then(page => {
          const items = page.data;

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

  update (id, data, params) {
    if (Array.isArray(data)) {
      return Promise.reject(errors.BadRequest('Not replacing multiple records. Did you mean `patch`?'));
    }

    // NOTE (EK): First fetch the old record so
    // that we can fill any existing keys that the
    // client isn't updating with null;
    return this._get(id, params).then(oldData => {
      let newObject = {};

      for (var key of Object.keys(oldData)) {
        if (data[key] === undefined) {
          newObject[key] = null;
        } else {
          newObject[key] = data[key];
        }
      }

      // NOTE (EK): Delete id field so we don't update it
      delete newObject[this.id];

      return this.db(params).update(newObject).where(this.id, id).then(() => {
        // NOTE (EK): Restore the id field so we can return it to the client
        newObject[this.id] = id;
        return newObject;
      });
    }).catch(errorHandler);
  }

  remove (id, params) {
    params.query = Object.assign({}, params.query);

    // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.
    if (id !== null) {
      params.query[this.id] = id;
    }

    return this._find(params).then(page => {
      const items = page.data;
      const { query } = filterQuery(params.query || {});
      const q = this.db(params);

      // build up the knex query out of the query params
      this.knexify(q, query);

      return q.del().then(() => {
        if (id !== null) {
          if (items.length === 1) {
            return items[0];
          } else {
            throw new errors.NotFound(`No record found for id '${id}'`);
          }
        }

        return items;
      });
    }).catch(errorHandler);
  }
}

module.exports = function init (options) {
  return new Service(options);
};

module.exports.hooks = hooks;
module.exports.Service = Service;
