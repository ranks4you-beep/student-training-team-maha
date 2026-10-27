// Public configuration only. Credentials and account data are never embedded here.
const TRAINING_API_ORIGIN = 'https://student-training-team-maha.student-training.workers.dev';
const TRAINING_BASE = new URL('../', document.currentScript.src);
const TRAINING_SESSION_KEY = 'maha-training-session-v2';
const TRAINING_SETUP_KEY = 'maha-training-private-setup-v1';
let trainingSession = null;
let trainingSetupToken = '';
function trainingPage(name='') { return new URL(name, TRAINING_BASE).href; }
function trainingClearSession() {
  trainingSession=null;
  try {sessionStorage.removeItem(TRAINING_SESSION_KEY);} catch (_) {}
}
function trainingForgetSetup() {
  trainingSetupToken='';
  try {sessionStorage.removeItem(TRAINING_SETUP_KEY);} catch (_) {}
}
function trainingHasSession() { return !!trainingSession?.session_token; }
function trainingHasSetup() { return !!trainingSetupToken; }
function trainingSaveSession(result) {
  if(!/^[A-Za-z0-9_-]{43}$/.test(result.session_token||'') || !/^[A-Za-z0-9_-]{43}$/.test(result.csrf_token||'')) throw new Error('Unable to start your session. Please try again.');
  trainingSession={session_token:result.session_token,csrf_token:result.csrf_token};
  try {sessionStorage.setItem(TRAINING_SESSION_KEY,JSON.stringify(trainingSession));}
  catch (_) {trainingSession=null;throw new Error('Allow browser storage to stay signed in.');}
  trainingForgetSetup();
}
try {
  const saved=JSON.parse(sessionStorage.getItem(TRAINING_SESSION_KEY)||'null');
  if(saved && /^[A-Za-z0-9_-]{43}$/.test(saved.session_token||'') && /^[A-Za-z0-9_-]{43}$/.test(saved.csrf_token||'')) trainingSession=saved;
  trainingSetupToken=sessionStorage.getItem(TRAINING_SETUP_KEY)||'';
} catch (_) {}
const setupFragment=new URLSearchParams(location.hash.slice(1)).get('setup');
if(setupFragment!==null) {
  if(/^[A-Za-z0-9_-]{43}$/.test(setupFragment)) {
    trainingSetupToken=setupFragment;
    try {sessionStorage.setItem(TRAINING_SETUP_KEY,setupFragment);} catch (_) {}
  }
  // A private activation token never remains in the address bar or referrer.
  history.replaceState(null,'',location.pathname+location.search);
}
if(!/^[A-Za-z0-9_-]{43}$/.test(trainingSetupToken)) trainingForgetSetup();
async function trainingFetch(path,options={}) {
  if(!path.startsWith('/api/') || path.includes('://') || path.includes('..')) throw new Error('Invalid workspace request.');
  const headers=new Headers(options.headers||{});
  if(trainingHasSession()) headers.set('Authorization','Bearer '+trainingSession.session_token);
  if(trainingHasSetup() && ['/api/auth/status','/api/auth/signup'].includes(path)) headers.set('X-Setup-Token',trainingSetupToken);
  const method=options.method||'GET';
  if(!['GET','HEAD'].includes(method)) {
    headers.set('Content-Type','application/json');
    if(trainingSession?.csrf_token && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token',trainingSession.csrf_token);
  }
  return fetch(TRAINING_API_ORIGIN+path,{...options,method,headers,credentials:'omit',mode:'cors',cache:'no-store',redirect:'error'});
}
async function trainingApi(path,method='GET',body) {
  const response=await trainingFetch(path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) {
    if(response.status===401 && !['/api/auth/login','/api/auth/signup'].includes(path)) {
      trainingClearSession();location.replace(trainingPage('login.html')+'?expired=1');
    }
    throw new Error(authMessage(typeof result.detail==='string'?result.detail:'Please check the entered values.'));
  }
  if(path==='/api/auth/logout') trainingClearSession();
  return result;
}
