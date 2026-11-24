import { AsyncLocalStorage } from 'node:async_hooks';
const context = new AsyncLocalStorage();
export function withAuditActor(actor, action) { return context.run(actor || null, action); }
export function currentAuditActor() { return context.getStore() || null; }
export function registerAuditFunctions(db) {
  db.function('riseora_actor_id', () => currentAuditActor()?.id ?? null);
  db.function('riseora_actor_name', () => currentAuditActor()?.username ?? null);
}
