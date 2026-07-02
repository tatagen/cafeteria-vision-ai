/**
 * localStorageベースのデータストア。
 * Firestore互換の最小APIを提供し、データはブラウザのlocalStorageに保存する。
 * サーバー・外部サービスは不要。
 */

const PREFIX = 'localdb_';
const TS_KEY = '__localdb_ts';

export class Timestamp {
  constructor(private ms: number) {}
  toDate(): Date { return new Date(this.ms); }
  toMillis(): number { return this.ms; }
  static now(): Timestamp { return new Timestamp(Date.now()); }
  static fromMillis(ms: number): Timestamp { return new Timestamp(ms); }
}

const SERVER_TS = { __localdb_server_ts: true };
export const serverTimestamp = () => SERVER_TS;

const serialize = (v: any): any => {
  if (v && typeof v === 'object') {
    if ((v as any).__localdb_server_ts) return { [TS_KEY]: Date.now() };
    if (v instanceof Timestamp) return { [TS_KEY]: v.toMillis() };
    if (v instanceof Date) return { [TS_KEY]: v.getTime() };
    if (Array.isArray(v)) return v.map(serialize);
    const o: Record<string, any> = {};
    for (const k of Object.keys(v)) o[k] = serialize(v[k]);
    return o;
  }
  return v;
};

const revive = (v: any): any => {
  if (v && typeof v === 'object') {
    if (typeof (v as any)[TS_KEY] === 'number') return Timestamp.fromMillis((v as any)[TS_KEY]);
    if (Array.isArray(v)) return v.map(revive);
    const o: Record<string, any> = {};
    for (const k of Object.keys(v)) o[k] = revive(v[k]);
    return o;
  }
  return v;
};

type Constraint =
  | { kind: 'orderBy'; field: string; dir: 'asc' | 'desc' }
  | { kind: 'limit'; n: number }
  | { kind: 'where'; field: string; op: string; value: any };

interface CollectionRef { __type: 'collection'; name: string; }
interface DocRef { __type: 'doc'; coll: string; id: string; }
interface QueryRef { __type: 'query'; name: string; constraints: Constraint[]; }

const readColl = (name: string): Record<string, any> => {
  try { return JSON.parse(localStorage.getItem(PREFIX + name) || '{}'); }
  catch { return {}; }
};

const listeners = new Map<string, Set<() => void>>();
const notify = (name: string) => { listeners.get(name)?.forEach(fn => fn()); };

const writeColl = (name: string, data: Record<string, any>) => {
  localStorage.setItem(PREFIX + name, JSON.stringify(data));
  notify(name);
};

// 他のタブでの変更も反映する
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(PREFIX)) notify(e.key.slice(PREFIX.length));
  });
}

export const collection = (_db: unknown, name: string): CollectionRef =>
  ({ __type: 'collection', name });

export const doc = (_db: unknown, coll: string, id: string): DocRef =>
  ({ __type: 'doc', coll, id });

export const query = (base: CollectionRef | QueryRef, ...constraints: Constraint[]): QueryRef => ({
  __type: 'query',
  name: base.name,
  constraints: [...(base.__type === 'query' ? base.constraints : []), ...constraints],
});

export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): Constraint =>
  ({ kind: 'orderBy', field, dir });
export const limit = (n: number): Constraint => ({ kind: 'limit', n });
export const where = (field: string, op: string, value: any): Constraint =>
  ({ kind: 'where', field, op, value });

const cmp = (a: any, b: any): number => {
  const av = a instanceof Timestamp ? a.toMillis() : a;
  const bv = b instanceof Timestamp ? b.toMillis() : b;
  if (av === undefined || av === null) return bv === undefined || bv === null ? 0 : -1;
  if (bv === undefined || bv === null) return 1;
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
};

const getSnapshotSync = (target: CollectionRef | QueryRef) => {
  const raw = readColl(target.name);
  let entries = Object.entries(raw).map(([id, data]) => ({ id, data: revive(data) }));
  const constraints = target.__type === 'query' ? target.constraints : [];
  for (const c of constraints) {
    if (c.kind === 'where') {
      entries = entries.filter(e => {
        const v = e.data[c.field];
        switch (c.op) {
          case '==': return v === c.value;
          case '!=': return v !== c.value;
          case '>': return cmp(v, c.value) > 0;
          case '>=': return cmp(v, c.value) >= 0;
          case '<': return cmp(v, c.value) < 0;
          case '<=': return cmp(v, c.value) <= 0;
          default: return true;
        }
      });
    } else if (c.kind === 'orderBy') {
      const sign = c.dir === 'desc' ? -1 : 1;
      entries.sort((x, y) => sign * cmp(x.data[c.field], y.data[c.field]));
    } else if (c.kind === 'limit') {
      entries = entries.slice(0, c.n);
    }
  }
  const docs = entries.map(e => ({
    id: e.id,
    ref: { __type: 'doc', coll: target.name, id: e.id } as DocRef,
    exists: () => true,
    data: () => e.data,
  }));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn),
  };
};

export const onSnapshot = (
  target: CollectionRef | QueryRef,
  next: (snap: ReturnType<typeof getSnapshotSync>) => void,
  _onError?: (e: unknown) => void,
) => {
  const fire = () => next(getSnapshotSync(target));
  if (!listeners.has(target.name)) listeners.set(target.name, new Set());
  listeners.get(target.name)!.add(fire);
  setTimeout(fire, 0);
  return () => { listeners.get(target.name)?.delete(fire); };
};

export const getDocs = async (target: CollectionRef | QueryRef) => getSnapshotSync(target);

export const getDoc = async (ref: DocRef) => {
  const raw = readColl(ref.coll)[ref.id];
  return {
    id: ref.id,
    ref,
    exists: () => raw !== undefined,
    data: () => (raw === undefined ? undefined : revive(raw)),
  };
};

export const setDoc = async (ref: DocRef, data: any) => {
  const coll = readColl(ref.coll);
  coll[ref.id] = serialize(data);
  writeColl(ref.coll, coll);
};

export const updateDoc = async (ref: DocRef, updates: any) => {
  const coll = readColl(ref.coll);
  coll[ref.id] = { ...(coll[ref.id] || {}), ...serialize(updates) };
  writeColl(ref.coll, coll);
};

export const addDoc = async (collRef: CollectionRef, data: any): Promise<DocRef> => {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const coll = readColl(collRef.name);
  coll[id] = serialize(data);
  writeColl(collRef.name, coll);
  return { __type: 'doc', coll: collRef.name, id };
};

export const deleteDoc = async (ref: DocRef) => {
  const coll = readColl(ref.coll);
  delete coll[ref.id];
  writeColl(ref.coll, coll);
};

export const db = {};
