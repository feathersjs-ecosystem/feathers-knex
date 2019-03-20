const debug = require('debug')('feathers-knex-transaction');

const RollbackReason = function (error) {
  this.error = error;
};

const start = () => {
  return hook => {
    if (!hook.service.Model || typeof hook.service.Model.transaction !== 'function') {
      return Promise.resolve(hook);
    }

    if (hook.params.transaction) {
      hook.params.transaction.count += 1;
      return Promise.resolve(hook);
    }

    return new Promise((resolve, reject) => {
      const id = Date.now();

      debug('started a new transaction %s', id);
      hook.service.Model
        .transaction(trx => resolve({
          id,
          trx,
          count: 0
        }))
        .catch(err => reject(err));
    }).then(trx => {
      hook.params.transaction = trx;
      return hook;
    });
  };
};

const end = () => {
  return hook => {
    if (hook.params.transaction) {
      const { trx, id, count } = hook.params.transaction;

      if (count > 0) {
        hook.params.transaction.count -= 1;
        return Promise.resolve(hook);
      }

      hook.params.transaction = undefined;

      return trx.commit()
        .then(() => debug('finished transaction %s with success', id))
        .then(() => hook);
    }
    return hook;
  };
};

const rollback = () => {
  return hook => {
    if (hook.params.transaction) {
      const { trx, id } = hook.params.transaction;
      return trx.rollback(new RollbackReason(hook.error))
        .then(() => debug('rolling back transaction %s', id))
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
