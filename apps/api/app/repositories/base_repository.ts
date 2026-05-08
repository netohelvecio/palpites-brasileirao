import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default abstract class BaseRepository<M extends LucidModel> {
  protected abstract model: M

  findById(id: string) {
    return this.model.find(id) as Promise<InstanceType<M> | null>
  }

  findByIdOrFail(id: string) {
    return this.model.findOrFail(id) as Promise<InstanceType<M>>
  }

  findByIdForUpdate(id: string, trx: TransactionClientContract) {
    return this.model
      .query({ client: trx })
      .where('id', id)
      .forUpdate()
      .first() as Promise<InstanceType<M> | null>
  }

  create(payload: Partial<InstanceType<M>>, trx?: TransactionClientContract) {
    return this.model.create(payload as any, { client: trx }) as Promise<InstanceType<M>>
  }

  async update(
    row: InstanceType<M>,
    payload: Partial<InstanceType<M>>,
    trx?: TransactionClientContract
  ) {
    if (trx) row.useTransaction(trx)
    row.merge(payload as any)
    await row.save()
    return row
  }
}
