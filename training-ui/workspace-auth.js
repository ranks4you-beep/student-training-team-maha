function isLeader(){return currentUser?.role==='admin';}
function canManage(){return ['admin','coordinator'].includes(currentUser?.role);}
function canUpdateTasks(){return ['admin','coordinator','member'].includes(currentUser?.role);}
function syncAuthShell(){
  translateAccountText();
  document.getElementById('sessionName').textContent=currentUser?.name||'';
  document.getElementById('sessionRole').textContent=currentUser?roleLabel(currentUser.role):'';
  document.querySelector('[data-view="users"]').hidden=!isLeader();
  document.querySelector('[data-view="users"]').classList.toggle('auth-forbidden',!isLeader());
}
function applyPermissions(){
  document.querySelectorAll('#content button[onclick],#modalBody button[onclick]').forEach(button=>{
    const action=button.getAttribute('onclick');
    if(/eventForm\(|removeEvent\(|taskForm\(|deleteTask\(/.test(action)&&!canManage())button.hidden=true;
    if(/userForm\(|closeActivity\(/.test(action)&&!isLeader())button.hidden=true;
    if(button.hidden)button.classList.add('auth-forbidden');
    const documentMatch=action.match(/saveDoc\('[^']+',\s*(\d+)/);
    if(documentMatch){
      const index=documentMatch[1];
      const approved=document.getElementById('a'+index)?.checked;
      if(!canManage()||(!isLeader()&&approved))button.disabled=true;
    }
  });
  document.querySelectorAll('#content select[onchange*="setTaskStatus"]').forEach(select=>select.disabled=!canUpdateTasks());
  document.querySelectorAll('#modalBody input[id^="a"]').forEach(input=>{if(!isLeader())input.disabled=true;});
  document.querySelectorAll('#modalBody input[id^="p"],#modalBody input[id^="u"]').forEach(input=>{
    const index=input.id.slice(1);
    if(!/^\d+$/.test(index))return;
    if(!canManage()||(!isLeader()&&document.getElementById('a'+index)?.checked))input.disabled=true;
  });
}
function onLanguageChanged(){syncAuthShell();applyPermissions();}
async function logout(){
  const button=document.getElementById('logoutButton');button.disabled=true;
  try{await api('/auth/logout','POST');location.replace('/login');}
  catch(error){alert(error.message);button.disabled=false;}
}
