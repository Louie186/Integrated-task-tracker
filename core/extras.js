// ── v8.8: Cookie Consent ─────────────────────────────────────────────────────
function acceptCookies(){
  localStorage.setItem('lew_cookies_ok','1');
  document.getElementById('cookieBanner').classList.add('hidden');
}
(function(){
  if(!localStorage.getItem('lew_cookies_ok')){
    setTimeout(()=>{ if(!localStorage.getItem('lew_cookies_ok')) document.getElementById('cookieBanner').classList.remove('hidden'); }, 1200);
  }
})();

// ── v8.8: Right-click Context Menu on Tasks ──────────────────────────────────
let _ctxTaskId = null;
const ctxMenu = document.getElementById('ctxMenu');
document.addEventListener('contextmenu', e=>{
  const taskEl = e.target.closest('.item[data-tid]');
  if(!taskEl){ ctxMenu.style.display='none'; return; }
  e.preventDefault();
  _ctxTaskId = parseInt(taskEl.dataset.tid);
  ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
  ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - 160) + 'px';
  ctxMenu.style.display = 'block';
});
document.addEventListener('click', ()=>{ if(ctxMenu) ctxMenu.style.display='none'; });
function ctxAction(action){
  ctxMenu.style.display = 'none';
  if(!_ctxTaskId) return;
  const t = data.tasks.find(x=>x.id===_ctxTaskId);
  if(!t) return;
  if(action==='edit'){ openTask(_ctxTaskId); }
  else if(action==='done'){ toggleDone(_ctxTaskId); }
  else if(action==='focus'){ show('focus'); toastMsg('Focus set: '+t.title); }
  else if(action==='delete'){ delTask(_ctxTaskId); }
}

// ── v8.8: Melliea Theme Toggle ───────────────────────────────────────────────
function toggleMellieaTheme(on){
  // Rose is one of the shared skins (core/theme.js) — every tab follows it
  // only change something when it really changes — login calls this with the saved value,
  // and must not overwrite a theme picked elsewhere (or one still to be copied from old settings)
  if(on){ if(LTTheme.raw().skin!=='rose') LTTheme.set({skin:'rose'}); }
  else if(LTTheme.has() && LTTheme.raw().skin==='rose') LTTheme.set({skin:'gold'});
}
let _heartInterval = null;
function startFloatingHearts(){
  if(_heartInterval) return;
  _heartInterval = setInterval(()=>{
    if(document.hidden) return;
    const h = document.createElement('div');
    h.className = 'heart-float';
    h.textContent = ['💕','💛','🌸','✨','💗'][Math.floor(Math.random()*5)];
    h.style.left = (10 + Math.random()*80) + 'vw';
    h.style.bottom = '60px';
    h.style.fontSize = (.7 + Math.random()*.8) + 'rem';
    document.body.appendChild(h);
    setTimeout(()=>h.remove(), 4000);
  }, 3000);
}
function stopFloatingHearts(){
  if(_heartInterval){ clearInterval(_heartInterval); _heartInterval = null; }
}

// ── v8.8: Daily Love Quotes ──────────────────────────────────────────────────
const LOVE_QUOTES = [
  "Every day with you is my favourite day. So today is my new favourite day. 💛",
  "You are my today and all of my tomorrows.",
  "In all the world, there is no heart for me like yours.",
  "You make every ordinary moment extraordinary.",
  "Distance means nothing when someone means everything.",
  "I look at you and see the rest of my life in front of my eyes.",
  "The best thing to hold onto in life is each other.",
  "You are the reason I smile every morning.",
  "With you, I am home — wherever we are.",
  "You are my calm in the middle of every storm. 🌸",
  "Every task I finish, every deadline I meet — it's for us. 💕",
  "You inspire me to build better things, including myself.",
  "Some things are just meant to be — and so are we.",
  "The world is better because you are in it.",
  "You are not just my love, you are my greatest adventure.",
];
function getDailyQuote(){
  const dayIndex = Math.floor(Date.now() / 86400000) % LOVE_QUOTES.length;
  return LOVE_QUOTES[dayIndex];
}

// ── v8.8: Dedication Page ─────────────────────────────────────────────────────
// Opened via the subtle "✦ Inspired by Melliea" button in the sidebar
function openDedication(){
  const overlay = document.getElementById('dedicationOverlay');
  if(!overlay) return;
  // Set daily quote
  const quoteEl = document.getElementById('dedicationQuote');
  if(quoteEl) quoteEl.textContent = '"' + getDailyQuote() + '"';
  // Set countdown
  updateDedicationCountdown();
  overlay.classList.add('show');
}
function closeDedication(){
  const overlay = document.getElementById('dedicationOverlay');
  if(overlay) overlay.classList.remove('show');
}
function updateDedicationCountdown(){
  const el = document.getElementById('dedicationCountdown');
  if(!el) return;
  // Dates come from SPECIAL_DATES (single place to edit, near end of script)
  const daysToAnn = daysUntilMMDD(SPECIAL_DATES.anniversary.m, SPECIAL_DATES.anniversary.d);
  const daysToBday = daysUntilMMDD(SPECIAL_DATES.birthday.m, SPECIAL_DATES.birthday.d);
  el.innerHTML = `
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <div class="melliea-countdown">
        <div class="count-num">${daysToAnn === 0 ? '🎉' : daysToAnn}</div>
        <div class="count-label">${daysToAnn === 0 ? 'Happy Anniversary!' : 'days to Anniversary'}</div>
      </div>
      <div class="melliea-countdown">
        <div class="count-num">${daysToBday === 0 ? '🎂' : daysToBday}</div>
        <div class="count-label">${daysToBday === 0 ? 'Happy Birthday!' : 'days to Birthday'}</div>
      </div>
    </div>`;
}

// ── v8.8: Today Is Special Banner ────────────────────────────────────────────
function checkSpecialDay(){
  const ANNIVERSARY_DATE = String(SPECIAL_DATES.anniversary.m).padStart(2,'0') + '-' + String(SPECIAL_DATES.anniversary.d).padStart(2,'0');
  const BIRTHDAY_DATE = String(SPECIAL_DATES.birthday.m).padStart(2,'0') + '-' + String(SPECIAL_DATES.birthday.d).padStart(2,'0');
  const today3 = new Date();
  const mmdd = String(today3.getMonth()+1).padStart(2,'0') + '-' + String(today3.getDate()).padStart(2,'0');
  const banner = document.getElementById('specialBanner');
  const msg = document.getElementById('specialBannerMsg');
  if(!banner || !msg) return;
  if(mmdd === ANNIVERSARY_DATE){
    msg.textContent = '🎉 Happy Anniversary, Melliea! Today is extra special. 💕';
    banner.classList.add('show');
  } else if(mmdd === BIRTHDAY_DATE){
    msg.textContent = '🎂 Happy Birthday, Melliea! Wishing you the most wonderful day! 🌸';
    banner.classList.add('show');
  }
}

// ── Special day banner: checked shortly after the page opens ─────────────────
document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(checkSpecialDay, 2000); });

// ── v9.0: Special-date countdowns (single place to edit dates) ───────────────
const SPECIAL_DATES = {
  anniversary: { m: 9, d: 28 },  // ← September 28
  birthday:    { m: 11, d: 13 }  // ← November 13
};
// Timezone-safe: builds dates from local components with time zeroed,
// so the day count is exact everywhere. Returns 0 on the day itself.
function daysUntilMMDD(m, d){
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), m - 1, d);
  if(target < today) target = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((target - today) / 86400000);
}
function updateSpecialCountdowns(){
  const a = daysUntilMMDD(SPECIAL_DATES.anniversary.m, SPECIAL_DATES.anniversary.d);
  const b = daysUntilMMDD(SPECIAL_DATES.birthday.m, SPECIAL_DATES.birthday.d);
  const set = (numId, subId, days, emoji, todayMsg) => {
    const n = document.getElementById(numId), s = document.getElementById(subId);
    if(!n || !s) return;
    if(days === 0){ n.textContent = emoji; s.textContent = todayMsg; }
    else { n.textContent = days; s.textContent = days === 1 ? 'day to go' : 'days to go'; }
  };
  set('kAnnDays','kAnnSub', a, '🎉', 'Happy Anniversary!');
  set('kBdayDays','kBdaySub', b, '🎂', 'Happy Birthday!');
}
document.addEventListener('DOMContentLoaded', () => {
  updateSpecialCountdowns();
  setInterval(updateSpecialCountdowns, 60 * 60 * 1000); // refresh hourly
});

// (dedication accessible via sidebar button)


/* ═══ v9.1 PRO PACK — self-contained, append-only ══════════════ */

// ── Live greeting bar + day progress ─────────────────────────────
function updateGreetBar(){
  const msg=document.getElementById('greetMsg'),dt=document.getElementById('greetDate'),
        clk=document.getElementById('greetClock'),m=document.getElementById('dayMeter'),
        ml=document.getElementById('dayMeterLbl');
  if(!msg)return;
  const now=new Date(),h=now.getHours();
  const word=h<5?'Burning the midnight oil':h<12?'Good morning':h<17?'Good afternoon':h<21?'Good evening':'Winding down';
  const who=(typeof currentUser!=='undefined'&&currentUser)?', '+currentUser:'';
  msg.textContent=word+who+' 👋';
  dt.textContent=now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  clk.textContent=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const pct=Math.round(((now-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000)*100);
  if(m)m.style.width=pct+'%';
  if(ml)ml.textContent=pct+'% of the day';
}

// ── 🔥 Productivity streak (consecutive days with a completed task)
function _streakKey(){return 'lt_streak_'+((typeof currentUser!=='undefined'&&currentUser)||'guest')}
function _loadStreak(){try{return JSON.parse(localStorage.getItem(_streakKey()))||{last:'',count:0}}catch(e){return{last:'',count:0}}}
function bumpStreak(){
  const s=_loadStreak(),t=today();
  if(s.last===t)return;
  const y=new Date();y.setDate(y.getDate()-1);
  const yest=y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
  s.count=(s.last===yest)?s.count+1:1;s.last=t;
  localStorage.setItem(_streakKey(),JSON.stringify(s));
}
function updateStreakChip(){
  let chip=document.getElementById('streakChip');
  if(!chip){
    const titleBox=document.querySelector('.title');
    if(!titleBox)return;
    chip=document.createElement('span');chip.id='streakChip';
    titleBox.querySelector('h2')?.after(chip);
  }
  const s=_loadStreak(),t=today();
  const y=new Date();y.setDate(y.getDate()-1);
  const yest=y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
  const live=(s.last===t||s.last===yest)?s.count:0;
  chip.innerHTML='🔥 '+live+' day streak'+milestoneBadge(live);
  chip.classList.toggle('on',live>0);
}
function milestoneBadge(n){
  if(n>=100)return ' <span class="streak-badge" title="100+ day streak!">💯</span>';
  if(n>=30)return ' <span class="streak-badge" title="30+ day streak!">🏆</span>';
  if(n>=7)return ' <span class="streak-badge" title="7+ day streak!">⭐</span>';
  return '';
}
// Wrap toggleDone: stamp completions + feed the streak (original logic untouched)
const _proOrigToggleDone=toggleDone;
toggleDone=function(id,evt){
  const t=data.tasks.find(x=>x.id===id);
  const wasDone=t&&ensure(t).status==='done';
  _proOrigToggleDone(id,evt);
  if(t&&!wasDone&&t.status==='done'){t.completedAt=today();bumpStreak();save();}
  updateStreakChip();
};

// ── Keyboard shortcuts: 1–9 views, N quick add, ? help ──────────
const PRO_VIEW_KEYS={'1':'dashboard','2':'focus','3':'tasks','4':'templates','5':'insights','6':'calendar','7':'notes','8':'finance','9':'settings'};
function _proTyping(){const a=document.activeElement;return a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT'||a.isContentEditable)}
function openShortcutHelp(){
  let m=document.getElementById('shortcutModal');
  if(!m){
    m=document.createElement('div');m.id='shortcutModal';m.className='modal';
    m.innerHTML=`<div class="modal-card" style="width:min(420px,100%)">
      <div class="modal-head"><h3 style="margin:0">⌨️ Keyboard Shortcuts</h3>
      <button class="icon" onclick="document.getElementById('shortcutModal').classList.remove('show')">✕</button></div>
      <div class="sc-grid">
        <span><kbd class="sc-key">1</kbd>–<kbd class="sc-key">9</kbd></span><span class="small">Switch pages (Dashboard … Settings)</span>
        <kbd class="sc-key">N</kbd><span class="small">New task — jump to quick add</span>
        <span><kbd class="sc-key">Ctrl</kbd> <kbd class="sc-key">K</kbd></span><span class="small">Global search</span>
        <kbd class="sc-key">Esc</kbd><span class="small">Close any popup</span>
        <kbd class="sc-key">?</kbd><span class="small">Show this help</span>
      </div></div>`;
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')});
    document.body.appendChild(m);
  }
  m.classList.add('show');
}
document.addEventListener('keydown',e=>{
  if(_proTyping()||e.ctrlKey||e.metaKey||e.altKey)return;
  if(document.querySelector('.login-screen.show'))return;
  if(e.key==='?'){e.preventDefault();openShortcutHelp();return;}
  if(document.querySelector('.modal.show'))return;
  if(PRO_VIEW_KEYS[e.key]&&typeof show==='function'){e.preventDefault();show(PRO_VIEW_KEYS[e.key]);return;}
  if(e.key.toLowerCase()==='n'){
    e.preventDefault();
    if(typeof show==='function')show('dashboard');
    const qi=document.getElementById('quickInput')||window.quickInput;
    if(qi){qi.focus();qi.scrollIntoView({block:'center',behavior:'smooth'});}
  }
});

// ── 3D tilt on KPI cards (desktop pointer only) ──────────────────
(function(){
  if(!matchMedia('(pointer:fine)').matches)return;
  let raf=null;
  document.addEventListener('pointermove',e=>{
    const card=e.target.closest&&e.target.closest('.card.kpi');
    if(!card)return;
    if(document.body.classList.contains('reduce-motion'))return;
    if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const r=card.getBoundingClientRect(),
            px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
      card.classList.add('tilting');
      card.style.transform=`perspective(700px) rotateX(${(0.5-py)*7}deg) rotateY(${(px-0.5)*9}deg) translateY(-2px)`;
      card.style.setProperty('--mx',(px*100)+'%');
      card.style.setProperty('--my',(py*100)+'%');
    });
  });
  document.addEventListener('pointerout',e=>{
    const card=e.target.closest&&e.target.closest('.card.kpi');
    if(card&&!card.contains(e.relatedTarget)){
      card.classList.remove('tilting');card.style.transform='';
    }
  });
})();

// ── Material ripple on buttons ───────────────────────────────────
document.addEventListener('pointerdown',e=>{
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  if(document.body.classList.contains('reduce-motion'))return;
  const el=e.target.closest&&e.target.closest('.btn,.icon,.template');
  if(!el)return;
  const r=el.getBoundingClientRect(),size=Math.max(r.width,r.height);
  const rip=document.createElement('span');rip.className='pro-ripple';
  rip.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
  el.appendChild(rip);
  rip.addEventListener('animationend',()=>rip.remove());
});

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  updateGreetBar();setInterval(updateGreetBar,1000);
  setTimeout(updateStreakChip,800);
});
