import React, { useEffect, useRef, useState } from "react";

/**
 * TransparentIconFrame
 * Extracts a single frame from a video and removes the (near) solid background
 * to produce a transparent PNG rendered as an <img>.
 *
 * Props:
 *  - src: string (video url)
 *  - size: number (px) output size, default 140
 *  - sampleTime: number (seconds) time to sample frame, default 0.2
 *  - tolerance: number (0..255) color distance threshold, default 35
 *  - edgeFeather: number (0..2) softens edges slightly, default 0.6
 */
const TransparentIconFrame = ({ src, size = 140, sampleTime = 1.0, tolerance = 28, edgeFeather = 0.6, className = "", renderMode = "mask", silhouette = true }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    const v = document.createElement("video");
    v.src = src;
    v.crossOrigin = "anonymous"; // same-origin here; safe
    v.muted = true;
    v.playsInline = true;
    videoRef.current = v;

    const c = document.createElement("canvas");
    canvasRef.current = c;

    let cleared = false;

    const handleCanPlay = async () => {
      try {
        // Seek to sample time
        const seekTo = Math.min(sampleTime, v.duration || sampleTime);
        if (!isNaN(seekTo)) {
          v.currentTime = seekTo;
        }
      } catch {
        // ignore
      }
    };

    const handleSeeked = () => {
      try {
        const dim = size;
        c.width = dim;
        c.height = dim;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        // Draw frame scaled to square canvas
        ctx.drawImage(v, 0, 0, dim, dim);

        // Detect background by sampling corners
        const sampleBlock = 6;
        const corners = [
          ctx.getImageData(2, 2, sampleBlock, sampleBlock).data,
          ctx.getImageData(dim - sampleBlock - 2, 2, sampleBlock, sampleBlock).data,
          ctx.getImageData(2, dim - sampleBlock - 2, sampleBlock, sampleBlock).data,
          ctx.getImageData(dim - sampleBlock - 2, dim - sampleBlock - 2, sampleBlock, sampleBlock).data,
        ];
        let r = 0, g = 0, b = 0, n = 0;
        for (const data of corners) {
          for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; n++; }
        }
        const bg = { r: Math.round(r/n), g: Math.round(g/n), b: Math.round(b/n) };

        const frame = ctx.getImageData(0, 0, dim, dim);
        const d = frame.data;
        const tol2 = tolerance * tolerance;
        const dist2 = (rr, gg, bb) => {
          const dr = rr - bg.r, dg = gg - bg.g, db = bb - bg.b;
          return dr*dr + dg*dg + db*db;
        };

        for (let i = 0; i < d.length; i += 4) {
          const rr = d[i], gg = d[i+1], bb = d[i+2];
          const dd = dist2(rr, gg, bb);
          if (dd < tol2) {
            d[i+3] = 0; // fully transparent for definite background
          } else if (dd < tol2 * 1.6) {
            // feather the edge
            d[i+3] = Math.min(255, d[i+3] * 0.35);
          }
        }
        ctx.putImageData(frame, 0, 0);

        // subtle feather pass
        if (edgeFeather > 0) {
          ctx.globalAlpha = 0.35;
          ctx.drawImage(c, -edgeFeather, 0, dim + edgeFeather, dim);
          ctx.drawImage(c, edgeFeather, 0, dim - edgeFeather, dim);
          ctx.globalAlpha = 1;
        }

        if (silhouette) {
          // Convert to monochrome to blend better with gray background
          const mono = ctx.getImageData(0, 0, dim, dim);
          const md = mono.data;
          for (let i = 0; i < md.length; i += 4) {
            const r = md[i], g = md[i+1], b = md[i+2];
            const lum = Math.max(0, Math.min(255, 0.2126*r + 0.7152*g + 0.0722*b));
            md[i] = md[i+1] = md[i+2] = lum; // grayscale
          }
          ctx.putImageData(mono, 0, 0);
        }

        const url = c.toDataURL("image/png");
        setImgUrl(url);
        cleared = true;
      } catch (e) {
        // fallback: don't set image
        console.warn("TransparentIconFrame: processing failed", e);
        cleared = true;
        setImgUrl(null);
      }
    };

    v.addEventListener("canplay", handleCanPlay);
    v.addEventListener("seeked", handleSeeked);

    // load
    v.load();

    return () => {
      try {
        v.removeEventListener("canplay", handleCanPlay);
        v.removeEventListener("seeked", handleSeeked);
        if (!cleared) setImgUrl(null);
      } catch {}
    };
  }, [src, size, sampleTime, tolerance, edgeFeather]);

  if (!imgUrl) return null;
  if (imgUrl && renderMode === "mask") {
    // Render as masked emboss so it looks engraved, not overlaid
    return (
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: size, height: size, pointerEvents: "none" }}>
        <img src={imgUrl} alt="icon" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "brightness(1.12)", mixBlendMode: "luminosity", opacity: 0.85 }} />
        <img src={imgUrl} alt="icon" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "blur(0.3px) brightness(0.9)", mixBlendMode: "multiply", opacity: 0.35, transform: "translate(0.6px, 0.6px)" }} />
        <img src={imgUrl} alt="icon" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "blur(0.2px)", mixBlendMode: "screen", opacity: 0.45, transform: "translate(-0.6px, -0.6px)" }} />
      </div>
    );
  }


  return (
    <img src={imgUrl} alt="icon" className={className}
      style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: size, height: size, objectFit: "contain", pointerEvents: "none" }} />
  );
};

export default TransparentIconFrame;