import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const compilacao = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'api/tsconfig.json', '--noEmit', 'false', '--outDir', 'work/compiled-api'], { stdio: 'inherit' });
if (compilacao.status !== 0) process.exit(compilacao.status || 1);
const { default: handler } = await import('../work/compiled-api/api/analisar-historico.js');
async function chamar(method) {
  let body;
  const res = { statusCode: 200, setHeader() {}, end(value) { body = JSON.parse(value); } };
  await handler({ method, headers: { 'content-type': 'application/json' }, body: {} }, res);
  return { status: res.statusCode, body };
}
const get = await chamar('GET');
assert.equal(get.status, 200); assert.equal(typeof get.body.configurada, 'boolean');
assert.equal((await chamar('POST')).status, 401);
console.log('PASS: função compilada para JavaScript carrega, responde status e recusa acesso sem login.');
