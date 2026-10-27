// Home dashboard, top bar, secondary panel and notifications drawer.
// Notifications are derived from the shared tasks and events; only "read" marks are kept per browser.
const L=(ar,en)=>language==='en'?en:ar;
Object.assign(EN,{
  'الرئيسية':'Home',
  'التقارير والمؤشرات':'Reports & indicators',
});

// Icon paths from Lucide (ISC licence).
const ICONS={
  sprout:'<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  calendar:'<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calendarDays:'<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  arrowLeft:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  logOut:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  cap:'<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  clipboard:'<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  fileCheck:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>',
  chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  checkCheck:'<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  alert:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
};
const icon=(name,cls='')=>`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const TRACK_TONES=['tone-cyan','tone-yellow','tone-pink','tone-green'];

function todayIso(){return iso(new Date());}
function dayLabel(d){
  const diff=Math.round((local(d)-local(todayIso()))/86400000);
  if(diff===0)return L('اليوم','Today');
  if(diff===1)return L('غدًا','Tomorrow');
  if(diff===-1)return L('أمس','Yesterday');
  return new Intl.DateTimeFormat(currentLocale(),{day:'numeric',month:'short'}).format(local(d));
}
function initials(name){
  // Skip the Arabic definite article so "مها العبسي" reads "مع", not "ما".
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean).map(w=>w.length>3&&w.startsWith('ال')?w.slice(2):w);
  return (parts.length>1?parts[0][0]+parts[parts.length-1][0]:(parts[0]||'?').slice(0,2)).toUpperCase();
}
const openTasks=()=>tasks.filter(t=>t.status!=='مكتمل');
const isOverdue=t=>t.status!=='مكتمل'&&t.due<todayIso();
const awaitingClosure=()=>events.filter(e=>e.status==='منتهية');
function programCode(id){
  const program=M.programs.find(p=>p.id==id);if(!program)return '';
  const siblings=M.programs.filter(p=>p.path_id===program.path_id);
  return program.path_id+'.'+(siblings.indexOf(program)+1);
}

/* ---- Top bar ---- */
function renderTopBar(){
  $('#brandTitle').textContent=L('الرئيسية · 1448هـ','Home · 1448 AH');
  $('#brandSub').textContent=tr('وحدة الدعم والتدريب الطلابي – 1448هـ').replace(/\s*[–-]\s*1448.*$/,'');
  $('#userAvatar').textContent=initials(currentUser?.name);
  $('#menuName').textContent=currentUser?.name||'';
  $('#userMenuButton').setAttribute('aria-label',L('قائمة الحساب','Account menu'));
  $('#calendarShortcut').setAttribute('aria-label',L('التقويم التدريبي','Training calendar'));
  $('#calendarShortcut').title=$('#calendarShortcut').getAttribute('aria-label');
  const unread=notifications().filter(n=>!n.read).length;
  $('#bellButton').setAttribute('aria-label',L('الإشعارات','Notifications')+(unread?` (${unread} ${L('غير مقروءة','unread')})`:''));
  $('#bellButton').title=L('الإشعارات','Notifications');
  $('#bellCount').hidden=!unread;$('#bellCount').textContent=unread>99?'99+':unread;
  $('#backButton').setAttribute('aria-label',L('العودة إلى الرئيسية','Back to home'));
}
function toggleUserMenu(force){
  const open=force??$('#userMenu').hidden;
  $('#userMenu').hidden=!open;$('#userMenuButton').setAttribute('aria-expanded',String(open));
  if(open)$('#userMenu').querySelector('.menu-item')?.focus();
}
document.addEventListener('click',event=>{if(!event.target.closest('.user-menu')&&!$('#userMenu').hidden)toggleUserMenu(false);});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(!$('#userMenu').hidden){toggleUserMenu(false);$('#userMenuButton').focus();}
  else if(!$('#drawer').hidden)closeDrawer();
});

/* ---- Frame: the secondary panel exists only on the home screen ---- */
function updateFrame(){
  const home=view==='dashboard';
  $('#page').classList.toggle('with-aside',home);
  $('#side').hidden=!home;
  $('#pageHead').classList.toggle('sr-only',home);
  $('#content').className=home?'home':'content-wide';
  if(home)renderSide();
  renderTopBar();
}

/* ---- Home ---- */
function moduleTile({view:target,action,tone,iconName,title,sub,badge}){
  const run=action||`navigate('${target}')`;
  return `<button type="button" class="module ${tone}" onclick="${run}"><span class="module-icon">${icon(iconName)}</span><span class="module-text"><span class="module-title">${esc(title)}</span>${sub?`<span class="module-sub">${esc(sub)}</span>`:''}</span>${badge?`<span class="count" aria-label="${esc(badge+' '+L('جديد','new'))}">${badge>99?'99+':badge}</span>`:''}</button>`;
}
function homeView(){
  const mine=openTasks().filter(t=>t.assignee_id===currentUser.id).length;
  const unread=notifications().filter(n=>!n.read).length;
  const overdue=tasks.filter(isOverdue).length;
  const modules=[
    {view:'events',tone:'tone-pink',iconName:'cap',title:tr('الدورات والفعاليات'),sub:eventCount(events.length)},
    {view:'calendar',tone:'tone-yellow',iconName:'calendarDays',title:L('التقويم التدريبي','Training calendar'),sub:new Intl.DateTimeFormat(currentLocale(),{day:'numeric',month:'long',year:'numeric'}).format(new Date())},
    {view:'tasks',tone:'tone-green',iconName:'clipboard',title:tr('مهام الفريق'),sub:L(`${openTasks().length} مهام مفتوحة`,`${openTasks().length} open tasks`),badge:mine},
    {view:'documents',tone:'tone-peach',iconName:'fileCheck',title:L('المرفقات والاعتماد','Documents & approvals'),sub:L(`${awaitingClosure().length} بانتظار التوثيق`,`${awaitingClosure().length} awaiting documents`)},
    {action:'openDrawer()',tone:'tone-cyan',iconName:'bell',title:L('الإشعارات','Notifications'),sub:L(`${unread} غير مقروءة`,`${unread} unread`),badge:unread},
    {view:'reports',tone:'tone-lilac',iconName:'chart',title:tr('التقارير والمؤشرات'),sub:L(`${overdue} مهام متأخرة`,`${overdue} overdue tasks`)},
  ];
  if(isLeader())modules.push({view:'users',tone:'tone-blue',iconName:'users',title:at('Accounts & permissions'),sub:L(`${users.length} حسابات`,`${users.length} accounts`)});
  const programs=M.programs.map(p=>{
    const count=events.filter(e=>e.program_id===p.id).length;
    return `<button type="button" class="program ${TRACK_TONES[(p.path_id-1)%4]}" onclick="openProgram(${Number(p.id)})"><span class="program-badge">${esc(programCode(p.id))}</span><span class="program-text"><span class="program-title">${esc(tr(p.name))}</span><span class="program-sub">${esc(pathName(p.path_id))} · ${esc(eventCount(count))}</span></span></button>`;
  }).join('');
  return `<div class="module-grid">${modules.map(moduleTile).join('')}</div><h2 class="section-title">${L('البرامج التدريبية','Training programs')}</h2><div class="program-grid">${programs}</div>`;
}
function openProgram(id){filterPath='all';filterProgram=id;navigate('events');}

/* ---- Secondary panel ---- */
let sideTab='upcoming';
function upcomingSessions(days=7){
  const start=todayIso(),end=plus(start,days),list=[];
  events.forEach(e=>e.sessions.forEach(d=>{if(d>=start&&d<end&&e.status!=='ملغاة')list.push({event:e,date:d});}));
  return list.sort((a,b)=>a.date.localeCompare(b.date)||a.event.time_start.localeCompare(b.event.time_start));
}
function sideTasks(tab){
  const today=todayIso();
  const sets={
    upcoming:openTasks().filter(t=>t.due>=today),
    overdue:tasks.filter(isOverdue),
    mine:openTasks().filter(t=>t.assignee_id===currentUser.id),
    done:tasks.filter(t=>t.status==='مكتمل'),
  };
  return tab?sets[tab]:sets;
}
function renderSide(){
  const sessions=upcomingSessions(),sets=sideTasks(),closing=awaitingClosure();
  const tabs=[['upcoming',L('القادمة','Upcoming')],['overdue',L('المتأخرة','Overdue')],['mine',L('لي','Mine')],['done',L('المكتملة','Done')]];
  const list=sets[sideTab].slice().sort((a,b)=>sideTab==='done'?b.due.localeCompare(a.due):a.due.localeCompare(b.due));
  const empty={upcoming:L('لا توجد مهام قادمة.','No upcoming tasks.'),overdue:L('لا توجد مهام متأخرة.','Nothing is overdue.'),mine:L('لا توجد مهام مسندة إليك.','No open tasks are assigned to you.'),done:L('لم تكتمل أي مهمة بعد.','No completed tasks yet.')}[sideTab];
  $('#side').setAttribute('aria-label',L('المواعيد القادمة','Upcoming schedule'));
  $('#side').innerHTML=`<section class="panel" aria-labelledby="sideEvents"><div class="panel-head"><h2 id="sideEvents">${L('الفعاليات القادمة','Upcoming sessions')}</h2><button type="button" class="link-btn" onclick="navigate('calendar')">${L('عرض التقويم','View calendar')}</button></div>${sessions.length?`<ul class="feed">${sessions.slice(0,4).map(({event,date})=>`<li><button type="button" class="feed-item" onclick="openSession('${esc(date)}')"><span class="feed-badge ${TRACK_TONES[(pathOf(event.program_id)-1)%4]}">${Number(date.slice(8))}</span><span class="feed-text"><span class="feed-title"><bdi>${esc(event.name)}</bdi></span><span class="feed-sub">${esc(pname(event.program_id))} · <bdi>${esc(event.time_start)}</bdi></span></span><span class="feed-when">${esc(dayLabel(date))}</span></button></li>`).join('')}</ul>${sessions.length>4?`<p class="panel-empty">${L(`و${sessions.length-4} لقاءات أخرى هذا الأسبوع`,`and ${sessions.length-4} more this week`)}</p>`:''}`:`<p class="panel-empty">${L('لا توجد لقاءات خلال الأيام السبعة القادمة.','No sessions in the next 7 days.')}</p>`}</section>
<section class="panel" aria-labelledby="sideTasks"><div class="panel-head"><h2 id="sideTasks">${L('المهام والمواعيد','Tasks and deadlines')}</h2><button type="button" class="link-btn" onclick="navigate('tasks')">${L('عرض الكل','View all')}</button></div><div class="tabs" role="tablist" aria-label="${L('تصفية المهام','Filter tasks')}">${tabs.map(([key,label])=>`<button type="button" class="tab" role="tab" aria-selected="${key===sideTab}" onclick="setSideTab('${key}')">${esc(label)} (${sets[key].length})</button>`).join('')}</div>${list.length?`<ul class="feed" role="tabpanel">${list.slice(0,6).map(t=>{const linked=events.find(e=>e.id===t.event_id);return `<li><button type="button" class="feed-item" onclick="taskDetails('${esc(t.id)}')"><span class="feed-badge" aria-hidden="true">${esc(initials(t.assignee_name||t.owner||'?'))}</span><span class="feed-text"><span class="feed-title"><bdi>${esc(t.title)}</bdi></span><span class="feed-sub">${esc(linked?linked.name:tr('مهمة عامة'))}</span></span><span class="feed-when ${isOverdue(t)?'late':''}">${esc(dayLabel(t.due))}</span></button></li>`}).join('')}</ul>`:`<p class="panel-empty" role="tabpanel">${empty}</p>`}</section>
<section class="panel" aria-labelledby="sideClosing"><div class="panel-head"><h2 id="sideClosing">${L('بانتظار الإغلاق','Awaiting closure')}</h2><button type="button" class="link-btn" onclick="navigate('documents')">${tr('متابعة المرفقات')}</button></div>${closing.length?`<ul class="feed">${closing.slice(0,4).map(e=>`<li><button type="button" class="feed-item" onclick="docDetails('${esc(e.id)}').catch(error=>alert(error.message))"><span class="feed-badge tone-peach">${icon('fileCheck')}</span><span class="feed-text"><span class="feed-title"><bdi>${esc(e.name)}</bdi></span><span class="feed-sub">${L('انتهت','Ended')} <bdi>${esc(dayLabel(e.end))}</bdi></span></span></button></li>`).join('')}</ul>`:`<p class="panel-empty">${L('لا توجد فعاليات منتهية بانتظار الإغلاق.','No finished activities are waiting to be closed.')}</p>`}</section>`;
}
function setSideTab(tab){sideTab=tab;renderSide();$('#side').querySelector('.tab[aria-selected="true"]')?.focus();}
function openSession(date){selectedDay=date;month=new Date(local(date).getFullYear(),local(date).getMonth(),1);navigate('calendar');}

/* ---- Notifications drawer ---- */
let drawerTab='all',drawerReturnFocus=null;
const seenKey=()=>'training-seen-notifications-v1:'+(currentUser?.id||'');
function seenSet(){try{return new Set(JSON.parse(localStorage.getItem(seenKey())||'[]'));}catch(_){return new Set();}}
function saveSeen(set){try{localStorage.setItem(seenKey(),JSON.stringify([...set].slice(-400)));}catch(_){}}
function notifications(){
  if(!currentUser||!M.programs)return [];
  const seen=seenSet(),today=todayIso(),tomorrow=plus(today,1),list=[];
  tasks.forEach(t=>{
    if(t.status==='مكتمل')return;
    const linked=events.find(e=>e.id===t.event_id),context=linked?linked.name:tr('مهمة عامة');
    if(isOverdue(t)&&(t.assignee_id===currentUser.id||canManage()))list.push({id:`overdue:${t.id}:${t.due}`,kind:'tasks',icon:'alert',tone:'tone-pink',context,html:`<b><bdi>${esc(t.title)}</bdi></b> ${L('متأخرة عن موعدها','is past its due date')}`,date:t.due,open:()=>taskDetails(t.id)});
    else if(t.assignee_id===currentUser.id)list.push({id:`assigned:${t.id}:${t.due}`,kind:'tasks',icon:'clipboard',tone:'tone-green',context,html:`<b><bdi>${esc(t.title)}</bdi></b> ${L('مسندة إليك','is assigned to you')}`,date:t.due,open:()=>taskDetails(t.id)});
  });
  events.forEach(e=>{
    if(e.status==='ملغاة')return;
    [today,tomorrow].forEach(d=>{if(e.sessions.includes(d))list.push({id:`session:${e.id}:${d}`,kind:'events',icon:'calendar',tone:'tone-yellow',context:pname(e.program_id),html:`<b><bdi>${esc(e.name)}</bdi></b> ${d===today?L('لديها لقاء اليوم','has a session today'):L('لديها لقاء غدًا','has a session tomorrow')} <bdi>${esc(e.time_start)}</bdi>`,date:d,open:()=>openSession(d)});});
    if(e.status==='منتهية'&&canManage())list.push({id:`closure:${e.id}`,kind:'events',icon:'fileCheck',tone:'tone-peach',context:pname(e.program_id),html:`<b><bdi>${esc(e.name)}</bdi></b> ${L('انتهت وتنتظر اكتمال المرفقات','has ended and needs its documents')}`,date:e.end,open:()=>docDetails(e.id).catch(error=>alert(error.message))});
  });
  return list.map(n=>({...n,read:seen.has(n.id)})).sort((a,b)=>Number(a.read)-Number(b.read)||Math.abs(local(a.date)-local(today))-Math.abs(local(b.date)-local(today)));
}
function renderDrawer(){
  const all=notifications(),counts={all:all.length,tasks:all.filter(n=>n.kind==='tasks').length,events:all.filter(n=>n.kind==='events').length};
  const shown=drawerTab==='all'?all:all.filter(n=>n.kind===drawerTab);
  const tabs=[['all',L('الكل','All')],['tasks',L('المهام','Tasks')],['events',L('الفعاليات','Activities')]];
  $('#drawer').innerHTML=`<div class="drawer-head"><h2 id="drawerTitle" tabindex="-1">${L('الإشعارات','Notifications')}</h2><div class="drawer-tools"><button type="button" class="icon-btn" onclick="markAllRead()" aria-label="${L('تعليم الكل كمقروء','Mark all as read')}" title="${L('تعليم الكل كمقروء','Mark all as read')}" ${all.some(n=>!n.read)?'':'disabled'}>${icon('checkCheck')}</button><button type="button" class="icon-btn" onclick="closeDrawer()" aria-label="${L('إغلاق','Close')}" title="${L('إغلاق','Close')}">${icon('x')}</button></div></div>
<div class="tabs" role="tablist" aria-label="${L('نوع الإشعار','Notification type')}">${tabs.map(([key,label])=>`<button type="button" class="tab" role="tab" aria-selected="${key===drawerTab}" onclick="setDrawerTab('${key}')">${esc(label)} (${counts[key]})</button>`).join('')}</div>
${shown.length?`<ul class="drawer-list" role="tabpanel">${shown.map(n=>`<li><button type="button" class="note ${n.read?'':'unread'}" onclick="openNotification('${esc(n.id)}')"><span class="note-icon ${n.tone}">${icon(n.icon)}</span><span class="note-body"><span class="note-context">${esc(n.context)}</span><span class="note-text">${n.html}</span></span><span class="note-when">${esc(dayLabel(n.date))}${n.read?'':`<span class="sr-only">${L('غير مقروء','unread')}</span>`}</span></button></li>`).join('')}</ul>`:`<div class="empty" role="tabpanel">${icon('inbox')}<b>${L('لا توجد إشعارات','You’re all caught up')}</b><span>${L('ستظهر هنا المهام المسندة إليك واللقاءات القريبة.','Tasks assigned to you and upcoming sessions appear here.')}</span></div>`}`;
}
function openDrawer(){
  drawerReturnFocus=document.activeElement;
  renderDrawer();$('#drawer').hidden=false;$('#drawerScrim').hidden=false;
  $('#bellButton').setAttribute('aria-expanded','true');$('#drawerTitle').focus();
}
function closeDrawer(){
  if($('#drawer').hidden)return;
  $('#drawer').hidden=true;$('#drawerScrim').hidden=true;$('#bellButton').setAttribute('aria-expanded','false');
  (drawerReturnFocus&&document.contains(drawerReturnFocus)?drawerReturnFocus:$('#bellButton')).focus();
}
function setDrawerTab(tab){drawerTab=tab;renderDrawer();$('#drawer').querySelector('.tab[aria-selected="true"]')?.focus();}
function markAllRead(){const seen=seenSet();notifications().forEach(n=>seen.add(n.id));saveSeen(seen);renderDrawer();refreshCounts();$('#drawerTitle').focus();}
function openNotification(id){
  const note=notifications().find(n=>n.id===id);if(!note)return;
  const seen=seenSet();seen.add(id);saveSeen(seen);
  drawerReturnFocus=null;closeDrawer();refreshCounts();
  note.open();
}
function refreshCounts(){renderTopBar();if(view==='dashboard')dashboard();}
$('#drawer').addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const focusable=[...$('#drawer').querySelectorAll('button:not([disabled]),[tabindex="-1"]')];
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
