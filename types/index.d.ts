// TypeScript Version: 3.0
import { Params, Paginated, Id, NullableId, Hook } from '@feathersjs/feathers';
import { AdapterService, ServiceOptions, InternalServiceMethods } from '@feathersjs/adapter-commons';
import * as Knex from 'knex';
import { start } from 'repl';

export interface KnexServiceOptions extends ServiceOptions {
  Model: Knex;
  name: string;
  schema: string;
}

export namespace hooks {
  namespace transaction {
    function start(options?: any): Hook;
    function end(options?: any): Hook;
    function rollback(options?: any): Hook;
  }
}

export class Service<T = any> extends AdapterService implements InternalServiceMethods<T> {
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
