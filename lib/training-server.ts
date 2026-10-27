import { env } from 'cloudflare:workers';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { assets } from './training-assets';

type Row = Record<string, any>;
type Database = D1Database;
const COOKIE = 'training_session', TTL = 8 * 3600, IDLE = 3600;
const ROLES = ['admin', 'coordinator', 'member', 'viewer'];
const DOCS = ['التقرير الختامي','الشواهد','ملف الحضور','ملف التقييم'];
const STATUSES = ['تحت الإعداد','مجدولة','جارٍ التنفيذ','منتهية','مغلقة','ملغاة'];
const TASK_STATUSES = ['غير مكتمل','تحت العمل','مكتمل'];
const PATHS = [
  ['المسار العام',['برنامج الثقافة المالية','برنامج مهارات المستقبل','برنامج السلوك المهني','برنامج البحث والابتكار العلمي']],
  ['المسار التخصصي',['برنامج المهارات الصحية التطبيقية','برنامج التقنيات والحلول العلمية','برنامج الإدارة والريادة المؤسسية','برنامج الدراسات والمهارات الإنسانية']],
  ['مسار المبادرات الطلابية',['برنامج القيادة والتأثير الطلابي','برنامج الأدوات الابتكارية','برنامج المهارات الإعلامية','برنامج صناعة المشاريع الطلابية']],
  ['المسار المهني',['برنامج التمكين الاحترافي','برنامج ريادة الأعمال','برنامج الشهادات التقنية والرقمية','برنامج الشهادات الاحترافية الإدارية']],
] as const;
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, message: string): never { throw new HttpError(status, message); }
const now = () => Math.floor(Date.now()/1000);
const hex = () => randomBytes(16).toString('hex');
const secret = () => randomBytes(32).toString('base64url');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const json = (data: unknown, status=200, headers: HeadersInit={}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const publicUser = (r: Row) => ({ id:r.id, name:r.name, email:r.email, role:r.role, active:r.active });
const get = (db: Database, sql: string, ...params: any[]): Promise<Row|null> => db.prepare(sql).bind(...params).first();
const all = async (db: Database, sql: string, ...params: any[]) => (await db.prepare(sql).bind(...params).all()).results as Row[];
const statement = (db: Database, sql: string, ...params: any[]) => db.prepare(sql).bind(...params);
const audit = (db: Database, user: Row, action: string, entity: string, id: string) => statement(db, 'INSERT INTO audit_logs(action,entity,entity_id,created_at,actor_id,actor_name) VALUES(?,?,?,?,?,?)', action,entity,id,new Date().toISOString(),user.id,user.name);
function text(v: unknown, max: number, required=false): string {
  if (typeof v!=='string' || v.length>max || (required&&!v.trim())) fail(400,'Please check the entered values.');
  return v as string;
}
function email(value: unknown) {
  const s=text(value,254,true).trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(s) || s.startsWith('.') || s.includes('..') || s.includes('.@')) fail(400,'Enter a valid email address.');
  return s;
}
function password(value: unknown, identity: {email:string,name:string}) {
  const s=text(value,128), lower=s.toLowerCase();
  if(s.length<15) fail(400,'Use a password between 15 and 128 characters.');
  const common=['password','qwerty','123456','letmein','welcome','iloveyou','admin','changeme'];
  const parts=[identity.email.split('@')[0],...identity.name.toLowerCase().split(/\s+/)].filter(p=>p.length>=4);
  if(new Set(lower).size<5 || /^\d+$/.test(s) || common.some(p=>lower.includes(p)) || parts.some(p=>lower.includes(p))) fail(400,'Choose a less predictable password without your name or email.');
  return s;
}
function account(v: Row, optionalPassword=false) {
  const result={name:text(v.name,100,true).trim(),email:email(v.email),role:v.role??'member',active:v.active===undefined?1:Number(v.active===true),password:v.password??''};
  if(!ROLES.includes(result.role)) fail(400,'Invalid role.');
  if(v.active!==undefined && typeof v.active!=='boolean') fail(400,'Please check the entered values.');
  if(!optionalPassword||result.password) password(result.password,result);
  return result;
}
async function derive(value: string, salt: string): Promise<Buffer> {
  // Memory-bounded scrypt: 32 MiB, three passes. Native Workers crypto, no JS KDF.
  return new Promise((resolve,reject)=>scrypt(value,Buffer.from(salt,'hex'),32,{N:32768,r:8,p:3,maxmem:48*1024*1024},(e,key)=>e?reject(e):resolve(key)));
}
async function passwordHash(value: string) { const salt=hex(); return `scrypt$32768$8$3$${salt}$${(await derive(value,salt)).toString('hex')}`; }
async function passwordMatches(value: string, stored: string) {
  const parts=stored.split('$');
  if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$32768$8$3') return false;
  const expected=Buffer.from(parts[5],'hex'), actual=await derive(value,parts[4]);
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
function cookie(request: Request) { return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''; }
async function session(db: Database, request: Request) {
  const token=cookie(request); if(!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const s=await get(db,`SELECT u.*,s.token_hash,s.csrf_token,s.last_seen FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND s.last_seen>? AND u.active=1 AND s.credential_version=u.credential_version`,hash(token),now(),now()-IDLE);
  if(s&&s.last_seen<now()-60) await statement(db,'UPDATE auth_sessions SET last_seen=? WHERE token_hash=?',now(),s.token_hash).run();
  return s;
}
function canSetup(request: Request) {
  const e=(env as any).OWNER_PLATFORM_EMAIL;
  return !!e && !!request.headers.get('oai-authenticated-user-id') && request.headers.get('oai-authenticated-user-email')?.toLowerCase()===e.toLowerCase();
}
async function rate(db: Database, request: Request, kind: string, mail: string) {
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const buckets=[[hash(kind+':ip:'+ip),40],[hash(kind+':email:'+mail),8]] as const;
  const stamp=now(), cutoff=stamp-900;
  const entries=await db.batch(buckets.map(([key])=>statement(db,`INSERT INTO auth_attempts(bucket,window_start,attempts) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END, attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END RETURNING attempts`,key,stamp,cutoff,cutoff)));
  if(entries.some((r,i)=>(r.results[0] as Row).attempts>buckets[i][1])) fail(429,'Too many attempts. Try again in 15 minutes.');
  // Bounded stale-row cleanup; no unbounded cleanup on the request path.
  await statement(db,'DELETE FROM auth_attempts WHERE bucket IN (SELECT bucket FROM auth_attempts WHERE window_start<? LIMIT 50)',cutoff).run();
}
async function issue(db: Database, request: Request, user: Row) {
  const token=secret(),csrf=secret();
  const changes=[statement(db,'INSERT INTO auth_sessions(token_hash,user_id,csrf_token,expires_at,last_seen,credential_version) SELECT ?,id,?,?,?,credential_version FROM users WHERE id=? AND active=1 AND credential_version=?',hash(token),csrf,now()+TTL,now(),user.id,user.credential_version)];
  if(cookie(request)) changes.unshift(statement(db,'DELETE FROM auth_sessions WHERE token_hash=?',hash(cookie(request))));
  const inserted=(await db.batch(changes)).at(-1)!;
  if(!inserted.meta.changes) fail(401,'Email or password is incorrect.');
  return json({user:publicUser(user),csrf_token:csrf},200,{'Set-Cookie':`${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL}${new URL(request.url).protocol==='https:'?'; Secure':''}`});
}
function requireRole(user: Row, roles: string[]) { if(!roles.includes(user.role)) fail(403,roles.length===1?'Only the leader can manage accounts and approvals.':'Your role cannot make this change.'); }
function date(s: unknown) {
  const value=text(s,10,true);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value) fail(400,'Invalid date.');
  return value;
}
function occurrences(e: Row) {
  if(e.schedule==='custom') return e.custom_dates;
  if(e.schedule==='single') return [e.start];
  const result=[];
  for(let stamp=Date.parse(e.start+'T12:00Z');stamp<=Date.parse(e.end+'T12:00Z');stamp+=86400000) {
    const d=new Date(stamp);if(e.schedule==='consecutive'||e.days.includes(d.getUTCDay())) result.push(d.toISOString().slice(0,10));
  }
  return result;
}
function eventOut(r: Row) { const e={...r,days:JSON.parse(r.days),custom_dates:JSON.parse(r.custom_dates)};return {...e,sessions:occurrences(e)}; }
async function eventInput(db: Database,v: Row) {
  const e={name:text(v.name,200,true).trim(),program_id:v.program_id,start:date(v.start),end:date(v.end),schedule:v.schedule,days:v.days??[],custom_dates:(v.custom_dates??[]).map(date),time_start:v.time_start??'16:00',time_end:v.time_end??'18:00',owner:text(v.owner??'',100),status:v.status??'مجدولة'};
  if(!await get(db,'SELECT id FROM programs WHERE id=?',e.program_id)) fail(400,'البرنامج غير موجود');
  if(!STATUSES.includes(e.status)) fail(400,'حالة غير صالحة');
  if(!['single','consecutive','weekly','custom'].includes(e.schedule)) fail(400,'نمط غير صالح');
  if(e.end<e.start||Date.parse(e.end)-Date.parse(e.start)>366*86400000) fail(400,'الفترة غير صالحة أو أطول من عام');
  if(![e.time_start,e.time_end].every(t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||e.time_end<=e.time_start) fail(400,'وقت غير صالح');
  if(!Array.isArray(e.days)||e.days.some((n:any)=>!Number.isInteger(n)||n<0||n>6)||(e.schedule==='weekly'&&!e.days.length)) fail(400,'اختاري أيام اللقاءات');
  if(e.custom_dates.length>367||e.custom_dates.some((d:string)=>d<e.start||d>e.end)||!occurrences(e).length) fail(400,'مواعيد اللقاءات يجب أن تقع داخل فترة الفعالية');
  return e;
}
const eventValues = (e: Row) => [e.name,e.program_id,e.start,e.end,e.schedule,JSON.stringify(e.days),JSON.stringify(e.custom_dates),e.time_start,e.time_end,e.owner,e.status];
async function taskInput(db: Database,v: Row,old: Row|null) {
  const t={title:text(v.title,200,true).trim(),owner:text(v.owner??'',100),due:date(v.due),priority:v.priority??'متوسطة',status:v.status??'غير مكتمل',event_id:v.event_id||null,notes:text(v.notes??'',20000),assignee_id:'assignee_id' in v?(v.assignee_id||null):(old?.assignee_id??null)};
  if(!TASK_STATUSES.includes(t.status)||!['منخفضة','متوسطة','عالية'].includes(t.priority)) fail(400,'حالة غير صالحة');
  if(t.event_id&&!await get(db,'SELECT id FROM events WHERE id=?',text(t.event_id,64))) fail(400,'The linked event no longer exists.');
  if(t.assignee_id) {
    const person=await get(db,'SELECT name,active FROM users WHERE id=?',text(t.assignee_id,64));
    if(!person||(!person.active&&old?.assignee_id!==t.assignee_id)) fail(400,'This assignee is unavailable. Refresh and choose an active account.');
    t.owner=person.name;
  }
  return t;
}
const taskValues=(t:Row)=>[t.title,t.owner,t.due,t.priority,t.status,t.event_id,t.notes,t.assignee_id];
async function ensureCatalog(db: Database) {
  if(await get(db,'SELECT id FROM programs WHERE id=401')) return;
  const statements=[];
  for(let i=0;i<PATHS.length;i++) {
    statements.push(statement(db,'INSERT OR IGNORE INTO paths(id,name) VALUES(?,?)',i+1,PATHS[i][0]));
    PATHS[i][1].forEach((p,j)=>statements.push(statement(db,'INSERT OR IGNORE INTO programs(id,path_id,name) VALUES(?,?,?)',(i+1)*100+j+1,i+1,p)));
  }
  await db.batch(statements);
}

async function dispatch(request: Request) {
  const db=env.DB;if(!db) fail(503,'Workspace storage is unavailable.');
  const url=new URL(request.url), path=decodeURI(url.pathname), method=request.method;
  const user=await session(db,request);
  if(!path.startsWith('/api/')) {
    let name=path==='/'?'/static/index.html':['/login','/signup'].includes(path)?'/static/auth.html':path;
    if(name==='/static/index.html'&&!user) return new Response(null,{status:303,headers:{Location:'/login'}});
    if(['/login','/signup'].includes(path)&&user) return new Response(null,{status:303,headers:{Location:'/'}});
    const asset=assets[name];
    if(!asset) return new Response('Not found',{status:404});
    return new Response(asset.body,{headers:{'Content-Type':asset.type}});
  }
  const publicRoute=['/api/auth/status','/api/auth/login','/api/auth/signup'].includes(path);
  if(!publicRoute&&!user) fail(401,'Please log in to continue.');
  const writes=!['GET','HEAD','OPTIONS'].includes(method);
  let v:Row={};
  if(writes) {
    const origin=request.headers.get('origin'), fetchSite=request.headers.get('sec-fetch-site');
    if((origin&&origin!==url.origin)||fetchSite==='cross-site') fail(403,'Request origin was rejected.');
    if(!publicRoute&&request.headers.get('x-csrf-token')!==user!.csrf_token) fail(403,'Refresh the page and try again.');
    if(!request.headers.get('content-type')?.startsWith('application/json')) fail(415,'JSON requests are required.');
    if(Number(request.headers.get('content-length'))>65536) fail(413,'Request is too large.');
    const raw=await request.text();if(raw.length>65536) fail(413,'Request is too large.');
    try {v=raw?JSON.parse(raw):{};} catch {fail(400,'Please check the entered values.');}
    if(!v||Array.isArray(v)||typeof v!=='object') fail(400,'Please check the entered values.');
  }
  if(path==='/api/auth/status'&&method==='GET') {
    const setup=!await get(db,"SELECT key FROM app_settings WHERE key='admin_setup'");
    return json({setup_required:setup,admin_setup_allowed:setup&&canSetup(request),registration_open:false,reserved_email:setup&&canSetup(request)?(env as any).ADMIN_EMAIL:undefined});
  }
  if(path==='/api/auth/signup'&&method==='POST') {
    if(!canSetup(request)) fail(403,'Only the site owner can set up the administrator.');
    if(await get(db,"SELECT key FROM app_settings WHERE key='admin_setup'")) fail(403,'Accounts are created by your leader.');
    const a=account({...v,role:'admin',active:true});
    if(!(env as any).ADMIN_EMAIL||a.email!==(env as any).ADMIN_EMAIL.toLowerCase()) fail(403,'Use the reserved administrator email.');
    await rate(db,request,'setup',a.email);
    const id=hex(),hashed=await passwordHash(a.password),platformId=request.headers.get('oai-authenticated-user-id');
    const initial={id,...a,credential_version:1};
    try { await db.batch([
      statement(db,"INSERT INTO app_settings(key,value) VALUES('admin_setup',?)",id),
      statement(db,'INSERT INTO users(id,name,email,role,active,password_hash,created_at,platform_user_id) VALUES(?,?,?,?,?,?,?,?)',id,a.name,a.email,'admin',1,hashed,new Date().toISOString(),platformId),
      audit(db,initial,'signup','user',id),
    ]); } catch(e) {if(await get(db,"SELECT key FROM app_settings WHERE key='admin_setup'")) fail(409,'Administrator setup is already complete.');throw e;}
    return issue(db,request,initial);
  }
  if(path==='/api/auth/login'&&method==='POST') {
    const mail=email(v.email),pw=text(v.password,128);await rate(db,request,'login',mail);
    const candidate=await get(db,'SELECT * FROM users WHERE email=?',mail);
    // A valid dummy KDF keeps unknown-email and wrong-password attempts comparable.
    const stored=candidate?.password_hash||'scrypt$32768$8$3$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
    const valid=await passwordMatches(pw,stored);
    if(!candidate||!candidate.active||!valid) fail(401,'Email or password is incorrect.');
    await db.batch([statement(db,'DELETE FROM auth_attempts WHERE bucket=?',hash('login:email:'+mail)),audit(db,candidate,'login','user',candidate.id)]);
    return issue(db,request,candidate);
  }
  if(path==='/api/auth/me'&&method==='GET') return json({user:publicUser(user!),csrf_token:user!.csrf_token});
  if(path==='/api/auth/logout'&&method==='POST') {
    await db.batch([statement(db,'DELETE FROM auth_sessions WHERE token_hash=?',user!.token_hash),audit(db,user!,'logout','user',user!.id)]);
    return json({ok:true},200,{'Set-Cookie':`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${url.protocol==='https:'?'; Secure':''}`});
  }
  if(path==='/api/meta'&&method==='GET') {await ensureCatalog(db);return json({paths:await all(db,'SELECT * FROM paths ORDER BY id'),programs:await all(db,'SELECT * FROM programs ORDER BY id'),docs:DOCS,statuses:STATUSES});}
  if(path==='/api/team'&&method==='GET') return json(await all(db,'SELECT id,name,role FROM users WHERE active=1 ORDER BY name,id'));
  if(path==='/api/workspace/revision'&&method==='GET') return json(await get(db,'SELECT COALESCE(MAX(id),0) AS revision FROM audit_logs'));
  if(path==='/api/audit'&&method==='GET') {requireRole(user!,['admin']);return json(await all(db,'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100'));}
  if(path==='/api/users'&&method==='GET') {requireRole(user!,['admin']);return json(await all(db,'SELECT id,name,email,role,active,1 AS has_login FROM users ORDER BY name'));}
  const userMatch=path.match(/^\/api\/users(?:\/([a-f0-9]{32}))?$/);
  if(userMatch&&['POST','PUT'].includes(method)) {
    if((method==='POST'&&userMatch[1])||(method==='PUT'&&!userMatch[1])) fail(404,'Not found.');
    requireRole(user!,['admin']);const id=userMatch[1],a=account(v,method==='PUT');
    const duplicate=await get(db,'SELECT id FROM users WHERE email=?',a.email);
    if(duplicate&&duplicate.id!==id) fail(409,'This email address is already in use.');
    const hashed=a.password?await passwordHash(a.password):null;
    if(method==='POST'&&!id) {
      const ident=hex();await db.batch([statement(db,'INSERT INTO users(id,name,email,role,active,password_hash,created_at) VALUES(?,?,?,?,?,?,?)',ident,a.name,a.email,a.role,a.active,hashed,new Date().toISOString()),audit(db,user!,'create','user',ident)]);
      return json({id:ident});
    }
    if(method==='PUT'&&id) {
      const old=await get(db,'SELECT * FROM users WHERE id=?',id);if(!old) fail(404,'Account not found.');
      const revoke=!!hashed||a.role!==old.role||!a.active||a.email!==old.email;
      // The last-leader condition lives in the atomic UPDATE, including concurrent edits.
      const updated=await statement(db,`UPDATE users SET name=?,email=?,role=?,active=?,password_hash=COALESCE(?,password_hash),credential_version=credential_version+? WHERE id=? AND (role<>'admin' OR active=0 OR (?='admin' AND ?=1) OR (SELECT COUNT(*) FROM users WHERE role='admin' AND active=1)>1)`,a.name,a.email,a.role,a.active,hashed,Number(revoke),id,a.role,a.active).run();
      if(!updated.meta.changes) fail(409,'Keep at least one active leader account.');
      await audit(db,user!,'update','user',id).run();return json({ok:true});
    }
  }
  if(path==='/api/events'&&method==='GET') return json((await all(db,'SELECT * FROM events ORDER BY start,name')).map(eventOut));
  const eventMatch=path.match(/^\/api\/events(?:\/([a-f0-9]{32}))?(\/close)?$/);
  if(eventMatch) {
    const id=eventMatch[1],close=eventMatch[2];
    if(close&&method==='POST') {
      requireRole(user!,['admin']);
      const result=await statement(db,`UPDATE events SET status='مغلقة' WHERE id=? AND status IN ('منتهية','مغلقة') AND (SELECT COUNT(*) FROM documents WHERE event_id=? AND present=1 AND approved=1)=4`,id,id).run();
      if(!result.meta.changes) fail(409,'Approve the four documents and finish the event before closing.');
      await audit(db,user!,'close','event',id).run();return json({ok:true});
    }
    requireRole(user!,['admin','coordinator']);
    if(method==='DELETE'&&id) {await db.batch([statement(db,'DELETE FROM events WHERE id=?',id),audit(db,user!,'delete','event',id)]);return json({ok:true});}
    if(['POST','PUT'].includes(method)&&!close) {
      await ensureCatalog(db);const e=await eventInput(db,v);
      if(method==='POST'&&!id) {
        if(e.status==='مغلقة') fail(409,'Approve the four documents before closing an event.');
        const ident=hex();await db.batch([
          statement(db,'INSERT INTO events(id,name,program_id,start,end,schedule,days,custom_dates,time_start,time_end,owner,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',ident,...eventValues(e),new Date().toISOString()),
          ...DOCS.map(kind=>statement(db,'INSERT INTO documents(event_id,kind) VALUES(?,?)',ident,kind)),audit(db,user!,'create','event',ident),
        ]);return json({id:ident});
      }
      if(method==='PUT'&&id) {
        const old=await get(db,'SELECT status FROM events WHERE id=?',id);if(!old) fail(404,'غير موجود');
        if(old.status==='مغلقة'&&user!.role!=='admin') fail(403,'Only the leader can reopen a closed event.');
        if(e.status==='مغلقة'&&user!.role!=='admin') fail(403,'Only the leader can close an event.');
        const updated=await statement(db,`UPDATE events SET name=?,program_id=?,start=?,end=?,schedule=?,days=?,custom_dates=?,time_start=?,time_end=?,owner=?,status=? WHERE id=? AND (status<>'مغلقة' OR ?='admin') AND (?<>'مغلقة' OR (SELECT COUNT(*) FROM documents WHERE event_id=? AND present=1 AND approved=1)=4)`,...eventValues(e),id,user!.role,e.status,id).run();
        if(!updated.meta.changes) fail(409,'Approve the four documents before closing an event.');
        await audit(db,user!,'update','event',id).run();return json({ok:true});
      }
    }
  }
  if(path==='/api/tasks'&&method==='GET') return json(await all(db,'SELECT t.*,u.name AS assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id ORDER BY t.due,t.id'));
  const taskMatch=path.match(/^\/api\/tasks(?:\/([a-f0-9]{32}))?(\/status)?$/);
  if(taskMatch) {
    const id=taskMatch[1];
    if(taskMatch[2]&&method==='PATCH') {
      requireRole(user!,['admin','coordinator','member']);if(!TASK_STATUSES.includes(v.status)) fail(400,'حالة غير صالحة');
      const updated=await statement(db,'UPDATE tasks SET status=? WHERE id=?',v.status,id).run();if(!updated.meta.changes) fail(404,'غير موجود');
      await audit(db,user!,'status','task',id).run();return json({ok:true});
    }
    requireRole(user!,['admin','coordinator']);
    if(method==='DELETE'&&id) {await db.batch([statement(db,'DELETE FROM tasks WHERE id=?',id),audit(db,user!,'delete','task',id)]);return json({ok:true});}
    if(['POST','PUT'].includes(method)&&!taskMatch[2]) {
      const old=id?await get(db,'SELECT * FROM tasks WHERE id=?',id):null;if(method==='PUT'&&!old) fail(404,'غير موجود');
      const t=await taskInput(db,v,old);
      if(method==='POST'&&!id) {const ident=hex();await db.batch([statement(db,'INSERT INTO tasks(id,title,owner,due,priority,status,event_id,notes,assignee_id) VALUES(?,?,?,?,?,?,?,?,?)',ident,...taskValues(t)),audit(db,user!,'create','task',ident)]);return json({id:ident});}
      if(method==='PUT'&&id) {await db.batch([statement(db,'UPDATE tasks SET title=?,owner=?,due=?,priority=?,status=?,event_id=?,notes=?,assignee_id=? WHERE id=?',...taskValues(t),id),audit(db,user!,'update','task',id)]);return json({ok:true});}
    }
  }
  const docMatch=path.match(/^\/api\/documents\/([a-f0-9]{32})(?:\/(.+))?$/);
  if(docMatch) {
    const id=docMatch[1],kind=docMatch[2]?decodeURIComponent(docMatch[2]):null;
    if(method==='GET'&&!kind) return json(await all(db,'SELECT * FROM documents WHERE event_id=?',id));
    if(method==='PUT'&&kind) {
      requireRole(user!,['admin','coordinator']);if(!DOCS.includes(kind)) fail(400,'Please check the entered values.');
      if(typeof v.present!=='boolean'||typeof v.approved!=='boolean') fail(400,'Please check the entered values.');
      if(v.approved&&!v.present) fail(400,'لا يمكن اعتماد ملف غير موجود');
      const link=text(v.url??'',2048).trim();
      if(link) {try{if(!['https:','http:'].includes(new URL(link).protocol)) fail(400,'Use a valid HTTP or HTTPS file link.');}catch{fail(400,'Use a valid HTTP or HTTPS file link.');}}
      const updated=await statement(db,`UPDATE documents SET present=?,approved=?,url=? WHERE event_id=? AND kind=? AND (SELECT status FROM events WHERE id=?)<>'مغلقة' AND (?='admin' OR (approved=0 AND ?=0))`,Number(v.present),Number(v.approved),v.present?link:'',id,kind,id,user!.role,Number(v.approved)).run();
      if(!updated.meta.changes) fail(409,'Document is closed, approved, or unavailable.');
      await audit(db,user!,'review','document',id+':'+kind).run();return json({ok:true});
    }
  }
  fail(404,'Not found.');
}

export async function handle(request: Request): Promise<Response> {
  let response:Response;
  try {response=await dispatch(request);} catch(e) {
    if(e instanceof HttpError) response=json({detail:e.message},e.status,e.status===429?{'Retry-After':'900'}:{});
    else {console.error('Training request failed',e instanceof Error?e.message:'Unknown error');response=json({detail:'The request could not be completed. Please refresh and try again.'},500);}
  }
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');
  headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com");
  return new Response(response.body,{status:response.status,headers});
}
