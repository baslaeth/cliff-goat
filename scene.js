import { STEP_COUNT } from './engine.js';
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const lerp = (a, b, t) => a + (b - a) * t;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class MountainScene {
  constructor(canvas, audio) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.audio = audio;
    this.night = 0; this.themeTransition = null;
    this.stage = 0; this.camera = 0; this.motion = null; this.collected = false; this.fallen = false; this.failedLedge = -1;
    this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedOverride = null;
    this.reduced = this.motionPreference.matches;
    this.motionPreference.addEventListener('change', () => this.setReducedOverride(this.reducedOverride));
    this.clock = 0; this.particles = []; this.pausedAt = null;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    this.resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pausedAt = performance.now();
      else if (this.pausedAt !== null) {
        if (this.motion) this.motion.start += performance.now() - this.pausedAt;
        this.pausedAt = null;
      }
    });
    const frame = now => { if (!document.hidden) this.draw(now); this.frameId = requestAnimationFrame(frame); };
    this.frameId = requestAnimationFrame(frame);
  }
  setNight(night, instant = false) {
    const target = night ? 1 : 0;
    if (instant || this.reduced) { this.night = target; this.themeTransition = null; }
    else this.themeTransition = { from: this.night, target, start: performance.now() };
  }
  color(day) {
    const palette = {
      '#b8d8d8':'#182c49','#99cbd5':'#12213d','#e0e9d4':'#395774','#eaeacd':'#50677c',
      '#b5cfcb':'#50657e','#a2c3c2':'#3d536e','#e7eede':'#b1c6d5',
      '#a8c7c5':'#4a637d','#94b8b8':'#354c68','#f1f2df':'#c8d9e0',
      '#9dbebb':'#3a566e','#8cafad':'#30485f','#e0e8d7':'#a5bfce',
      '#a2c2bb':'#415f73','#8cb2aa':'#324e64','#d8e6d5':'#a2bdcb',
      '#83a795':'#314e5d','#6f9883':'#263f50','#b1cfc1':'#7695a6','#608a75':'#294654',
      '#496d50':'#263d4c','#3e634d':'#203846','#557653':'#304d58',
      '#727e6a':'#596f7b','#919781':'#83949a','#616f60':'#405764','#a2a28a':'#9aa8ac',
      '#aab28a':'#809a93','#c1ce93':'#aec5b4','#c4c8a1':'#b3c5ba','#e0e3b6':'#d5e3cd',
      '#eaf0dc00':'#7392b000','#eaf0dc1c':'#7392b010','#eaf0dc55':'#7392b030',
      '#fcfbea':'#a8bfd2','#fcfbea00':'#a8bfd200','#f9f4cc80':'#bfdafa40','#f9f4cc00':'#bfdafa00',
      '#f9f5d7':'#e1ebed'
    };
    const end = palette[day];
    if (!end || !this.night) return day;
    const channel = i => Math.round(lerp(parseInt(day.slice(i,i+2),16),parseInt(end.slice(i,i+2),16),this.night)).toString(16).padStart(2,'0');
    return '#' + channel(1) + channel(3) + channel(5) + (day.length===9 ? channel(7) : '');
  }
  setReducedOverride(value) {
    this.reducedOverride = value;
    this.reduced = value ?? this.motionPreference.matches;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width; this.h = rect.height; this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.s = clamp(this.w / 1100, .68, 1.15);
    this.spacing = Math.min(290, this.w * .445);
    this.rise = Math.min(125, this.h * .225);
    this.baseX = this.w < 600 ? this.w * .24 : this.w * .33;
    this.baseY = this.h * .735;
    this.draw(performance.now());
  }
  reset() { this.stage = 0; this.camera = 0; this.motion = null; this.collected = false; this.fallen = false; this.failedLedge = -1; this.particles = []; }
  jump(attempt, onComplete) {
    if (this.motion) return false;
    this.motion = { type: 'jump', start: performance.now(), attempt, done: onComplete, events: new Set() };
    return true;
  }
  collect(final, onComplete) {
    if (this.motion) return false;
    this.motion = { type: 'collect', start: performance.now(), final, done: onComplete, events: new Set() };
    return true;
  }
  event(m, key, t, threshold, sound) {
    if (t >= threshold && !m.events.has(key)) { m.events.add(key); if (sound) this.audio.play(sound); return true; }
    return false;
  }
  polygon(points, fill, stroke, width = 1) {
    const c = this.ctx; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
    if (fill) { c.fillStyle = this.color(fill); c.fill(); } if (stroke) { c.strokeStyle = this.color(stroke); c.lineWidth = width; c.stroke(); }
  }
  ellipse(x, y, rx, ry, color, rotation = 0) { const c = this.ctx; c.beginPath(); c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); c.fillStyle = this.color(color); c.fill(); }
  line(points, color, width = 1) { const c = this.ctx; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = this.color(color); c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
  draw(now) {
    if (this.themeTransition) {
      const t = clamp((now - this.themeTransition.start) / 350);
      this.night = lerp(this.themeTransition.from, this.themeTransition.target, ease(t));
      if (t === 1) this.themeTransition = null;
    }
    this.clock = now / 1000;
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h);
    const m = this.motion; let pose = { crouch: 0, airborne: 0, nod: 0, scramble: 0, tilt: 0, walk: 0, opacity: 1, scale: 1, focus: 0, startled: 0, relief: 0, proud: 0 };
    let goatStage = this.stage, goatLift = 0, goatDX = 0, broken = -1, crumble = 0, shelter = this.collected ? 1 : 0, ring = 0;
    let completed = null;
    if (m?.type === 'jump') {
      const t = (now - m.start) / 1000 * 1.425; // 2.00 s, including camera settling.
      const from = m.attempt.from;
      const flight = clamp((t - .37) / .83);
      goatStage = from + ease(flight);
      // Reserve clearance for the horns throughout the arc, even in short views.
      const arcClearance = Math.max(24, this.baseY - this.rise * .65 - 135 * this.s - 16);
      const arcHeight = Math.min((this.reduced ? 80 : 155) * this.s, arcClearance) * (this.reduced ? .65 : 1);
      goatLift = -Math.sin(flight * Math.PI) * arcHeight;
      if (t < .37) { pose.crouch = Math.sin(clamp(t / .37) * Math.PI / 2); pose.nod = .25 * pose.crouch; }
      else if (t < 1.20) { pose.airborne = Math.sin(flight * Math.PI); pose.crouch = .18; pose.tilt = -.15 * Math.sin(flight * Math.PI); pose.nod = -.08; }
      else { pose.crouch = .8 * (1 - ease((t - 1.20) / .28)); }
      pose.focus = t < 1.2 ? .65 + pose.crouch * .35 : 0;
      this.event(m, 'push', t, .37, 'takeoff');
      this.event(m, 'contact', t, 1.20, 'hoof');
      if (m.attempt.success) {
        if (t > 1.48 && t < 1.86) pose.scramble = Math.sin((t - 1.48) * 46) * (1 - (t - 1.48) / .38);
        if (t > 1.86 && t < 2.35) { pose.nod = Math.sin((t - 1.86) * 28) * .15 * (1 - (t - 1.86) / .49); pose.proud = Math.sin((t - 1.86) / .49 * Math.PI); }
        this.event(m, 'scramble', t, 1.49, 'scramble');
        this.camera = from + ease((t - 1.55) / 1.25);
        if (t >= 2.85) { this.stage = from + 1; this.camera = this.stage; completed = m.done; }
      } else {
        if (t >= 1.34) { broken = from + 1; crumble = clamp((t - 1.34) / 1.08); }
        if (t >= 1.34) pose.startled = 1;
        if (t >= 1.48) { pose.scramble = Math.sin(t * 48); pose.tilt = clamp((t - 1.48) / .8) * .85; goatDX = ease((t - 1.48) / .8) * 34 * this.s; }
        if (t >= 1.75) { goatLift = Math.pow((t - 1.75) / .83, 2) * this.h * 1.3; pose.airborne = 1; }
        this.event(m, 'crack', t, 1.36, 'crack'); this.event(m, 'stones', t, 1.57, 'pebbles'); this.event(m, 'bleat', t, 2.13, 'bleat');
        if (t >= 2.85) { this.fallen = true; this.failedLedge = from + 1; completed = m.done; }
      }
    } else if (m?.type === 'collect') {
      const t = (now - m.start) / 1000 * 1.65; // Bell at 0.89 s; settlement at 1.67 s.
      shelter = ease(t / .35); goatDX = ease((t - .3) / .95) * (this.shelterOffset() + 3) * this.s;
      pose.walk = t > .3 && t < 1.3 ? Math.sin((t - .3) * 23) : 0;
      // Turn into the doorway's depth, ducking under the lintel as the hooves step in.
      pose.scale = 1 - .48 * ease((t - .55) / .88);
      pose.crouch = .3 * Math.sin(clamp((t - .55) / .88) * Math.PI);
      pose.relief = ease(t / .4);
      pose.nod = t > 1.25 ? Math.sin(clamp((t - 1.25) / .35) * Math.PI) * -.30 : 0;
      pose.opacity = 1 - ease((t - 1.45) / .4);
      ring = t > 1.45 ? Math.sin((t - 1.45) * 22) * Math.exp(-(t - 1.45) * 2) : 0;
      this.event(m, 'step1', t, .55, 'hoof'); this.event(m, 'step2', t, .95, 'hoof');
      if (this.event(m, 'bell', t, 1.47, 'bell')) this.burst(m.final);
      if (m.final) this.event(m, 'summit', t, 1.8, 'summit');
      if (t >= 2.75) { this.collected = true; completed = m.done; }
    }
    if (this.reduced) { pose.tilt *= .3; pose.scramble *= .25; pose.nod *= .5; }
    this.background();
    const visible = Math.floor(this.camera);
    for (let i = Math.max(0, visible - 2); i <= Math.min(STEP_COUNT, visible + 4); i++) {
      if (i !== this.failedLedge) {
        if (i === broken && m?.attempt.variant === 'shear') this.shearLedge(i, crumble);
        else this.ledge(i, i === broken ? crumble : 0);
      }
    }
    const gx = this.baseX + (goatStage - this.camera) * this.spacing + goatDX;
    const gy = this.baseY - (goatStage - this.camera) * this.rise + goatLift - 2 * this.s;
    const sx = this.baseX + (this.stage - this.camera) * this.spacing;
    const sy = this.baseY - (this.stage - this.camera) * this.rise;
    if (shelter > 0) this.shelter(sx, sy, shelter, ring, false);
    if (!this.fallen && !this.collected) this.goat(gx, gy, pose);
    if (shelter > 0) this.shelter(sx, sy, shelter, ring, true);
    this.foreground(); this.drawParticles();
    if (completed) { this.motion = null; completed(); }
  }
  background() {
    const c = this.ctx, w = this.w, h = this.h, altitude = this.camera / STEP_COUNT;
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, this.color(altitude > .4 ? '#99cbd5' : '#b8d8d8')); sky.addColorStop(.72, this.color('#e0e9d4')); sky.addColorStop(1, this.color('#eaeacd'));
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const sunX = w * .69 - this.camera * 9, sunY = h * .20 + altitude * 55;
    const glow = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 130);
    glow.addColorStop(0, this.color('#f9f4cc80')); glow.addColorStop(1, this.color('#f9f4cc00')); c.fillStyle = glow; c.fillRect(0, 0, w, h);
    this.ellipse(sunX, sunY, 29 * this.s, 29 * this.s, '#f9f5d7');
    if (this.night > 0) {
      c.save();c.globalAlpha=this.night;
      // Craters give the pale disk a moon silhouette without masking the sky.
      this.ellipse(sunX-9*this.s,sunY-7*this.s,6*this.s,7*this.s,'#aebfd0');
      this.ellipse(sunX+10*this.s,sunY+9*this.s,4*this.s,4*this.s,'#bdcfda');
      for(let i=0;i<28;i++)this.ellipse(hash(i+80)*w,hash(i+120)*h*.30, .8+hash(i+22)*.7,.8+hash(i+22)*.7,'#dbe6e9');
      c.restore();
    }
    for (let j = 0; j < 5; j++) this.cloud((w * (.1 + j * .26) - this.camera * 13 + Math.sin(this.clock * .025 + j) * 14) % (w + 140), h * (.14 + (j % 3) * .09), (60 + hash(j) * 70) * this.s, .3);
    const farY = h * .62 + this.camera * 19;
    this.mountain(w * .19 - this.camera * 9, farY, w * .35 + 140, h * .38, '#b5cfcb', '#a2c3c2', '#e7eede');
    this.mountain(w * .58 - this.camera * 13, farY + 20, w * .47, h * .59, '#a8c7c5', '#94b8b8', '#f1f2df');
    this.mountain(w * .90 - this.camera * 17, farY + 70, w * .37, h * .50, '#9dbebb', '#8cafad', '#e0e8d7');
    this.mountain(w * .01 - this.camera * 9, farY + 68, w * .38, h * .45, '#a2c2bb', '#8cb2aa', '#d8e6d5');
    const valleyY = h * .66 + this.camera * 27;
    this.polygon([[0, valleyY - 25], [w*.15,valleyY+11], [w*.28,valleyY+70], [w*.45,valleyY+120], [w*.60,valleyY+83], [w*.72,valleyY+65], [w*.88,valleyY+30], [w,valleyY-13], [w,h+300],[0,h+300]], '#83a795');
    this.polygon([[0,valleyY+35],[w*.21,valleyY+45],[w*.38,valleyY+133],[w*.60,valleyY+180],[w*.78,valleyY+94],[w,valleyY+57],[w,h+350],[0,h+350]], '#6f9883');
    this.polygon([[w*.59,valleyY+96],[w*.53,valleyY+141],[w*.63,valleyY+179],[w*.5,h+180],[w*.49,h+180],[w*.6,valleyY+179],[w*.50,valleyY+141]], '#b1cfc1');
    for (let i = 0; i < 40; i++) {
      const x = (i / 39) * w; const yy = valleyY + 90 + Math.sin(i * .42) * 38;
      this.pine(x, yy, 13 + hash(i + 9) * 27, '#608a75');
    }
    const mist = c.createLinearGradient(0, h*.42, 0, h);
    mist.addColorStop(0, this.color('#eaf0dc00')); mist.addColorStop(.52, this.color('#eaf0dc1c')); mist.addColorStop(1, this.color('#eaf0dc55')); c.fillStyle=mist; c.fillRect(0,0,w,h);
    if (this.camera > 1) for (let i=0;i<5;i++) this.cloud(w * (i*.27) - Math.sin(this.clock*.025+i)*30, h*.77 + Math.sin(i*2)*40 + (this.camera%1)*10, w*.22, clamp(this.camera/STEP_COUNT)*.55);
    // Fine wind strokes and a distant pair of birds give the landscape a little life.
    c.globalAlpha=.22;
    for(let i=0;i<6;i++){ const x=((this.clock*15 + i*223)%(w+110))-55; const y=h*.30+hash(i+12)*h*.34; this.line([[x,y],[x+18,y-2],[x+35,y]],'#fffde7',1); }
    c.globalAlpha=1;
    for(let i=0;i<2;i++){const x=w*.72 + i*22 + Math.sin(this.clock*.16)*18, y=h*.30+i*12; const flap=Math.sin(this.clock*2+i)*2; this.line([[x-4,y+flap],[x,y+2],[x+5,y+flap]],'#75988b',1);}
  }
  cloud(x,y,size,alpha) {
    const c=this.ctx; c.save(); c.globalAlpha=alpha; const g=c.createRadialGradient(x,y,1,x,y,size);g.addColorStop(0, this.color('#fcfbea'));g.addColorStop(1, this.color('#fcfbea00'));c.fillStyle=g;c.save();c.translate(x,y);c.scale(1,.25);c.fillRect(-size,-size,size*2,size*2);c.restore();c.restore();
  }
  mountain(x, bottom, width, height, light, dark, snow) {
    const top=bottom-height;
    this.polygon([[x-width*.6,bottom+100],[x-width*.3,top+height*.44],[x-width*.16,top+height*.26],[x,top],[x+width*.15,top+height*.25],[x+width*.35,top+height*.5],[x+width*.6,bottom+100]],light);
    this.polygon([[x,top],[x+width*.06,top+height*.39],[x-width*.02,top+height*.56],[x+width*.2,bottom+100],[x+width*.6,bottom+100],[x+width*.35,top+height*.5],[x+width*.15,top+height*.25]],dark);
    this.polygon([[x-width*.16,top+height*.26],[x,top],[x+width*.15,top+height*.25],[x+width*.1,top+height*.22],[x+width*.04,top+height*.32],[x-width*.005,top+height*.20],[x-width*.07,top+height*.28],[x-width*.1,top+height*.23]],snow);
    this.line([[x-width*.05,top+height*.32],[x-width*.09,top+height*.46],[x-width*.16,top+height*.57]],light,2);
  }
  pine(x,y,size,color) {
    this.line([[x,y],[x,y-size]],color,2);
    this.polygon([[x,y-size],[x-size*.23,y-size*.53],[x-size*.13,y-size*.55],[x-size*.34,y-size*.18],[x-size*.17,y-size*.24],[x-size*.4,y],[x+size*.37,y],[x+size*.17,y-size*.25],[x+size*.3,y-size*.2],[x+size*.13,y-size*.58],[x+size*.22,y-size*.53]],color);
  }
  ledge(index, crumble) {
    const c=this.ctx,s=this.s;
    const x=this.baseX+(index-this.camera)*this.spacing, y=this.baseY-(index-this.camera)*this.rise;
    if(x < -240 || x > this.w+250 || y < -160 || y > this.h+300) return;
    const half=this.ledgeHalf(index)*s;
    c.save(); c.translate(x,y);
    const drop=crumble>.23 ? Math.pow((crumble-.23)*2,2)*220 : 0;
    if(crumble>.23){c.translate(0,drop);c.rotate((crumble-.23)*(this.reduced ? .04 : .24));c.globalAlpha=1-clamp((crumble-.7)/.3);}
    const depth=(620+hash(index)*220)*s;
    this.polygon([[-half,-1],[-half-10*s,15*s],[-half+12*s,62*s],[-half+28*s,depth*.43],[-half+50*s,depth*.9],[-half+66*s,depth],[half-23*s,depth*.70],[half-10*s,depth*.31],[half+7*s,20*s],[half-3*s,2*s]],'#727e6a');
    this.polygon([[-half,9*s],[-half+12*s,58*s],[-half+31*s,depth*.53],[-half+50*s,depth*.9],[-half+60*s,depth*.68],[-half+45*s,depth*.39],[-half+49*s,41*s],[-half+29*s,9*s]],'#919781');
    this.polygon([[half*.14,12*s],[half*.4,37*s],[half*.23,depth*.29],[half*.42,depth*.49],[half*.15,depth*.78],[half-23*s,depth*.70],[half-10*s,depth*.31],[half+7*s,20*s]],'#616f60');
    this.polygon([[-half+28*s,60*s],[-half+50*s,73*s],[-half+36*s,depth*.55],[-half+44*s,depth*.75],[-half+26*s,depth*.41]],'#a2a28a');
    for(let j=0;j<6;j++){
      const yy=(35+j*31)*s; const left=-half+12*s+j*3*s;
      this.line([[left,yy],[left+half*.5,yy+5*s],[left+half*.77,yy],[half-10*s-j*4*s,yy+6*s]],j%2?'#a3a58b65':'#4d615650',1.4*s);
    }
    this.polygon([[-half,0],[-half+12*s,-9*s],[-half*.3,-13*s],[half*.42,-10*s],[half-3*s,-6*s],[half+7*s,3*s],[half-13*s,15*s],[half*.31,18*s],[-half*.38,12*s],[-half-10*s,8*s]],'#aab28a');
    this.polygon([[-half,-1],[-half+12*s,-9*s],[-half*.3,-13*s],[half*.42,-10*s],[half-3*s,-6*s],[half+7*s,3*s],[half*.5,5*s],[half*.18,1*s],[-half*.4,4*s]],index<4?'#c1ce93':'#c4c8a1');
    this.line([[-half+5*s,-3*s],[-half*.35,-9*s],[half*.3,-7*s],[half-6*s,-2*s]],'#e0e3b6',2*s);
    if(index>2 || crumble>0){
      this.line([[half*.38,-8*s],[half*.25,0],[half*.39,8*s],[half*.12,16*s],[half*.18,35*s]],'#536154',Math.max(1,crumble*5)*s);
      if(crumble>0)this.line([[half*.25,0],[-half*.14,-6*s],[-half*.4,1*s],[-half*.6,10*s]],'#475749',crumble*5*s);
    }
    for(let j=0;j<(index<4?6:2);j++){
      const xx=-half+15*s+hash(index*4+j)*half*1.6;
      this.line([[xx,-7*s],[xx-3*s,-14*s],[xx+1*s,-10*s],[xx+5*s,-17*s]],'#879855',1*s);
    }
    if(index===0){
      this.line([[-half+60*s,-7*s],[-half+60*s,-38*s]],'#697352',3*s);
      this.polygon([[-half+43*s,-39*s],[-half+76*s,-39*s],[-half+82*s,-32*s],[-half+76*s,-25*s],[-half+43*s,-25*s]],'#e6ddad');
      c.fillStyle='#77805d';c.font=`600 ${6*s}px sans-serif`;c.textAlign='center';c.fillText('BASE CAMP',-half+61*s,-29*s);
    }
    if(index>0){
      c.font=`500 ${10*s}px 'DM Sans', sans-serif`;c.textAlign='center';c.fillStyle='#f5f6df';
      const label=index===STEP_COUNT?'THE SUMMIT':`LEDGE ${String(index).padStart(2,'0')}`;
      c.globalAlpha*=.8;c.fillText(label,0,39*s);
      if(index===STEP_COUNT){this.line([[half-15*s,-4*s],[half-15*s,-59*s]],'#606b4e',2*s);this.polygon([[half-15*s,-59*s],[half+15*s,-50*s],[half-15*s,-42*s]],'#d88558');}
    }
    c.restore();
    if(crumble>.15)for(let j=0;j<(this.reduced?3:7);j++){
      const t=clamp((crumble-.15)*1.2), px=x+(hash(j+index)*2-1)*half*(1+t),py=y+20+t*t*350+hash(j)*t*90;
      c.save();c.translate(px,py);c.rotate(t*6+j);this.polygon([[-5*s,-3*s],[4*s,-5*s],[7*s,2*s],[-2*s,6*s]],j%2?'#8a947c':'#616f60');c.restore();
    }
  }
  ledgeHalf(index) { return index === 0 ? 108 : 91 - index * (45.6 / STEP_COUNT); }
  shearLedge(index, progress) {
    if (progress >= 1) return;
    const c = this.ctx, s = this.s;
    const x = this.baseX + (index - this.camera) * this.spacing;
    const y = this.baseY - (index - this.camera) * this.rise;
    const half = this.ledgeHalf(index) * s;
    // The main section shears first; the unsupported edge follows shortly
    // afterward. Both pieces leave the scene instead of leaving a thin pillar.
    const cut = x - half * .48;
    const edgeFall = clamp((progress - .28) / .72);
    c.save();
    c.translate(-edgeFall * (this.reduced ? 6 : 18) * s, edgeFall * edgeFall * (this.h + 160));
    c.globalAlpha = 1 - ease((progress - .72) / .28);
    c.beginPath(); c.rect(x - half - 20*s, y - 90*s, half * .52 + 20*s, this.h + 900); c.clip();
    this.ledge(index, 0); c.restore();
    const slide = ease((progress - .12) / .7);
    c.save(); c.translate(slide * (this.reduced ? 12 : 43) * s, slide * slide * (this.h + 80));
    c.globalAlpha = 1 - ease((progress - .72) / .28);
    c.beginPath(); c.rect(cut, y - 90*s, half * 1.52 + 20*s, this.h + 900); c.clip();
    this.ledge(index, 0); c.restore();
    if (progress < .28) this.line([[cut,y-8*s],[cut+3*s,y+23*s],[cut-2*s,y+55*s]], '#48584c', 2.5*s);
    if (progress > .2 && progress < .9) for (let i=0;i<(this.reduced?2:4);i++) {
      const t=progress-.2;
      this.polygon([[cut+i*7*s,y+28+t*t*340],[cut+4*s+i*7*s,y+33+t*t*340],[cut+i*7*s,y+38+t*t*340]], '#7b8871');
    }
  }
  goat(x,y,p) {
    const c=this.ctx,s=this.s*1.04*p.scale;
    c.save();c.translate(x,y);c.scale(s,s);c.globalAlpha=p.opacity;
    if(p.airborne<.15 && Math.abs(p.tilt)<.25)this.ellipse(-2,1,35,3,'#49564030');
    c.rotate(p.tilt);
    // Presentation-only leg lengthening: the hips and body rise by this many units while
    // the toes stay on the ground line, so the visible leg is roughly 60% longer.
    const legLength=12;
    const hipY=-28-legLength+p.crouch*8;
    // Jointed legs, longer than before. Toes stay anchored while the hips compress.
    const leg=(hx,far)=>{
      const rear=hx<0;
      const fx=hx+(rear?-12:14)*p.airborne+p.scramble*(rear?3:-3)+p.walk*(rear?-4:4);
      const fy=-2-p.airborne*(rear?10:17)-Math.abs(p.walk)*2;
      const kneeX=hx+(rear?5:-2)+p.crouch*(rear?7:-6);
      this.line([[hx,hipY],[kneeX,(hipY+fy)*.5],[fx,fy-5]],far?'#c6c9b0':'#f4efd8',far?8:10);
      this.polygon([[fx-6,fy-6],[fx+4,fy-6],[fx+7,fy],[fx-6,fy]],far?'#596052':'#414b40');
      this.line([[fx+1,fy-4],[fx+2,fy]],'#aeb49b',1.2);
    };
    c.save();c.translate(-5,-1);leg(-23,true);leg(18,true);c.restore();
    // A single bean-shaped body and one shadow, without fur or muscle detail.
    this.ellipse(-42,hipY-20,9,5,'#f4efd8',.65);
    const stretch = p.airborne*2 + p.crouch*2;
    this.ellipse(-10,hipY-13,34+stretch,24-p.crouch*2-p.airborne,'#d7dac0');
    this.ellipse(-11,hipY-17,33+stretch,23-p.crouch*2-p.airborne,'#f7f0d9');
    leg(-23,false);leg(18,false);
    c.save();c.translate(22,hipY-36);c.rotate(p.nod*.65-(p.proud||0)*.06);
    // Broad hooked horns and big ears make a goat silhouette at small sizes.
    const horn=(dx,shade)=>{
      c.beginPath();c.moveTo(dx,-15);c.bezierCurveTo(dx-1,-35,dx-13,-43,dx-23,-34);
      c.bezierCurveTo(dx-29,-28,dx-25,-22,dx-23,-23);
      c.bezierCurveTo(dx-26,-33,dx-15,-35,dx-11,-25);c.lineTo(dx-8,-13);c.closePath();c.fillStyle=shade;c.fill();
    };
    horn(-4,'#74785f');horn(13,'#989177');
    this.line([[4,-28],[10,-31]],'#c6bc98',2);
    const earTilt = -.28-p.focus*.3+p.startled*.55+p.relief*.16;
    this.ellipse(-16,-8,13,7,'#d3d7bc',earTilt);
    this.ellipse(7,-1,25,25,'#dedfc4');
    this.ellipse(6,-4,24,24,'#fff4da');
    this.polygon([[5,17],[7,29],[12,25],[15,31],[19,18]],'#c4ccb0');
    this.ellipse(-16,-10,14,7,'#f7efd5',earTilt);
    this.ellipse(-19,-10,7,3,'#b5bea0',earTilt);
    // Three-quarter face: large lively eyes, asymmetrical brows and a short muzzle.
    const eye=(ex,ey,rx)=>{
      const blink = this.clock%5.8>5.65 && !p.startled;
      if(blink) { this.line([[ex-rx,ey],[ex+rx,ey]],'#526047',2);return; }
      this.ellipse(ex,ey,rx,7+p.startled*1.5-p.focus-p.relief,'#fffdf0');
      this.ellipse(ex+1.8,ey+.4,3.4,4.8,'#526047');
      this.ellipse(ex+2.5,ey+.5,1.8,3.1,'#283d32');
      this.ellipse(ex+1,ey-1.9,1.2,1.2,'#fffdf0');
    };
    eye(3,-5,6);eye(19,-6,5.7);
    const browLift = p.startled*6+p.relief*2+(p.proud||0)*1.5;
    this.line([[-3,-13-browLift],[7,-10.8-browLift-p.focus]],'#66714f',2.7);
    this.line([[14,-12-browLift-p.focus],[23,-14-browLift]],'#66714f',2.6);
    this.ellipse(19,10,15,10,'#d1d6b5');
    this.ellipse(26,6,2.2,1.6,'#58654b');
    if(p.startled) this.ellipse(22,14,4,4.8,'#4d6147');
    else {
      c.beginPath();c.moveTo(12,13);c.quadraticCurveTo(22,19+p.relief*2-p.focus*3,29,12-p.relief);c.strokeStyle='#4d6147';c.lineWidth=1.9;c.lineCap='round';c.stroke();
      this.line([[28,11-p.relief],[30,13-p.relief]],'#4d6147',1.5);
    }
    c.restore();c.restore();
  }
  shelterOffset() { return Math.min(40, this.ledgeHalf(this.stage) - 36); }
  shelter(x,y,amount,ring,front) {
    const c=this.ctx,s=this.s; c.save();c.translate(x+this.shelterOffset()*s,y-3*s);c.scale(s,s);c.globalAlpha=amount;
    if(!front){
      this.polygon([[-23,0],[-23,-51],[7,-72],[34,-52],[34,0]],'#c4ae7e');
      this.polygon([[7,-72],[34,-52],[34,0],[7,-3]],'#9e8f68');
      for(let i=0;i<4;i++)this.line([[-23,-11-i*10],[7,-11-i*10]],'#ac966c',1);
      this.polygon([[-31,-50],[6,-79],[41,-51],[35,-45],[6,-65],[-26,-44]],'#4b6550');
      this.polygon([[-12,0],[-12,-32],[-6,-39],[3,-39],[9,-32],[9,0]],'#354a3a');
      this.ellipse(-1,-24,5,8,'#eac27925');
      this.line([[20,-17],[29,-17],[29,-31],[20,-31],[20,-17]],'#dac594',2);
      this.polygon([[21,-18],[28,-18],[28,-30],[21,-30]],'#718672');
    } else {
      c.save();c.translate(-1,-52);c.rotate(ring*.3);
      this.line([[0,-10],[0,-5]],'#6f6646',1.5);
      this.polygon([[-5,3],[-4,-4],[0,-6],[4,-4],[5,3]],'#e8bd67');this.line([[-6,4],[6,4]],'#98753e',2);this.ellipse(ring*2,6,1.5,2,'#7f6948');c.restore();
      if(Math.abs(ring)>.15){c.globalAlpha=Math.abs(ring)*.7;this.line([[-17,-60],[-21,-65]],'#f7e8aa',2);this.line([[13,-60],[17,-65]],'#f7e8aa',2);}
    }
    c.restore();
  }
  foreground(){
    const c=this.ctx,h=this.h,w=this.w;
    if(this.camera<2.5){c.save();c.globalAlpha=1-clamp(this.camera/2.5);const down=this.camera*80;
      this.polygon([[0,h-40+down],[w*.12,h-22+down],[w*.28,h+38+down],[0,h+80]],'#496d50');
      for(let i=0;i<7;i++)this.pine(i*23-15,h+32+down,70+hash(i+33)*60,'#3e634d');
      for(let i=0;i<5;i++)this.pine(w-15-i*23,h+60+down,70+hash(i+54)*70,'#557653');c.restore();}
    const g=c.createLinearGradient(0,h-95,0,h);g.addColorStop(0, this.color('#274f3d00'));g.addColorStop(1, this.color('#274f3d22'));c.fillStyle=g;c.fillRect(0,h-95,w,95);
  }
  burst(final) { const count=this.reduced?12:final?100:42; for(let i=0;i<count;i++) this.particles.push({born:this.clock,x:this.baseX+this.shelterOffset()*this.s,y:this.baseY-50*this.s,vx:(hash(i+2)*2-1)*(final?210:125),vy:-90-hash(i+88)*170,color:['#eef2cf','#d9b96b','#d4e4a3','#efb184'][i%4],size:2+hash(i)*4}); }
  drawParticles(){const c=this.ctx;this.particles=this.particles.filter(p=>this.clock-p.born<2.7);for(const p of this.particles){const t=this.clock-p.born;c.save();c.globalAlpha=1-clamp((t-1)/1.7);c.translate(p.x+p.vx*t,p.y+p.vy*t+90*t*t);c.rotate(t*3);c.fillStyle=p.color;c.fillRect(-p.size/2,-p.size/2,p.size,p.size*.55);c.restore();}}
}
