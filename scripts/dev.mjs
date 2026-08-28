import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const childEnvironment = {
  ...process.env,
  OMB_GATEWAY_TOKEN: process.env.OMB_GATEWAY_TOKEN ?? randomBytes(32).toString('base64url'),
};

const children = [
  spawn('npm', ['--workspace', '@omb/gateway', 'run', 'dev'], { env: childEnvironment, stdio: 'inherit' }),
  spawn('npm', ['--workspace', '@omb/web', 'run', 'dev'], { env: childEnvironment, stdio: 'inherit' }),
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
