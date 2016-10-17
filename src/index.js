import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import isPlainObject from 'is-plain-object';
import errorHandler from './error-handler';
import { errors } from 'feathers-errors';

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
  $like: 'like'
};

// Create the service.
class Service {
	constructor(options) {
    if (!options) {
      throw new Error('Knex options have to be provided');
    }

    if (!options.Model) {
      throw new Error('You must provide a Model (the initialized knex object)');
    }

    if (typeof options.name !== 'string') {
      throw new Error('No table name specified.');
    }

    this.knex = options.Model;
    this.id = options.id || 'id';
    this.paginate = options.paginate || {};
    this.table = options.name;
    this.events = options.events || [];
	}

  // NOTE (EK): We need this method so that we return a new query
  // instance each time, otherwise it will reuse the same query.
  db() {
    return this.knex(this.table);
  }

  extend(obj) {
		return Proto.extend(obj, this);
	}

  knexify(query, params, parentKey) {
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

          return value.forEach(condition => {
            query[method](function() {
              self.knexify(this, condition);
            });
          });
        }

        return query[method].call(query, column, value);
      }

      return query.where(column, operator, value);
    });
  }

	_find(params, count, getFilter = filter) {
    const { filters, query } = getFilter(params.query || {});
    let q = this.db().select(['*']);

		// $select uses a specific find syntax, so it has to come first.
		if (filters.$select) {
      q = this.db().select(... filters.$select);
		}

    // build up the knex query out of the query params
    this.knexify(q, query);

		// Handle $sort
		if (filters.$sort) {
      Object.keys(filters.$sort).forEach(key =>
        q = q.orderBy(key, parseInt(filters.$sort[key], 10) === 1 ? 'asc' : 'desc'));
		}

		// Handle $limit
		if (filters.$limit) {
      q.limit(filters.$limit);
		}

		// Handle $skip
		if (filters.$skip) {
      q.offset(filters.$skip);
		}

    const executeQuery = total => {
      return q.then(data => {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data
        };
      });
    };

    if(count) {
      let countQuery = this.db().count(`${this.id} as total`);

      this.knexify(countQuery, query);

      return countQuery.then(count => count[0].total).then(executeQuery);
    }

    return executeQuery();
	}

  find(params) {
    const paginate = (params && typeof params.paginate !== 'undefined') ?
      params.paginate : this.paginate;
    const result = this._find(params, !!paginate.default,
      query => filter(query, paginate)
    );

    if(!paginate.default) {
      return result.then(page => page.data);
    }

    return result;
  }

	_get(id, params) {
    params.query = params.query || {};
    params.query[this.id] = id;

    return this._find(params)
      .then(page => {
        if(page.data.length !== 1) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return page.data[0];
      }).catch(errorHandler);
	}

  get(...args) {
    return this._get(...args);
  }

  _create(data, params) {
    return this.db().insert(data, this.id).then(rows => {
      const id = typeof data[this.id] !== 'undefined' ?
        data[this.id] : rows[0];
      return this._get(id, params);
    }).catch(errorHandler);
  }

	create(data, params) {
    if(Array.isArray(data)) {
      return Promise.all(data.map(current => this._create(current, params)));
    }

    return this._create(data, params);
	}

	patch(id, raw, params) {
    const query = Object.assign({}, params.query);
    const data = Object.assign({}, raw);
    const patchQuery = {};

    if(id !== null) {
      query[this.id] = id;
    }

    // Account for potentially modified data
    Object.keys(query).forEach(key => {
      if(query[key] !== undefined && data[key] !== undefined &&
          typeof data[key] !== 'object') {
        patchQuery[key] = data[key];
      } else {
        patchQuery[key] = query[key];
      }
    });

    let q = this.db();
    this.knexify(q, query);

    delete data[this.id];

    return q.update(data).then(() => {
      return this._find({ query: patchQuery }).then(page => {
        const items = page.data;

        if(id !== null) {
          if(items.length === 1) {
            return items[0];
          } else {
            throw new errors.NotFound(`No record found for id '${id}'`);
          }
        }

        return items;
      });
    }).catch(errorHandler);
	}

	update(id, data, params) {
    if(Array.isArray(data)) {
      return Promise.reject('Not replacing multiple records. Did you mean `patch`?');
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

      return this.db().where(this.id, id).update(newObject).then(() => {
        // NOTE (EK): Restore the id field so we can return it to the client
        newObject[this.id] = id;
        return newObject;
      });
    }).catch(errorHandler);
	}

	remove(id, params) {
    params.query = params.query || {};

    // NOTE (EK): First fetch the record so that we can return
    // it when we delete it.
    if(id !== null) {
      params.query[this.id] = id;
    }

    return this._find(params).then(page => {
      const items = page.data;
      const query = this.db();

      this.knexify(query, params.query);

      return query.del().then(() => {
        if(id !== null) {
          if(items.length === 1) {
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

export default function init(options) {
  return new Service(options);
}

init.Service = Service;
