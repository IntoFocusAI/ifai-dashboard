// ---- Connect retry (added 23 Nov 2026) ----
// Toolbelt connects a wrench's MCP servers once, when the run starts. If that fails, every callTool to
// that server throws "could not be connected" and the run used to fail in under a second. Before any
// work, this checks each required server with listTools (no tool is called). If one is missing, it waits
// 10 s (then 20 s) and runs this same wrench again as a new execution, which connects again. Nothing has
// been read or written at that point, so a retry cannot repeat a write. Other errors are not retried.
// The original wrench code is unchanged below; its run() is renamed __runMain().
const __CR = __CR_CONFIG__;
async function __crMissing() {
  const missing = [];
  await Promise.all(__CR.servers.map(async s => {
    try { await listTools(s); }
    catch (e) { const m = String((e && e.message) || e); if (/could not be connected/i.test(m)) missing.push(m); }
  }));
  return missing;
}
async function run(inputs) {
  const all = inputs || {};
  const clean = {};
  for (const k of Object.keys(all)) if (k !== '_connectAttempt' && k !== '_connectDeadline') clean[k] = all[k];
  const attempt = Number(all._connectAttempt || 0);
  const stepMs = typeof __CR.stepMs === 'number' ? __CR.stepMs : (__CR.stepMs[clean.action] || __CR.stepMs.default);
  const deadline = Number(all._connectDeadline || (Date.now() + stepMs - 20000));
  const missing = await __crMissing();
  if (!missing.length) return __runMain(clean);
  if (attempt >= __CR.waits.length) throw new Error(missing[0] + ` (still not connected after ${attempt} retries)`);
  const wait = __CR.waits[attempt];
  if (Date.now() + wait + 30000 > deadline) throw new Error(missing[0] + ' (no time left in this step to retry)');
  console.log(`connect retry ${attempt + 1}: ${missing.length} server(s) not connected; waiting ${wait / 1000}s, then running again`);
  await new Promise(r => setTimeout(r, wait));
  const r = await callTool('workspace', 'wrench_execute', {
    wrenchId: __CR.self,
    inputs: Object.assign({}, clean, { _connectAttempt: attempt + 1, _connectDeadline: deadline }),
    timeout: Math.max(30000, deadline - Date.now())
  });
  const text = r && typeof r.text === 'string' ? r.text : (typeof r === 'string' ? r : JSON.stringify(r));
  if (!/executed successfully/i.test(text)) throw new Error(`connect retry ${attempt + 1} failed: ` + String(text).slice(0, 1500));
  const i = text.indexOf('Outputs:');
  let out = null;
  if (i >= 0) { try { out = JSON.parse(text.slice(i + 8).split('\n\nLogs:')[0].trim()); } catch (_) { out = null; } }
  if (out && typeof out === 'object' && !Array.isArray(out)) return Object.assign({}, out, { connectRetry: attempt + 1 });
  return { connectRetry: attempt + 1, retryOutput: String(text).slice(0, 4000) };
}
// ---- end connect retry ----
