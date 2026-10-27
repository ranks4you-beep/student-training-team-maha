import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
const read=name=>readFile('training-ui/'+name,'utf8');
await mkdir('docs/assets',{recursive:true});
for(const name of ['i18n.js','auth-shared.js','auth.css','theme.css','home.js','workspace-auth.js','workspace-sync.js']) await copyFile('training-ui/'+name,'docs/assets/'+name);
await copyFile('scripts/pages-runtime.js','docs/assets/pages-runtime.js');
const extraTranslations={
 'Your administrator has not activated this workspace yet. Use the private setup link to create the leader account.':'لم يفعّل المسؤول مساحة العمل بعد. استخدمي رابط الإعداد الخاص لإنشاء حساب القائد.',
 'Unable to start your session. Please try again.':'تعذر بدء الجلسة. حاولي مجددًا.',
 'Allow browser storage to stay signed in.':'اسمحي بتخزين المتصفح للبقاء مسجلة الدخول.',
};
const shared=await read('auth-shared.js');
await writeFile('docs/assets/auth-shared.js',shared.replace('function at(key)',`Object.assign(AUTH_AR,${JSON.stringify(extraTranslations)});\nfunction at(key)`));
let index=await read('index.html');
index=index.replaceAll('/static/','./assets/');
index=index.replace('<script src="./assets/i18n.js">','<script src="./assets/pages-runtime.js"></script><script>if(!trainingHasSession())location.replace(trainingPage("login.html"));</script><script src="./assets/i18n.js">');
const start=index.indexOf('async function api('),end=index.indexOf('async function reload()',start);
if(start<0||end<0)throw new Error('Workspace API adapter was not found.');
index=index.slice(0,start)+"async function api(url,method='GET',body){return trainingApi('/api'+url,method,body);}\n"+index.slice(end);
index=index.replace('function navigate(v){','function navigate(v){if(!M.programs)return;');
await writeFile('docs/index.html',index);
let auth=await read('auth.html');
auth=auth.replaceAll('/static/','./assets/');
auth=auth.replace('<script src="./assets/i18n.js" defer>','<script src="./assets/pages-runtime.js" defer></script><script src="./assets/i18n.js" defer>');
auth=auth.replace(/<div id="ownerSetup"[\s\S]*?<\/div><form id="authForm">/,'<div id="ownerSetup" class="owner-setup" hidden><p data-auth-i18n="Your administrator has not activated this workspace yet. Use the private setup link to create the leader account."></p></div><form id="authForm">');
auth=auth.replace('<meta charset="UTF-8">','<meta charset="UTF-8"><meta name="referrer" content="no-referrer">');
await writeFile('docs/login.html',auth);
let account=await read('auth-page.js');
account=account.replace("location.pathname==='/signup'", "(new URLSearchParams(location.search).get('mode')==='signup'||trainingHasSetup())");
account=account.replace("history.replaceState(null,'',mode==='signup'?'/signup':'/login');", "history.replaceState(null,'',trainingPage('login.html')+(mode==='signup'?'?mode=signup':''));");
account=account.replace("fetch('/api/auth/'+(authMode==='signup'?'signup':'login'),{method:'POST',credentials:'same-origin',", "trainingFetch('/api/auth/'+(authMode==='signup'?'signup':'login'),{method:'POST',");
account=account.replace("location.replace('/');", "trainingSaveSession(result);location.replace(trainingPage());");
account=account.replace("fetch('/api/auth/status',{credentials:'same-origin'})", "trainingFetch('/api/auth/status')");
account=account.replace("}catch(_){showAuthError('Unable to reach the server. Refresh the page and try again.');}","}catch(error){showAuthError(error.message||'Unable to reach the server. Refresh the page and try again.');}");
await writeFile('docs/assets/auth-page.js',account);
let workspace=await read('workspace-auth.js');
workspace=workspace.replace("location.replace('/login');","trainingClearSession();location.replace(trainingPage('login.html'));");
await writeFile('docs/assets/workspace-auth.js',workspace);
await writeFile('docs/404.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Student Training</title><body style="font-family:Segoe UI,Tahoma,sans-serif;padding:40px;color:#173353"><h1>Student Training Platform</h1><p>This page has moved.</p><a href="/student-training-team-maha/">Open the workspace</a></body></html>');
await writeFile('docs/.nojekyll','');
console.log('Built full GitHub Pages interface; no external page redirect or embedded credentials.');
