/**
 * Gym QR modal cache (PHASE3-CONTRACT Amendment 3): each branch's fixed signed
 * QR (and the branch list) is saved in the user's offline database whenever it
 * loads online, and shown from there offline. Wiped on sign-out with the other
 * cached data (SNAPSHOT_META_KEYS).
 */
import { getMeta, setMeta, type OfflineDB } from './db';
import type { CachedBranchQr, StaticBranchQr } from './types';

export async function saveBranchQr(
  db: OfflineDB,
  branch: { id: string; name: string | null },
  qr: StaticBranchQr,
  now: number = Date.now(),
): Promise<CachedBranchQr> {
  const all = (await getMeta(db, 'branch_qrs')) ?? {};
  const row: CachedBranchQr = { ...qr, branch_id: branch.id, branch_name: branch.name, saved_at: now };
  await setMeta(db, 'branch_qrs', { ...all, [branch.id]: row });
  return row;
}

export async function getCachedBranchQr(db: OfflineDB, branchId: string): Promise<CachedBranchQr | null> {
  return ((await getMeta(db, 'branch_qrs')) ?? {})[branchId] ?? null;
}

export async function saveQrBranches(db: OfflineDB, branches: { id: string; name: string }[]): Promise<void> {
  await setMeta(db, 'qr_branches', branches.map((b) => ({ id: b.id, name: b.name })));
}

export async function getQrBranches(db: OfflineDB): Promise<{ id: string; name: string }[]> {
  return (await getMeta(db, 'qr_branches')) ?? [];
}

export type BranchQrLoad =
  | { source: 'live'; qr: StaticBranchQr }
  | { source: 'cache'; qr: CachedBranchQr }
  | { source: 'none' };

/**
 * Online: fetch the signed QR, save it, return it. Offline or on any failure:
 * the saved copy (if any). `db` may be null (no IndexedDB) → live only.
 */
export async function loadBranchQr(
  db: OfflineDB | null,
  branch: { id: string; name: string | null },
  opts: { online: boolean; fetchImpl?: typeof fetch; now?: number },
): Promise<BranchQrLoad> {
  if (opts.online) {
    try {
      const res = await (opts.fetchImpl ?? fetch)(`/api/branches/${branch.id}/qr?mode=static`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as StaticBranchQr | null;
      if (res.ok && data && typeof data.qr === 'string') {
        if (db) await saveBranchQr(db, branch, data, opts.now).catch(() => undefined);
        return { source: 'live', qr: data };
      }
    } catch {
      // fall through to the saved copy
    }
  }
  const cached = db ? await getCachedBranchQr(db, branch.id).catch(() => null) : null;
  return cached ? { source: 'cache', qr: cached } : { source: 'none' };
}
