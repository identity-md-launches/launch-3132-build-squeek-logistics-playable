import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { assertCspCompatible } from '../scripts/check-csp.mjs';
import { generateCoreValidator } from '../scripts/generate-core-validator.mjs';
import validate from '../src/integration/core-validator.generated.mjs';
import { uintFormats } from '../src/integration/unsigned-decimal.mjs';
import schema from '../src/integration/core.schema.json';
import observed from './fixtures/core-observed.json';

describe('CSP-compatible Core validation', () => {
  it('commits the exact generated output of the official schema and shared formats', async () => {
    await expect(generateCoreValidator({ check: true })).resolves.toBeUndefined();
  });

  it('loads and validates in a Node process that forbids string code generation', () => {
    const result = spawnSync(process.execPath, ['--disallow-code-generation-from-strings', '--input-type=module', '-e', `
      import validate from './src/integration/core-validator.generated.mjs';
      import { readFileSync } from 'node:fs';
      const input = JSON.parse(readFileSync('tests/fixtures/core-observed.json', 'utf8'));
      if (!validate(input) || validate({}) || validate({...input, schemaVersion: 2})) process.exit(1);
    `], { encoding: 'utf8' });
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  });

  it('preserves full schema behavior, uint bounds, Unicode length and event constraints', () => {
    // Ajv is used only in this Node test as a parity oracle, never by the app.
    const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv);
    for (const [name, format] of Object.entries(uintFormats)) ajv.addFormat(name, format);
    const original = ajv.compile(schema);
    const samples: unknown[] = [observed, null, [], {}, true, 'not a payload',
      { schemaVersion: 1, installationId: 'test', status: 'unavailable', reason: 'indexer_unavailable' }];
    const variant = (modify: (input: typeof observed) => void) => {
      const input = structuredClone(observed); modify(input); samples.push(input);
    };
    variant(v => { v.schemaVersion = 2; });
    variant(v => { Object.assign(v, { unexpected: 'property' }); });
    variant(v => { Object.assign(v.core, { unexpected: 1 }); });
    variant(v => { delete (v as Partial<typeof observed>).implementation; });
    variant(v => { v.installationId = ''; });
    variant(v => { v.installationId = '🐹'.repeat(128); });
    variant(v => { v.installationId = '🐹'.repeat(129); });
    variant(v => { v.identities.core = '0xINVALID'; });
    variant(v => { Object.assign(v.core, { paused: 'false' }); });
    variant(v => { Object.assign(v.chain, { chainId: 11155111 }); });
    variant(v => { v.chain.confirmations = '11'; });
    variant(v => { v.events = Array.from({ length: 26 }, () => structuredClone(observed.events[0])); });
    variant(v => { if (v.events[0]) v.events[0].eventName = 'UnknownEvent'; });
    for (const [path, bits] of [['cumulativeWork', 64], ['cumulativeBlockUnits', 96], ['authorizationNonce', 256]] as const) {
      for (const value of ['0', '01', '-1', '1.5', '1e3', ' 1', '1\n', 'x'.repeat(1000), String(2n ** BigInt(bits) - 1n), String(2n ** BigInt(bits))]) {
        variant(v => { v.core[path] = value; });
      }
    }
    for (const input of samples) expect(validate(input), JSON.stringify(input).slice(0, 200)).toBe(original(input));
    expect(validate(observed)).toBe(true);
    expect(validate({ ...observed, core: { ...observed.core, cumulativeWork: String(2n ** 64n) } })).toBe(false);
    expect(validate({ ...observed, core: { ...observed.core, cumulativeBlockUnits: String(2n ** 96n) } })).toBe(false);
    expect(validate({ ...observed, core: { ...observed.core, authorizationNonce: String(2n ** 256n) } })).toBe(false);
  });

  it('has no runtime compilation in its generated source', () => {
    assertCspCompatible(readFileSync('src/integration/core-validator.generated.mjs', 'utf8'));
  });
});

describe('production runtime evaluation guard', () => {
  it.each([
    'eval("payload")', '(0, eval)("payload")', 'globalThis["eval"]("payload")',
    'new Function("return 1")', 'Function("return 1")', 'window.Function("return 1")',
    'Function.call(null, "return 1")', 'Reflect.construct(Function, ["return 1"])',
    'setTimeout("doWork()", 1)', 'window.setInterval(`doWork()`, 1)',
  ])('rejects executable strings: %s', source => {
    expect(() => assertCspCompatible(source)).toThrow(/incompatible with CSP/);
  });
  it('allows normal functions, callback timers and text mentioning eval', () => {
    expect(() => assertCspCompatible('const text = "new Function() and eval()"; setTimeout(() => console.log(text), 1);')).not.toThrow();
  });
});
