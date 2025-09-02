import React, { useEffect, useRef, useState } from "react";

/**
 * TransparentIconVideo
 * - Draws a video onto a canvas and removes a near-uniform background (auto-detected from corners)
 * - Designed for small icon-sized overlays in the card header without visible background box
 *
 * Props:
 *  - src: string
 *  - size: number (px) default 140
 *  - opacity: number (0..1) default 0.95
 *  - tolerance: number (0..255) color tolerance default 36
 *  - edgeFeather: number (px) default 0.7
 *  - bgStrategy: 'auto' | 'white' (fallback if auto fails)
 */
const TransparentIconVideo = ({ src, size = 180, opacity = 1, tolerance = 18, edgeFeather = 0.4, bgStrategy = 'white' }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [bgColor, setBgColor] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });

    const onCanPlay = async () => {
      try {
        await v.play();
      } catch {}
      setReady(true);
    };

    const onLoadedMeta = () => {
      // kick playback if possible
      try { v.muted = true; v.playsInline = true; v.play().catch(() => {}); } catch {}
    };

    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('canplay', onCanPlay);

    let detected = false;

    const detectBg = () => {
      try {
        const w = c.width, h = c.height;
        const s = Math.max(4, Math.round(size * 0.04));
        const blocks = [
          ctx.getImageData(2, 2, s, s).data,
          ctx.getImageData(w - s - 2, 2, s, s).data,
          ctx.getImageData(2, h - s - 2, s, s).data,
          ctx.getImageData(w - s - 2, h - s - 2, s, s).data,
        ];
        let r = 0, g = 0, b = 0, n = 0;
        for (const data of blocks) {
          for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; n++; }
        }
        const color = { r: Math.round(r/n), g: Math.round(g/n), b: Math.round(b/n) };
        setBgColor(color);
        detected = true;
      } catch {}
    };

    const process = () => {
      const w = (c.width = size);
      const h = (c.height = size);
      try {
        if (v.readyState >= 2) {
          ctx.drawImage(v, 0, 0, w, h);
          if (!detected && v.currentTime > 0.08 && bgStrategy === 'auto') detectBg();

          const frame = ctx.getImageData(0, 0, w, h);
          const d = frame.data;
          const tol = tolerance;
          const t2 = tol * tol;

          const base = bgColor || (bgStrategy === 'white' ? { r: 255, g: 255, b: 255 } : null);

          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i+1], b = d[i+2];
            let alpha = d[i+3];
            let dd = Infinity;
            if (base) {
              const dr = r - base.r, dg = g - base.g, db = b - base.b;
              dd = dr*dr + dg*dg + db*db;
            } else {
              // fallback: treat very bright pixels as bg
              const lum = 0.2126*r + 0.7152*g + 0.0722*b;
              if (lum > 250) dd = 0; // close to white
              else dd = 1e9;
            }

            if (dd < t2) {
              alpha = 0;
            } else if (dd < t2 * 1.7) {
              alpha = Math.min(255, alpha * 0.35);
            }
            d[i+3] = alpha;
          }

          ctx.putImageData(frame, 0, 0);

          if (edgeFeather > 0) {
            ctx.globalAlpha = 0.35;
            ctx.drawImage(c, -edgeFeather, 0, w + edgeFeather, h);
            ctx.drawImage(c, edgeFeather, 0, w - edgeFeather, h);
            ctx.globalAlpha = 1;
          }
        }
      } catch {}
      rafRef.current = requestAnimationFrame(process);
    };

    rafRef.current = requestAnimationFrame(process);

    return () => {
      try {
        v.removeEventListener('loadedmetadata', onLoadedMeta);
        v.removeEventListener('canplay', onCanPlay);
      } catch {}
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [src, size, tolerance, edgeFeather, bgStrategy]);

  return (
    <div className="icon-video-wrapper" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: size, height: size, opacity }} aria-hidden="true">
      <video ref={videoRef} src={src} muted loop playsInline style={{ position: 'absolute', left: -9999 }} />
      <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} />
    </div>
  );
};

export default TransparentIconVideo;