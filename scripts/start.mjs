import { spawn } from 'node:child_process';
import { migrate } from './migrate.mjs';

try {
  const secret = process.env.BETTER_AUTH_SECRET || '';
  if (secret.length < 32 || secret.startsWith('replace-with-')) throw new Error('Set a random BETTER_AUTH_SECRET (32+ characters) in Render Environment');
  const origin = new URL(process.env.BETTER_AUTH_URL || '');
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1','localhost'].includes(origin.hostname))) throw new Error('BETTER_AUTH_URL must use HTTPS');
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('BETTER_AUTH_URL must contain only the site origin');
  await migrate();
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', process.env.PORT || '3000'], { stdio: 'inherit' });
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => { process.exitCode = code ?? 0; });
  child.on('error', () => { console.error('Could not start the web server'); process.exitCode = 1; });
} catch (error) { console.error(error.message); process.exitCode = 1; }
