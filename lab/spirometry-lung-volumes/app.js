'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const presets = {normal:{r:1,c:1,label:'Normal'}};
function model(r=1,c=1,effort=1){
 r=clamp(Number(r)||1,.5,4);c=clamp(Number(c)||1,.4,2.5);effort=clamp(Number(effort)||1,.65,1);
 const vc=4800*Math.pow(clamp(c,.4,1.3),.6),rv=1200*(1+.6*Math.max(0,c-1))+400*Math.max(0,r-1.5)/2.5;
 const tv=500*vc/4800,erv=1200*vc/4800,irv=vc-tv-erv;
 const fvc=vc*(1-.15*Math.max(0,r-2)/2)*effort,tau=(-1/Math.log(.2))*r/Math.max(1/c,.3)/effort;
 const fev1=fvc*(1-Math.exp(-1/tau));
 return {r,c,effort,vc,rv,tv,erv,irv,tlc:vc+rv,frc:rv+erv,ic:tv+irv,fvc,tau,fev1,ratio:clamp(fev1/fvc,0,1)};
}
const baseline=model();
const lessonSteps=[
 {title:'Start with an ordinary breath',state:'normal',scene:'quiet',caption:'A <dfn>spirogram</dfn> traces changing air volume over time. <dfn>Tidal volume</dfn> is the air moving in and out during a quiet breath. The small waves show that most air stays inside.',question:'During quiet breathing, do the lungs empty completely?',choices:['Yes, every breath empties them','No, only a small part moves'],answer:1,why:'Quiet breathing moves tidal air around a much larger resting volume.',callout:'Tidal air moves; most air stays inside'},
 {title:'Find the reserve on either side',state:'normal',scene:'volumes',caption:'<dfn>Inspiratory reserve</dfn> is extra air you can draw in after a quiet breath in. <dfn>Expiratory reserve</dfn> is extra air you can push out after a quiet breath out. <dfn>Residual volume</dfn> is the air still left.',question:'After your strongest breath out, what remains?',choices:['No air at all','Residual air','Inspiratory reserve'],answer:1,why:'Residual volume stays in the lungs even after maximal exhalation.',callout:'Residual air never leaves'},
 {title:'Build the capacities',state:'normal',scene:'capacities',caption:'A <dfn>capacity</dfn> combines volumes. <dfn>Inspiratory capacity</dfn> combines tidal air and inspiratory reserve. <dfn>Functional residual capacity</dfn> combines expiratory reserve and residual air. <dfn>Vital capacity</dfn> is all movable air. <dfn>Total lung capacity</dfn> includes residual air too.',question:'Which capacity includes every volume?',choices:['Vital capacity','Total lung capacity','Inspiratory capacity'],answer:1,why:'Total capacity combines tidal air, both reserves and residual air.',callout:'Capacities combine the coloured volumes'},
 {title:'The air a spirometer cannot see',state:'normal',scene:'hidden',caption:'<dfn>Spirometry</dfn> measures air passing through a mouthpiece. Residual air never passes through, so it and capacities containing it are invisible. Body plethysmography uses an enclosed box; gas dilution tracks a gas mixture to estimate the air remaining.',question:'Can spirometry alone measure total lung capacity?',choices:['Yes, just blow harder','No, it includes residual air'],answer:1,why:'Residual volume, functional residual capacity and total lung capacity require another measurement.',callout:'Residual air: outside the spirometer’s view'},
 {title:'Blow out a forced breath',state:'normal',scene:'forced',caption:'<dfn>Forced vital capacity</dfn> is the total air blown out after the deepest breath in. <dfn>Forced expiratory volume in the first second</dfn> is the early part. Their <dfn>ratio</dfn> tells us what fraction of the total leaves early.',question:'What does the early part of this curve measure?',choices:['Air left inside','Air exhaled in the first second','All air in the lung'],answer:1,why:'The early volume is part of the total forced breath, not air left inside.',callout:'Early exhaled air / total forced breath'},
 {title:'Read the same breath two ways',state:'normal',scene:'linked',caption:'<dfn>Flow</dfn> is how quickly air moves. A <dfn>flow–volume loop</dfn> plots flow against air already exhaled. Its upper limb shows breathing out; the lower limb shows breathing in. The moving dots follow the same breath on both pictures.',question:'What does the upper part of the loop show?',choices:['Breathing out','Breathing in','Air remaining at rest'],answer:0,why:'Positive outward flow draws the upper limb while the volume–time curve rises.',callout:'One breath, two linked views'},
 {title:'Keep the fraction and size together',state:'normal',scene:'forced',caption:'The early fraction describes speed of emptying, not lung size. A smaller breath can have a preserved fraction. A low fraction suggests an <dfn>obstructive pattern</dfn>: air has difficulty getting out. A reduced measured total capacity defines a <dfn>restrictive pattern</dfn>.',question:'Can a preserved early fraction prove total capacity is normal?',choices:['Yes','No, a fraction does not tell total size'],answer:1,why:'The early volume and total forced breath can both fall while their fraction stays similar.',callout:'Read speed and total size together'},
 {title:'Check the quality before the pattern',state:'normal',scene:'linked',caption:'A forced test needs a deep breath in, a strong start and continued exhalation. Low effort can imitate disease. Compare repeated acceptable breaths before interpreting the pattern. Next, explore how airway resistance and ease of lung stretch change the pictures.',question:'What should come before interpreting an unusual curve?',choices:['Checking the quality of the effort','Naming a disease immediately'],answer:0,why:'Poor effort can lower the measured volumes and flows without establishing disease.',callout:'A useful pattern starts with acceptable effort'}
];
let steps=lessonSteps;
let step=0,progress=0,playing=false,last=0,frame=0;
const predictions=new Map();
let cv=null,selectedClinical='normal',selectedPreset='normal';
const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function svg(content,label,extra='') {return `<svg class="plot ${extra}" viewBox="0 0 360 280" role="img" aria-label="${htmlEscape(label)}">${content}</svg>`;}
function path(points){return points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');}
function out(m,t){return m.fvc*(1-Math.exp(-t/m.tau));}
function flow(m,t){return m.fvc/m.tau*Math.exp(-t/m.tau)*(1-Math.exp(-t/.027));}
function drawPictures(target,m,p=1,scene='forced',callout='',technical=false){
 // Both plots share a window reaching at least 99.99% of modeled expiration.
 const duration=['quiet','volumes','capacities','hidden'].includes(scene)?8:Math.max(8,m.tau*Math.log(10000));
 const x=t=>48+t/duration*285,y=v=>225-v/7500*165;
 const curve=(a,q)=>path(Array.from({length:121},(_,i)=>{const t=i/120*duration*q;return[x(t),y(out(a,t))];}));
 const early=scene==='quiet'||scene==='volumes'||scene==='capacities'||scene==='hidden';
 let trace;
 if(early){
  const volume=t=>{if(scene==='quiet')return m.frc+m.tv*(1-Math.cos(t*Math.PI))/2;if(t<2)return m.frc+m.tv*(1-Math.cos(t*Math.PI))/2;if(t<4)return m.frc+(m.tv+m.irv)*(1-Math.cos((t-2)*Math.PI/2))/2;if(t<6)return m.tlc-(m.vc)*(1-Math.cos((t-4)*Math.PI/2))/2;return m.rv+(m.erv)*(1-Math.cos((t-6)*Math.PI/2))/2;};
  trace=`<path class="ghost" data-ghost d="${path(Array.from({length:121},(_,i)=>[x(i/15),y(volume(i/15))]))}"/><path class="current quiet" data-current d="${path(Array.from({length:121},(_,i)=>[x(i/120*8*p),y(volume(i/120*8*p))]))}"/>`;
 }else trace=`<path class="ghost" data-ghost d="${curve(baseline,1)}"/><path class="current" data-current d="${curve(m,p)}"/><circle class="marker" cx="${x(duration*p)}" cy="${y(out(m,duration*p))}" r="5"/>${p>=1/duration?`<path class="guide" d="M${x(1)},225 V${y(m.fev1)} H48"/><text x="${x(1)+5}" y="${y(m.fev1)-9}">${technical?'FEV1 at 1 s':'Early volume'}</text>`:''}<text x="215" y="${Math.max(55,y(m.fvc)-10)}">${technical?'FVC limit':'Total breath'}</text>`;
 let traceSVG=svg(`<text x="18" y="25">${technical?'Volume exhaled (L) ↑':early?'Air in lungs ↑':'Air exhaled ↑'}</text><path class="axis" d="M48 45 V225 H338"/><text x="240" y="259">${technical?'Time (s) →':'Time →'}</text>${technical?`<text x="44" y="245">0</text><text x="${x(1)}" y="245">1</text><text x="326" y="245">${duration.toFixed(1)}</text>`:''}${trace}<text class="callout" x="48" y="46">${htmlEscape(early?(scene==='quiet'?'Quiet tidal breaths':scene==='hidden'?'Residual air stays inside':scene==='capacities'?'Combine the volumes':'A maximal breath'):scene==='linked'?'Same moment on both curves':technical?'Illustrative forced expiration':callout.length>36?'Watch the early part of the breath':callout)}</text>`,early?'Lung volume through quiet and maximal breaths. '+callout:'Volume–time spirogram. '+callout);
 if(scene==='capacities'){
  const parts=[['Residual',40,'#626b75'],['Exp. reserve',40,'#9b620e'],['Tidal',17,'#14756e'],['Insp. reserve',103,'#254dff']];
  let base=242;
  const stack=parts.map(([label,h,color])=>{base-=h;return `<rect x="22" y="${base}" width="105" height="${h}" fill="${color}"/><text class="bar-label" x="74" y="${base+h/2+5}" text-anchor="middle">${label}</text>`;}).join('');
  const brackets=[[151,42,242,'Total'],[204,42,202,'Vital'],[257,42,162,'Insp.'],[310,162,242,'Resting']].map(([x,top,bottom,label])=>`<path class="axis" d="M${x-5} ${top} H${x} V${top+(bottom-top)*p} H${x-5}"/><text x="${x}" y="${label==='Resting'?146:26}" text-anchor="middle">${label}</text>`).join('');
  traceSVG=svg(stack+brackets,'Capacity brackets: total includes every volume; vital excludes residual; inspiratory combines tidal and inspiratory reserve; resting combines residual and expiratory reserve.');
 }

 const lx=v=>48+v/6500*285,ly=f=>165-f/14000*120;
 const loop=(a,q)=>{
  const pts=Array.from({length:361},(_,i)=>{const t=Math.pow(i/360,2)*duration*q;return[lx(out(a,t)),ly(flow(a,t))];});
  if(q===1){const endVolume=out(a,duration);pts.push([lx(endVolume),ly(0)]);for(let i=0;i<=70;i++){const u=1-i/70;pts.push([lx(endVolume*u),ly(-3300*Math.sin(Math.PI*u)/Math.pow(a.r,.3))]);}}
  return path(pts);
 };
 const loopSVG=(!technical && scene!=='linked' && !(scene==='forced' && step>=5)) ? svg('<text x="48" y="110">Follow the changing air volume.</text><text x="48" y="140">A second view comes in step 6.</text>', 'The second view is introduced in step 6.') : svg(`<text x="18" y="25">${technical?'Flow (L/s) ↑':'Airflow ↑'}</text><path class="axis" d="M48 43 V225 M48 165 H338"/><text x="217" y="259">${technical?'Volume (L) →':'Air exhaled →'}</text><text x="268" y="153">Out</text><text x="268" y="212">In</text><path class="ghost" data-ghost d="${loop(baseline,1)}"/><path class="current" data-current d="${loop(m,early?0:p)}"/>${!early?`<circle class="marker" cx="${lx(out(m,duration*p))}" cy="${ly(flow(m,duration*p))}" r="5"/>`:''}${early?'<text x="67" y="82">A forced breath comes later</text>':''}`, 'Flow–volume loop: dashed normal and solid current breath.');
 const colors=['#626b75','#9b620e','#14756e','#254dff'];
 const labels=scene==='quiet'?['Air staying inside','Extra air below','Tidal','Extra air above']:['Residual','Exp. reserve','Tidal','Insp. reserve'];
 const vals=[m.rv,m.erv,m.tv,m.irv];
 const phone=window.matchMedia('(max-width:599px)').matches;
 const bottom=phone?230:480, scale=phone?170/8500:420/8500;
 let total=0;
 const bars=vals.map((v,i)=>{const h=v*scale,by=bottom-total-h;total+=h;return `<rect x="${phone?23:18}" y="${by}" width="${phone?65:119}" height="${h}" fill="${colors[i]}"/><text ${phone?'': 'class="bar-label" text-anchor="middle"'} x="${phone?100:77.5}" y="${by+h/2+4}">${technical?(phone?['RV','ERV','TV','IRV'][i]+': '+Math.round(v):['RV','ERV','TV','IRV'][i]):labels[i]}</text>`;}).join('');
 const cap=scene==='capacities'?`<text x="${phone?100:12}" y="${phone?257:525}">${phone?'All air: total capacity':'All air: total'}</text>`:'';
 const barSVG=`<svg class="plot volume-plot" viewBox="${phone?'0 0 360 280':'0 0 155 560'}" role="img" aria-label="${scene==='quiet'?'Tidal air and air staying inside the lungs.':'Stacked lung volumes: inspiratory reserve, tidal, expiratory reserve and residual air.'}"><text x="${phone?20:12}" y="25">${technical?'Volumes (mL)':'Lung volumes'}</text>${bars}${cap}<text x="${phone?20:12}" y="${phone?55:62}">${scene==='hidden'?'Residual stays':technical?'TLC '+Math.round(m.tlc):scene==='quiet'?'Air in lungs':'All air = total'}</text></svg>`;
 $(target).innerHTML=`<div class="pictures"><div class="traces">${traceSVG}${loopSVG}</div>${barSVG}</div>${callout?`<div class="diagram-callout">${htmlEscape(callout)}</div>`:''}`;
}
function summaryText(m){return `Illustrative model: FEV1 ${(m.fev1/1000).toFixed(2)} L, FVC ${(m.fvc/1000).toFixed(2)} L, ratio ${m.ratio.toFixed(2)}. TLC ${(m.tlc/1000).toFixed(2)} L. ${m.ratio<.7?'Slow early emptying in this model.':'Early fraction preserved in this model.'}`;}
function stop(){playing=false;cancelAnimationFrame(frame);$('#play').textContent='Play breath';}
function renderLesson(){
 stop();progress=0;$('#scrubber').value=0;
 const current=$(`#steps [data-step="${step+1}"]`);current.append($('#lesson-visual'),$('.prediction'),$('.player'));
 $$('#steps [data-step]').forEach((el,i)=>el.hidden=i!==step);
 const s=steps[step];
 $('[data-step-progress]').textContent=`Step ${step+1} of ${steps.length}`;
 $('[data-step-back]').disabled=step===0;$('[data-step-next]').textContent=step===steps.length-1?'Start again ↺':'Next →';
 $('#picture-state').textContent=s.title;
 $('#lesson-picture').dataset.scene=s.scene;
 $('#prediction-question').textContent=s.question;
 $('#prediction-options').innerHTML=s.choices.map((c,i)=>`<button data-prediction="${i}" aria-pressed="false">${htmlEscape(c)}</button>`).join('');
 $$('#prediction-options button').forEach(b=>b.addEventListener('click',()=>{if(!predictions.has(step)){predictions.set(step,Number(b.dataset.prediction));updatePrediction();}}));
 updatePrediction();drawLesson();
}
function updatePrediction(){
 const s=steps[step],a=predictions.get(step),answered=a!==undefined;
 $('#play').disabled=!answered;$('#replay').disabled=!answered;$('#scrubber').disabled=!answered;
 $$('#prediction-options button').forEach((b,i)=>{b.disabled=answered;b.classList.toggle('selected',i===a);b.classList.toggle('correct',answered&&i===s.answer);b.setAttribute('aria-pressed',String(i===a));});
 $('#prediction-feedback').textContent=answered?`${a===s.answer?'Correct.':'Not quite.'} ${s.why}`:'Choose a prediction to unlock the breath.';
}
function drawLesson(){
 const s=steps[step],target=presets[s.state]||presets.normal;
 const a=presets.normal;
 const morph=predictions.has(step)?progress:0;
 const m=model(a.r+(target.r-a.r)*morph,a.c+(target.c-a.c)*morph);
 drawPictures('#lesson-picture',m,progress,s.scene,s.callout,false);
 const announcement=`${s.title}. ${s.callout}. ${progress===0?'Breath at start.':progress===1?'Breath complete.':'Breath in progress.'}`;
 if($('#lesson-picture-summary').textContent!==announcement)$('#lesson-picture-summary').textContent=announcement;
}
function navigate(delta,focus=true){
 const n=step+delta;step=n>=steps.length?0:clamp(n,0,steps.length-1);renderLesson();history.replaceState(null,'',`#step-${step+1}`);
 if(focus)$(`#steps [data-step="${step+1}"] h2`).focus({preventScroll:true});
}
function play(restart=false){
 if(!predictions.has(step))return;
 if(playing){stop();return;}
 if(reduced.matches){progress=1;$('#scrubber').value=100;drawLesson();return;}
 if(restart||progress>=1)progress=0;
 playing=true;last=performance.now();$('#play').textContent='Pause';
 function tick(now){if(!playing)return;progress=clamp(progress+(now-last)/6000*Number($('#speed').value),0,1);last=now;$('#scrubber').value=Math.round(progress*100);drawLesson();if(progress>=1)stop();else frame=requestAnimationFrame(tick);}
 frame=requestAnimationFrame(tick);
}
function setupLesson(){
 $('#steps').innerHTML=steps.map((s,i)=>`<article data-step="${i+1}" data-step-title="${htmlEscape(s.title)}"${i?' hidden':''}><div class="step-copy"><p class="step-kicker">${String(i+1).padStart(2,'0')} / THE BREATH, EXPLAINED</p><h2 tabindex="-1">${s.title}</h2><p class="caption">${s.caption}</p></div></article>`).join('');
 const hash=location.hash.match(/^#step-(\d+)$/);step=hash?clamp(Number(hash[1])-1,0,steps.length-1):0;
 $('[data-step-back]').addEventListener('click',()=>navigate(-1));$('[data-step-next]').addEventListener('click',()=>navigate(1));
 $('#play').addEventListener('click',()=>play());$('#replay').addEventListener('click',()=>{stop();play(true);});
 $('#scrubber').addEventListener('input',e=>{stop();progress=Number(e.target.value)/100;drawLesson();});
 $('#lesson').addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||e.target.closest('[role=tablist]'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();navigate(e.key==='ArrowRight'?1:-1);}if(e.code==='Space'&&!e.target.matches('button')){e.preventDefault();play();}});
 window.addEventListener('hashchange',()=>{const n=location.hash.match(/^#step-(\d+)$/);if(n){step=clamp(+n[1]-1,0,steps.length-1);renderLesson();}});
 renderLesson();
}
function selectTab(id,focus=false){stop();$$('[role=tab]').forEach(t=>{const chosen=t.getAttribute('aria-controls')===id;t.setAttribute('aria-selected',String(chosen));t.tabIndex=chosen?0:-1;$('#'+t.getAttribute('aria-controls')).hidden=!chosen;if(chosen&&focus)t.focus();});}
$$('[role=tab]').forEach((t,i)=>{t.addEventListener('click',()=>selectTab(t.getAttribute('aria-controls')));t.addEventListener('keydown',e=>{const tabs=$$('[role=tab]');let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;if(e.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;if(e.key==='Home')n=0;if(e.key==='End')n=tabs.length-1;if(n!==undefined){e.preventDefault();selectTab(tabs[n].getAttribute('aria-controls'),true);}});});
function setupExplore(){
 $('#presets').innerHTML=Object.entries(presets).map(([id,s])=>`<button data-preset="${id}" aria-pressed="${id==='normal'}">${s.label}</button>`).join('');
 $$('#presets button').forEach(b=>b.addEventListener('click',()=>{selectedPreset=b.dataset.preset;const s=presets[selectedPreset];$('#resistance').value=s.r;$('#compliance').value=s.c;$('#effort').value='1';updateExplore();selectedClinical=selectedPreset;renderClinical();}));
 ['resistance','compliance','effort'].forEach(id=>$('#'+id).addEventListener('input',()=>{selectedPreset='custom';updateExplore();}));updateExplore();
}
function updateExplore(){
 const r=+$('#resistance').value,c=+$('#compliance').value,effort=+$('#effort').value,m=model(r,c,effort);
 $('#r-out').textContent=r.toFixed(1)+'×';$('#c-out').textContent=c.toFixed(1)+'×';
 $('#resistance').setAttribute('aria-valuetext',`airway resistance ${r.toFixed(1)} times normal`);$('#compliance').setAttribute('aria-valuetext',`lung compliance ${c.toFixed(1)} times normal`);
 $$('#presets button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===selectedPreset)));
 $('#effort-warning').hidden=effort===1;
 drawPictures('#explore-picture',m,1,'forced',selectedPreset==='custom'?'Your custom breath':presets[selectedPreset].label,true);
 $('#explore-picture-summary').textContent=summaryText(m);
 const stats=[['FEV1',(m.fev1/1000).toFixed(2)+' L'],['FVC',(m.fvc/1000).toFixed(2)+' L'],['FEV1/FVC',m.ratio.toFixed(2)],['Total capacity',(m.tlc/1000).toFixed(2)+' L'],['Residual volume',(m.rv/1000).toFixed(2)+' L'],['Resting capacity',(m.frc/1000).toFixed(2)+' L']];
 $('#model-stats').innerHTML=stats.map(([k,v])=>`<div class="stat"><small>${k}</small><strong>${v}</strong></div>`).join('');
 const pre=model(2.8,1),post=model(1.3,1),change=(post.fev1-pre.fev1)/baseline.fev1*100;
 $('#bd-result').textContent=`Fixed illustrative airway-opening comparison (independent of sliders): resistance 2.8× before → 1.3× after; compliance 1.0× and full effort in both. Early exhaled volume rises by ${change.toFixed(1)}% of the illustrative predicted FEV1 (baseline normal). This is not a patient response.`;
 renderClinical();
 window.lungModel=model;
}
const arrows={up:['↑','Higher'],down:['↓','Lower'],none:['–','No specified change'],variable:['~','Variable']};
function validate(data){
 if(!data||!Array.isArray(data.values)||!data.values.length||!Array.isArray(data.states))throw Error('Clinical data has an invalid structure.');
 const sources=data.sourceDetails||[];
 for(const v of [...data.values,...data.states])if(!v.id||!v.source||!data.sources[v.source]||!sources.some(s=>s.id===v.source)||!v.location||!v.excerpt?.trim())throw Error(`Missing source evidence for ${v.id||'an entry'}.`);
 const ids=new Set(data.values.map(v=>v.id));if(ids.size!==data.values.length)throw Error('Duplicate clinical value ids.');
 for(const s of data.states){if(!['disease','drug','physiologic'].includes(s.kind)||!s.mechanism)throw Error('Invalid clinical state.');for(const id of ids)if(!Object.hasOwn(arrows,s.shifts?.[id]))throw Error(`Missing or invalid shift: ${s.id} / ${id}.`);}
 for(const id of new Set(lessonSteps.map(s=>s.state)))if(!data.states.some(s=>s.id===id))throw Error(`Selectable lesson state ${id} has no clinical entry.`);
 for(const id of Object.keys(presets))if(!data.states.some(s=>s.id===id))throw Error(`Model preset ${id} has no clinical entry.`);
 if(data.evidencePolicy==='strict')for(const s of data.states)if(s.id!=='normal')for(const id of ids)if(typeof s.evidence?.[id]!=='string'||!s.evidence[id].trim())throw Error(`Missing direction evidence: ${s.id} / ${id}.`);
 return true;
}
function sourceInfo(id){const s=cv.sourceDetails.find(s=>s.id===id);return `<a href="${htmlEscape(s.url)}">${htmlEscape(s.citation)}</a> <span>Accessed ${s.accessed}.</span>`;}
function sourceList(){return `<ul class="source-list">${cv.sourceDetails.map(s=>`<li>${sourceInfo(s.id)}</li>`).join('')}</ul>`;}
function gauge(v,shift,known=true){
 if(v.referenceKind==='threshold')return `<svg class="gauge" role="img" aria-label="Positive response threshold: greater than ${v.threshold}% of predicted. No baseline response assigned." viewBox="0 0 300 95"><path class="ref-line" d="M150 27 V53"/><text x="150" y="15" text-anchor="middle">Positive-response threshold</text><text x="150" y="78" text-anchor="middle">&gt;${v.threshold}% of predicted</text></svg>`;

 let left=38,right=62,marker={up:82,down:18,none:50,variable:50}[shift];
 const ratio=v.id==='fev1fvc',response=v.id==='bdr',point=v.low===null&&v.high===null;
 if(ratio){left=((v.low+4)/6)*100;right=100;if(shift==='none')marker=66;}
 const map=x=>18+x*2.64;
 const band=point?`<line class="ref-line" x1="${map(50)}" x2="${map(50)}" y1="27" y2="53"/>`:`<rect class="band" x="${map(left)}" y="31" width="${(right-left)*2.64}" height="18"/>`;
 return `<svg class="gauge" role="img" aria-label="${htmlEscape(v.label+': '+(known?arrows[shift][1]:'not established by cited source'))}" viewBox="0 0 300 95"><defs><pattern id="hatch-${v.id}" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="#171916"/></pattern></defs><rect class="track" x="18" y="31" width="264" height="18"/>${band}${known?(shift==='variable'?`<rect x="${map(15)}" y="23" width="${2.64*70}" height="34" fill="url(#hatch-${v.id})"/>`:`<path class="needle" d="M${map(marker)} 18 V58"/><path d="M${map(marker)-5} 17 L${map(marker)+5} 17 L${map(marker)} 24Z" fill="#171916"/>`):''}<text x="18" y="78">${ratio?'−4':response?'Less response':'Low'}</text><text x="282" y="78" text-anchor="end">${ratio?'+2':response?'More response':'High'}</text><text x="${ratio?map(left):150}" y="12" text-anchor="middle">${ratio?'LLN '+String(v.low):point?'Typical marker':'Reference band'}</text></svg>`;
}
function knownShift(s,id){return s.id==='normal'||cv.evidencePolicy!=='partial'||Object.hasOwn(s.evidence||{},id);}
function shiftText(s,id){return knownShift(s,id)?arrows[s.shifts[id]].join(' '):'Not established by cited source';}
function liveGauge(v,reference,m){
 const key={tv:'tv',rv:'rv',frc:'frc',tlc:'tlc',vc:'vc',compliance:'c',fev1fvc:'ratio'}[v.id];
 if(!key)return reference;
 const value=m[key],ratio=key==='ratio',relative=value/baseline[key];
 const fraction=ratio?value:relative/2.5;
 const x=18+264*clamp(fraction,0,1);
 const current=ratio?value.toFixed(2)+' fraction':key==='c'?value.toFixed(2)+'× baseline':Math.round(value)+' mL';
 const label='Illustrative model: '+current;
 // This separate scale does not convert the model ratio into a clinical z-score.
 return reference.replace('viewBox="0 0 300 95"','viewBox="0 0 300 155"').replace('class="gauge"','class="gauge live-gauge"').replace(/aria-label="[^"]*"/,match=>match.slice(0,-1)+'; '+htmlEscape(label)+'"').replace('</svg>',`<text x="18" y="100">${htmlEscape(label)}</text><path class="track" stroke="#babeb3" d="M18 121 H282"/><path class="model-needle" data-model-value="${value}" stroke="#254dff" stroke-width="3" d="M${x} 109 V131"/><text x="18" y="149">0${ratio?'':'× baseline'}</text><text x="282" y="149" text-anchor="end">${ratio?'1.00 fraction':'2.5× baseline'}</text></svg>`);
}
function renderClinical(){
 if(!cv)return;
 const s=cv.states.find(s=>s.id===selectedClinical)||cv.states[0];selectedClinical=s.id;
 const m=model(+$('#resistance').value,+$('#compliance').value,+$('#effort').value);
 $$('#clinical-states input').forEach(r=>r.checked=r.value===s.id);
 $('#mechanism').innerHTML=`<div class="mechanism"><p><strong>${htmlEscape(s.label)}</strong> · ${htmlEscape(s.mechanism)}</p><details><summary>Source for this mechanism</summary><p>${sourceInfo(s.source)} · ${htmlEscape(s.location)}</p><blockquote>“${htmlEscape(s.excerpt)}”</blockquote></details></div>`;
 $('#clinical-rows').innerHTML=cv.values.map(v=>{
  const shift=s.shifts[v.id],known=knownShift(s,v.id),[arrow,label]=arrows[shift];
  return `<article class="clinical-row" data-cv="${v.id}"><div><h3>${htmlEscape(v.label)}</h3><span class="unit">${htmlEscape(v.unit)}</span><p class="reference">${htmlEscape(v.display)}</p></div><div>${liveGauge(v,gauge(v,shift,known),m)}</div><div><p class="small">Cited reference direction</p><p class="shift" data-shift="${known?shift:'unestablished'}"><b>${known?arrow:'·'}</b><span class="marker-value">${known?label:'Not established by cited source'}</span></p><p class="note">${htmlEscape(v.note)}</p></div><details><summary>Source</summary><p>${sourceInfo(v.source)}<br>${htmlEscape(v.location)}</p><blockquote>“${htmlEscape(v.excerpt)}”</blockquote>${known&&s.id!=='normal'?`<p>Direction evidence: ${htmlEscape(s.evidence?.[v.id]||s.excerpt)}. ${sourceInfo(s.source)} · ${htmlEscape(s.location)}</p>`:''}</details></article>`;
 }).join('');
}
function renderSummary(){
 const cols=['rv','frc','tlc','vc','compliance','fev1fvc','bdr'];
 $('#summary-table').innerHTML=`<table><thead><tr><th scope="col">Pattern</th>${cols.map(id=>`<th scope="col">${htmlEscape(cv.values.find(v=>v.id===id).label)}</th>`).join('')}</tr></thead><tbody>${cv.states.map(s=>`<tr><th scope="row">${htmlEscape(s.label)}</th>${cols.map(id=>`<td data-summary-state="${s.id}" data-summary-value="${id}">${htmlEscape(shiftText(s,id))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 $('#summary-sources').innerHTML=sourceList();
 const glossary=[['TV','Tidal volume: air moved in a quiet breath.'],['IRV','Inspiratory reserve volume: extra air inhaled after a quiet inspiration.'],['ERV','Expiratory reserve volume: extra air exhaled after a quiet expiration.'],['RV','Residual volume: air remaining after maximal expiration.'],['IC','Inspiratory capacity = TV + IRV.'],['FRC','Functional residual capacity = RV + ERV; air remaining after quiet expiration.'],['VC','Vital capacity = IRV + TV + ERV.'],['TLC','Total lung capacity = VC + RV.'],['FVC','Forced vital capacity: total air forcefully exhaled after maximal inspiration.'],['FEV1','Forced expiratory volume exhaled in the first second.'],['FEV1/FVC','Fraction of the forced breath exhaled in the first second.'],['LLN','Lower limit of normal: a population reference boundary, not a diagnosis.'],['z-score','Distance from the predicted reference value in standard deviations.'],['Compliance','Ease of lung stretch: change in volume for a change in pressure.'],['Airway resistance','Opposition to airflow through the airways.'],['Elastic recoil','The lung’s tendency to spring back after inflation.'],['Air trapping','Air retained because the lungs cannot empty fully.'],['Bronchodilator response','Change in FEV1 or FVC after airway-opening treatment, expressed relative to predicted. Response does not equal complete reversal of obstruction.']];
 $('#glossary').innerHTML=glossary.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join('');
}
const questions=[
 [1,'Which air remains after the strongest exhalation?',['Tidal volume','Residual volume','Inspiratory reserve'],1,'Residual volume never leaves in a spirometry manoeuvre.'],
 [1,'Which capacities contain residual air and cannot be measured by spirometry alone?',['Inspiratory capacity and vital capacity','Functional residual capacity and total lung capacity','Vital capacity only'],1,'Both resting capacity and total capacity include residual volume.'],
 [1,'Which combination makes vital capacity?',['Tidal + both reserve volumes','Residual + tidal only','All four volumes'],0,'Vital capacity contains all movable air, excluding residual volume.'],
 [2,'What is the early volume on a forced volume–time curve?',['FEV1','Residual volume','Total lung capacity'],0,'FEV1 is the volume exhaled in the first second of the forced breath.'],
 [2,'What is on the horizontal axis of a flow–volume loop?',['Time','Pressure','Volume exhaled'],2,'A flow–volume loop trades the time axis for exhaled volume.'],
 [3,'What is most characteristic of an obstructive pattern?',['Slower early emptying and a low early fraction','A small total capacity alone','Faster early emptying'],0,'Obstruction reduces early flow disproportionately; the expiratory limb can look scooped.'],
 [3,'What confirms a restrictive pattern?',['A low total lung capacity','A low ratio alone','A response to airway opening'],0,'Spirometry can suggest restriction; a measured low total capacity confirms the physiological pattern.'],
 [4,'What should you check before interpreting an unusual forced breath?',['Name a disease immediately','Check effort and repeated acceptable breaths','Ignore test quality'],1,'A deep breath in, a strong start and continued exhalation matter. Poor effort can imitate disease.']
];
let quizAnswers={};
try{quizAnswers=JSON.parse(localStorage.getItem('lab24-quiz-v2')||'{}');if(!quizAnswers||typeof quizAnswers!=='object')quizAnswers={};}catch{quizAnswers={};}
function renderQuiz(){
 $('#quiz-items').innerHTML=questions.map(([goal,q,choices,correct,why],i)=>{const a=quizAnswers[i];return `<article class="quiz-item"><p class="goal-tag">QUESTION ${i+1} · GOAL ${goal}</p><h3>${q}</h3><div class="choices">${choices.map((c,j)=>`<button data-question="${i}" data-choice="${j}"${a!==undefined?' disabled':''} class="${a===j?'chosen':''}">${c}</button>`).join('')}</div><p class="feedback" role="status" tabindex="-1">${a!==undefined?(a===correct?'Correct. ':'Not quite. ')+why:''}</p></article>`;}).join('');
 let score=0;questions.forEach((q,i)=>{if(quizAnswers[i]===q[3])score++;});const answered=Object.keys(quizAnswers).filter(k=>questions[k]).length;
 $('#quiz-score').textContent=`${score} / ${questions.length} correct · ${answered} answered`;
 $$('#quiz-items button').forEach(b=>b.addEventListener('click',()=>{const question=Number(b.dataset.question);quizAnswers[question]=Number(b.dataset.choice);try{localStorage.setItem('lab24-quiz-v2',JSON.stringify(quizAnswers));}catch{}renderQuiz();$$('.quiz-item .feedback')[question].focus();}));
}
$('#quiz-reset').addEventListener('click',()=>{quizAnswers={};try{localStorage.removeItem('lab24-quiz-v2');}catch{}renderQuiz();});
$('#print').addEventListener('click',()=>window.print());
async function init(){
 try{
  let data;
  if(location.protocol==='file:')data=JSON.parse($('#clinical-fallback').textContent);
  else {const response=await fetch('./clinical-values.json');if(!response.ok)throw Error('Clinical data file could not be loaded.');data=await response.json();}
  // Validate the full declared inventory before rendering any selectable content.
  validate(data);
  cv=data;
  setupLesson();setupExplore();
  $('#clinical-disclaimer').textContent=cv.disclaimer;
  $('#clinical-sources').innerHTML=sourceList();
  $('#clinical-states').insertAdjacentHTML('beforeend',cv.states.map(s=>`<label><input type="radio" name="clinical-state" value="${s.id}"${s.id==='normal'?' checked':''}>${s.label}</label>`).join(''));
  $$('#clinical-states input').forEach(r=>r.addEventListener('change',()=>{selectedClinical=r.value;renderClinical();}));
  renderClinical();renderSummary();renderQuiz();
  if(cv.evidencePolicy==='strict'&&cv.states.length<5){
   const notice=document.createElement('p');notice.className='evidence-notice';notice.textContent='Evidence boundary: disease and treatment presets are withheld because the listed sources do not establish every requested direction. Explore resistance and compliance directly; no unsupported clinical arrows are shown.';
   $('#clinical-disclaimer').after(notice);$('#presets').before(notice.cloneNode(true));
  }
 }catch(e){
  const panel=$('#data-error');panel.hidden=false;panel.textContent=`Clinical values unavailable: ${e.message} Direction arrows and the simulator are withheld. Reload when the local data file is available.`;
  $('#clinical-rows').replaceChildren();$('#summary-table').replaceChildren();$('#clinical-states').disabled=true;$('#presets').replaceChildren();
  ['resistance','compliance','effort','play','replay','scrubber'].forEach(id=>$('#'+id).disabled=true);
 }
}
window.addEventListener('resize',()=>{if(cv){drawLesson();updateExplore();}});
init();
