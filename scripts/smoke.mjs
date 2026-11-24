// Smoke test: start the built server over stdio, list its tools, and cast one chart.
import { spawn } from 'node:child_process';

const EXPECTED = ['calculate_vedic_chart', 'calculate_dasha_periods', 'get_daily_panchang', 'calculate_jaimini_karakas', 'analyze_vastu_zone'];
const child = spawn(process.execPath, ['dist/index.js'], { stdio: ['pipe', 'pipe', 'inherit'] });
const pending = new Map();
let buf = '';
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
let nextId = 1;
const rpc = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
const fail = (m) => { console.error('SMOKE FAIL:', m); child.kill(); process.exit(1); };
setTimeout(() => fail('timed out after 20 s'), 20000).unref();

const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'ci-smoke', version: '1' } });
if (init.error) fail(JSON.stringify(init.error));
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

const list = await rpc('tools/list', {});
const names = (list.result?.tools ?? []).map((t) => t.name);
for (const n of EXPECTED) if (!names.includes(n)) fail(`missing tool ${n}; got ${names.join(', ')}`);

const chart = await rpc('tools/call', { name: 'calculate_vedic_chart', arguments: { birthDate: '1990-03-14', birthTime: '06:45', latitude: 26.91, longitude: 75.79, timezone: 'Asia/Kolkata' } });
if (chart.error || chart.result?.isError) fail(JSON.stringify(chart.error ?? chart.result));
const text = chart.result?.content?.[0]?.text ?? '';
if (!/Lagna|ascendant/i.test(text)) fail('chart response has no ascendant');

console.log(`SMOKE OK: ${names.length} tools, chart cast`);
child.kill();
process.exit(0);
