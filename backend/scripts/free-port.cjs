/**
 * Runs before `npm run dev`. On Windows, closing a terminal or pressing Ctrl+C
 * often leaves the tsx child processes of a previous `npm run dev` alive,
 * which makes the next start fail with EADDRINUSE on port 4000. This stops any
 * leftover API/worker processes of this backend so the new run starts clean.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const backendDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4000);

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return '';
  }
}

if (process.platform === 'win32') {
  const script = `
    $dir = '${backendDir.replace(/'/g, "''")}'
    $ids = @()
    $ids += (Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess
    $ids += (Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object { $_.CommandLine -like "*$dir*" -and ($_.CommandLine -like '*server.ts*' -or $_.CommandLine -like '*worker.ts*') }).ProcessId
    $ids | Where-Object { $_ -and $_ -ne ${process.pid} } | Sort-Object -Unique | ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; $_
    }`;
  // -EncodedCommand (base64 UTF-16LE) sidesteps all shell quoting issues.
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  // Absolute path: powershell is not always on PATH (e.g. Git Bash).
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const stopped = run(`"${powershell}" -NoProfile -NonInteractive -EncodedCommand ${encoded}`)
    .split(/\s+/)
    .filter(Boolean);
  if (stopped.length) console.log(`[predev] Stopped ${stopped.length} leftover backend process(es).`);
} else {
  const pids = run(`lsof -ti tcp:${port}`).split(/\s+/).filter(Boolean);
  for (const pid of pids) run(`kill -9 ${pid}`);
  if (pids.length) console.log(`[predev] Freed port ${port}.`);
}
