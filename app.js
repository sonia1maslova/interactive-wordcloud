const canvas = document.getElementById('cloudCanvas');
const ctx = canvas.getContext('2d');
const input = document.getElementById('dataInput');
const state = {
  shape: 'ellipse', background: '#ebeff3', backgroundAlpha: 0.92, edgeColor: '#c4cad2', edgeAlpha: 0.82, opacity: 0.92,
  transparentBackground: false, transparentEdge: false, transparentMask: false,
  wordAlpha: 1, baseFont: 29, variation: 13, showLabels: true, terms: [], selected: -1,
  dragging: false, customMask: null, dragOffset: { x: 0, y: 0 },
};

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
      alpha: Number.isFinite(Number(t.alpha)) ? Number(t.alpha) : 1,
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
  const cleanCell = value => value.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
  const header = rows[0].toLowerCase().split(/[\t,]/).map(cleanCell);
  const hasHeader = header.includes('word') || header.includes('term');
  const start = hasHeader ? 1 : 0;
  const wordIdx = hasHeader ? Math.max(header.indexOf('word'), header.indexOf('term')) : 0;
  const weightIdx = hasHeader ? ['weight','value','importance','effect_size','size'].map(k => header.indexOf(k)).find(i => i >= 0) ?? 1 : 1;
  return normaliseTerms(rows.slice(start).map(row => {
    const cells = row.split(/[\t,]/).map(cleanCell);
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
      if (Number.isFinite(Number(parsed.backgroundAlpha))) { state.backgroundAlpha = Number(parsed.backgroundAlpha); document.getElementById('backgroundAlpha').value = Math.round(state.backgroundAlpha * 100); document.getElementById('backgroundAlphaValue').textContent = `${Math.round(state.backgroundAlpha * 100)}%`; }
      if (Number.isFinite(Number(parsed.edgeAlpha))) { state.edgeAlpha = Number(parsed.edgeAlpha); document.getElementById('edgeAlpha').value = Math.round(state.edgeAlpha * 100); document.getElementById('edgeAlphaValue').textContent = `${Math.round(state.edgeAlpha * 100)}%`; }
      if (Number.isFinite(Number(parsed.opacity))) { state.opacity = Number(parsed.opacity); document.getElementById('opacity').value = Math.round(state.opacity * 100); document.getElementById('opacityValue').textContent = `${Math.round(state.opacity * 100)}%`; }
      if (Number.isFinite(Number(parsed.wordAlpha))) { state.wordAlpha = Number(parsed.wordAlpha); document.getElementById('wordAlpha').value = Math.round(state.wordAlpha * 100); document.getElementById('wordAlphaValue').textContent = `${Math.round(state.wordAlpha * 100)}%`; }
      if (Number.isFinite(Number(parsed.baseFont))) { state.baseFont = Number(parsed.baseFont); document.getElementById('baseFont').value = state.baseFont; document.getElementById('baseFontValue').textContent = state.baseFont; }
      if (Number.isFinite(Number(parsed.variation))) { state.variation = Number(parsed.variation); document.getElementById('variation').value = state.variation; document.getElementById('variationValue').textContent = state.variation; }
      for (const key of ['transparentBackground','transparentEdge','transparentMask']) {
        if (typeof parsed[key] === 'boolean') { state[key] = parsed[key]; document.getElementById(key).checked = parsed[key]; }
      }
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

function serialiseTerms() { return JSON.stringify(state.terms.map(t => ({ word: t.word, weight: t.weight, color: t.color, alpha: t.alpha ?? 1, x: +t.x.toFixed(4), y: +t.y.toFixed(4) })), null, 2); }
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
  if (!state.transparentBackground) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (state.shape === 'custom' && state.customMask) {
    if (!state.transparentMask) {
      ctx.save(); ctx.globalAlpha = state.backgroundAlpha * state.opacity; ctx.drawImage(state.customMask, 28, 28, canvas.width-56, canvas.height-56); ctx.restore();
    }
  } else {
    if (!state.transparentMask) {
      const geo = shapePath(); ctx.save(); ctx.clip();
      const [r,g,b] = hexToRgb(state.background);
      const gradient = ctx.createRadialGradient(geo.cx, geo.cy, 10, geo.cx, geo.cy, Math.max(geo.w, geo.h) * .62);
      gradient.addColorStop(0, `rgba(${r},${g},${b},${state.backgroundAlpha * state.opacity})`);
      gradient.addColorStop(.72, `rgba(${r},${g},${b},${state.backgroundAlpha * state.opacity * .88})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0.10)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    }
    if (!state.transparentEdge) {
      ctx.save(); ctx.strokeStyle = state.edgeColor; ctx.lineWidth = 3; ctx.globalAlpha = state.edgeAlpha; shapePath(); ctx.stroke(); ctx.restore();
    }
  }
}

function drawTerms() {
  if (!state.showLabels) return;
  state.terms.forEach((term, index) => {
    const x = term.x * canvas.width, y = term.y * canvas.height, size = termSize(term);
    ctx.save(); ctx.font = `${size}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (index === state.selected) { const m = ctx.measureText(term.word); ctx.fillStyle = 'rgba(255,255,255,.60)'; ctx.roundRect(x-m.width/2-12, y-size*.55, m.width+24, size*1.1, 12); ctx.fill(); ctx.strokeStyle = term.color; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = rgba(term.color, state.wordAlpha * (term.alpha ?? 1)); ctx.fillText(term.word, x, y); ctx.restore();
  });
}
function render() { drawPanel(); drawTerms(); document.getElementById('wordCount').textContent = `${state.terms.length} words`; }

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

function updateSelected() {
  const disabled = state.selected < 0;
  const box = document.getElementById('selectedEditor');
  box.classList.toggle('is-disabled', disabled);
  ['selectedWord','selectedColor','selectedAlpha','selectedWeight'].forEach(id => { document.getElementById(id).disabled = disabled; });
  if (disabled) { document.getElementById('selectionStatus').textContent = '未选择'; return; }
  const t = state.terms[state.selected];
  document.getElementById('selectionStatus').textContent = t.word;
  document.getElementById('selectedWord').value = t.word;
  document.getElementById('selectedColor').value = t.color;
  document.getElementById('selectedAlpha').value = Math.round((t.alpha ?? 1) * 100);
  document.getElementById('selectedAlphaValue').textContent = `${Math.round((t.alpha ?? 1) * 100)}%`;
  document.getElementById('selectedWeight').value = t.weight;
}
document.getElementById('selectedColor').addEventListener('input',e=>{if(state.selected>=0){state.terms[state.selected].color=e.target.value;render();}});
document.getElementById('selectedAlpha').addEventListener('input',e=>{if(state.selected>=0){state.terms[state.selected].alpha=+e.target.value/100;document.getElementById('selectedAlphaValue').textContent=`${e.target.value}%`;render();}});
document.getElementById('selectedWord').addEventListener('input',e=>{if(state.selected>=0){state.terms[state.selected].word=e.target.value;document.getElementById('selectionStatus').textContent=e.target.value;render();}});
document.getElementById('selectedWeight').addEventListener('input',e=>{if(state.selected>=0){state.terms[state.selected].weight=+e.target.value;const vals=state.terms.map(t=>t.weight),min=Math.min(...vals),max=Math.max(...vals);state.terms.forEach(t=>t.norm=max===min?1:(t.weight-min)/(max-min));render();}});

function bind(id, key, format=(v)=>v) { const el=document.getElementById(id), out=document.getElementById(`${id}Value`); el.addEventListener('input',e=>{state[key]=['opacity','backgroundAlpha','edgeAlpha','wordAlpha'].includes(id)?+e.target.value/100:+e.target.value;if(out)out.textContent=format(e.target.value);render();}); }
bind('baseFont','baseFont'); bind('variation','variation'); bind('opacity','opacity',v=>`${v}%`);
bind('backgroundAlpha','backgroundAlpha',v=>`${v}%`); bind('edgeAlpha','edgeAlpha',v=>`${v}%`); bind('wordAlpha','wordAlpha',v=>`${v}%`);
document.getElementById('shape').addEventListener('change',e=>{state.shape=e.target.value;render();});
document.getElementById('background').addEventListener('input',e=>{state.background=e.target.value;render();});
document.getElementById('edgeColor').addEventListener('input',e=>{state.edgeColor=e.target.value;render();});
document.getElementById('showLabels').addEventListener('change',e=>{state.showLabels=e.target.checked;render();});
for (const key of ['transparentBackground','transparentEdge','transparentMask']) {
  document.getElementById(key).addEventListener('change', e => { state[key] = e.target.checked; render(); });
}
document.getElementById('applyData').addEventListener('click',()=>{if(!applyInputText(input.value))alert('没有读到有效 word。');});
document.getElementById('dataFile').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{input.value=reader.result;if(!applyInputText(reader.result))alert('没有读到有效 word。');};reader.readAsText(file);});
document.getElementById('maskFile').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{state.customMask=img;state.shape='custom';document.getElementById('shape').value='custom';render();};img.src=reader.result;};reader.readAsDataURL(file);});
function timestampName() { const d=new Date(), pad=n=>String(n).padStart(2,'0'); return `wordcloud_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }
function outputBaseName() { const raw=document.getElementById('outputName').value.trim(); const safe=raw.replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').replace(/^\.+/,'').slice(0,80); return safe || timestampName(); }
function currentSettings() { return {shape:state.shape,background:state.background,backgroundAlpha:state.backgroundAlpha,edgeColor:state.edgeColor,edgeAlpha:state.edgeAlpha,opacity:state.opacity,transparentBackground:state.transparentBackground,transparentEdge:state.transparentEdge,transparentMask:state.transparentMask,wordAlpha:state.wordAlpha,baseFont:state.baseFont,variation:state.variation,showLabels:state.showLabels,terms:state.terms}; }
let saveDirectoryHandle = null;
let exportInProgress = false;
const directoryPickerSupported = window.isSecureContext && typeof window.showDirectoryPicker === 'function';
function setSaveStatus(message) { document.getElementById('saveLocationStatus').textContent = message; }
function updateSaveControls() {
  document.getElementById('chooseSaveFolder').disabled = !directoryPickerSupported || exportInProgress;
  document.getElementById('useDefaultDownload').disabled = !saveDirectoryHandle || exportInProgress;
  document.getElementById('saveLayout').disabled = exportInProgress;
  document.getElementById('exportPng').disabled = exportInProgress;
}
async function chooseSaveFolder() {
  if (!directoryPickerSupported) return;
  try {
    const directory = await window.showDirectoryPicker({id: 'wordcloud-export', mode: 'readwrite'});
    saveDirectoryHandle = directory;
    setSaveStatus(`当前文件夹：${directory.name}。PNG 和布局 JSON 都将保存到这里。`);
    updateSaveControls();
  } catch (error) {
    if (error.name === 'AbortError') return;
    setSaveStatus('无法选择文件夹。请重试，或使用浏览器默认下载。');
  }
}
document.getElementById('chooseSaveFolder').addEventListener('click', chooseSaveFolder);
document.getElementById('useDefaultDownload').addEventListener('click', () => {
  saveDirectoryHandle = null;
  setSaveStatus('当前：浏览器默认下载位置。');
  updateSaveControls();
});
if (!directoryPickerSupported) {
  document.getElementById('saveLocationHelp').textContent = '当前浏览器不支持网页选择保存文件夹，将使用普通下载。可在支持此功能的 Chrome 或 Edge 中打开本工具，或在浏览器设置中开启下载前询问保存位置。';
}
updateSaveControls();

async function availableExportName(directory, name) {
  const dot = name.lastIndexOf('.'), stem = name.slice(0, dot), extension = name.slice(dot);
  for (let count = 1; count <= 1000; count++) {
    const candidate = count === 1 ? name : `${stem}_${count}${extension}`;
    try { await directory.getFileHandle(candidate); }
    catch (error) { if (error.name === 'NotFoundError') return candidate; throw error; }
  }
  throw new Error('Too many files with the same name.');
}
async function saveExportFile(makeBlob, name) {
  if (exportInProgress) return;
  exportInProgress = true;
  updateSaveControls();
  const directory = saveDirectoryHandle;
  try {
    if (directory) {
      const options = {mode: 'readwrite'};
      let permission = await directory.queryPermission(options);
      if (permission !== 'granted') permission = await directory.requestPermission(options);
      if (permission !== 'granted') {
        setSaveStatus('未获得保存权限。请重新选择文件夹，或切换到默认下载。');
        return;
      }
    }
    const blob = await makeBlob();
    if (!blob) throw new Error('Export could not be generated.');
    if (directory) {
      const actualName = await availableExportName(directory, name);
      const file = await directory.getFileHandle(actualName, {create: true});
      const writable = await file.createWritable();
      try { await writable.write(blob); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch (_) {} throw error; }
      setSaveStatus(`已保存：${directory.name} / ${actualName}`);
    } else {
      download(blob, name);
      setSaveStatus(`已交给浏览器下载：${name}`);
    }
  } catch (error) {
    setSaveStatus(error.name === 'AbortError' ? '已取消保存。' : '保存失败。请检查文件夹权限并重试，或切换到默认下载。');
  } finally {
    exportInProgress = false;
    updateSaveControls();
  }
}
document.getElementById('saveLayout').addEventListener('click', () => {
  const layout = JSON.stringify({version: 1, ...currentSettings()}, null, 2);
  return saveExportFile(() => new Blob([layout], {type: 'application/json'}), `${outputBaseName()}.json`);
});
document.getElementById('exportPng').addEventListener('click', () => {
  return saveExportFile(() => new Promise(resolve => canvas.toBlob(resolve, 'image/png')), `${outputBaseName()}.png`);
});
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

const defaultKey = 'interactiveWordCloudDefaults';
function applySettings(settings, includeWords=false) {
  Object.assign(state, settings);
  if (!includeWords) state.terms = [];
  document.getElementById('shape').value=state.shape; document.getElementById('background').value=state.background; document.getElementById('edgeColor').value=state.edgeColor;
  for (const id of ['transparentBackground','transparentEdge','transparentMask']) document.getElementById(id).checked=Boolean(state[id]);
  for (const id of ['baseFont','variation']) document.getElementById(id).value=state[id];
  for (const id of ['opacity','backgroundAlpha','edgeAlpha','wordAlpha']) { document.getElementById(id).value=Math.round(state[id]*100); document.getElementById(`${id}Value`).textContent=`${Math.round(state[id]*100)}%`; }
  document.getElementById('showLabels').checked=state.showLabels; input.value=includeWords ? serialiseTerms() : ''; state.selected=-1; updateSelected(); render();
}
document.getElementById('setDefault').addEventListener('click',()=>{localStorage.setItem(defaultKey,JSON.stringify(currentSettings()));document.getElementById('defaultStatus').textContent='已将当前布局和视觉参数设为默认。';});
document.getElementById('resetDefault').addEventListener('click',()=>{localStorage.removeItem(defaultKey);applySettings({shape:'ellipse',background:'#ebeff3',backgroundAlpha:.92,edgeColor:'#c4cad2',edgeAlpha:.82,opacity:.92,transparentBackground:false,transparentEdge:false,transparentMask:false,wordAlpha:1,baseFont:29,variation:13,showLabels:true},false);document.getElementById('defaultStatus').textContent='已恢复内置默认设置。';});

const savedDefaults = localStorage.getItem(defaultKey);
if (savedDefaults) { try { applySettings(JSON.parse(savedDefaults), true); } catch (_) { state.terms=[]; updateSelected(); render(); } }
else { state.terms=[]; input.value=''; updateSelected(); render(); }
