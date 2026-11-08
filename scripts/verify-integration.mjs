import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// Public, unauthenticated reads only. The output contains deployment evidence, never local configuration.
const sources = {
  deployment: 'https://docs.squeekchain.com/assets/deployments/sepolia.json',
  schema: 'https://docs.squeekchain.com/assets/api/core.json',
  core: 'https://api.squeekchain.com/v1/core',
};
function get(url) { return execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '30', url], { encoding: 'utf8', maxBuffer: 1_000_000 }); }
const pinnedRecordText = await readFile('src/integration/sepolia.json', 'utf8');
const pinnedRecord = JSON.parse(pinnedRecordText);
const recordText = get(sources.deployment), record = JSON.parse(recordText);
const schemaText = get(sources.schema), schema = JSON.parse(schemaText);
const payload = JSON.parse(get(sources.core));
const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv);
for (const bits of [64, 96, 256]) ajv.addFormat(`uint${bits}-decimal`, { type: 'string', validate: s => /^(0|[1-9][0-9]*)$/.test(s) && s.length <= 78 && BigInt(s) < 2n ** BigInt(bits) });
const validate = ajv.compile(schema);
assert(validate(payload), JSON.stringify(validate.errors));
assert.equal(payload.status, 'available');
assert.equal(record.chainId, 11155111); assert.equal(payload.chain.chainId, String(record.chainId)); assert.equal(payload.chain.target, 'sepolia');
const expected = record.contracts.SqueekCore;
assert.deepEqual(expected, pinnedRecord.contracts.SqueekCore, 'The official Core record changed; review the bundled pin.');
assert.equal(expected.address, '0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4');
assert.equal(payload.identities.core, expected.address);
assert.equal(payload.identities.proxyImplementation, expected.implementation);
assert.equal(payload.identities.proxyAdmin, expected.proxyAdmin);
assert.equal(payload.identities.proxyAdminSlot, expected.proxyAdmin);
assert.equal(payload.identities.proxyAdminOwner, record.operational.governanceTimelock.address);
assert.equal(payload.identities.operatorTimelock, record.operational.governanceTimelock.address);
assert.equal(payload.identities.operatorProposer, record.operational.governanceSafe.address);
assert.equal(payload.implementation.codeAddress, expected.implementation);
assert.equal(payload.implementation.runtimeHash, expected.implementationRuntimeHash);
assert.equal(payload.implementation.storageLayoutDigest, expected.storageLayoutDigest);
assert.equal(payload.chain.deploymentBlock, String(expected.deployedAtBlock));
assert(BigInt(payload.chain.indexedThroughBlock) >= BigInt(payload.chain.safeThroughBlock));
assert.equal(BigInt(payload.core.cumulativeBlockUnits), BigInt(payload.core.blockHeight) * 1_000_000_000n + BigInt(payload.core.blockProgress));
const sha = s => createHash('sha256').update(s).digest('hex');
const evidence = {
  checkedAt: new Date().toISOString(), method: 'Live public HTTP GET; official JSON Schema validation and identity comparison. No independent Ethereum RPC proof.',
  sources, suppliedDeploymentUrl: { url: 'https://docs.squeekchain.com/sepolia.json', observedStatus: 404, resolution: 'Used the canonical record linked from the official Developers page.' },
  release: record.release, revision: record.revision, chain: payload.chain, identities: payload.identities, implementation: payload.implementation, settled: payload.core,
  recordSHA256: sha(recordText), schemaSHA256: sha(schemaText), officialSchemaValid: true, matchedOfficialRecord: true,
};
await mkdir('artifacts', { recursive: true });
await mkdir('docs', { recursive: true });
await writeFile('artifacts/sepolia-verification.json', JSON.stringify(evidence, null, 2) + '\n');
await writeFile('docs/sepolia-verification.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ verified: true, checkedAt: evidence.checkedAt, chainId: record.chainId, core: expected.address, height: payload.core.blockHeight, round: payload.core.settledThroughRound, work: payload.core.cumulativeWork, safeEthereumBlock: payload.chain.safeThroughBlock }, null, 2));
