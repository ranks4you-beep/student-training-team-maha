let authMode=location.pathname==='/signup'?'signup':'login';
let setupAllowed=false,reservedEmail="",setupRequired=false,authReady=false,authBusy=false,passwordVisible=false,errorKey='';
const field=id=>document.getElementById(id);
function showAuthError(key){errorKey=key;field('authError').textContent=authMessage(key);field('authError').hidden=!key;if(key)field('authError').focus();}
function submitLabel(){return authBusy?(authMode==='signup'?'Creating account…':'Signing in…'):(authMode==='signup'?(setupRequired?'Create leader account':'Create account'):'Log in');}
function renderAccountMode(){
  translateAccountText();
  document.title=at('Student Training Platform')+' · '+at(authMode==='signup'?'Sign up':'Log in');
  const signup=authMode==='signup';
  field('signupTab').hidden=!setupRequired;
  field('ownerSetup').hidden=!(signup&&setupRequired&&!setupAllowed);
  field('authForm').hidden=signup&&!setupAllowed;
  field('email').readOnly=signup&&setupAllowed;
  if(signup&&setupAllowed)field('email').value=reservedEmail;
  field('formTitle').textContent=at(signup?(setupRequired?'Create your leader account':'Create your account'):'Welcome back');
  field('formDescription').textContent=at(signup?(setupRequired?'This is the first account. It will be the leader, with full access to the platform.':'Accounts are created by your leader.'):'Log in to your training workspace.');
  field('setupBadge').hidden=!(signup&&setupRequired);
  field('nameField').hidden=!signup;field('fullName').required=signup;
  field('confirmField').hidden=!signup;field('confirmPassword').required=signup;
  field('passwordHint').hidden=!signup;field('password').minLength=signup?8:1;
  field('password').autocomplete=signup?'new-password':'current-password';
  for(const [id,mode] of [['loginTab','login'],['signupTab','signup']]){
    field(id).classList.toggle('active',authMode===mode);field(id).setAttribute('aria-pressed',String(authMode===mode));field(id).disabled=authBusy;
  }
  field('authSubmit').textContent=at(submitLabel());field('authSubmit').disabled=!authReady||authBusy;
  field('authSubmit').setAttribute('aria-busy',String(authBusy));field('languageToggle').disabled=authBusy;
  field('passwordToggle').setAttribute('aria-label',at(passwordVisible?'Hide password':'Show password'));
  field('passwordToggle').title=at(passwordVisible?'Hide password':'Show password');
  if(errorKey)field('authError').textContent=authMessage(errorKey);
}
function onLanguageChanged(){renderAccountMode();}
function switchMode(mode){if(authBusy)return;authMode=mode;history.replaceState(null,'',mode==='signup'?'/signup':'/login');showAuthError('');renderAccountMode();}
field('loginTab').addEventListener('click',()=>switchMode('login'));
field('signupTab').addEventListener('click',()=>switchMode('signup'));
field('languageToggle').addEventListener('click',()=>setLanguage(language==='ar'?'en':'ar'));
field('passwordToggle').addEventListener('click',()=>{
  passwordVisible=!passwordVisible;
  field('password').type=field('confirmPassword').type=passwordVisible?'text':'password';
  field('passwordToggle').setAttribute('aria-pressed',String(passwordVisible));renderAccountMode();
});
field('authForm').addEventListener('submit',async event=>{
  event.preventDefault();if(authBusy||!authReady)return;
  showAuthError('');
  if(authMode==='signup'&&field('password').value!==field('confirmPassword').value){showAuthError('Passwords do not match.');return;}
  const data={email:field('email').value,password:field('password').value};
  if(authMode==='signup')data.name=field('fullName').value;
  authBusy=true;renderAccountMode();
  try{
    const response=await fetch('/api/auth/'+(authMode==='signup'?'signup':'login'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){showAuthError(typeof result.detail==='string'?result.detail:'Please check the entered values.');return;}
    location.replace('/');
  }catch(_){showAuthError('Unable to reach the server. Refresh the page and try again.');}
  finally{authBusy=false;renderAccountMode();}
});
applyLanguage();renderAccountMode();
(async()=>{
  try{
    const response=await fetch('/api/auth/status',{credentials:'same-origin'});
    if(!response.ok)throw new Error();
    const status=await response.json();setupRequired=status.setup_required;setupAllowed=status.admin_setup_allowed;reservedEmail=status.reserved_email||'';authReady=true;
    if(!setupRequired&&authMode==='signup'){switchMode('login');showAuthError('Accounts are created by your leader.');}
    if(setupRequired)switchMode('signup');
    if(new URLSearchParams(location.search).has('expired'))showAuthError('Your session ended. Please log in again.');
    renderAccountMode();
  }catch(_){showAuthError('Unable to reach the server. Refresh the page and try again.');}
})();
