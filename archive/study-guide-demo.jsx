// Original throwaway prototype; referenced by GradientDescentViz.jsx.
import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Play, Pause, RotateCcw, StepForward } from "lucide-react";
 
// ---------- shared aesthetic tokens ----------
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const INK = "#1a1a1a";
const PAPER = "#f7f6f2";
const FADE = "#9b9892";
const ACCENT = "#c0392b";
 
// ---------- table of contents data (from the screenshot) ----------
const SECTIONS = [
  {
    n: 4,
    title: "AI AND ML",
    items: [
      { label: "Neural nets and transformers." },
      { label: "Gradient descent and backpropagation.", words: "demo", key: "gradient" },
      { label: "Embeddings and attention." },
      { label: "Generating images." },
      { label: "Precision, recall and the confusion matrix." },
      { label: "RLHF and human feedback." },
    ],
  },
  {
    n: 5,
    title: "DATA AND COMPRESSION",
    items: [
      { label: "Bits, bytes and binary.", words: "3.1K" },
      { label: "Entropy and compression.", words: "5.1K" },
      { label: "Image compression.", words: "5.4K" },
      { label: "Cryptography." },
      { label: "How is data stored?", words: "4.9K" },
    ],
  },
  {
    n: 6,
    title: "NETWORKING AND THE WEB",
    items: [
      { label: "Sending and receiving data.", words: "3.0K" },
      { label: "How the internet works.", words: "3.7K" },
      { label: "What is a browser?" },
    ],
  },
  {
    n: 7,
    title: "COMPILERS AND INTERPRETERS",
    items: [
      { label: "What is code?" },
      { label: "Compilers and interpreters." },
      { label: "What makes code fast?" },
    ],
  },
  {
    n: 8,
    title: "OBJECT-ORIENTED PROGRAMMING (JAVA)",
    items: [
      { label: "Classes and objects." },
      { label: "Constructors and the heap." },
      { label: "Encapsulation and access modifiers." },
      { label: "Inheritance." },
      { label: "Polymorphism and dynamic dispatch." },
      { label: "Abstract classes and interfaces." },
      { label: "Composition over inheritance." },
    ],
  },
  {
    n: 9,
    title: "MISC",
    items: [{ label: "QR and barcodes.", words: "2.1K" }],
  },
];
 
// ---------- gradient descent math ----------
// Asymmetric double well: lets us show learning rate AND local-vs-global minima.
const f = (x) => 0.08 * Math.pow(x * x - 4, 2) + 0.15 * x;
const fp = (x) => 0.32 * x * (x * x - 4) + 0.15; // exact derivative
 
const X_MIN = -3.6, X_MAX = 3.6, Y_MIN = -0.8, Y_MAX = 7.2;
 
function TOC({ onOpen }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 26px 80px" }}>
      <div
        style={{
          textAlign: "center",
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: 22,
          padding: "22px 0 18px",
          borderBottom: `1px solid #e3e1da`,
          marginBottom: 38,
        }}
      >
        Learning with Sabih<span style={{ color: FADE, fontWeight: 400 }}> / study guide</span>
      </div>
 
      {SECTIONS.map((sec, si) => (
        <div
          key={sec.n}
          style={{
            marginBottom: 46,
            animation: `rise 0.5s ease both`,
            animationDelay: `${si * 0.07}s`,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 19,
              letterSpacing: "0.04em",
              fontWeight: 700,
              marginBottom: 20,
              color: INK,
            }}
          >
            <span style={{ color: FADE, marginRight: 16 }}>{sec.n}.</span>
            {sec.title}
          </div>
 
          {sec.items.map((it, ii) => {
            const live = it.words === "demo";
            return (
              <div
                key={ii}
                onClick={live ? () => onOpen(it.key) : undefined}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  marginLeft: 22,
                  marginBottom: 16,
                  fontFamily: SERIF,
                  fontSize: 18.5,
                  cursor: live ? "pointer" : "default",
                  color: live ? INK : "#3a3a3a",
                }}
              >
                <span style={{ color: live ? ACCENT : FADE, marginRight: 12 }}>•</span>
                <span
                  style={{
                    whiteSpace: "nowrap",
                    textDecoration: live ? "underline" : "none",
                    textDecorationColor: live ? ACCENT : "transparent",
                    textUnderlineOffset: 4,
                    color: live ? ACCENT : "inherit",
                    fontWeight: live ? 600 : 400,
                  }}
                >
                  {it.label}
                </span>
                <span
                  style={{
                    flex: 1,
                    margin: "0 8px",
                    borderBottom: `2px dotted #cfccc4`,
                    transform: "translateY(-4px)",
                  }}
                />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12.5,
                    letterSpacing: "0.05em",
                    color: live ? ACCENT : FADE,
                    whiteSpace: "nowrap",
                  }}
                >
                  {live ? "INTERACTIVE →" : it.words ? `${it.words} WORDS` : ""}
                </span>
              </div>
            );
          })}
        </div>
      ))}
 
      <div
        style={{
          fontFamily: MONO,
          fontSize: 12,
          color: FADE,
          textAlign: "center",
          marginTop: 30,
          lineHeight: 1.7,
        }}
      >
        one topic built out as a demo. the rest are placeholders.
        <br />
        tap "Gradient descent and backpropagation" above.
      </div>
    </div>
  );
}
 
function GradientPage({ onBack }) {
  const [x, setX] = useState(2.9);
  const [lr, setLr] = useState(0.12);
  const [steps, setSteps] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | running | converged | diverged
  const [running, setRunning] = useState(false);
  const svgRef = useRef(null);
  const dragging = useRef(false);
 
  const W = 640, H = 380, padL = 18, padR = 18, padT = 18, padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const sx = (wx) => padL + ((wx - X_MIN) / (X_MAX - X_MIN)) * plotW;
  const sy = (wy) => padT + (1 - (wy - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;
  const invX = (px) => X_MIN + ((px - padL) / plotW) * (X_MAX - X_MIN);
 
  // curve path
  const curve = (() => {
    let d = "";
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const wx = X_MIN + (i / N) * (X_MAX - X_MIN);
      d += `${i === 0 ? "M" : "L"} ${sx(wx).toFixed(1)} ${sy(f(wx)).toFixed(1)} `;
    }
    return d;
  })();
 
  const doStep = useCallback(() => {
    setX((cur) => {
      const g = fp(cur);
      let nx = cur - lr * g;
      if (Math.abs(nx) > 4.2) {
        setStatus("diverged");
        setRunning(false);
        return cur;
      }
      if (Math.abs(g) < 0.02) {
        setStatus("converged");
        setRunning(false);
        return cur;
      }
      return nx;
    });
    setSteps((s) => s + 1);
  }, [lr]);
 
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => doStep(), 90);
    return () => clearInterval(id);
  }, [running, doStep]);
 
  const reset = () => {
    setRunning(false);
    setSteps(0);
    setStatus("idle");
    setX(2.9);
    setLr(0.12);
  };
 
  // dragging
  const pointerMove = (e) => {
    if (!dragging.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const px = ((clientX - rect.left) / rect.width) * W;
    let wx = invX(px);
    wx = Math.max(X_MIN, Math.min(X_MAX, wx));
    setX(wx);
    setStatus("idle");
    setSteps(0);
  };
  const startDrag = (e) => {
    setRunning(false);
    dragging.current = true;
    pointerMove(e);
  };
  const endDrag = () => (dragging.current = false);
 
  // tangent segment (the gradient)
  const m = fp(x);
  const dlt = 0.85;
  const tx1 = x - dlt, tx2 = x + dlt;
  const ty1 = f(x) + m * (tx1 - x);
  const ty2 = f(x) + m * (tx2 - x);
 
  const statusColor =
    status === "diverged" ? ACCENT : status === "converged" ? "#1e8449" : INK;
 
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 26px 80px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "20px 0 16px",
          borderBottom: "1px solid #e3e1da",
          marginBottom: 26,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: MONO,
            fontSize: 12.5,
            letterSpacing: "0.05em",
            background: "none",
            border: "none",
            color: FADE,
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ArrowLeft size={15} /> CONTENTS
        </button>
      </div>
 
      <div style={{ fontFamily: MONO, fontSize: 12.5, color: ACCENT, letterSpacing: "0.06em", marginBottom: 10 }}>
        4 / AI AND ML
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 700, margin: "0 0 18px", lineHeight: 1.15 }}>
        Gradient descent
      </h1>
      <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.6, color: "#2c2c2c", marginBottom: 14 }}>
        Training a model means finding the parameter values that make its error as small
        as possible. Picture the error as a landscape: every position is a possible setting,
        and height is how wrong the model is. Gradient descent is the rule for walking downhill.
      </p>
      <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.6, color: "#2c2c2c", marginBottom: 26 }}>
        At any point, the <b>gradient</b> is the slope. It points uphill, so we step the
        opposite way. The <b>learning rate</b> sets how big each step is. Drag the dot to place
        it anywhere, then run it.
      </p>
 
      {/* visualization */}
      <div
        style={{
          border: "1px solid #e0ddd5",
          borderRadius: 4,
          background: "#fffefb",
          padding: "10px 10px 4px",
          marginBottom: 18,
          boxShadow: "0 1px 0 #e8e5dd",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", display: "block", touchAction: "none", cursor: "ew-resize" }}
          onMouseDown={startDrag}
          onMouseMove={pointerMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={startDrag}
          onTouchMove={pointerMove}
          onTouchEnd={endDrag}
        >
          {/* baseline */}
          <line x1={padL} y1={sy(0)} x2={W - padR} y2={sy(0)} stroke="#ece9e1" strokeWidth="1" />
          {/* well labels */}
          <text x={sx(-2.05)} y={sy(f(-2.05)) + 26} fontFamily={MONO} fontSize="11" fill={FADE} textAnchor="middle">
            global min
          </text>
          <text x={sx(1.98)} y={sy(f(1.98)) + 26} fontFamily={MONO} fontSize="11" fill={FADE} textAnchor="middle">
            local min
          </text>
          {/* curve */}
          <path d={curve} fill="none" stroke={INK} strokeWidth="2" />
          {/* tangent / gradient */}
          <line
            x1={sx(tx1)} y1={sy(ty1)} x2={sx(tx2)} y2={sy(ty2)}
            stroke={ACCENT} strokeWidth="2" strokeDasharray="1 0"
          />
          {/* drop line */}
          <line x1={sx(x)} y1={sy(f(x))} x2={sx(x)} y2={sy(Y_MIN)} stroke="#d8d4ca" strokeWidth="1" strokeDasharray="3 4" />
          {/* the descending point */}
          <circle cx={sx(x)} cy={sy(f(x))} r="9" fill={ACCENT} stroke="#fff" strokeWidth="2.5" />
        </svg>
      </div>
 
      {/* readouts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          fontFamily: MONO,
          fontSize: 13,
          marginBottom: 20,
        }}
      >
        {[
          ["position", x.toFixed(3)],
          ["loss", f(x).toFixed(3)],
          ["gradient", fp(x).toFixed(3)],
          ["steps", String(steps)],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "#efece4", borderRadius: 3, padding: "9px 8px", textAlign: "center" }}>
            <div style={{ color: FADE, fontSize: 10.5, letterSpacing: "0.05em", marginBottom: 4 }}>{k.toUpperCase()}</div>
            <div style={{ color: INK, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>
 
      {/* learning rate slider */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12.5, color: INK, marginBottom: 8 }}>
          <span style={{ color: FADE, letterSpacing: "0.05em" }}>LEARNING RATE</span>
          <span style={{ fontWeight: 700 }}>{lr.toFixed(3)}</span>
        </div>
        <input
          type="range" min="0.01" max="0.6" step="0.005" value={lr}
          onChange={(e) => { setLr(parseFloat(e.target.value)); setStatus("idle"); }}
          style={{ width: "100%", accentColor: ACCENT }}
        />
        <div style={{ fontFamily: MONO, fontSize: 11, color: FADE, marginTop: 6 }}>
          low = slow and steady · high = overshoots and can fly off the map
        </div>
      </div>
 
      {/* controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={() => { if (status === "diverged" || status === "converged") setStatus("idle"); setRunning((r) => !r); }} style={btn(true)}>
          {running ? <Pause size={14} /> : <Play size={14} />} {running ? "Pause" : "Run"}
        </button>
        <button onClick={() => { setRunning(false); doStep(); }} style={btn(false)}>
          <StepForward size={14} /> Step
        </button>
        <button onClick={reset} style={btn(false)}>
          <RotateCcw size={14} /> Reset
        </button>
        <div style={{ display: "flex", alignItems: "center", fontFamily: MONO, fontSize: 12.5, color: statusColor, marginLeft: "auto", fontWeight: 700, letterSpacing: "0.05em" }}>
          {status.toUpperCase()}
        </div>
      </div>
 
      {/* takeaways */}
      <div style={{ background: "#efece4", borderLeft: `3px solid ${ACCENT}`, borderRadius: "0 4px 4px 0", padding: "16px 18px", marginTop: 26 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.06em", color: ACCENT, marginBottom: 12 }}>TRY THIS</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.6, color: "#2c2c2c" }}>
          <li style={{ marginBottom: 8 }}>Drop the dot on the right side and run it. It settles in the nearer valley, not the deepest one. That is a <b>local minimum</b>, the thing that makes training hard.</li>
          <li style={{ marginBottom: 8 }}>Push the learning rate past about 0.45 and run. The steps overshoot and the loss blows up.</li>
          <li>Set the learning rate very low. It converges, but slowly. This is the trade-off every model wrestles with.</li>
        </ul>
      </div>
 
      <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, margin: "34px 0 12px" }}>So where does backprop fit?</h2>
      <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.6, color: "#2c2c2c", marginBottom: 14 }}>
        Here the landscape has one knob, so the slope is easy. A real network has millions of
        knobs, and the loss is one number at the very end. <b>Backpropagation</b> is the
        bookkeeping that figures out how much each individual weight contributed to that final
        error, working backward through the layers using the chain rule from calculus.
      </p>
      <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.6, color: "#2c2c2c" }}>
        Backprop computes the gradient. Gradient descent takes the step. Together they are one
        training iteration, repeated millions of times.
      </p>
    </div>
  );
}
 
function btn(primary) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: "0.03em",
    padding: "9px 15px",
    borderRadius: 3,
    cursor: "pointer",
    border: primary ? "none" : "1px solid #d4d0c6",
    background: primary ? INK : "#fffefb",
    color: primary ? PAPER : INK,
  };
}
 
export default function StudyGuide() {
  const [view, setView] = useState("home");
  return (
    <div style={{ background: PAPER, minHeight: "100vh", color: INK }}>
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        input[type=range]{ height: 4px; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
      {view === "home" ? (
        <TOC onOpen={() => setView("gradient")} />
      ) : (
        <GradientPage onBack={() => setView("home")} />
      )}
    </div>
  );
}
 
