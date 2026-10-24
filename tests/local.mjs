import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';

const freePort = async () => {
  const server = createServer();
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
};
const db = await PGlite.create();
const dbPort = await freePort(), webPort = await freePort();
const socket = new PGLiteSocketServer({ db, host:'127.0.0.1', port:dbPort });
const folder = await mkdtemp(join(tmpdir(),'waitupfat-test-'));
const base = `http://127.0.0.1:${webPort}`;
const env = {...process.env, NODE_ENV:'production', NEXT_TELEMETRY_DISABLED:'1', PORT:String(webPort), DATABASE_URL:`postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres?sslmode=disable`, PG_POOL_MAX:'1', BETTER_AUTH_URL:base, BETTER_AUTH_SECRET:randomBytes(32).toString('hex'), TEST_BASE_URL:base, TEST_FIXTURE_FILE:join(folder,'fixture.json')};
let app;
const run = (file) => new Promise((resolve,reject) => {
 const child=spawn(process.execPath,[file],{env,stdio:'inherit'});
 child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${file} exited ${code}`)));
});
async function start() {
 app=spawn(process.execPath,['scripts/start.mjs'],{env,stdio:'inherit'});
 for(let i=0;i<90;i++) {
  if(app.exitCode!==null) throw new Error('Web process exited before health check');
  try { if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)})).ok) return; } catch {}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error('Local test server did not become ready');
}
async function stop() {
 if(!app || app.exitCode!==null) return;
 const exiting=once(app,'exit');app.kill('SIGTERM');
 await exiting;
}
try {
 await socket.start();
 await start();
 if (process.argv.includes('--preview')) {
  console.log(`PREVIEW ${base}`);
  await new Promise(resolve => { process.once('SIGINT',resolve); process.once('SIGTERM',resolve); });
 } else {
 const html=await (await fetch(base)).text();
 assert.ok(html.includes('嘴巴等等我'),'App HTML renders');
 await run('tests/flows.mjs');
 const before=await db.query('SELECT COUNT(*)::int n FROM meals');
 await stop();
 await start(); // The startup migration must be safe to run again.
 const after=await db.query('SELECT COUNT(*)::int n FROM meals');
 assert.equal(after.rows[0].n,before.rows[0].n,'Restart and migration preserve records');
 const fixture=JSON.parse(await readFile(env.TEST_FIXTURE_FILE,'utf8'));
 const response=await fetch(base+'/api/app/data?scope=mine',{headers:{cookie:fixture.cookie}});
 assert.equal(response.status,200,'Session survives application restart');
 assert.ok((await response.json()).meals.some(m=>m.id===fixture.mealId && m.visibility==='private'),'Private record survives restart');
 console.log('PASS: production build, database migrations, session and private record survive restart.');
 }
} finally {
 await stop(); await socket.stop(); await db.close(); await rm(folder,{recursive:true,force:true});
}
