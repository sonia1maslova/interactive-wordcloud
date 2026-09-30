const canvas = document.getElementById('cloudCanvas');
const ctx = canvas.getContext('2d');
const input = document.getElementById('dataInput');
const state = {
  shape: 'ellipse', background: '#ebeff3', edgeColor: '#c4cad2', opacity: 0.92,
  baseFont: 29, variation: 13, showLabels: true, terms: [], selected: -1,
  dragging: false, customMask: null, dragOffset: { x: 0, y: 0 },
};

const demoTerms = [
  { word: 'anxiety', weight: 1.00, color: '#2a6f97', x: .29, y: .27 },
  { word: 'fear', weight: .90, color: '#4c9a62', x: .57, y: .23 },
  { word: 'emotion', weight: .89, color: '#ef7d00', x: .78, y: .31 },
  { word: 'valence', weight: .78, color: '#dc4a86', x: .22, y: .46 },
  { word: 'arousal', weight: .76, color: '#6e59b8', x: .50, y: .43 },
  { word: 'emotion regulation', weight: .72, color: '#2a9e9e', x: .32, y: .64 },
  { word: 'extinction', weight: .35, color: '#b05ab2', x: .68, y: .60 },
  { word: 'facial expression', weight: .20, color: '#a56b1e', x: .53, y: .77 },
];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function hexToRgb(hex) { const n = hex.replace('#', ''); return [parseInt(n.slice(0,2),16), parseInt(n.slice(2,4),16), parseInt(n.slice(4,6),16)]; }
function rgba(hex, alpha) { const [r,g,b] = hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})`; }

function normaliseTerms(terms) {
  const vals = terms.map(t => Number(t.weight ?? t.value ?? t.importance ?? t.effect_size ?? t.size ?? 0));
  const min = Math.min(...vals), max = Math.max(...vals);
  return terms.filter(t => String(t.word ?? t.term ?? '').trim()).map((t, i) => {
    const word = String(t.word ?? t.term).trim();
    const weight = Number(t.weight ?? t.value ?? t.importance ?? t.effect_size ?? t.size ?? 0);
    return {
      word, weight: Number.isFinite(weight) ? weight : 0,
      norm: max === min ? 1 : (weight - min) / (max - min),
      color: t.color || ['#2a6f97','#4c9a62','#ef7d00','#dc4a86','#7161b5','#2a9da4','#b05cab','#a56b1e'][i % 8],
      x: Number.isFinite(Number(t.x)) ? Number(t.x) : .2 + (i % 4) * .2,
      y: Number.isFinite(Number(t.y)) ? Number(t.y) : .25 + Math.floor(i / 4) * .25,
    };
  });
}

function parseTerms(raw) {
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (parsed.terms || parsed.words || []);
    return normaliseTerms(arr);
  } catch (_) {}
  const rows = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const header = rows[0].toLowerCase().split(/[\t,]/);
  const hasHeader = header.includes('word') || header.includes('term');
  const start = hasHeader ? 1 : 0;
  const wordIdx = hasHeader ? Math.max(header.indexOf('word'), header.indexOf('term')) : 0;
  const weightIdx = hasHeader ? ['weight','value','importance','effect_size','size'].map(k => header.indexOf(k)).find(i => i >= 0) ?? 1 : 1;
  return normaliseTerms(rows.slice(start).map(row => {
    const cells = row.split(/[\t,]/).map(x => x.trim());
    return { word: cells[wordIdx], weight: Number(cells[weightIdx]) || 0 };
  }));
}

function applyInputText(raw) {
  const text = raw.trim();
  if (!text) return false;
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) && parsed && Array.isArray(parsed.terms)) {
      if (parsed.shape) { state.shape = parsed.shape; document.getElementById('shape').value = parsed.shape; }
      if (parsed.background) { state.background = parsed.background; document.getElementById('background').value = parsed.background; }
      if (parsed.edgeColor) { state.edgeColor = parsed.edgeColor; document.getElementById('edgeColor').value = parsed.edgeColor; }
      if (Number.isFinite(Number(parsed.opacity))) { state.opacity = Number(parsed.opacity); document.getElementById('opacity').value = Math.round(state.opacity * 100); document.getElementById('opacityValue').textContent = `${Math.round(state.opacity * 100)}%`; }
      if (Number.isFinite(Number(parsed.baseFont))) { state.baseFont = Number(parsed.baseFont); document.getElementById('baseFont').value = state.baseFont; document.getElementById('baseFontValue').textContent = state.baseFont; }
      if (Number.isFinite(Number(parsed.variation))) { state.variation = Number(parsed.variation); document.getElementById('variation').value = state.variation; document.getElementById('variationValue').textContent = state.variation; }
      state.terms = normaliseTerms(parsed.terms);
    } else {
      const terms = parseTerms(text);
      if (!terms.length) return false;
      state.terms = terms;
    }
  } catch (_) {
    const terms = parseTerms(text);
    if (!terms.length) return false;
    state.terms = terms;
  }
  state.selected = -1;
  updateSelected();
  render();
  return true;
}

function serialiseTerms() { return JSON.stringify(state.terms.map(t => ({ word: t.word, weight: t.weight, color: t.color, x: +t.x.toFixed(4), y: +t.y.toFixed(4) })), null, 2); }
function termSize(term) { return state.baseFont + state.variation * term.norm; }
function shapePath(targetCtx = ctx) {
  const pad = 28, w = canvas.width - pad * 2, h = canvas.height - pad * 2, cx = canvas.width / 2, cy = canvas.height / 2;
  targetCtx.beginPath();
  if (state.shape === 'circle') targetCtx.arc(cx, cy, Math.min(w,h) / 2, 0, Math.PI * 2);
  else if (state.shape === 'rounded') targetCtx.roundRect(pad, pad, w, h, 52);
  else if (state.shape === 'hexagon') { for (let i=0;i<6;i++) { const a = Math.PI/6 + i*Math.PI/3; const x=cx+(w/2)*Math.cos(a), y=cy+(h/2)*Math.sin(a); i ? targetCtx.lineTo(x,y) : targetCtx.moveTo(x,y); } targetCtx.closePath(); }
  else targetCtx.ellipse(cx, cy, w/2, h/2, 0, 0, Math.PI*2);
  return { pad, w, h, cx, cy };
}

function drawPanel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (state.shape === 'custom' && state.customMask) {
    ctx.save(); ctx.globalAlpha = state.opacity; ctx.drawImage(state.customMask, 28, 28, canvas.width-56, canvas.height-56); ctx.restore();
  } else {
    const geo = shapePath(); ctx.save(); ctx.clip();
    const [r,g,b] = hexToRgb(state.background);
    const gradient = ctx.createRadialGradient(geo.cx, geo.cy, 10, geo.cx, geo.cy, Math.max(geo.w, geo.h) * .62);
    gradient.addColorStop(0, `rgba(${r},${g},${b},${state.opacity})`);
    gradient.addColorStop(.72, `rgba(${r},${g},${b},${state.opacity * .88})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0.10)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    ctx.save(); ctx.strokeStyle = state.edgeColor; ctx.lineWidth = 3; ctx.globalAlpha = .82; shapePath(); ctx.stroke(); ctx.restore();
  }
}

function drawTerms() {
  if (!state.showLabels) return;
  state.terms.forEach((term, index) => {
    const x = term.x * canvas.width, y = term.y * canvas.height, size = termSize(term);
    ctx.save(); ctx.font = `${size}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (index === state.selected) { const m = ctx.measureText(term.word); ctx.fillStyle = 'rgba(255,255,255,.60)'; ctx.roundRect(x-m.width/2-12, y-size*.55, m.width+24, size*1.1, 12); ctx.fill(); ctx.strokeStyle = term.color; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = term.color; ctx.fillText(term.word, x, y); ctx.restore();
  });
}
function render() { drawPanel(); drawTerms(); document.getElementById('termCount').textContent = `${state.terms.length} terms`; }

function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; }
function hitTest(p) {
  for (let i = state.terms.length - 1; i >= 0; i--) { const t=state.terms[i], size=termSize(t); ctx.font=`${size}px Arial`; const m=ctx.measureText(t.word); if (Math.abs(p.x-t.x*canvas.width)<=m.width/2+12 && Math.abs(p.y-t.y*canvas.height)<=size*.65) return i; }
  return -1;
}
function ellipseClamp(x, y) {
  if (state.shape === 'custom' || state.shape === 'rounded') return {x:clamp(x,.06,.94), y:clamp(y,.08,.92)};
  const cx=.5, cy=.5, rx=state.shape === 'circle' ? .43 : .46, ry=state.shape === 'circle' ? .43 : .44;
  const dx=(x-cx)/rx, dy=(y-cy)/ry, r=Math.sqrt(dx*dx+dy*dy); if(r<=.92) return {x,y}; return {x:cx+dx/r*rx*.92,y:cy+dy/r*ry*.92};
}

canvas.addEventListener('pointerdown', e => { const p=pointerPosition(e), hit=hitTest(p); state.selected=hit; if(hit>=0){state.dragging=true;canvas.setPointerCapture(e.pointerId);state.dragOffset={x:p.x/canvas.width-state.terms[hit].x,y:p.y/canvas.height-state.terms[hit].y};} updateSelected(); render(); });
canvas.addEventListener('pointermove', e => { if(!state.dragging || state.selected<0)return; const p=pointerPosition(e), t=state.terms[state.selected], next=ellipseClamp(p.x/canvas.width-state.dragOffset.x,p.y/canvas.height-state.dragOffset.y); t.x=next.x;t.y=next.y;render(); });
canvas.addEventListener('pointerup', e => { state.dragging=false; try{canvas.releasePointerCapture(e.pointerId);}catch(_){}; });
window.addEventListener('keydown', e => { if(e.key==='Delete' && state.selected>=0){state.terms.splice(state.selected,1);state.selected=-1;updateSelected();render();} });

function updateSelected() { const disabled=state.selected<0, box=document.getElementById('selectedEditor'); box.classList.toggle('is-disabled',disabled); ['selectedWord','selectedColor','selectedWeight'].forEach(id=>document.getElementById(id).disabled=disabled); if(disabled){document.getElementById('selectionStatus').textContent='未选择';return;} const t=state.terms[state.selected]; document.getElementById('selectionStatus').textContent=t.word; document.getElementById('selectedWord').value=t.word; document.getElementById('selectedColor').value=t.color; document.getElementById('selectedWeight').value=t.weight; }
document.getElementById('selectedColor').addEventListener('input',e=>{if(state.selected>=0){state.terms[state.selected].color=e.target.value;render();}});
document.getElementById('selectedWord').addEventListener('input',e=>{if(state.selected>=0){state.terms[state.selected].word=e.target.value;document.getElementById('selectionStatus').textContent=e.target.value;render();}});
document.getElementById('selectedWeight').addEventListener('input',e=>{if(state.selected>=0){state.terms[state.selected].weight=+e.target.value;const vals=state.terms.map(t=>t.weight),min=Math.min(...vals),max=Math.max(...vals);state.terms.forEach(t=>t.norm=max===min?1:(t.weight-min)/(max-min));render();}});

function bind(id, key, format=(v)=>v) { const el=document.getElementById(id), out=document.getElementById(`${id}Value`); el.addEventListener('input',e=>{state[key]=id==='opacity'?+e.target.value/100:+e.target.value;if(out)out.textContent=format(e.target.value);render();}); }
bind('baseFont','baseFont'); bind('variation','variation'); bind('opacity','opacity',v=>`${v}%`);
document.getElementById('shape').addEventListener('change',e=>{state.shape=e.target.value;render();});
document.getElementById('background').addEventListener('input',e=>{state.background=e.target.value;render();});
document.getElementById('edgeColor').addEventListener('input',e=>{state.edgeColor=e.target.value;render();});
document.getElementById('showLabels').addEventListener('change',e=>{state.showLabels=e.target.checked;render();});
document.getElementById('applyData').addEventListener('click',()=>{if(!applyInputText(input.value))alert('没有读到有效 term。');});
document.getElementById('loadDemo').addEventListener('click',()=>{state.terms=normaliseTerms(JSON.parse(JSON.stringify(demoTerms)));input.value=serialiseTerms();state.selected=-1;updateSelected();render();});
document.getElementById('dataFile').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{input.value=reader.result;if(!applyInputText(reader.result))alert('没有读到有效 term。');};reader.readAsText(file);});
document.getElementById('maskFile').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{state.customMask=img;state.shape='custom';document.getElementById('shape').value='custom';render();};img.src=reader.result;};reader.readAsDataURL(file);});
document.getElementById('addTerm').addEventListener('click',()=>{const i=state.terms.length;state.terms.push({word:`term ${i+1}`,weight:.5,norm:.5,color:'#2a6f97',x:.28+(i%3)*.22,y:.35+Math.floor(i/3)*.22});state.selected=i;updateSelected();render();});
document.getElementById('saveLayout').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,shape:state.shape,background:state.background,edgeColor:state.edgeColor,opacity:state.opacity,baseFont:state.baseFont,variation:state.variation,terms:state.terms},null,2)],{type:'application/json'});download(blob,'term-cloud-layout.json');});
document.getElementById('exportPng').addEventListener('click',()=>{const link=document.createElement('a');link.download='term-cloud.png';link.href=canvas.toDataURL('image/png');link.click();});
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

state.terms=normaliseTerms(JSON.parse(JSON.stringify(demoTerms))); input.value=serialiseTerms(); updateSelected(); render();
