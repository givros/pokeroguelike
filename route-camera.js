const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class RouteCamera {
  constructor() { this.zoom = 1.1; this.x = 0; this.y = 0; }
  detach() { this.events?.abort(); this.resize?.disconnect(); this.viewport = null; this.board = null; this.tokens = null; this.links = null; this.geometryKey = ''; }
  mount(viewport, { id, stage, targetY, height }) {
    this.detach();
    this.viewport = viewport;
    this.board = viewport.querySelector('.route-board');
    this.tokens = new Map([...this.board.querySelectorAll('[data-route-node]')].map(node=>[node.dataset.routeNode,node]));
    this.links = [...this.board.querySelectorAll('line[data-from]')];
    this.width = Math.max(600, viewport.clientWidth);
    this.height = height;
    this.board.style.width = `${this.width}px`;
    this.board.style.height = `${height}px`;
    this.targetY = targetY;
    if (this.id !== id) this.zoom = 1.1;
    if (this.id !== id || this.stage !== stage) this.center();
    this.id = id; this.stage = stage;
    this.apply();
    const events = new AbortController(); this.events = events;
    const listen = (type, handler, options = {}) => viewport.addEventListener(type, handler, { ...options, signal: events.signal });
    let drag = null, suppressUntil = 0;
    listen('pointerdown', event => {
      if (event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: this.x, originY: this.y, moved: false };
    });
    listen('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) {
        drag.moved = true; viewport.setPointerCapture(event.pointerId); viewport.classList.add('dragging');
      }
      if (drag.moved) { this.x = drag.originX + dx; this.y = drag.originY + dy; this.apply(); }
    });
    const release = event => {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.moved) suppressUntil = performance.now() + 350;
      drag = null; viewport.classList.remove('dragging');
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    };
    listen('pointerup', release); listen('pointercancel', release); listen('lostpointercapture', release);
    window.addEventListener('pointerup', release, { signal: events.signal });
    window.addEventListener('blur', () => { if(drag) release({pointerId:drag.id}); }, { signal: events.signal });
    listen('click', event => {
      if (performance.now() < suppressUntil) { event.preventDefault(); event.stopPropagation(); }
    }, { capture: true });
    listen('wheel', event => {
      event.preventDefault();
      const box = viewport.getBoundingClientRect();
      this.zoomAt(this.zoom * Math.exp(-event.deltaY * .0015), event.clientX - box.left, event.clientY - box.top);
    }, { passive: false });
    listen('keydown', event => {
      if (event.target !== viewport) return;
      const offsets = { ArrowLeft: [70,0], ArrowRight: [-70,0], ArrowUp: [0,70], ArrowDown: [0,-70] };
      if (offsets[event.key]) { event.preventDefault(); const [dx,dy] = offsets[event.key]; this.x += dx; this.y += dy; this.apply(); }
      else if (['+','=','-'].includes(event.key)) { event.preventDefault(); this.zoomBy(event.key === '-' ? .85 : 1.18); }
      else if (event.key === 'Home') { event.preventDefault(); this.center(); this.apply(); }
    });
    this.resize = new ResizeObserver(() => this.apply()); this.resize.observe(viewport);
  }
  center() {
    if (!this.viewport) return;
    this.x = (this.viewport.clientWidth - this.width * this.zoom) / 2;
    this.y = this.viewport.clientHeight * .72 - this.targetY * this.zoom;
  }
  zoomBy(factor) { if(this.viewport) this.zoomAt(this.zoom * factor, this.viewport.clientWidth / 2, this.viewport.clientHeight / 2); }
  zoomAt(next, px, py) {
    const zoom = clamp(next, .35, 2.2), ratio = zoom / this.zoom;
    this.x = px - (px - this.x) * ratio; this.y = py - (py - this.y) * ratio; this.zoom = zoom; this.apply();
  }
  apply() {
    if (!this.viewport || !this.board) return;
    const w = this.viewport.clientWidth, h = this.viewport.clientHeight;
    this.x = this.width * this.zoom < w ? (w - this.width * this.zoom) / 2 : clamp(this.x, w - this.width * this.zoom - 45, 45);
    this.y = this.height * this.zoom < h ? (h - this.height * this.zoom) / 2 : clamp(this.y, h - this.height * this.zoom - 45, 45);
    this.board.style.left=`${this.x}px`;this.board.style.top=`${this.y}px`;
    const key=`${w}:${h}:${this.width}:${this.height}:${this.zoom}`;
    if(this.geometryKey!==key){
      // Resize native elements instead of scaling a composited bitmap of the map.
      // Panning reuses this geometry and only moves the board.
      const width=this.width*this.zoom,height=this.height*this.zoom;
      this.board.style.width=`${width}px`;this.board.style.height=`${height}px`;
      this.board.style.setProperty('--route-zoom',this.zoom);
      const svg=this.board.querySelector('svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      const centers=new Map([...this.tokens].map(([id,node])=>[id,{x:parseFloat(node.style.left)*width/100,y:parseFloat(node.style.top)*height/100,r:node.offsetWidth/2+3}]));
      for(const line of this.links){
        const a=centers.get(line.dataset.from),b=centers.get(line.dataset.to),dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy)||1;
        line.setAttribute('x1',a.x+dx/distance*a.r);line.setAttribute('y1',a.y+dy/distance*a.r);
        line.setAttribute('x2',b.x-dx/distance*b.r);line.setAttribute('y2',b.y-dy/distance*b.r);
      }
      this.geometryKey=key;
    }
    this.viewport.dataset.zoom = String(this.zoom);
    const label = this.viewport.closest('.route-map').querySelector('[data-map-zoom]');
    const text=`${Math.round(this.zoom * 100)}%`;
    if (label&&label.textContent!==text) label.textContent=text;
  }
}
