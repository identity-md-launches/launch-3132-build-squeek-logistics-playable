import { readdir, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rollup/parseAst';

const executionNames = new Set(['eval', 'Function']);
const propertyName = node => node?.computed ? node.property?.value : node?.property?.name;
function isExecutionTarget(node) {
  if (node?.type === 'Identifier') return executionNames.has(node.name);
  if (node?.type === 'MemberExpression') return executionNames.has(propertyName(node)) || isExecutionTarget(node.object);
  if (node?.type === 'SequenceExpression') return isExecutionTarget(node.expressions.at(-1));
  if (node?.type === 'ChainExpression') return isExecutionTarget(node.expression);
  return false;
}

export function assertCspCompatible(source, filename = 'bundle.js') {
  const failures = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const name = node.callee.type === 'Identifier' ? node.callee.name : propertyName(node.callee);
      const stringTimer = ['setTimeout', 'setInterval'].includes(name)
        && (typeof node.arguments[0]?.value === 'string' || node.arguments[0]?.type === 'TemplateLiteral');
      const reflected = node.callee.type === 'MemberExpression' && propertyName(node.callee) === 'construct'
        && isExecutionTarget(node.arguments[0]);
      if (isExecutionTarget(node.callee) || stringTimer || reflected) {
        const before = source.slice(0, node.start);
        const line = before.split('\n').length, column = node.start - before.lastIndexOf('\n');
        failures.push(`${filename}:${line}:${column}: ${source.slice(node.start, node.end).slice(0, 100)}`);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(parseAst(source));
  if (failures.length) throw new Error(`Runtime code evaluation is incompatible with CSP:\n${failures.join('\n')}`);
}

async function audit(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) count += await audit(path);
    else if (/\.(?:m?js)$/.test(entry.name)) {
      assertCspCompatible(await readFile(path, 'utf8'), relative(process.cwd(), path)); count++;
    }
  }
  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await audit(resolve(process.argv[2] || 'dist'));
  if (!count) throw new Error('No JavaScript bundles found to audit.');
  console.log(`PASS: ${count} production JavaScript bundles contain no eval/Function execution or string timers.`);
}
