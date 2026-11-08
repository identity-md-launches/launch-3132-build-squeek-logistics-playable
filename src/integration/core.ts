import validate from './core-validator.generated.mjs';
import deployment from './sepolia.json';

export const CORE_URL = 'https://api.squeekchain.com/v1/core';
export const DEPLOYMENT_URL = 'https://docs.squeekchain.com/assets/deployments/sepolia.json';
export const EXPECTED_CORE = '0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4';
export const MAX_AGE = 120_000;
export const STALLED_HEAD = 300_000;
export type CorePayload = {
  schemaVersion: 1; status: 'available'; installationId: string;
  chain: { target: string; chainId: string; confirmations: string; safeThroughBlock: string; indexedThroughBlock: string; deploymentBlock: string };
  identities: { core: string; proxyImplementation: string; proxyAdmin: string; proxyAdminOwner: string; operatorTimelock: string; operatorProposer: string; factory: string; proxyAdminSlot: string };
  core: { blockHeight: string; settledThroughRound: string; cumulativeWork: string; cumulativeBlockUnits: string; blockProgress: string; paused: boolean; workPerThousandBlocks: string; authorizationNonce: string };
  implementation: { codeAddress: string; runtimeHash: string; storageLayoutDigest: string; codeVersion: string };
};
export function parseCore(value: unknown): CorePayload {
  if (!validate(value)) throw new Error('API schema validation failed. Global milestones are UNKNOWN.');
  const v = value as CorePayload | { status: 'unavailable'; reason: string };
  if (v.status !== 'available') throw new Error(`SqueekCore unavailable: ${v.reason.replaceAll('_', ' ')}.`);
  const d = deployment.contracts.SqueekCore;
  if (deployment.chainId !== 11155111 || deployment.network !== 'sepolia' || d.address !== EXPECTED_CORE) throw new Error('The bundled deployment record does not match the required Sepolia deployment.');
  if (v.chain.chainId !== String(deployment.chainId) || v.chain.target !== 'sepolia' || v.chain.deploymentBlock !== String(d.deployedAtBlock)) throw new Error('Chain identity mismatch. Expected the official Ethereum Sepolia deployment.');
  const identitiesMatch = v.identities.core === d.address && v.identities.proxyImplementation === d.implementation && v.identities.proxyAdmin === d.proxyAdmin && v.identities.proxyAdminSlot === d.proxyAdmin && v.identities.proxyAdminOwner === deployment.operational.governanceTimelock.address && v.identities.operatorTimelock === deployment.operational.governanceTimelock.address && v.identities.operatorProposer === deployment.operational.governanceSafe.address;
  if (!identitiesMatch || v.implementation.codeAddress !== d.implementation || v.implementation.runtimeHash !== d.implementationRuntimeHash || v.implementation.storageLayoutDigest !== d.storageLayoutDigest) throw new Error('SqueekCore identity mismatch against the official deployment record. Unlocks stopped.');
  if (BigInt(v.chain.safeThroughBlock) < BigInt(v.chain.deploymentBlock) || BigInt(v.chain.indexedThroughBlock) < BigInt(v.chain.safeThroughBlock)) throw new Error('The API has not indexed the safe Sepolia block.');
  if (BigInt(v.core.cumulativeBlockUnits) !== BigInt(v.core.blockHeight) * 1_000_000_000n + BigInt(v.core.blockProgress)) throw new Error('Settled block accounting is inconsistent. Unlocks stopped.');
  if (BigInt(v.core.blockHeight) > 0n && (BigInt(v.core.cumulativeWork) === 0n || BigInt(v.core.settledThroughRound) === 0n)) throw new Error('Settled work and round are inconsistent with block height.');
  return v;
}
export type SyncState = { status: 'loading' | 'verified' | 'unknown'; data: CorePayload | null; checkedAt: number | null; reason: string; nextAt: number; etag: string | null };
export const initialSync = (): SyncState => ({ status: 'loading', data: null, checkedAt: null, reason: 'Checking the settled frontier…', nextAt: 0, etag: null });
export function isFresh(sync: SyncState, now = Date.now()) { return sync.status === 'verified' && sync.checkedAt !== null && now >= sync.checkedAt && now - sync.checkedAt < MAX_AGE; }
export function retryAfter(value: string | null, now = Date.now()) {
  if (!value) return now + 60_000;
  if (/^\d+$/.test(value.trim())) return now + Math.max(1, Number(value)) * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(now + 1000, timestamp) : now + 60_000;
}
export class CoreClient {
  private etag: string | null = null;
  private cached: CorePayload | null = null;
  private nextAt = 0;
  private failures = 0;
  private lastSafe = '';
  private lastSafeChanged = 0;
  private fetching = false;
  constructor(private fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init)) {}
  async sync(now = Date.now()): Promise<SyncState> {
    if (this.fetching || now < this.nextAt) return { status: 'unknown', data: null, checkedAt: null, reason: 'Waiting before the next network request.', nextAt: this.nextAt, etag: this.etag };
    this.fetching = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await this.fetcher(CORE_URL, { headers: this.etag ? { 'If-None-Match': this.etag } : {}, signal: controller.signal, credentials: 'omit', cache: 'no-cache' });
      if (response.status === 429 || response.status === 503) {
        this.nextAt = retryAfter(response.headers.get('Retry-After'), now);
        throw new Error(`API ${response.status === 429 ? 'rate limited' : 'temporarily unavailable'}. Retrying after the server’s waiting period.`);
      }
      if (!response.ok && response.status !== 304) throw new Error(`SqueekCore returned HTTP ${response.status}. Retrying automatically.`);
      const date = response.headers.get('Date');
      if (date && (!Number.isFinite(Date.parse(date)) || Math.abs(now - Date.parse(date)) > MAX_AGE)) throw new Error('The API response is stale or the device clock is incorrect.');
      if (Number(response.headers.get('Age') || 0) * 1000 > MAX_AGE) throw new Error('The cached API response is stale.');
      if (response.status === 304 && !this.cached) { this.etag = null; throw new Error('Received a conditional response without a verified snapshot.'); }
      const data = response.status === 304 ? this.cached! : parseCore(await response.json());
      if (this.cached && BigInt(data.chain.safeThroughBlock) < BigInt(this.cached.chain.safeThroughBlock)) throw new Error('The safe Ethereum block moved backwards. Waiting for a consistent snapshot.');
      if (data.chain.safeThroughBlock !== this.lastSafe) { this.lastSafe = data.chain.safeThroughBlock; this.lastSafeChanged = now; }
      if (now - this.lastSafeChanged > STALLED_HEAD) throw new Error('The safe Ethereum block has not advanced in five minutes. Current state is UNKNOWN.');
      this.cached = data;
      this.etag = response.status === 304 ? response.headers.get('ETag') || this.etag : response.headers.get('ETag');
      this.nextAt = now + 30_000;
      this.failures = 0;
      return { status: 'verified', data, checkedAt: now, reason: '', nextAt: this.nextAt, etag: this.etag };
    } catch (error) {
      this.failures++;
      this.nextAt = Math.max(this.nextAt, now + Math.min(300_000, 15_000 * 2 ** Math.min(this.failures, 4)));
      return { status: 'unknown', data: null, checkedAt: null, reason: error instanceof Error && error.name !== 'AbortError' ? error.message : 'SqueekCore could not be reached. Your outpost is still playable.', nextAt: this.nextAt, etag: this.etag };
    } finally { clearTimeout(timeout); this.fetching = false; }
  }
}
