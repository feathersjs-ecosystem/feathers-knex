// TypeScript Version: 4.1
import { Params, Paginated, Id, NullableId, HookContext, Hook } from '@feathersjs/feathers';
import { AdapterService, ServiceOptions, InternalServiceMethods } from '@feathersjs/adapter-commons';
import { Knex } from 'knex';

export interface KnexServiceOptions extends ServiceOptions {
  Model: Knex;
  name: string;
  schema: string;
}

export namespace hooks {
  namespace transaction {
    function start(options?: { getKnex: (hook: HookContext) => Knex | undefined }): Hook;
    function end(): Hook;
    function rollback(): Hook;
  }
}

export class Service<T = any> extends AdapterService<T> implements InternalServiceMethods<T> {
  Model: Knex;
  knex: Knex;
  fullName: string;
  options: KnexServiceOptions;

  constructor(config?: Partial<KnexServiceOptions>);

  db(params?: Params): Knex;
  init(options?: any): Promise<any>;
  createQuery(params?: Params): Knex;

  _find(params?: Params): Promise<T | T[] | Paginated<T>>;
  _get(id: Id, params?: Params): Promise<T>;
  _create(data: Partial<T> | Array<Partial<T>>, params?: Params): Promise<T | T[]>;
  _update(id: NullableId, data: T, params?: Params): Promise<T>;
  _patch(id: NullableId, data: Partial<T>, params?: Params): Promise<T>;
  _remove(id: NullableId, params?: Params): Promise<T>;
}

declare const knex: ((config?: Partial<KnexServiceOptions>) => Service);
export default knex;
