import React, { useEffect, useRef, useState } from "react";

/**
 * TransparentIconVideo
 * - Renders a video into a canvas and removes a near-solid background color (auto-detected from corners)
 * - Good for small icon-sized overlays where the source has a uniform bg (white/solid).
 * - Props:
 *   - src: string (video url)
 *   - size: number (px) canvas size, default 140
 *   - opacity: number (0..1) final opacity, default 0.9
 *   - softness: number (px) small blur to blend edges, default 0.6
 *   - tolerance: number (0..255) color tolerance for bg removal, default 35
 */
const TransparentIconVideo = ({ src, size = 140, opacity = 0.9, softness = 0.6, tolerance = 35 }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [bgColor, setBgColor] = useState(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });

    let detected = false;
    const detectBg = () => {
      try {
        const w = c.width, h = c.height;
        ctx.drawImage(v, 0, 0, w, h);
        const s = 6; // sample block size
        const corners = [
          ctx.getImageData(2, 2, s, s).data,
          ctx.getImageData(w - s - 2, 2, s, s).data,
          ctx.getImageData(2, h - s - 2, s, s).data,
          ctx.getImageData(w - s - 2, h - s - 2, s, s).data,
        ];
        let r = 0, g = 0, b = 0, n = 0;
        for (const data of corners) {
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
          }
        }
        const color = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
        setBgColor(color);
        detected = true;
      } catch {}
    };

    const process = () => {
      const w = c.width = size;
      const h = c.height = size;
      try {
        ctx.drawImage(v, 0, 0, w, h);
        if (!detected && v.currentTime > 0.03) detectBg();
        if (bgColor) {
          const frame = ctx.getImageData(0, 0, w, h);
          const d = frame.data;
          const tol = tolerance;
          const soft = softness;
          const dist2 = (r, g, b) => {
            const dr = r - bgColor.r, dg = g - bgColor.g, db = b - bgColor.b;
            return dr*dr + dg*dg + db*db;
          };
          const t2 = tol * tol;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const dd = dist2(r, g, b);
            if (dd < t2) {
              // near background: fade out with slight softness
              d[i + 3] = Math.max(0, d[i + 3] - 255);
            } else if (dd < t2 * 1.7) {
              // edge zone: partially transparent + soft alpha for smoother blend
              d[i + 3] = Math.min(255, d[i + 3] * 0.35);
            }
          }
          ctx.putImageData(frame, 0, 0);
          if (soft > 0) {
            // cheap soften via drawing back with low alpha
            ctx.globalAlpha = 0.3;
            ctx.drawImage(c, -soft, 0, w + soft, h);
            ctx.drawImage(c, soft, 0, w - soft, h);
            ctx.globalAlpha = 1;
          }
        }
      } catch {}
      rafRef.current = requestAnimationFrame(process);
    };

    rafRef.current = requestAnimationFrame(process);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [src, size, softness, tolerance, bgColor]);

  return (
    <div className="icon-video-wrapper" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: size, height: size, opacity }} aria-hidden>
      <video ref={videoRef} src={src} muted loop autoPlay playsInline style={{ display: "none" }} />
      <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} />
    </div>
  );
};

export default TransparentIconVideo;