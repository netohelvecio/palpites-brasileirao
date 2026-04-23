import type { LucidModel } from '@adonisjs/lucid/types/model'

export default abstract class BaseRepository<M extends LucidModel> {
  protected abstract model: M

  findById(id: string) {
    return this.model.find(id) as Promise<InstanceType<M> | null>
  }

  findByIdOrFail(id: string) {
    return this.model.findOrFail(id) as Promise<InstanceType<M>>
  }

  create(payload: Partial<InstanceType<M>>) {
    return this.model.create(payload as any) as Promise<InstanceType<M>>
  }

  async update(row: InstanceType<M>, payload: Partial<InstanceType<M>>) {
    row.merge(payload as any)
    await row.save()
    return row
  }
}
