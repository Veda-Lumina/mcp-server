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

// Every tool documents itself: description, read-only annotations, and a description on every input.
for (const t of list.result.tools) {
  if ((t.description ?? '').length < 200) fail(`${t.name}: description too short`);
  if (t.annotations?.readOnlyHint !== true || t.annotations?.openWorldHint !== false) fail(`${t.name}: missing read-only annotations`);
  for (const [k, v] of Object.entries(t.inputSchema?.properties ?? {})) if (!v.description) fail(`${t.name}.${k}: no description`);
}
const vastu = list.result.tools.find((t) => t.name === 'analyze_vastu_zone');
if (vastu.inputSchema.properties.zone.enum.length !== 8) fail('analyze_vastu_zone must offer exactly the 8 supported directions');

// Bad input is an error, not a silently wrong chart.
const bad = await rpc('tools/call', { name: 'calculate_vedic_chart', arguments: { birthDate: '1990-13-45', birthTime: '06:45', latitude: 26.91, longitude: 75.79 } });
if (!bad.result?.isError) fail('an impossible date must return an error');

const chart = await rpc('tools/call', { name: 'calculate_vedic_chart', arguments: { birthDate: '1990-03-14', birthTime: '06:45', latitude: 26.91, longitude: 75.79, timezone: 'Asia/Kolkata' } });
if (chart.error || chart.result?.isError) fail(JSON.stringify(chart.error ?? chart.result));
const text = chart.result?.content?.[0]?.text ?? '';
if (!/Lagna|ascendant/i.test(text)) fail('chart response has no ascendant');

console.log(`SMOKE OK: ${names.length} tools, chart cast`);
child.kill();
process.exit(0);
