// One lightweight revision check every 15s; never replace a form while it is edited.
let sharedPollTimer=null,sharedPollBusy=false;
function canRefreshSharedWork(){
  return currentUser&&workspaceRevision!==null&&!document.hidden&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,select');
}
async function pollSharedWork(){
  if(sharedPollBusy||!canRefreshSharedWork())return;
  sharedPollBusy=true;
  try{
    const latest=await api('/workspace/revision');
    if(latest.revision!==workspaceRevision&&canRefreshSharedWork())await reload();
  }catch(_){const status=document.getElementById('workspaceSyncStatus');if(status)status.textContent=at('Updates paused. Use Refresh to retry.');}
  finally{sharedPollBusy=false;}
}
async function refreshSharedWork(){
  if(sharedPollBusy)return;
  sharedPollBusy=true;
  document.querySelectorAll('.shared-refresh').forEach(button=>button.disabled=true);
  try{await reload();}catch(error){alert(error.message);}
  finally{sharedPollBusy=false;document.querySelectorAll('.shared-refresh').forEach(button=>button.disabled=false);}
}
function startSharedSync(){if(sharedPollTimer===null)sharedPollTimer=setInterval(pollSharedWork,15000);}
window.addEventListener('DOMContentLoaded',()=>{
  startSharedSync();
  document.getElementById('modal').addEventListener('close',pollSharedWork);
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollSharedWork();});
window.addEventListener('focus',pollSharedWork);
window.addEventListener('pageshow',startSharedSync);
window.addEventListener('pagehide',()=>{clearInterval(sharedPollTimer);sharedPollTimer=null;});
