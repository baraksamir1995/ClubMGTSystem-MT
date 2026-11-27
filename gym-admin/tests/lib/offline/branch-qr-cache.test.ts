import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshIndexedDb, openTestDb } from './helpers';
import { getCachedBranchQr, getQrBranches, loadBranchQr, saveQrBranches } from '@/lib/offline/branch-qr-cache';
import { wipeCache, type OfflineDB } from '@/lib/offline/db';

const B = 'b0b0b0b0-1111-4222-8333-444444444444';
const QR = { qr: '{"type":"gym_access","v":2}', mode: 'static' as const, expires_at: '2036-11-27T00:00:00Z', kid: 'k1' };
const ok = () => vi.fn().mockResolvedValue(new Response(JSON.stringify(QR), { status: 200 }));

describe('Gym QR cache (Amendment 3)', () => {
  let db: OfflineDB;
  beforeEach(async () => {
    freshIndexedDb();
    db = await openTestDb();
  });

  it('online: fetches the fixed QR and saves it; offline: shown from the saved copy', async () => {
    const live = await loadBranchQr(db, { id: B, name: 'Main' }, { online: true, fetchImpl: ok(), now: 5 });
    expect(live).toEqual({ source: 'live', qr: QR });
    const fetchImpl = vi.fn();
    const off = await loadBranchQr(db, { id: B, name: 'Main' }, { online: false, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(off).toEqual({ source: 'cache', qr: { ...QR, branch_id: B, branch_name: 'Main', saved_at: 5 } });
  });

  it('online but the endpoint fails → saved copy; nothing saved → none', async () => {
    expect(await loadBranchQr(db, { id: B, name: 'Main' }, { online: true, fetchImpl: vi.fn().mockRejectedValue(new TypeError('x')) })).toEqual({ source: 'none' });
    await loadBranchQr(db, { id: B, name: 'Main' }, { online: true, fetchImpl: ok() });
    const res = await loadBranchQr(db, { id: B, name: 'Main' }, { online: true, fetchImpl: vi.fn().mockResolvedValue(new Response('{}', { status: 500 })) });
    expect(res.source).toBe('cache');
  });

  it('without IndexedDB it still works live', async () => {
    expect(await loadBranchQr(null, { id: B, name: null }, { online: true, fetchImpl: ok() })).toMatchObject({ source: 'live' });
    expect(await loadBranchQr(null, { id: B, name: null }, { online: false })).toEqual({ source: 'none' });
  });

  it('branch list is saved for the modal; sign-out wipe removes QRs and branches', async () => {
    await saveQrBranches(db, [{ id: B, name: 'Main' }]);
    await loadBranchQr(db, { id: B, name: 'Main' }, { online: true, fetchImpl: ok() });
    expect(await getQrBranches(db)).toEqual([{ id: B, name: 'Main' }]);
    await wipeCache(db);
    expect(await getQrBranches(db)).toEqual([]);
    expect(await getCachedBranchQr(db, B)).toBeNull();
  });
});
