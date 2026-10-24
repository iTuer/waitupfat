import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) && process.env.ALLOW_LIVE_TEST !== 'yes') throw new Error('Live tests require explicit opt-in');
const suffix = randomUUID().slice(0,8);
const password = randomUUID() + '!aA';
function client(){let cookies=new Map();const call=async(path,data,options={})=>{const res=await fetch(base+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json','Origin':base}:{}),Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...options.headers},body:data?JSON.stringify(data):undefined,redirect:'manual'});for(const header of res.headers.getSetCookie()){const [pair]=header.split(';'),i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}let body;try{body=await res.json();}catch{body={error:'Non-JSON response'};}return {status:res.status,body};};call.cookie=()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');return call;}
const a=client(),b=client(),anonymous=client();
const path='/api/app/';
assert.equal((await anonymous(path+'data')).status,401,'Anonymous records are blocked');
for (const [call,name] of [[a,'Test A'],[b,'Test B']]){
 const signup=await call('/api/auth/sign-up/email',{email:`${name.replace(' ','').toLowerCase()}-${suffix}@example.com`,password,name});
 assert.equal(signup.status,200,`Registration: ${JSON.stringify(signup.body)}`);
 assert.ok((await call('/api/auth/get-session')).body.user,'Registration establishes session');
}
const meal={id:randomUUID(),title:'测试：番茄鸡蛋面',kind:'午餐',emoji:'🍜',note:'integration test',visibility:'public',eatenAt:'2026-10-20T12:30'};
const privateMeal={...meal,id:randomUUID(),title:'测试：私密记录',visibility:'private'};
for (const m of [meal,privateMeal])assert.equal((await a(path+'meal',m)).status,200,'Create meal');
assert.equal((await a(path+'meal',meal)).status,200,'Idempotent retry');
let mine=(await a(path+'data?scope=mine')).body.meals;
assert.equal(mine.filter(x=>x.id===meal.id).length,1,'Retry does not duplicate meal');
assert.equal(mine.find(x=>x.id===meal.id).status,'pending','New public meal pending');
let square=(await b(path+'data?scope=square')).body.meals;
assert.ok(square.some(x=>x.id===meal.id),'Other account sees public meal');
assert.ok(!square.some(x=>x.id===privateMeal.id),'Other account cannot see private meal');
assert.ok(square.every(x=>!('email' in x)&&!('owner' in x)),'No account identifier leakage');
assert.equal((await b(path+'vote',{id:privateMeal.id,value:1})).status,404,'Cannot vote private meal by ID');
assert.equal((await b(path+'publish',{id:privateMeal.id})).status,404,'Cannot publish another user private meal');
assert.equal((await a(path+'vote',{id:meal.id,value:1})).status,403,'Self approval blocked');
assert.equal((await b(path+'vote',{id:meal.id,value:1})).status,200,'Another user approves');
assert.equal((await b(path+'vote',{id:meal.id,value:1})).status,200,'Duplicate vote updates');
mine=(await a(path+'data?scope=mine')).body.meals;
assert.equal(mine.find(x=>x.id===meal.id).up,1,'One person one vote');
assert.equal(mine.find(x=>x.id===meal.id).status,'approved','Approval reflects vote');
assert.equal((await b(path+'vote',{id:meal.id,value:-1})).status,200,'Vote change supported');
mine=(await a(path+'data?scope=mine')).body.meals;
assert.equal(mine.find(x=>x.id===meal.id).status,'declined','Changed vote recalculates status');
assert.equal((await b(path+'like',{id:meal.id,liked:true})).status,200);
assert.equal((await b(path+'like',{id:meal.id,liked:true})).status,200);
mine=(await a(path+'data?scope=mine')).body.meals;
assert.equal(mine.find(x=>x.id===meal.id).hearts,1,'Likes do not duplicate');
assert.equal((await b(path+'withdraw',{id:meal.id})).status,403,'Cannot withdraw others records');
assert.equal((await a(path+'publish',{id:privateMeal.id})).status,200,'Owner can explicitly publish');
assert.equal((await a(path+'meal',{...meal,id:randomUUID()},{headers:{Origin:'https://evil.example'}})).status,403,'CSRF blocked');
assert.equal((await a(path+'settings',{breakfast:'08:30',lunch:'12:00',dinner:'18:30',enabled:1})).status,200);
assert.equal((await a(path+'profile?day=2026-10-20')).body.settings.lunch,'12:00','Settings persisted');
for(const id of [meal.id,privateMeal.id])assert.equal((await a(path+'withdraw',{id})).status,200,'Withdraw test records');
assert.ok(!(await b(path+'data?scope=square')).body.meals.some(x=>[meal.id,privateMeal.id].includes(x.id)),'Withdrawn records hidden');
assert.equal((await a('/api/auth/sign-out',{})).status,200);
assert.equal((await a(path+'data')).status,401,'Logout invalidates session');
const login=await a('/api/auth/sign-in/email',{email:`testa-${suffix}@example.com`,password});
assert.equal(login.status,200,'Existing account can log back in');
console.log('PASS: 2-account signup/login, durable records, private isolation, one vote per user, self-approval prevention, vote changes, likes, ownership, CSRF, reminders, withdrawal, logout.');

if (process.env.TEST_FIXTURE_FILE) {
 const { writeFile } = await import('node:fs/promises');
 const persisted={...privateMeal,id:randomUUID(),title:'restart persistence check'};
 assert.equal((await a(path+'meal',persisted)).status,200);
 await writeFile(process.env.TEST_FIXTURE_FILE,JSON.stringify({cookie:a.cookie(),mealId:persisted.id}),{mode:0o600});
}
