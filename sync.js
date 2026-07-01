/* ═══════════════════════════════════════════════════════════════════
   sync.js v12 — FREE encrypted cloud sync via private GitHub Gist
   ───────────────────────────────────────────────────────────────────
   • Each person uses THEIR OWN GitHub token → THEIR OWN private Gist.
   • Split behaviour:
       – Lew (admin)  → backs up the WHOLE device (all local accounts)
       – anyone else  → backs up ONLY their own account
   • The backup is ENCRYPTED with a separate passphrase (AES-GCM).
     A stolen token alone = unreadable junk without the passphrase.
   • Newest copy wins. No servers, no cost, no trial.
   Setup: Settings → ☁ Cloud Sync → token + passphrase → Connect.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var API='https://api.github.com';
  var DATA_PREFIX='lews_tracker_v82_data_';
  var USERS_KEY='lews_tracker_v82_users';
  var K_TOKEN='lew_gist_token', K_PASS='lew_gist_pass_set', K_LOCAL='lew_gist_local_updated', K_BOOT='lew_gist_boot_restored';
  var K_PASSVAL='lew_gist_pass_remembered'; // remembered passphrase, per-device (opt-in, see disconnect/forget)
  var EMBED_KEYS=['lews_qaqc_state_v1','lews_qaqc_updated','lews_register_state_v1','lews_register_updated','lews_team_v1','lews_team_updated','lews_register_assign_v1'];
  var pushTimer=null, lastPushed='', passphrase='';

  function tok(){ return localStorage.getItem(K_TOKEN)||''; }
  function who(){ return (typeof currentUser!=='undefined'&&currentUser)?String(currentUser):''; }
  function isLew(){ return who().toLowerCase()==='lew'; }
  // Each user gets their own gist, tracked by a per-user id key
  function gistKey(){ return 'lew_gist_id_'+ (who().toLowerCase()||'guest'); }
  function gid(){ return localStorage.getItem(gistKey())||''; }
  function setGid(v){ localStorage.setItem(gistKey(),v); }
  // The backup filename encodes which account it belongs to
  function fileName(){ return 'lews-tracker__'+(who().toLowerCase()||'guest')+'.enc.json'; }

  function quietSay(msg,color){
    var el=document.getElementById('gsyncStatus');
    if(el){ el.textContent=msg; el.style.color=color||''; }
  }
  function say(msg,color){ quietSay(msg,color); if(typeof toastMsg==='function') try{toastMsg('☁ '+msg);}catch(e){} }

  // ── Build the snapshot (split: Lew=all users, others=self only) ──
  function buildSnapshot(){
    var snap={version:2, owner:who(), scope:isLew()?'device':'user', updatedAt:new Date().toISOString(), users:'[]', data:{}, embed:{}};
    var allUsers=[];
    try{ allUsers=JSON.parse(localStorage.getItem(USERS_KEY)||'[]'); }catch(e){}
    if(isLew()){
      // whole device: every account + every data blob + embedded apps
      snap.users=localStorage.getItem(USERS_KEY)||'[]';
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k && k.indexOf(DATA_PREFIX)===0) snap.data[k.slice(DATA_PREFIX.length)]=localStorage.getItem(k);
      }
      EMBED_KEYS.forEach(function(k){ var v=localStorage.getItem(k); if(v!==null) snap.embed[k]=v; });
    } else {
      // single user: only this account's record + data
      var me=who();
      var mineUser=allUsers.filter(function(u){return u.username&&u.username.toLowerCase()===me.toLowerCase();});
      snap.users=JSON.stringify(mineUser);
      var d=localStorage.getItem(DATA_PREFIX+me);
      if(d!==null) snap.data[me]=d;
      // a non-Lew user also owns their QA/QC + register work on this device
      EMBED_KEYS.forEach(function(k){ var v=localStorage.getItem(k); if(v!==null) snap.embed[k]=v; });
    }
    return snap;
  }
  function applySnapshot(snap){
    if(!snap||(snap.version!==1&&snap.version!==2)) throw new Error('bad snapshot');
    if(snap.scope==='user'||snap.version===1){
      // merge a single user without wiping other local accounts
      var incoming=[]; try{incoming=JSON.parse(snap.users||'[]');}catch(e){}
      var cur=[]; try{cur=JSON.parse(localStorage.getItem(USERS_KEY)||'[]');}catch(e){}
      incoming.forEach(function(u){
        var idx=cur.findIndex(function(c){return c.username&&u.username&&c.username.toLowerCase()===u.username.toLowerCase();});
        if(idx>=0) cur[idx]=u; else cur.push(u);
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(cur));
      Object.keys(snap.data||{}).forEach(function(u){ localStorage.setItem(DATA_PREFIX+u, snap.data[u]); });
    } else {
      // device scope (Lew): full restore
      localStorage.setItem(USERS_KEY, snap.users||'[]');
      Object.keys(snap.data||{}).forEach(function(u){ localStorage.setItem(DATA_PREFIX+u, snap.data[u]); });
    }
    if(snap.embed){ Object.keys(snap.embed).forEach(function(k){ localStorage.setItem(k, snap.embed[k]); }); }
    localStorage.setItem(K_LOCAL, snap.updatedAt);
  }

  // ── AES-GCM encryption (browser-native, real) ──
  function b64(buf){ var b=new Uint8Array(buf),s=''; for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]); return btoa(s); }
  function unb64(str){ var s=atob(str),b=new Uint8Array(s.length); for(var i=0;i<s.length;i++)b[i]=s.charCodeAt(i); return b; }
  function deriveKey(pass,saltB64){
    var enc=new TextEncoder();
    return (window.crypto||crypto).subtle.importKey('raw',enc.encode(pass),{name:'PBKDF2'},false,['deriveKey']).then(function(base){
      return (window.crypto||crypto).subtle.deriveKey(
        {name:'PBKDF2',salt:unb64(saltB64),iterations:120000,hash:'SHA-256'},
        base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    });
  }
  function encrypt(obj){
    var salt=b64((window.crypto||crypto).getRandomValues(new Uint8Array(16)));
    var iv=(window.crypto||crypto).getRandomValues(new Uint8Array(12));
    return deriveKey(passphrase,salt).then(function(key){
      var data=new TextEncoder().encode(JSON.stringify(obj));
      return (window.crypto||crypto).subtle.encrypt({name:'AES-GCM',iv:iv},key,data);
    }).then(function(ct){
      return JSON.stringify({enc:'AES-GCM',v:1,salt:salt,iv:b64(iv),ct:b64(ct)});
    });
  }
  function decrypt(text){
    var box; try{box=JSON.parse(text);}catch(e){ throw new Error('Backup unreadable'); }
    if(!box||box.enc!=='AES-GCM') throw new Error('Not an encrypted backup');
    return deriveKey(passphrase,box.salt).then(function(key){
      return (window.crypto||crypto).subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},key,unb64(box.ct));
    }).then(function(pt){
      return JSON.parse(new TextDecoder().decode(pt));
    }).catch(function(){ throw new Error('Wrong passphrase or corrupted backup'); });
  }

  // ── GitHub API ──
  function gh(method,path,body){
    return fetch(API+path,{ method:method,
      headers:{'Authorization':'Bearer '+tok(),'Accept':'application/vnd.github+json','Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    }).then(function(r){
      if(r.status===401) throw new Error('Token rejected — needs the "gist" scope');
      if(r.status===404) throw new Error('Gist not found');
      if(!r.ok) throw new Error('GitHub error '+r.status);
      return r.json();
    });
  }
  function createGist(payload){
    var files={}; files[fileName()]={content:payload};
    return gh('POST','/gists',{description:"Lew's Tracker encrypted backup ("+who()+")",public:false,files:files})
      .then(function(g){ setGid(g.id); return g; });
  }
  function readGist(){
    return gh('GET','/gists/'+gid()).then(function(g){
      var f=g.files&&g.files[fileName()];
      if(!f) throw new Error('Backup file missing in gist');
      if(f.truncated) return fetch(f.raw_url).then(function(r){return r.text();});
      return f.content;
    });
  }
  function writeGist(payload){
    var files={}; files[fileName()]={content:payload};
    return gh('PATCH','/gists/'+gid(),{files:files});
  }

  // ── Push (debounced) ──
  function pushSoon(){ if(!tok()||!passphrase) return; clearTimeout(pushTimer); pushTimer=setTimeout(pushNow,2500); }
  function pushNow(){
    if(!tok()){ quietSay('Not connected','#e08'); return Promise.resolve(); }
    if(!passphrase){ quietSay('Enter passphrase to sync','#e80'); return Promise.resolve(); }
    var snap=buildSnapshot();
    var fingerprint=JSON.stringify(snap.data)+snap.users+JSON.stringify(snap.embed);
    if(fingerprint===lastPushed){ quietSay('Synced ✓ '+new Date().toLocaleTimeString(),'#7c6'); return Promise.resolve(); }
    quietSay('Encrypting & syncing…');
    return encrypt(snap).then(function(payload){
      return gid()?writeGist(payload):createGist(payload);
    }).then(function(){
      lastPushed=fingerprint; localStorage.setItem(K_LOCAL,snap.updatedAt);
      quietSay('Synced ✓ '+new Date().toLocaleTimeString()+' ('+(isLew()?'whole device':who())+')','#7c6');
    }).catch(function(e){ quietSay('Sync failed: '+e.message,'#e55'); });
  }

  // ── Pull on startup ──
  function pullOnBoot(){
    if(!tok()||!gid()||!passphrase) return;
    if(sessionStorage.getItem(K_BOOT)){ sessionStorage.removeItem(K_BOOT); quietSay('Restored from cloud ✓','#7c6'); return; }
    readGist().then(function(text){ return decrypt(text); }).then(function(snap){
      var cloud=Date.parse(snap.updatedAt||0)||0;
      var local=Date.parse(localStorage.getItem(K_LOCAL)||0)||0;
      if(cloud>local){ applySnapshot(snap); sessionStorage.setItem(K_BOOT,'1'); location.reload(); }
      else if(local>cloud){ pushSoon(); quietSay('Local is newest — uploading','#7c6'); }
      else quietSay('In sync ✓','#7c6');
    }).catch(function(e){ quietSay('Cloud check failed: '+e.message,'#e55'); });
  }

  // ── Hook save() ──
  function hookSave(){
    if(typeof window.save!=='function') return setTimeout(hookSave,500);
    var orig=window.save;
    window.save=function(){ var r=orig.apply(this,arguments); pushSoon(); return r; };
  }

  // ── Settings card UI ──
  function buildUI(){
    var slot=document.getElementById('gsyncSlot');
    var sec=document.getElementById('settings');
    if(!slot && !sec) return setTimeout(buildUI,800);
    if(document.getElementById('gsyncCard')) return;
    var remembered=!!localStorage.getItem(K_PASSVAL);
    var host;
    if(slot){
      // merged into the Workflow & Backup card — no extra outer card wrapper needed
      host=slot;
    } else {
      // fallback for pages without a dedicated slot (e.g. qaqc.html/register.html)
      host=document.createElement('div');
      host.className='card';
      sec.appendChild(host);
    }
    var card=document.createElement('div');
    card.id='gsyncCard';
    card.innerHTML=
      '<h3 style="margin:0 0 6px">☁ Cloud Sync — encrypted, free (GitHub Gist)</h3>'+
      '<div class="small" style="margin-bottom:10px">Backs up to YOUR private Gist, encrypted with a passphrase only you know. '+
      'Lew backs up the whole device; everyone else backs up only their own account. '+
      'Make a token (only the <b>gist</b> scope): '+
      '<a href="https://github.com/settings/tokens/new?scopes=gist&description=Lews%20Tracker%20Sync" target="_blank" rel="noopener">open token page</a>, '+
      'set "No expiration", generate, paste below.</div>'+
      '<input id="gsyncToken" type="password" placeholder="GitHub token (ghp_… / github_pat_…)" style="width:100%;margin-bottom:8px" autocomplete="off">'+
      '<input id="gsyncPass" type="password" placeholder="Encryption passphrase (remember this — no recovery)" style="width:100%;margin-bottom:8px" autocomplete="off">'+
      '<label class="small" style="display:flex;align-items:center;gap:6px;margin:-2px 0 8px"><input type="checkbox" id="gsyncRemember" style="width:auto" checked> Remember passphrase on this device</label>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">'+
      '<button class="btn primary" id="gsyncConnect">Connect & Sync</button>'+
      '<button class="btn" id="gsyncNow">Sync now</button>'+
      '<button class="btn" id="gsyncPull">Restore from cloud</button>'+
      '<button class="btn" id="gsyncOff">Disconnect</button>'+
      '</div>'+
      '<div id="gsyncStatus" class="small">'+(tok()?(remembered?'Connected — passphrase remembered on this device':'Token saved — enter passphrase, then Connect'):'Not connected')+'</div>'+
      (remembered?'<button class="btn" id="gsyncForgetPass" style="margin-top:8px">Forget passphrase (ask again next time)</button>':'');
    host.appendChild(card);
    var inT=document.getElementById('gsyncToken'); if(tok()) inT.value='••••••••••••••••';
    var inP=document.getElementById('gsyncPass'); if(remembered) inP.value='••••••••••••••••';

    document.getElementById('gsyncConnect').onclick=function(){
      var t=inT.value.trim(), p=inP.value;
      if(t&&t.indexOf('•')!==0) localStorage.setItem(K_TOKEN,t);
      if(!tok()){ quietSay('Paste a token first','#e55'); return; }
      if(p&&p.indexOf('•')!==0) passphrase=p; // only overwrite if a fresh value was typed
      if(!passphrase){ quietSay('Enter a passphrase first','#e55'); return; }
      localStorage.setItem(K_PASS,'1');
      if(document.getElementById('gsyncRemember').checked) localStorage.setItem(K_PASSVAL,passphrase);
      else localStorage.removeItem(K_PASSVAL);
      inT.value='••••••••••••••••'; inP.value='••••••••••••••••';
      quietSay('Connecting…');
      // find this user's existing backup gist (made on another device)
      gh('GET','/gists?per_page=100').then(function(list){
        var mine=(list||[]).filter(function(g){return g.files&&g.files[fileName()];})[0];
        if(mine){ setGid(mine.id); pullOnBoot(); }
        else { pushNow(); }
      }).catch(function(e){ quietSay(e.message,'#e55'); });
    };
    document.getElementById('gsyncNow').onclick=function(){
      if(!passphrase){ var p=inP.value; if(p&&p.indexOf('•')!==0) passphrase=p; }
      pushNow();
    };
    document.getElementById('gsyncPull').onclick=function(){
      if(!passphrase){ var p=inP.value; if(p&&p.indexOf('•')!==0) passphrase=p; }
      if(!passphrase){ quietSay('Enter your passphrase first','#e55'); return; }
      if(!confirm('Replace THIS account\'s data with the cloud copy?')) return;
      readGist().then(function(t){return decrypt(t);}).then(function(snap){ applySnapshot(snap); location.reload(); })
        .catch(function(e){ quietSay(e.message,'#e55'); });
    };
    document.getElementById('gsyncOff').onclick=function(){
      localStorage.removeItem(K_TOKEN); localStorage.removeItem(K_PASS); localStorage.removeItem(K_PASSVAL);
      passphrase=''; inT.value=''; inP.value='';
      quietSay('Disconnected (encrypted cloud copy kept on GitHub)');
    };
    var forgetBtn=document.getElementById('gsyncForgetPass');
    if(forgetBtn) forgetBtn.onclick=function(){
      localStorage.removeItem(K_PASSVAL); passphrase=''; inP.value='';
      quietSay('Passphrase forgotten — you\'ll need to re-enter it next time','#e80');
      forgetBtn.style.display='none';
    };
  }

  function init(){
    hookSave();
    var remembered=localStorage.getItem(K_PASSVAL);
    if(remembered) passphrase=remembered; // restore before building UI / before any early save() triggers a push
    buildUI();
    if(remembered && tok() && gid()) pullOnBoot();
    else if(remembered && tok()) pushSoon();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();

  window.__gsync={buildSnapshot:buildSnapshot,applySnapshot:applySnapshot,pushNow:pushNow,pullOnBoot:pullOnBoot,
    _setPass:function(p){passphrase=p;}, _enc:encrypt, _dec:decrypt, isLew:isLew};
  window.__trackerEmbedSaved=function(){ pushSoon(); };
})();
