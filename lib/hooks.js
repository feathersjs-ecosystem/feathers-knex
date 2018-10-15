const debug = require('debug')('feathers-knex-transaction');

const RollbackReason = function(error) {
  this.error = error;
};

const start = (options) => {
  return hook => new Promise(resolve => {
    if (!hook.service.Model || typeof hook.service.Model.transaction !== 'function') {
      return resolve(hook);
    }

    if (hook.params.transaction) {
      hook.params.transaction.count += 1;
      return resolve(hook);
    }

    const transaction = {};

    transaction.promise = hook.service.Model.transaction(trx => {
      transaction.trx = trx;
      transaction.id = Date.now();
      transaction.count = 0;

      hook.params.transaction = transaction;

      debug('started a new transaction %s', transaction.id);
      return resolve(hook);
    }).catch((error) => {
      if (error instanceof RollbackReason) return;
      throw error;
    });
  });
};

const end = (options) => {
  return hook => {
    if (hook.params.transaction) {
      const { promise, trx, id, count } = hook.params.transaction;

      if (count > 0) {
        hook.params.transaction.count -= 1;
        return Promise.resolve(hook);
      }

      hook.params.transaction = undefined;

      return trx.commit()
        .then(() => promise)
        .then(() => debug('finished transaction %s with success', id))
        .then(() => hook);
    }
    return hook;
  };
};

const rollback = (options) => {
  return hook => {
    if (hook.params.transaction) {
      const { promise, trx, id } = hook.params.transaction;
      return trx.rollback(new RollbackReason(hook.error))
        .then(() => debug('rolling back transaction %s', id))
        .then(() => promise)
        .then(() => hook);
    }
    return hook;
  };
};

module.exports = {
  transaction: {
    start,
    end,
    rollback
  }
};
