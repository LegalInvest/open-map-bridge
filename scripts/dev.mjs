import { spawn } from 'node:child_process';

const children = [
  spawn('npm', ['--workspace', '@omb/gateway', 'run', 'dev'], { stdio: 'inherit' }),
  spawn('npm', ['--workspace', '@omb/web', 'run', 'dev'], { stdio: 'inherit' }),
];

let shuttingDown = false;

function stop(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop();
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`development child exited (${signal ?? code ?? 'unknown'})`);
    stop();
    process.exitCode = code && code > 0 ? code : 1;
  });
}
