const debug = require('debug')('feathers-knex-transaction');

const ROLLBACK = { rollback: true };

const getKnex = (hook) => {
  const knex = hook.service.Model;

  return knex && typeof knex.transaction === 'function' ? knex : undefined;
};

const start = (options = {}) => {
  options = Object.assign({ getKnex }, options);

  return hook => {
    const { transaction } = hook.params;
    const parent = transaction;
    const knex = transaction ? transaction.trx : options.getKnex(hook);

    if (!knex) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = {};

      if (parent) {
        transaction.parent = parent;
        transaction.committed = parent.committed;
      } else {
        transaction.committed = new Promise(resolve => {
          transaction.resolve = resolve;
        });
      }

      transaction.starting = true;
      transaction.promise = knex.transaction(trx => {
        transaction.trx = trx;
        transaction.id = Date.now();

        hook.params = { ...hook.params, transaction };

        debug('started a new transaction %s', transaction.id);

        resolve();
      }).catch((error) => {
        if (transaction.starting) {
          reject(error);
        } else if (error !== ROLLBACK) {
          throw error;
        }
      });
    });
  };
};

const end = () => {
  return hook => {
    const { transaction } = hook.params;

    if (!transaction) {
      return;
    }

    const { trx, id, promise, parent } = transaction;

    hook.params = { ...hook.params, transaction: parent };
    transaction.starting = false;

    return trx.commit()
      .then(() => promise)
      .then(() => transaction.resolve && transaction.resolve(true))
      .then(() => debug('ended transaction %s', id))
      .then(() => hook);
  };
};

const rollback = () => {
  return hook => {
    const { transaction } = hook.params;

    if (!transaction) {
      return;
    }

    const { trx, id, promise, parent } = transaction;

    hook.params = { ...hook.params, transaction: parent };
    transaction.starting = false;

    return trx.rollback(ROLLBACK)
      .then(() => promise)
      .then(() => transaction.resolve && transaction.resolve(false))
      .then(() => debug('rolled back transaction %s', id))
      .then(() => hook);
  };
};

module.exports = {
  transaction: {
    start,
    end,
    rollback
  }
};
