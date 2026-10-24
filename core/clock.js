var uClockRaf=null,uClockSty=0;
function openObject(){var c=document.getElementById("clockCanvas");c.width=window.innerWidth;c.height=window.innerHeight;c.style.borderRadius="0";c.style.boxShadow="none";c.style.width="100vw";c.style.height="100vh";uClockSty=data.settings.clockStyle||0;var cs=document.getElementById("clockStyleSelect");if(cs)cs.value=uClockSty;document.getElementById("objectModal").classList.add("show");uStartClock(c);}
function uCloseObj(e){if(e&&e.target.id!=="objectModal")return;uCloseObjBtn();}
function uCloseObjBtn(){document.getElementById("objectModal").classList.remove("show");if(uClockRaf){cancelAnimationFrame(uClockRaf);uClockRaf=null;}}
function nextClockStyle(){uClockSty=(uClockSty+1)%3;data.settings.clockStyle=uClockSty;save();var cs=document.getElementById("clockStyleSelect");if(cs)cs.value=uClockSty;}
function setClockStyle(v){uClockSty=v;data.settings.clockStyle=v;save();}
function uStartClock(canvas){if(uClockRaf)cancelAnimationFrame(uClockRaf);var ctx=canvas.getContext("2d"),fr=0;function gAcc(){var s=getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()||"#d8b76d";if(s.startsWith("#")&&s.length===7)return[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];return[216,183,109];}function draw(){uClockRaf=requestAnimationFrame(draw);var W=canvas.width,H=canvas.height,cx=W/2,cy=H/2;var t=fr++*.015,acc=gAcc(),ac=acc[0]+","+acc[1]+","+acc[2];var R=Math.min(W,H)*.4;ctx.clearRect(0,0,W,H);var bg=ctx.createRadialGradient(cx,cy,0,cx,cy,R*1.7);bg.addColorStop(0,"#111309");bg.addColorStop(1,"#040503");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);var sty=uClockSty;if(sty===0){var gl=ctx.createRadialGradient(cx,cy,0,cx,cy,R*.68);gl.addColorStop(0,"rgba("+ac+",.15)");gl.addColorStop(1,"transparent");ctx.fillStyle=gl;ctx.beginPath();ctx.arc(cx,cy,R*.68,0,Math.PI*2);ctx.fill();var rgs=[{a:R*.92,b:R*.28,spd:.42,n:54,sz:2.8,of:0},{a:R*.75,b:R*.67,spd:-.31,n:42,sz:2.1,of:1.1},{a:R*.58,b:R*.19,spd:.72,n:30,sz:1.7,of:2.3}];rgs.forEach(function(rg){var rot=t*rg.spd+rg.of;for(var i=0;i<rg.n;i++){var ang=(i/rg.n)*Math.PI*2+rot;var x=cx+rg.a*Math.cos(ang),y=cy+rg.b*Math.sin(ang);var d=(Math.sin(ang)+1)/2;ctx.beginPath();ctx.arc(x,y,rg.sz*(.5+d*.6),0,Math.PI*2);ctx.fillStyle="rgba("+ac+","+((.2+d*.75).toFixed(2))+")";ctx.fill();}});var now2=new Date(),sa=(now2.getSeconds()/60)*Math.PI*2-Math.PI/2;var sx=cx+rgs[0].a*Math.cos(sa),sy=cy+rgs[0].b*Math.sin(sa);ctx.shadowBlur=16;ctx.shadowColor="#ff9655";ctx.beginPath();ctx.arc(sx,sy,6,0,Math.PI*2);ctx.fillStyle="#ff9655";ctx.fill();ctx.shadowBlur=0;}else if(sty===1){ctx.lineWidth=.9;for(var i=0;i<=12;i++){var phi=(i/12)*Math.PI;var ly=cy+R*.78*Math.cos(phi),lrx=R*.78*Math.sin(phi);ctx.beginPath();ctx.ellipse(cx,ly,lrx||.5,lrx*.33||.3,0,0,Math.PI*2);ctx.strokeStyle="rgba("+ac+","+((.12+Math.abs(Math.sin(phi))*.5).toFixed(2))+")";ctx.stroke();}for(var j=0;j<10;j++){var ba=(j/10)*Math.PI+t*.22;var cv=Math.cos(ba);ctx.save();ctx.translate(cx,cy);ctx.scale(Math.abs(cv)*.78,1);ctx.beginPath();ctx.ellipse(0,0,R*.78*Math.abs(Math.sin(ba))||.5,R*.78,0,0,Math.PI*2);ctx.strokeStyle="rgba("+ac+","+((.1+Math.abs(cv)*.42).toFixed(2))+")";ctx.stroke();ctx.restore();}ctx.beginPath();ctx.arc(cx,cy-R*.78,5,0,Math.PI*2);ctx.fillStyle="rgba("+ac+",.85)";ctx.shadowBlur=12;ctx.shadowColor="rgba("+ac+",.9)";ctx.fill();ctx.shadowBlur=0;}else{for(var k=0;k<100;k++){var seed=k*7919;var px=cx+(Math.sin(seed*.0073+t*.04*(1+k%4*.1)))*W*.47;var py=cy+(Math.cos(seed*.011+t*.033*(1+k%3*.14)))*H*.47;var br=(Math.sin(t*.6+k*.7)+1)/2;ctx.beginPath();ctx.arc(px,py,(.7+k%3*.38)*br,0,Math.PI*2);ctx.fillStyle="rgba("+ac+","+((.14+br*.7).toFixed(2))+")";ctx.fill();}for(var m2=0;m2<6;m2++){var gx=cx+(Math.sin(t*.07+m2*1.05))*.38*W;var gy=cy+(Math.cos(t*.09+m2*.88))*.38*H;var ng=ctx.createRadialGradient(gx,gy,0,gx,gy,R*.48);ng.addColorStop(0,"rgba("+ac+",.065)");ng.addColorStop(1,"transparent");ctx.fillStyle=ng;ctx.beginPath();ctx.arc(gx,gy,R*.48,0,Math.PI*2);ctx.fill();}}var now=new Date();var ts=("0"+now.getHours()).slice(-2)+":"+("0"+now.getMinutes()).slice(-2)+":"+("0"+now.getSeconds()).slice(-2);var ds=now.toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"});var tz=(Intl.DateTimeFormat("en-US",{timeZoneName:"shortOffset"}).formatToParts(now).find(function(p){return p.type==="timeZoneName";})||{}).value||"GMT";var fsz=Math.min(W*.125,72);ctx.textAlign="center";ctx.textBaseline="middle";ctx.shadowBlur=24;ctx.shadowColor="rgba("+ac+",.8)";ctx.font="900 "+fsz+"px \"Inter\",ui-sans-serif,sans-serif";ctx.fillStyle="#f8f2e8";ctx.fillText(ts,cx,cy-6);ctx.shadowBlur=0;ctx.font="500 "+Math.min(W*.031,16)+"px \"Inter\",ui-sans-serif,sans-serif";ctx.fillStyle="rgba("+ac+",.88)";ctx.fillText(ds,cx,cy+fsz*.72);ctx.font="600 "+Math.min(W*.022,12)+"px \"Inter\",ui-sans-serif,sans-serif";ctx.fillStyle="rgba(255,255,255,.32)";ctx.fillText(tz+" - Local Time",cx,cy+fsz*.72+21);}draw();}


// ── v8.4: Screensaver controls ───────────────────────────────────────────────
(function(){
  var hideTimer=null;
  var modal=document.getElementById('objectModal');
  var controls=document.getElementById('ssControls');
  var hint=document.getElementById('ssHint');
  if(!modal||!controls)return;
  function showControls(){
    controls.style.opacity='1';
    if(hint)hint.style.opacity='1';
    modal.style.cursor='default';
    clearTimeout(hideTimer);
    hideTimer=setTimeout(function(){
      controls.style.opacity='0';
      if(hint)hint.style.opacity='0';
      modal.style.cursor='none';
    },3000);
  }
  modal.addEventListener('mousemove',showControls);
  modal.addEventListener('touchstart',showControls);
  // Resize canvas when window resizes during screensaver
  window.addEventListener('resize',function(){
    if(!modal.classList.contains('show'))return;
    var c=document.getElementById('clockCanvas');
    if(c){c.width=window.innerWidth;c.height=window.innerHeight;}
  });
  // Esc to exit
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&modal.classList.contains('show')){
      uCloseObjBtn();
    }
  });
})();

// PWA service worker registration
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));}
