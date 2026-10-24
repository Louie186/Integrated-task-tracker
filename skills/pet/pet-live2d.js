/* ═══ v9.5 LIVE2D PET — everything drawn in ONE canvas ═══
   Model + desk + typing arm + key glow + mouse click glow are all PIXI
   sprites in the same renderer. No dependence on the old sprite layers. */
var uL2DAssets=new Proxy({},{get:function(_,k){return (typeof k==='string'&&k.indexOf('scene/')===0)?'img/'+k+'.png':undefined;}});
(function(){
  // Faces for gamepad/keyboard modes still flow through uImg:
  var _l2dOrigUImg=uImg;
  uImg=function(p){
    if(p&&uL2DAssets[p])return uL2DAssets[p];
    return _l2dOrigUImg(p);
  };

  var L2D={app:null,model:null,loading:false,ready:false,lastMotion:0,
           arm:null,key:null,click:null,armTex:[],keyTex:[],armT:null,keyT:null,clickT:null};
  window.__L2D=L2D; // exposed for testing/diagnostics
  var MODEL_URL='img/standard/cat_model/cat.model3.json';
  var CDN=[
    'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/browser/pixi.min.js',
    'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js'
  ];
  function loadScript(src){return new Promise(function(res,rej){
    var s=document.createElement('script');s.src=src;s.onload=res;
    s.onerror=function(){rej(new Error('Failed: '+src))};document.head.appendChild(s);
  })}
  function loadLibs(){
    var p=Promise.resolve();
    CDN.forEach(function(src){p=p.then(function(){
      if(src.indexOf('cubismcore')>-1&&window.Live2DCubismCore)return;
      if(src.indexOf('pixi.min')>-1&&window.PIXI)return;
      if(src.indexOf('cubism4')>-1&&window.PIXI&&PIXI.live2d)return;
      return loadScript(src);
    })});
    return p;
  }
  // Old sprite layers stay blank in live2d mode — the canvas does everything
  var _l2dOrigUMD=uMD;
  uMD=function(){
    if(typeof uMode!=='undefined'&&uMode==='live2d'){
      var none=function(){return -1},empty=function(){return ''};
      return{bg:'',cat:'',face:empty,lhUp:'',rhUp:'',
             lhFrame:none,rhFrame:none,kbFrame:none,
             lhSrc:empty,rhSrc:empty,kbSrc:empty,faceCount:0};
    }
    return _l2dOrigUMD();
  };
  function spr(key){ // full-scene sprite from an embedded asset
    var s=PIXI.Sprite.from(uL2DAssets[key]);
    s.width=612;s.height=352;s.visible=true;
    return s;
  }
  function buildScene(){
    var st=L2D.app.stage;
    st.addChild(spr('scene/bg'));           // 1. desk + mouse (bottom)
    st.addChild(L2D.model);                 // 2. Umaru ON the desk — her hand sits over table/mouse
    L2D.key=spr('scene/key0');L2D.key.visible=false;st.addChild(L2D.key);    // 3. key glow
    L2D.arm=spr('scene/arm0');L2D.arm.visible=false;st.addChild(L2D.arm);    // 4. typing arm
    for(var i=0;i<50;i++){
      L2D.armTex.push(PIXI.Texture.from(uL2DAssets['scene/arm'+i]));
      L2D.keyTex.push(PIXI.Texture.from(uL2DAssets['scene/key'+i]));
    }
  }
  function fitModel(){
    var m=L2D.model,W=612,H=352;
    m.scale.set(1);
    var s=Math.min(W/m.width,H/m.height)*1.16;
    m.scale.set(s,s);
    m.anchor.set(0.5,0.5);
    m.position.set(W*0.5,H*0.5-H*0.005);
  }
  function playMotion(){
    var now=Date.now();
    if(!L2D.model||now-L2D.lastMotion<2500)return;
    L2D.lastMotion=now;
    try{L2D.model.motion('CAT_motion')}catch(e){}
  }
  // ── Drive the model's own parameters (same ones the desktop exe uses) ──
  // Writes go straight to the raw Cubism core arrays (string IDs always work
  // there), then get saved so the engine's per-frame load/save keeps them.
  function rawCore(){
    var cm=L2D.model&&L2D.model.internalModel&&L2D.model.internalModel.coreModel;
    if(!cm)return null;
    var raw=cm._model||cm.getModel&&cm.getModel()||null;
    return(raw&&raw.parameters&&raw.parameters.ids)?{cm:cm,raw:raw}:{cm:cm,raw:null};
  }
  function setP(id,v){
    try{
      var c=rawCore();if(!c)return;
      var done=false;
      if(c.raw){
        var i=c.raw.parameters.ids.indexOf(id);
        if(i>=0){c.raw.parameters.values[i]=v;done=true;}
      }
      if(!done&&c.cm.setParameterValueById){
        try{c.cm.setParameterValueById(id,v);}catch(e2){}
      }
      if(c.cm.saveParameters)c.cm.saveParameters();
    }catch(e){}
  }
  function pRange(id){
    try{
      var c=rawCore();
      if(c&&c.raw){
        var i=c.raw.parameters.ids.indexOf(id);
        if(i>=0)return[c.raw.parameters.minimumValues[i],c.raw.parameters.maximumValues[i]];
      }
    }catch(e){}
    return[0,1];
  }
  var pKeyT=null;
  function onKey(e){
    if(uMode!=='live2d'||!L2D.ready)return;
    if(!uWin||uWin.style.display!=='block')return;
    var i=uLH.indexOf(e.keyCode);
    if(i<0||i>=50)return;
    L2D.arm.texture=L2D.armTex[i];L2D.arm.visible=true;
    L2D.key.texture=L2D.keyTex[i];L2D.key.visible=true;
    clearTimeout(L2D.armT);
    L2D.armT=setTimeout(function(){L2D.arm.visible=false;L2D.key.visible=false;},130);
    setP('CatParamLeftHandDown',1);     // her arm slaps the keyboard
    clearTimeout(pKeyT);
    pKeyT=setTimeout(function(){setP('CatParamLeftHandDown',0);},200);
    if(Math.random()<0.03)playMotion();
  }
  function onKeyUp(){
    if(uMode!=='live2d'||!L2D.ready)return;
    clearTimeout(pKeyT);
    setP('CatParamLeftHandDown',0);
  }
  function onClick(ev){
    if(uMode!=='live2d'||!L2D.ready)return;
    if(!uWin||uWin.style.display!=='block')return;
    setP((ev.button===2)?'ParamMouseRightDown':'ParamMouseLeftDown',1);
  }
  function onClickUp(){
    if(uMode!=='live2d'||!L2D.ready)return;
    setP('ParamMouseLeftDown',0);
    setP('ParamMouseRightDown',0);
  }
  function uL2DShow(){
    var cv=document.getElementById('uL2D');
    if(!cv)return;
    cv.style.display='block';
    if(L2D.ready||L2D.loading)return;
    L2D.loading=true;
    if(typeof toastMsg==='function')toastMsg('Loading Live2D…');
    loadLibs().then(function(){
      L2D.app=new PIXI.Application({view:cv,width:612,height:352,backgroundAlpha:0,autoStart:true});
      return PIXI.live2d.Live2DModel.from(MODEL_URL,{autoInteract:false});
    }).then(function(model){
      L2D.model=model;fitModel();buildScene();
      L2D.ready=true;L2D.loading=false;
      var rx=pRange('ParamMouseX'),ry=pRange('ParamMouseY');
      window.addEventListener('pointermove',function(e){
        if(!L2D.ready||uMode!=='live2d')return;
        var r=cv.getBoundingClientRect();
        var sx=r.width/612,sy=r.height/352;
        try{L2D.model.focus((e.clientX-r.left)/(sx||1),(e.clientY-r.top)/(sy||1))}catch(err){}
        var tx=Math.max(0,Math.min(1,e.clientX/window.innerWidth));
        var ty=Math.max(0,Math.min(1,e.clientY/window.innerHeight));
        setP('ParamMouseX',rx[0]+(rx[1]-rx[0])*tx);
        setP('ParamMouseY',ry[0]+(ry[1]-ry[0])*(1-ty));
      });
      cv.addEventListener('pointerdown',playMotion);
      document.addEventListener('keydown',onKey);
      document.addEventListener('keyup',onKeyUp);
      document.addEventListener('pointerdown',onClick);
      document.addEventListener('pointerup',onClickUp);
      if(typeof toastMsg==='function')toastMsg('Live2D pet ready ✨');
    }).catch(function(err){
      console.error('Live2D load failed:',err);
      L2D.loading=false;
      if(typeof toastMsg==='function')toastMsg('Live2D failed — check img/standard/cat_model files. Reverting.');
      if(typeof uSetMode==='function')uSetMode('gamepad');
    });
  }
  function uL2DHide(){
    var cv=document.getElementById('uL2D');
    if(cv)cv.style.display='none';
  }
  var _l2dOrigLoadMode=uLoadMode;
  uLoadMode=function(){
    var lbl=document.getElementById('uPetBarLbl');
    if(typeof uMode!=='undefined'&&uMode==='live2d'){
      _l2dOrigLoadMode();   // blanks the old sprite layers via the wrapped uMD
      uL2DShow();
      if(lbl)lbl.textContent='✨ Urume-chan';
      return;
    }
    uL2DHide();
    if(lbl)lbl.textContent='🐱 Urume-chan';
    _l2dOrigLoadMode();
  };
})();
