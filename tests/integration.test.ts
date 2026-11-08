import { beforeEach, describe, expect, it, vi } from 'vitest';
import observed from './fixtures/core-observed.json';
import { CORE_URL, CoreClient, initialSync, isFresh, MAX_AGE, parseCore, retryAfter } from '../src/integration/core';
import { applyMilestones, freshGame } from '../src/game';

const NOW = 1_800_000_000_000;
const response = (data: unknown = observed, status = 200, headers: HeadersInit = {}) => new Response(status === 304 ? null : JSON.stringify(data), { status, headers });
describe('official Core schema and identity verification', () => {
  it('validates the real observed response against the official schema and deployment record', () => {
    const d = parseCore(observed);
    expect(d.chain.chainId).toBe('11155111'); expect(d.identities.core).toBe('0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4');
  });
  it('rejects unsupported schemas, unavailable status and missing fields', () => {
    expect(() => parseCore({ ...observed, schemaVersion: 2 })).toThrow(/schema/);
    expect(() => parseCore({ schemaVersion: 1, installationId: 'test', status: 'unavailable', reason: 'indexer_unavailable' })).toThrow(/unavailable/);
    expect(() => parseCore({ status: 'available', core: { blockHeight: '1000' } })).toThrow(/schema/);
  });
  it('rejects mismatched chain, Core, runtime and inconsistent settled accounting', () => {
    expect(() => parseCore({ ...observed, chain: { ...observed.chain, chainId: '1' } })).toThrow(/Chain identity/);
    expect(() => parseCore({ ...observed, identities: { ...observed.identities, core: observed.identities.proxyAdmin } })).toThrow(/identity mismatch/);
    expect(() => parseCore({ ...observed, implementation: { ...observed.implementation, runtimeHash: '0x' + '1'.repeat(64) } })).toThrow(/identity mismatch/);
    expect(() => parseCore({ ...observed, core: { ...observed.core, blockHeight: '1000' } })).toThrow(/accounting/);
  });
  it('rejects unsafe block coverage and uint overflows', () => {
    expect(() => parseCore({ ...observed, chain: { ...observed.chain, indexedThroughBlock: '1' } })).toThrow(/safe Sepolia/);
    expect(() => parseCore({ ...observed, core: { ...observed.core, cumulativeWork: String(2n ** 64n) } })).toThrow(/schema/);
  });
});
describe('network errors, freshness, ETag and rate limiting', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('calls the default browser fetch with its global receiver', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(function (this: typeof globalThis) {
      expect(this).toBe(globalThis); return Promise.resolve(response());
    });
    expect((await new CoreClient().sync(NOW)).status).toBe('verified');
  });
  it('reads the exact public endpoint without credentials and sends the returned ETag unchanged', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(observed, 200, { ETag: 'W/"settled-v1"' })).mockResolvedValueOnce(response(null, 304));
    const client = new CoreClient(fetcher);
    const first = await client.sync(NOW);
    expect(first.status).toBe('verified'); expect(first.data?.core.blockHeight).toBe(observed.core.blockHeight);
    expect(fetcher.mock.calls[0][0]).toBe(CORE_URL); expect(fetcher.mock.calls[0][1].credentials).toBe('omit');
    const second = await client.sync(NOW + 30000);
    expect(second.status).toBe('verified'); expect(second.data).toEqual(first.data);
    expect(fetcher.mock.calls[1][1].headers['If-None-Match']).toBe('W/"settled-v1"');
  });
  it('makes unavailable API data UNKNOWN and cannot apply any permanent unlocks', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ schemaVersion: 1, installationId: 'test', status: 'unavailable', reason: 'indexer_unavailable' }));
    const sync = await new CoreClient(fetcher).sync(NOW);
    expect(sync.status).toBe('unknown'); expect(sync.data).toBe(null); expect(isFresh(sync, NOW)).toBe(false);
    let s = freshGame(NOW);
    if (isFresh(sync, NOW) && sync.data) s = applyMilestones(s, { height: sync.data.core.blockHeight, round: sync.data.core.settledThroughRound, work: sync.data.core.cumulativeWork, safeBlock: sync.data.chain.safeThroughBlock, checkedAt: NOW });
    expect(s.unlocked).toHaveLength(0);
  });
  it('does not replace a failed read with zero or previously fetched data', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response()).mockRejectedValueOnce(new Error('Offline'));
    const client = new CoreClient(fetcher); await client.sync(NOW);
    const failed = await client.sync(NOW + 30000);
    expect(failed.status).toBe('unknown'); expect(failed.data).toBeNull(); expect(failed.checkedAt).toBeNull();
  });
  it('honors 429 Retry-After and does not issue an early retry', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({}, 429, { 'Retry-After': '120' }));
    const client = new CoreClient(fetcher);
    const a = await client.sync(NOW); expect(a.status).toBe('unknown'); expect(a.nextAt).toBe(NOW + 120000);
    await client.sync(NOW + 119999); expect(fetcher).toHaveBeenCalledTimes(1);
    await client.sync(NOW + 120000); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(retryAfter(new Date(NOW + 90000).toUTCString(), NOW)).toBe(NOW + 90000);
  });
  it('expires a successful snapshot after two minutes and rejects old HTTP dates or Age', async () => {
    const verified = await new CoreClient(vi.fn().mockResolvedValue(response())).sync(NOW);
    expect(isFresh(verified, NOW + MAX_AGE - 1)).toBe(true); expect(isFresh(verified, NOW + MAX_AGE)).toBe(false);
    expect(isFresh(verified, NOW - 1)).toBe(false);
    expect(isFresh(initialSync(), NOW)).toBe(false);
    const stale = await new CoreClient(vi.fn().mockResolvedValue(response(observed, 200, { Date: new Date(NOW - MAX_AGE - 1000).toUTCString() }))).sync(NOW);
    expect(stale.status).toBe('unknown'); expect(stale.reason).toMatch(/stale/);
    const aged = await new CoreClient(vi.fn().mockResolvedValue(response(observed, 200, { Age: '121' }))).sync(NOW);
    expect(aged.status).toBe('unknown');
  });
  it('detects a safe block stalled for more than five minutes', async () => {
    const client = new CoreClient(vi.fn().mockImplementation(async () => response()));
    expect((await client.sync(NOW)).status).toBe('verified');
    const stale = await client.sync(NOW + 301000);
    expect(stale.status).toBe('unknown'); expect(stale.reason).toMatch(/not advanced/);
  });
  it('stops on 500 or invalid JSON rather than reporting invented data', async () => {
    const server = await new CoreClient(vi.fn().mockResolvedValue(response({}, 500))).sync(NOW);
    expect(server.status).toBe('unknown'); expect(server.reason).toMatch(/500/);
    const invalid = await new CoreClient(vi.fn().mockResolvedValue(new Response('not-json'))).sync(NOW);
    expect(invalid.status).toBe('unknown'); expect(invalid.data).toBeNull();
  });
});
