/* Self-hosted, dependency-free software 3D renderer with a persistent image fallback. */
(() => {
  'use strict';
  const configNode = document.getElementById('research-model-config');
  if (!configNode) return;
  const config = JSON.parse(configNode.textContent);
  const canvas = document.getElementById('research-canvas');
  const stage = canvas.parentElement;
  const fallback = document.getElementById('model-fallback');
  const status = document.getElementById('model-status');
  const componentPicker = document.getElementById('component-picker');
  const detail = document.getElementById('component-detail');
  const zoomInput = document.getElementById('model-zoom');
  const roofButton = document.getElementById('model-roof');
  const cache = new Map();
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (_) { /* Keep image. */ }
  let key = 'charging', faces = [], angle = .6, elevation = .5, zoom = 1;
  let selection = 'all', hideRoof = false, queued = false, epoch = 0;
  const text = (id, value) => { document.getElementById(id).textContent = value; };
  function setEnabled(enabled) {
    document.querySelectorAll('.model-controls button, .model-controls input, #component-picker button').forEach(el => { el.disabled = !enabled; });
  }
  function showFallback(message) {
    canvas.style.display = 'none'; fallback.style.display = 'block'; status.textContent = message;
  }
  function components() {
    componentPicker.replaceChildren();
    const entries = [['all', {label:'Whole system'}], ...Object.entries(config[key].groups)];
    entries.forEach(([id, group]) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = group.label;
      button.dataset.component = id; button.setAttribute('aria-pressed', String(id === selection));
      button.addEventListener('click', () => {
        selection = id;
        componentPicker.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        detail.textContent = id === 'all' ? config[key].description : group.detail;
        request();
      }); componentPicker.append(button);
    });
  }
  function reset() {
    const initial = cache.get(key) || config[key];
    angle = initial.angle ?? config[key].angle ?? .6; elevation = initial.elev ?? config[key].elev ?? .5; zoom = 1; selection = 'all'; hideRoof = false;
    zoomInput.value = '1'; roofButton.textContent = 'Hide canopy'; roofButton.setAttribute('aria-pressed','false');
    detail.textContent = config[key].description; components();
  }
  async function choose(next, updateURL = true) {
    if (!Object.prototype.hasOwnProperty.call(config, next)) next = 'charging';
    key = next; const currentEpoch = ++epoch, model = config[key]; faces = []; reset();
    showFallback('Model image ready. Loading the interactive view…');
    fallback.src = model.image; fallback.alt = 'Illustrative 3D model: ' + model.title;
    text('model-kind', 'Interactive 3D · ' + model.short); text('model-title', model.title); text('model-description', model.description);
    text('model-venue', model.paper.venue + ' · ' + model.paper.year); text('model-paper-title', model.paper.title);
    text('model-authors', model.paper.authors); text('model-citation', model.paper.citation);
    document.getElementById('model-paper-link').href = 'https://doi.org/' + model.paper.doi;
    canvas.setAttribute('aria-label', model.title + '. Rotate and zoom with the controls below.');
    document.querySelectorAll('[data-model]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.model === key)));
    roofButton.hidden = key !== 'charging'; setEnabled(false);
    if (updateURL) { const url = new URL(location.href); url.searchParams.set('model',key); history.replaceState(null,'',url); }
    if (!ctx) { showFallback('Image preview available. This browser cannot display the interactive model.'); return; }
    let timeout;
    try {
      let geometry = cache.get(key);
      if (!geometry) {
        const abort = new AbortController(); timeout = setTimeout(() => abort.abort(), 15000);
        const response = await fetch(model.geometry, {signal:abort.signal});
        if (!response.ok) throw new Error('Model unavailable');
        geometry = await response.json();
        if (!Array.isArray(geometry.faces) || !geometry.faces.length) throw new Error('Invalid model');
        cache.set(next, geometry);
      }
      if (currentEpoch !== epoch) return;
      faces = geometry.faces.map(face => ({...face, rgb:[1,3,5].map(i => parseInt(face.c.slice(i,i+2),16))}));
      angle = geometry.angle ?? angle; elevation = geometry.elev ?? elevation;
      setEnabled(true); request();
    } catch (_) {
      if (currentEpoch === epoch) showFallback('The model image is available. Reload this page to retry the interactive view.');
    } finally { clearTimeout(timeout); }
  }
  function render() {
    queued = false;
    if (!ctx || !faces.length || !stage.clientWidth) return;
    try {
      const width = Math.max(320,Math.min(1000,Math.round(stage.clientWidth * 1.2)));
      const height = Math.max(220, Math.round(width * stage.clientHeight / stage.clientWidth));
      canvas.width = width; canvas.height = height;
      const image = ctx.createImageData(width,height), pixels = image.data;
      const depths = new Float32Array(width * height); depths.fill(-1e10);
      for (let y=0; y<height; y++) {
        const t=1-Math.abs(y/height-.5)*2, r=Math.round(17+17*t), g=Math.round(19+18*t), b=Math.round(25+21*t);
        for (let x=0; x<width; x++) { const p=(y*width+x)*4; pixels[p]=r; pixels[p+1]=g; pixels[p+2]=b; pixels[p+3]=255; }
      }
      const ca=Math.cos(angle), sa=Math.sin(angle), ce=Math.cos(elevation), se=Math.sin(elevation);
      const scale=Math.min(width/16,height/9.8)*zoom, view=[sa*ce,se,ca*ce];
      const project = p => {
        const x=p[0], y=p[1]-1.2, z=p[2], horizontal=x*ca-z*sa, depth=x*sa+z*ca;
        return [width/2+horizontal*scale,height/2-(y*ce-depth*se)*scale,depth*ce+y*se];
      };
      for (const face of faces) {
        if (hideRoof && face.g === 'solar') continue;
        if (face.n.reduce((sum,n,i) => sum+n*view[i],0) <= 0) continue;
        const points=face.p.map(project);
        let rgb=face.rgb;
        if (selection !== 'all' && face.g !== 'base' && face.g !== selection) rgb=rgb.map(v => Math.round(v*.38+35));
        for (let i=1; i<points.length-1; i++) {
          const a=points[0],b=points[i],c=points[i+1];
          const xmin=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),xmax=Math.min(width-1,Math.ceil(Math.max(a[0],b[0],c[0])));
          const ymin=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),ymax=Math.min(height-1,Math.ceil(Math.max(a[1],b[1],c[1])));
          const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
          if (Math.abs(den)<1e-10) continue;
          for (let y=ymin; y<=ymax; y++) for (let x=xmin; x<=xmax; x++) {
            const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den;
            const v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den;
            if (u<-.0000001 || v<-.0000001 || u+v>1.0000001) continue;
            const z=u*a[2]+v*b[2]+(1-u-v)*c[2],n=y*width+x;
            if (z>depths[n]) { depths[n]=z; const p=n*4; pixels[p]=rgb[0]; pixels[p+1]=rgb[1]; pixels[p+2]=rgb[2]; }
          }
        }
      }
      ctx.putImageData(image,0,0); canvas.style.display='block'; fallback.style.display='none';
      status.textContent='Drag horizontally or use Rotate. Select a component to highlight its role.';
    } catch (_) { showFallback('Image preview shown. The interactive view is unavailable in this browser.'); setEnabled(false); }
  }
  function request() { if (!queued) { queued=true; requestAnimationFrame(render); } }
  document.querySelectorAll('[data-model]').forEach(button => button.addEventListener('click', () => choose(button.dataset.model)));
  document.getElementById('model-left').addEventListener('click', () => {angle-=.35;request();});
  document.getElementById('model-right').addEventListener('click', () => {angle+=.35;request();});
  zoomInput.addEventListener('input', () => {zoom=Number(zoomInput.value);request();});
  roofButton.addEventListener('click', () => { hideRoof=!hideRoof;roofButton.textContent=hideRoof?'Show canopy':'Hide canopy';roofButton.setAttribute('aria-pressed',String(hideRoof));request(); });
  document.getElementById('model-reset').addEventListener('click', () => {reset();request();});
  let last=null;
  canvas.addEventListener('pointerdown', event => {last=event.clientX;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove', event => {if(last!==null){angle-=(event.clientX-last)*.012;last=event.clientX;request();}});
  canvas.addEventListener('pointerup', () => {last=null;}); canvas.addEventListener('pointercancel', () => {last=null;});
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(request).observe(stage); else window.addEventListener('resize', request);
  choose(new URL(location.href).searchParams.get('model') || 'charging',false);
})();
