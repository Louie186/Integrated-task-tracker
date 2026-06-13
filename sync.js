/* ═══════════════════════════════════════════════════════════════════
   sync.js — FREE cloud sync via a private GitHub Gist
   ───────────────────────────────────────────────────────────────────
   How it works (plain language):
   • Your tracker data lives in this browser's storage.
   • Every time you save, this script (after a short pause) uploads a
     snapshot of ALL users' data to a private Gist on your GitHub.
   • When you open the tracker on any device, it checks the Gist:
     if the cloud copy is newer, it restores it and reloads once.
   • Newest copy always wins. No servers, no cost, no trial.
   Setup: Settings → ☁ Cloud Sync card → paste a GitHub token (gist
   scope only) → Connect. That's it.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var API='https://api.github.com';
  var FILE='lews-tracker-backup.json';
  var K_TOKEN='lew_gist_token', K_GIST='lew_gist_id', K_LOCAL='lew_gist_local_updated', K_BOOT='lew_gist_boot_restored';
  var DATA_PREFIX='lews_tracker_v82_data_';
  var USERS_KEY='lews_tracker_v82_users';
  var pushTimer=null, lastPushed='';

  function tok(){ return localStorage.getItem(K_TOKEN)||''; }
  function gid(){ return localStorage.getItem(K_GIST)||''; }
  function say(msg,color){
    var el=document.getElementById('gsyncStatus');
    if(el){ el.textContent=msg; el.style.color=color||''; }
    if(typeof toastMsg==='function') try{toastMsg('☁ '+msg);}catch(e){}
  }
  function quietSay(msg,color){
    var el=document.getElementById('gsyncStatus');
    if(el){ el.textContent=msg; el.style.color=color||''; }
  }

  // ── Snapshot: every user's data + the users list, in one JSON ──
  var EMBED_KEYS=['lews_qaqc_state_v1','lews_qaqc_updated','lews_register_state_v1','lews_register_updated'];
  function buildSnapshot(){
    var snap={version:1, updatedAt:new Date().toISOString(), users:localStorage.getItem(USERS_KEY)||'[]', data:{}, embed:{}};
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(k && k.indexOf(DATA_PREFIX)===0){
        snap.data[k.slice(DATA_PREFIX.length)]=localStorage.getItem(k);
      }
    }
    EMBED_KEYS.forEach(function(k){ var v=localStorage.getItem(k); if(v!==null) snap.embed[k]=v; });
    return snap;
  }
  function applySnapshot(snap){
    if(!snap||snap.version!==1) throw new Error('bad snapshot');
    localStorage.setItem(USERS_KEY,snap.users||'[]');
    Object.keys(snap.data||{}).forEach(function(u){
      localStorage.setItem(DATA_PREFIX+u,snap.data[u]);
    });
    if(snap.embed){ Object.keys(snap.embed).forEach(function(k){ localStorage.setItem(k,snap.embed[k]); }); }
    localStorage.setItem(K_LOCAL,snap.updatedAt);
  }

  // ── GitHub API ──
  function gh(method,path,body){
    return fetch(API+path,{
      method:method,
      headers:{
        'Authorization':'Bearer '+tok(),
        'Accept':'application/vnd.github+json',
        'Content-Type':'application/json'
      },
      body:body?JSON.stringify(body):undefined
    }).then(function(r){
      if(r.status===401) throw new Error('Token rejected — check it has the "gist" scope');
      if(r.status===404) throw new Error('Gist not found');
      if(!r.ok) throw new Error('GitHub error '+r.status);
      return r.json();
    });
  }
  function createGist(snap){
    var files={}; files[FILE]={content:JSON.stringify(snap)};
    return gh('POST','/gists',{description:"Lew's Tracker cloud backup",public:false,files:files})
      .then(function(g){ localStorage.setItem(K_GIST,g.id); return g; });
  }
  function readGist(){
    return gh('GET','/gists/'+gid()).then(function(g){
      var f=g.files&&g.files[FILE];
      if(!f) throw new Error('Backup file missing in gist');
      if(f.truncated) return fetch(f.raw_url).then(function(r){return r.json();});
      return JSON.parse(f.content);
    });
  }
  function writeGist(snap){
    var files={}; files[FILE]={content:JSON.stringify(snap)};
    return gh('PATCH','/gists/'+gid(),{files:files});
  }

  // ── Push (debounced — runs a moment after you stop saving) ──
  function pushSoon(){
    if(!tok()) return;
    clearTimeout(pushTimer);
    pushTimer=setTimeout(pushNow,2500);
  }
  function pushNow(){
    if(!tok()) { quietSay('Not connected','#e08'); return Promise.resolve(); }
    var snap=buildSnapshot();
    var body=JSON.stringify(snap.data)+snap.users;
    if(body===lastPushed){ quietSay('Synced ✓ '+new Date().toLocaleTimeString(),'#7c6'); return Promise.resolve(); }
    quietSay('Syncing…');
    var p=gid()?writeGist(snap):createGist(snap);
    return p.then(function(){
      lastPushed=body;
      localStorage.setItem(K_LOCAL,snap.updatedAt);
      quietSay('Synced ✓ '+new Date().toLocaleTimeString(),'#7c6');
    }).catch(function(e){ quietSay('Sync failed: '+e.message,'#e55'); });
  }

  // ── Pull on startup: cloud newer → restore + reload once ──
  function pullOnBoot(){
    if(!tok()||!gid()) return;
    if(sessionStorage.getItem(K_BOOT)){ sessionStorage.removeItem(K_BOOT); quietSay('Restored from cloud ✓','#7c6'); return; }
    readGist().then(function(snap){
      var cloud=Date.parse(snap.updatedAt||0)||0;
      var local=Date.parse(localStorage.getItem(K_LOCAL)||0)||0;
      if(cloud>local){
        applySnapshot(snap);
        sessionStorage.setItem(K_BOOT,'1');
        location.reload();
      } else if(local>cloud){
        pushSoon();
        quietSay('Local is newest — uploading','#7c6');
      } else {
        quietSay('In sync ✓','#7c6');
      }
    }).catch(function(e){ quietSay('Cloud check failed: '+e.message,'#e55'); });
  }

  // ── Hook the app's save() ──
  function hookSave(){
    if(typeof window.save!=='function') return setTimeout(hookSave,500);
    var orig=window.save;
    window.save=function(){
      var r=orig.apply(this,arguments);
      pushSoon();
      return r;
    };
  }

  // ── Settings card UI ──
  function buildUI(){
    var sec=document.getElementById('settings');
    if(!sec) return setTimeout(buildUI,800);
    if(document.getElementById('gsyncCard')) return;
    var card=document.createElement('div');
    card.className='card'; card.id='gsyncCard';
    card.innerHTML=
      '<h3 style="margin:0 0 6px">☁ Cloud Sync — GitHub Gist (free)</h3>'+
      '<div class="small" style="margin-bottom:10px">Backs up all users to a private Gist on your GitHub. '+
      'Create a token with ONLY the <b>gist</b> scope: '+
      '<a href="https://github.com/settings/tokens/new?scopes=gist&description=Lews%20Tracker%20Sync" target="_blank" rel="noopener">open token page</a>, '+
      'set expiration to "No expiration", generate, paste below.</div>'+
      '<input id="gsyncToken" type="password" placeholder="Paste GitHub token (ghp_… or github_pat_…)" '+
      'style="width:100%;margin-bottom:8px" autocomplete="off">'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">'+
      '<button class="btn primary" id="gsyncConnect">Connect & Sync</button>'+
      '<button class="btn" id="gsyncNow">Sync now</button>'+
      '<button class="btn" id="gsyncPull">Restore from cloud</button>'+
      '<button class="btn" id="gsyncOff">Disconnect</button>'+
      '</div>'+
      '<div id="gsyncStatus" class="small">'+(tok()?'Connected — will sync after each save':'Not connected')+'</div>';
    sec.appendChild(card);
    var inp=document.getElementById('gsyncToken');
    if(tok()) inp.value='••••••••••••••••';
    document.getElementById('gsyncConnect').onclick=function(){
      var v=inp.value.trim();
      if(!v||v.indexOf('•')===0){ quietSay('Paste a token first','#e55'); return; }
      localStorage.setItem(K_TOKEN,v);
      inp.value='••••••••••••••••';
      quietSay('Connecting…');
      // if a backup gist already exists (made on another device), reuse it
      gh('GET','/gists?per_page=100').then(function(list){
        var mine=(list||[]).filter(function(g){return g.files&&g.files[FILE];})[0];
        if(mine){ localStorage.setItem(K_GIST,mine.id); pullOnBoot(); }
        else { pushNow(); }
      }).catch(function(e){ quietSay(e.message,'#e55'); });
    };
    document.getElementById('gsyncNow').onclick=function(){ pushNow(); };
    document.getElementById('gsyncPull').onclick=function(){
      if(!confirm('Replace data on THIS device with the cloud copy?')) return;
      readGist().then(function(snap){ applySnapshot(snap); location.reload(); })
        .catch(function(e){ quietSay(e.message,'#e55'); });
    };
    document.getElementById('gsyncOff').onclick=function(){
      localStorage.removeItem(K_TOKEN);
      inp.value='';
      quietSay('Disconnected (cloud copy kept on GitHub)');
    };
  }

  // ── Boot ──
  function init(){ hookSave(); buildUI(); pullOnBoot(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();

  // expose for tests/diagnostics
  window.__gsync={buildSnapshot:buildSnapshot,applySnapshot:applySnapshot,pushNow:pushNow,pullOnBoot:pullOnBoot};

  // ── Bridge: embedded QA/QC + Register apps call this after they save ──
  // (they write to localStorage themselves; this just schedules the cloud push)
  window.__trackerEmbedSaved=function(which){ pushSoon(); };
})();
