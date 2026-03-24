(function() {
  const canvas = document.getElementById('dotsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const spacing = 140;
  const speed = 0.3; // pixels per frame
  let offset = 0;
  let w, h, cx, cy, maxDist;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    cx = w / 2;
    cy = h * 0.45;
    maxDist = Math.max(w, h) * 0.85;
  }

  function frame() {
    offset = (offset + speed) % spacing;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Layer 1 — main dots flowing up
    for (let x = spacing / 2; x < w; x += spacing) {
      for (let y = -spacing + (spacing / 2) - offset; y < h + spacing; y += spacing) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const fade = Math.max(0, 1 - (dist / maxDist));
        const alpha = fade * 0.7;
        if (alpha < 0.03) continue;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.fill();
      }
    }

    // Layer 2 — offset subtler dots (slightly slower)
    const offset2 = (offset * 0.6) % spacing;
    for (let x = spacing; x < w; x += spacing) {
      for (let y = -spacing + spacing - offset2; y < h + spacing; y += spacing) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const fade = Math.max(0, 1 - (dist / maxDist));
        const alpha = fade * 0.4;
        if (alpha < 0.03) continue;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.fill();
      }
    }

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
