/** Pure queue-domain rules shared by UI and regression tests. */
export function queueSnapshot(data: any): { queue: any; queues: any[] } {
  // Support old servers' explicit empty snapshot, but never interpret an error as empty.
  const emptyLegacy = data?.success === false && Array.isArray(data.queues) &&
    data.queues.length === 0 && !data.message && !data.code;
  if (!data || (!data.success && !emptyLegacy)) throw new Error(data?.message || 'Queue updates are unavailable. Your last ticket is still shown.');
  const queues = Array.isArray(data.queues) ? data.queues : data.queue ? [data.queue] : [];
  return { queue: data.queue || queues[0] || null, queues };
}
export function supportedQueueType(current: 'walkin'|'appointment', walkin: boolean, appointment: boolean) {
  if (current === 'appointment' && appointment) return current;
  if (current === 'walkin' && walkin) return current;
  return appointment ? 'appointment' : 'walkin';
}
export function feeSummary(items: {id:number; amount?:number|null; price?:number|null}[], selected: number[], quantities: Record<number,number>) {
  let total = 0, complete = true;
  for (const item of items.filter(i => selected.includes(i.id))) {
    const value = item.amount ?? item.price;
    if (value == null || !Number.isFinite(Number(value))) complete = false;
    else total += Number(value) * (quantities[item.id] || 1);
  }
  return { total, complete };
}
/** One in-flight read per screen, with invalidation on blur/unmount. */
export function createQueuePoll(task: (full: boolean, isCurrent: () => boolean) => Promise<void>) {
  let active = true;
  let pending: Promise<void> | null = null;
  const isCurrent = () => active;
  return {
    run(full = false): Promise<void> {
      if (!active) return Promise.resolve();
      if (pending) return pending;
      pending = Promise.resolve().then(() => { if (active) return task(full, isCurrent); }).finally(() => { pending = null; });
      return pending;
    },
    stop() { active = false; },
  };
}
