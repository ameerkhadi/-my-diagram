import { useState, useEffect, useRef } from "react";

const W = 980;
const H = 620;

const COLORS = {
  purple: "#a855f7",
  green:  "#32cd64",
  orange: "#ff9f1c",
  teal:   "#20b2aa",
  pink:   "#ff6eb4",
  blue:   "#4488ff",
};

// ── Layout constants ──────────────────────────────────────────────────────────
const INPUT     = { x: 18,  y: 230, w: 90,  h: 140 };
const ENC1      = { x: 155, y: 200, w: 90,  h: 200 };
const ENC2      = { x: 285, y: 230, w: 80,  h: 140 };
const BOTTLENECK= { x: 415, y: 255, w: 90,  h: 90  };
const DEC2      = { x: 555, y: 230, w: 80,  h: 140 };
const DEC1      = { x: 685, y: 200, w: 90,  h: 200 };
const OUTPUT    = { x: 825, y: 230, w: 90,  h: 140 };
const LOSS      = { x: 415, y: 430, w: 110, h: 65  };
const ORIG_IMG  = { x: 18,  y: 60,  w: 90,  h: 80  };
const RECON_IMG = { x: 825, y: 60,  w: 90,  h: 80  };
const LATENT    = { x: 415, y: 130, w: 90,  h: 70  };

// ── Paths ─────────────────────────────────────────────────────────────────────
const pathInputToEnc1      = [[108,300],[155,300]];
const pathEnc1ToEnc2       = [[245,300],[285,300]];
const pathEnc2ToBottleneck = [[365,300],[415,300]];
const pathBottleneckToDec2 = [[505,300],[555,300]];
const pathDec2ToDec1       = [[635,300],[685,300]];
const pathDec1ToOutput     = [[775,300],[825,300]];
const pathBottleneckToLatent=[[460,255],[460,200]];
const pathOutputToLoss     = [[870,370],[870,460],[525,460]];
const pathInputToLoss      = [[63,370],[63,460],[415,460]];
const pathLossToEnc1       = [[470,430],[470,490],[200,490],[200,400]];
const pathOrigToInput      = [[63,140],[63,230]];
const pathOutputToRecon    = [[870,230],[870,140]];

const pts2d = pts =>
  pts.map((p,i)=>(i===0?"M":"L")+" "+p[0]+" "+p[1]).join(" ");

// ── Neuron mini-canvas ────────────────────────────────────────────────────────
function NeuronLayer({ count, color, height, activated }) {
  const h = height || 180;
  const spacing = Math.min(28, (h - 20) / Math.max(count, 1));
  const dots = Math.min(count, Math.floor((h - 20) / spacing));
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", gap: spacing - 12, paddingTop:6 }}>
      {Array.from({ length: dots }).map((_, i) => {
        const bright = activated ? 0.6 + Math.random() * 0.4 : 0.2;
        return (
          <div key={i} style={{
            width: 9, height: 9, borderRadius:"50%",
            background: activated ? color : `${color}44`,
            boxShadow: activated ? `0 0 6px 2px ${color}88` : "none",
            transition: "background 0.4s, box-shadow 0.4s",
            flexShrink: 0,
          }}/>
        );
      })}
    </div>
  );
}

// ── Image pixel preview ───────────────────────────────────────────────────────
function PixelPreview({ color, noisy, reconstructed }) {
  const grid = 7;
  const pixels = Array.from({ length: grid * grid }).map((_, i) => {
    const base = Math.sin(i * 0.7 + i * 0.3) * 0.5 + 0.5;
    const noise = noisy ? (Math.random() - 0.5) * 0.4 : 0;
    const blur  = reconstructed ? base * 0.85 + 0.1 : base;
    return Math.max(0, Math.min(1, blur + noise));
  });
  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${grid}, 1fr)`,
      gap:1, padding:4, width:"100%", height:"100%" }}>
      {pixels.map((v, i) => (
        <div key={i} style={{
          borderRadius:1,
          background: `rgba(${
            color === COLORS.purple ? `${Math.round(168*v)},${Math.round(85*v)},${Math.round(247*v)}`
            : `${Math.round(32*v)},${Math.round(205*v)},${Math.round(100*v)}`
          },${0.3 + v * 0.7})`,
        }}/>
      ))}
    </div>
  );
}

// ── Latent space visualization ────────────────────────────────────────────────
function LatentViz({ active }) {
  const points = [
    [22,28],[38,18],[28,38],[50,22],[42,40],
    [18,44],[60,30],[35,50],[55,48],[26,55],
  ];
  return (
    <svg width="100%" height="100%" viewBox="0 0 80 70">
      {points.map(([x,y],i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={active ? 4 : 2.5}
            fill={COLORS.orange} opacity={active ? 0.9 : 0.4}
            style={{ transition:"all 0.5s" }}/>
          {active && <circle cx={x} cy={y} r={7}
            fill="none" stroke={COLORS.orange} strokeWidth={0.5} opacity={0.3}/>}
        </g>
      ))}
      {active && (
        <ellipse cx={38} cy={36} rx={28} ry={22}
          fill="none" stroke={COLORS.orange} strokeWidth={0.8}
          strokeDasharray="3 2" opacity={0.4}/>
      )}
    </svg>
  );
}

// ── Loss curve mini chart ─────────────────────────────────────────────────────
function LossCurve({ active }) {
  const pts = [[0,50],[10,42],[22,32],[35,22],[50,15],[70,10],[95,7],[115,6]];
  const d = pts.map((p,i)=>(i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`)).join(" ");
  return (
    <svg width="100%" height="100%" viewBox="0 0 120 60" style={{ padding:2 }}>
      <line x1={0} y1={55} x2={115} y2={55} stroke="#ffffff22" strokeWidth={0.8}/>
      <line x1={0} y1={0}  x2={0}   y2={55} stroke="#ffffff22" strokeWidth={0.8}/>
      {active && <>
        <path d={d} fill="none" stroke={COLORS.orange} strokeWidth={2} opacity={0.9}/>
        <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r={3}
          fill={COLORS.orange} opacity={0.9}/>
        <text x={60} y={12} textAnchor="middle"
          fill={COLORS.orange} fontSize={7} fontFamily="JetBrains Mono">
          MSE Loss ↓
        </text>
      </>}
      {!active && (
        <text x={60} y={32} textAnchor="middle"
          fill="#334455" fontSize={7} fontFamily="JetBrains Mono">
          Loss · · ·
        </text>
      )}
    </svg>
  );
}

// ── Packet tooltip ────────────────────────────────────────────────────────────
const PACKET_TIPS = {
  encode: {
    title: "⚡ Forward Pass — Encoding",
    explain: "Input data flows through encoder layers, each compressing information.",
    math: "h = ReLU(W·x + b)",
  },
  decode: {
    title: "🔁 Forward Pass — Decoding",
    explain: "Latent vector expands back through decoder to reconstruct the input.",
    math: "x̂ = σ(W'·z + b')",
  },
  latent: {
    title: "🧠 Latent Representation z",
    explain: "Compressed bottleneck vector — the learned abstract features.",
    math: "z = Encoder(x) ∈ ℝ²",
  },
  loss: {
    title: "📉 Reconstruction Loss",
    explain: "Measures how different the output is from the input.",
    math: "L = ||x - x̂||²",
  },
  gradient: {
    title: "🔄 Backpropagation",
    explain: "Gradients flow backwards to update all weights via chain rule.",
    math: "∂L/∂W = ∂L/∂x̂ · ∂x̂/∂W",
  },
  pixel: {
    title: "🖼️ Input Image",
    explain: "Raw pixel values fed as a flattened vector into the network.",
    math: "x ∈ ℝ^(H×W×C)",
  },
};

function PacketTooltip({ tip, color, x, y, visible }) {
  if (!tip) return null;
  const onLeft = x > W * 0.55;
  return (
    <div style={{
      position:"absolute",
      left: onLeft ? x - 220 : x + 18,
      top:  y - 10,
      width: 210,
      background:"rgba(4,8,22,0.97)",
      border:`1px solid ${color}55`,
      borderLeft:`3px solid ${color}`,
      borderRadius:9, padding:"9px 12px",
      fontFamily:"'JetBrains Mono',monospace",
      fontSize:8, lineHeight:1.8,
      pointerEvents:"none", zIndex:300,
      opacity:visible?1:0,
      transform:visible?"scale(1)":"scale(0.96)",
      transition:"opacity 0.18s ease, transform 0.18s ease",
    }}>
      <div style={{color,fontWeight:700,fontSize:9,marginBottom:5}}>{tip.title}</div>
      <div style={{color:"#b8cce0",marginBottom:6}}>{tip.explain}</div>
      <div style={{
        background:"rgba(255,255,255,0.05)",border:`1px solid ${color}22`,
        borderRadius:5,padding:"4px 7px",color:"#7ec8a0",
        fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:0.5,
      }}>{tip.math}</div>
      <div style={{
        position:"absolute",top:14,
        ...(onLeft
          ?{right:-5,borderTop:"5px solid transparent",borderBottom:"5px solid transparent",borderLeft:`5px solid ${color}`}
          :{left:-5, borderTop:"5px solid transparent",borderBottom:"5px solid transparent",borderRight:`5px solid ${color}`}),
        width:0,height:0,
      }}/>
    </div>
  );
}

// ── Packet ────────────────────────────────────────────────────────────────────
const TRAIL_LEN = 10;
function Packet({ points, color, duration, delay, active, shape, tipKey }) {
  const [trail, setTrail] = useState([]);
  const [hov,   setHov]   = useState(false);
  const raf = useRef(null), t0 = useRef(null), buf = useRef([]);

  useEffect(()=>{
    if(!active){setTrail([]);buf.current=[];return;}
    const dur=duration*1000, del=delay*1000;
    const segs=[];let total=0;
    for(let i=1;i<points.length;i++){
      const dx=points[i][0]-points[i-1][0],dy=points[i][1]-points[i-1][1];
      const len=Math.hypot(dx,dy);
      segs.push({len,dx,dy,x0:points[i-1][0],y0:points[i-1][1]});
      total+=len;
    }
    let live=true;
    const frame=ts=>{
      if(!live)return;
      if(!t0.current)t0.current=ts;
      const e=ts-t0.current-del;
      if(e<0){raf.current=requestAnimationFrame(frame);return;}
      const tgt=((e%dur)/dur)*total;
      let acc=0;
      for(const s of segs){
        if(acc+s.len>=tgt){
          const f=(tgt-acc)/s.len;
          buf.current=[...buf.current,{x:s.x0+s.dx*f,y:s.y0+s.dy*f}].slice(-TRAIL_LEN);
          setTrail([...buf.current]);break;
        }
        acc+=s.len;
      }
      raf.current=requestAnimationFrame(frame);
    };
    raf.current=requestAnimationFrame(frame);
    return()=>{live=false;cancelAnimationFrame(raf.current);t0.current=null;buf.current=[];};
  },[active,duration,delay]);

  if(!trail.length)return null;
  const head=trail[trail.length-1];
  const tip=PACKET_TIPS[tipKey];
  const sc=hov?1.5:1;
  const glow=`0 0 10px 4px ${color}88`;

  const renderHead=()=>{
    const base={position:"absolute",zIndex:42,pointerEvents:"auto",cursor:"pointer",transformOrigin:"center",transition:"transform 0.1s,box-shadow 0.1s"};
    if(shape==="diamond") return(
      <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{...base,left:head.x-7,top:head.y-7,width:14,height:14,
          background:color,transform:`rotate(45deg) scale(${sc})`,
          boxShadow:hov?`0 0 18px 7px ${color}cc`:glow}}/>
    );
    if(shape==="square") return(
      <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{...base,left:head.x-7,top:head.y-7,width:14,height:14,
          background:color,borderRadius:2,transform:`scale(${sc})`,
          boxShadow:hov?`0 0 18px 7px ${color}cc`:glow}}/>
    );
    if(shape==="star") return(
      <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{...base,left:head.x-8,top:head.y-8,fontSize:14,lineHeight:1,
          transform:`scale(${sc})`,filter:`drop-shadow(0 0 ${hov?7:3}px ${color})`}}>⭐</div>
    );
    if(shape==="triangle") return(
      <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{...base,left:head.x-7,top:head.y-7,width:0,height:0,
          borderLeft:"7px solid transparent",borderRight:"7px solid transparent",
          borderBottom:`14px solid ${color}`,transform:`scale(${sc})`,
          filter:`drop-shadow(0 0 ${hov?7:3}px ${color})`}}/>
    );
    return(
      <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{...base,left:head.x-7,top:head.y-7,width:14,height:14,
          borderRadius:"50%",background:color,transform:`scale(${sc})`,
          boxShadow:hov?`0 0 18px 7px ${color}cc`:glow}}/>
    );
  };

  return(
    <div style={{position:"absolute",left:0,top:0,pointerEvents:"none",zIndex:40}}>
      {trail.slice(0,-1).map((pt,i)=>{
        const t=(i+1)/trail.length;
        return(
          <div key={i} style={{
            position:"absolute",
            left:pt.x-Math.max(1.5,t*5),top:pt.y-Math.max(1.5,t*5),
            width:Math.max(3,t*10),height:Math.max(3,t*10),
            borderRadius:"50%",background:color,
            opacity:Math.pow(t,1.8)*0.55,
            filter:`blur(${(1-t)*2}px)`,pointerEvents:"none",
          }}/>
        );
      })}
      {renderHead()}
      <PacketTooltip tip={tip} color={color} x={head.x} y={head.y} visible={hov}/>
    </div>
  );
}

// ── PulseRing ─────────────────────────────────────────────────────────────────
function PulseRing({ box, color }) {
  return(
    <div style={{
      position:"absolute",
      left:box.x+box.w/2-28,top:box.y+box.h/2-28,
      width:56,height:56,borderRadius:"50%",
      border:`2px solid ${color}`,
      animation:"pulseRing 2s ease-out infinite",
      pointerEvents:"none",zIndex:5,
    }}/>
  );
}

// ── Layer box ─────────────────────────────────────────────────────────────────
const LAYER_TIPS = {
  INPUT:      { color:COLORS.purple, label:"Input Layer",     neurons:8,  desc:"Flattened pixel vector fed into encoder.",     math:"x ∈ ℝ^784" },
  ENC1:       { color:COLORS.purple, label:"Encoder L1",      neurons:10, desc:"First compression: 784→128 with ReLU.",        math:"h₁ = ReLU(W₁x + b₁)" },
  ENC2:       { color:COLORS.green,  label:"Encoder L2",      neurons:7,  desc:"Second compression: 128→64.",                  math:"h₂ = ReLU(W₂h₁ + b₂)" },
  BOTTLENECK: { color:COLORS.orange, label:"Bottleneck z",    neurons:3,  desc:"Latent code: the compressed representation.",  math:"z = W₃h₂ + b₃  ∈ ℝ²" },
  DEC2:       { color:COLORS.green,  label:"Decoder L2",      neurons:7,  desc:"First expansion: 2→64 with ReLU.",             math:"d₁ = ReLU(W₄z + b₄)" },
  DEC1:       { color:COLORS.teal,   label:"Decoder L1",      neurons:10, desc:"Second expansion: 64→128.",                   math:"d₂ = ReLU(W₅d₁ + b₅)" },
  OUTPUT:     { color:COLORS.teal,   label:"Output Layer",    neurons:8,  desc:"Reconstructed vector via sigmoid activation.", math:"x̂ = σ(W₆d₂ + b₆)" },
};

function LayerBox({ box, tipKey, activated, stage }) {
  const [hov, setHov] = useState(false);
  const cfg = LAYER_TIPS[tipKey];
  if (!cfg) return null;
  return (
    <div
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        position:"absolute",left:box.x,top:box.y,width:box.w,height:box.h,
        background: hov?"rgba(14,22,48,0.99)":"rgba(10,14,36,0.93)",
        border:`1.5px solid ${hov?cfg.color:cfg.color+"88"}`,
        borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",
        zIndex:10,boxShadow:hov?`0 0 30px ${cfg.color}55`:`0 0 12px ${cfg.color}18`,
        cursor:"default",transition:"all 0.2s",overflow:"visible",
      }}
    >
      {/* label */}
      <div style={{
        position:"absolute",top:5,left:0,right:0,
        textAlign:"center",fontFamily:"'JetBrains Mono',monospace",
        fontSize:7.5,fontWeight:700,color:`${cfg.color}dd`,letterSpacing:0.4,
      }}>{cfg.label}</div>

      {/* neurons */}
      <div style={{marginTop:20,width:"100%",flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <NeuronLayer count={cfg.neurons} color={cfg.color} height={box.h-30} activated={activated}/>
      </div>

      {/* tooltip */}
      {hov && (
        <div style={{
          position:"absolute",
          bottom:"calc(100% + 10px)",left:"50%",
          transform:"translateX(-50%)",
          background:"rgba(4,8,22,0.97)",
          border:`1px solid ${cfg.color}44`,
          borderTop:`2.5px solid ${cfg.color}`,
          borderRadius:10,padding:"10px 13px",
          minWidth:210,maxWidth:240,
          fontFamily:"'JetBrains Mono',monospace",
          fontSize:8,lineHeight:1.8,
          pointerEvents:"none",zIndex:200,
          whiteSpace:"normal",
        }}>
          <div style={{color:cfg.color,fontWeight:700,fontSize:9,marginBottom:5}}>{cfg.label}</div>
          <div style={{color:"#b8cce0",marginBottom:6}}>{cfg.desc}</div>
          <div style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${cfg.color}22`,
            borderRadius:5,padding:"4px 7px",color:"#7ec8a0",fontSize:9,letterSpacing:0.5,
            fontFamily:"'JetBrains Mono',monospace"}}>{cfg.math}</div>
          <div style={{position:"absolute",bottom:-5,left:"50%",
            transform:"translateX(-50%) rotate(45deg)",width:8,height:8,
            background:"rgba(4,8,22,0.97)",
            borderBottom:`1px solid ${cfg.color}44`,borderRight:`1px solid ${cfg.color}44`}}/>
        </div>
      )}
    </div>
  );
}

// ── Callout ───────────────────────────────────────────────────────────────────
function Callout({ sx, sy, accentColor, step, text, show }) {
  return(
    <div style={{
      position:"absolute",left:sx,top:sy,
      background:"rgba(6,10,24,0.93)",border:`1px solid ${accentColor}44`,
      borderLeft:`3px solid ${accentColor}`,borderRadius:8,padding:"7px 11px",maxWidth:172,
      fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,lineHeight:1.6,
      pointerEvents:"none",opacity:show?1:0,
      transform:show?"translateY(0)":"translateY(6px)",
      transition:"opacity 0.35s ease, transform 0.35s ease",zIndex:25,
    }}>
      <div style={{color:accentColor,fontWeight:700,letterSpacing:1,fontSize:7.5,textTransform:"uppercase",marginBottom:3}}>{step}</div>
      <div style={{color:"#b8cae0"}}>{text}</div>
    </div>
  );
}

// ── Laser cursor ──────────────────────────────────────────────────────────────
function LaserCursor({ containerRef }) {
  const [pos,setPos]=useState(null);
  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const onMove=e=>{const r=el.getBoundingClientRect();setPos({x:e.clientX-r.left,y:e.clientY-r.top});};
    const onLeave=()=>setPos(null);
    el.addEventListener("mousemove",onMove);el.addEventListener("mouseleave",onLeave);
    return()=>{el.removeEventListener("mousemove",onMove);el.removeEventListener("mouseleave",onLeave);};
  },[]);
  if(!pos)return null;
  return(
    <div style={{
      position:"absolute",left:pos.x-7,top:pos.y-7,
      width:14,height:14,borderRadius:"50%",
      background:"radial-gradient(circle,#ff9090 0%,#ff2222 45%,#aa0000 100%)",
      boxShadow:"0 0 6px 2px #ff444488,0 0 16px 6px #ff222233,0 0 30px 12px #ff000015",
      pointerEvents:"none",zIndex:9999,
    }}/>
  );
}

// ── Floating math equation ────────────────────────────────────────────────────
function MathTag({ x, y, eq, color, show }) {
  return(
    <div style={{
      position:"absolute",left:x,top:y,
      background:`rgba(4,8,22,0.92)`,
      border:`1px solid ${color}44`,borderRadius:6,
      padding:"3px 8px",
      fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,
      color:color,fontWeight:600,letterSpacing:0.5,
      pointerEvents:"none",zIndex:26,
      opacity:show?0.92:0,
      transition:"opacity 0.3s ease",
    }}>{eq}</div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AutoencoderDiagram() {
  const [stage,   setStage]  = useState(0);
  const [hovBtn,  setHovBtn] = useState(null);
  const canvasRef = useRef(null);
  const lastStage = 5;

  const stages=[
    {label:"Overview"},
    {label:"① Encode"},
    {label:"② Latent z"},
    {label:"③ Decode"},
    {label:"④ Loss"},
    {label:"⑤ Full Pass"},
  ];

  const arrowVis={
    ie1:[1],e1e2:[1],e2bn:[1],
    bnl:[2],
    bnd2:[3],d2d1:[3],d1o:[3],
    oli:[4],ili:[4],lg:[4],
    bg:[5],
  };
  const arrowShow=id=>stage===lastStage||(arrowVis[id]||[]).includes(stage);
  const isActive=req=>stage===lastStage||req.includes(stage);

  // which layers are "lit up"
  const encActive  = isActive([1]);
  const latActive  = isActive([2]);
  const decActive  = isActive([3]);
  const lossActive = isActive([4]);

  const packets=[
    // Stage 1 — encode
    {path:pathInputToEnc1,      color:COLORS.purple, dur:1.8, del:0,   req:[1], shape:"diamond", tipKey:"encode"},
    {path:pathEnc1ToEnc2,       color:COLORS.purple, dur:1.8, del:0.4, req:[1], shape:"diamond", tipKey:"encode"},
    {path:pathEnc2ToBottleneck, color:COLORS.green,  dur:1.8, del:0.8, req:[1], shape:"diamond", tipKey:"encode"},
    // Stage 2 — latent
    {path:pathBottleneckToLatent,color:COLORS.orange,dur:2.0, del:0,   req:[2], shape:"star",    tipKey:"latent"},
    // Stage 3 — decode
    {path:pathBottleneckToDec2, color:COLORS.green,  dur:1.8, del:0,   req:[3], shape:"square",  tipKey:"decode"},
    {path:pathDec2ToDec1,       color:COLORS.teal,   dur:1.8, del:0.4, req:[3], shape:"square",  tipKey:"decode"},
    {path:pathDec1ToOutput,     color:COLORS.teal,   dur:1.8, del:0.8, req:[3], shape:"square",  tipKey:"decode"},
    // Stage 4 — loss + backprop
    {path:pathOutputToLoss,     color:COLORS.orange, dur:2.2, del:0,   req:[4], shape:"triangle",tipKey:"loss"},
    {path:pathInputToLoss,      color:COLORS.orange, dur:2.2, del:0.3, req:[4], shape:"triangle",tipKey:"loss"},
    {path:pathLossToEnc1,       color:COLORS.pink,   dur:2.8, del:0.6, req:[4], shape:"circle",  tipKey:"gradient"},
    // image paths
    {path:pathOrigToInput,      color:COLORS.purple, dur:1.5, del:0,   req:[1], shape:"circle",  tipKey:"pixel"},
    {path:pathOutputToRecon,    color:COLORS.teal,   dur:1.5, del:0,   req:[3], shape:"circle",  tipKey:"decode"},
  ];

  return(
    <div style={{fontFamily:"'JetBrains Mono',monospace",background:"#080d1c",
      minHeight:"100vh",display:"flex",flexDirection:"column",
      alignItems:"center",paddingTop:28,paddingBottom:40}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        @keyframes pulseRing{0%{transform:scale(0.7);opacity:0.9;}100%{transform:scale(2.4);opacity:0;}}
        @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        *{box-sizing:border-box;}
      `}</style>

      {/* Title */}
      <div style={{color:COLORS.orange,fontSize:17,fontWeight:700,letterSpacing:2,
        marginBottom:4,textTransform:"uppercase",textAlign:"center"}}>
        🧠 Deep Learning Autoencoder — Interactive Educational Simulator
      </div>
      <div style={{color:"#3d4f60",fontSize:9,marginBottom:18,letterSpacing:1,textAlign:"center"}}>
        Encoder → Bottleneck → Decoder · Hover neurons & packets for math · Click stages to explore
      </div>

      {/* Buttons */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",justifyContent:"center"}}>
        {stages.map((s,i)=>{
          const isAct=stage===i;
          return(
            <button key={i} onClick={()=>setStage(i)}
              onMouseEnter={()=>setHovBtn(i)} onMouseLeave={()=>setHovBtn(null)}
              style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600,
                padding:"6px 15px",borderRadius:20,cursor:"pointer",border:"1px solid",
                borderColor:isAct?COLORS.orange:hovBtn===i?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.12)",
                background:isAct?"rgba(255,159,28,0.16)":hovBtn===i?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",
                color:isAct?COLORS.orange:hovBtn===i?"#c8d4e8":"#6a7b94",
                transition:"all 0.2s ease"}}>{s.label}</button>
          );
        })}
      </div>

      {/* Canvas */}
      <div ref={canvasRef} style={{position:"relative",width:W,height:H,
        background:"rgba(8,13,28,0.98)",borderRadius:16,
        border:"1.5px solid rgba(255,159,28,0.15)",
        boxShadow:"0 0 60px rgba(255,159,28,0.06),0 8px 40px rgba(0,0,0,0.6)",
        overflow:"visible",cursor:"none"}}>

        {/* canvas label */}
        <div style={{position:"absolute",top:10,left:14,fontFamily:"'JetBrains Mono',monospace",
          fontSize:9.5,fontWeight:600,color:"rgba(255,159,28,0.5)",letterSpacing:1,textTransform:"uppercase"}}>
          Autoencoder Neural Network
        </div>

        {/* Encoder region */}
        <div style={{position:"absolute",left:130,top:130,width:280,height:360,
          border:"1.5px dashed rgba(168,85,247,0.25)",borderRadius:14,background:"rgba(168,85,247,0.025)"}}>
          <div style={{position:"absolute",top:7,left:12,fontFamily:"'JetBrains Mono',monospace",
            fontSize:9.5,fontWeight:600,color:"rgba(168,85,247,0.5)"}}>Encoder  φ(x)</div>
        </div>

        {/* Decoder region */}
        <div style={{position:"absolute",left:530,top:130,width:280,height:360,
          border:"1.5px dashed rgba(32,178,170,0.25)",borderRadius:14,background:"rgba(32,178,170,0.025)"}}>
          <div style={{position:"absolute",top:7,left:12,fontFamily:"'JetBrains Mono',monospace",
            fontSize:9.5,fontWeight:600,color:"rgba(32,178,170,0.5)"}}>Decoder  ψ(z)</div>
        </div>

        {/* Bottleneck highlight */}
        <div style={{position:"absolute",left:405,top:200,width:110,height:210,
          border:"1.5px solid rgba(255,159,28,0.35)",borderRadius:12,background:"rgba(255,159,28,0.04)"}}>
          <div style={{position:"absolute",top:6,left:8,fontFamily:"'JetBrains Mono',monospace",
            fontSize:9,fontWeight:600,color:"rgba(255,159,28,0.55)"}}>Bottleneck</div>
        </div>

        {/* Orig image box */}
        <div style={{position:"absolute",left:ORIG_IMG.x,top:ORIG_IMG.y,width:ORIG_IMG.w,height:ORIG_IMG.h,
          background:"rgba(10,14,36,0.93)",border:`1.5px solid ${COLORS.purple}88`,borderRadius:8,
          overflow:"hidden",zIndex:10}}>
          <div style={{position:"absolute",top:5,left:6,fontFamily:"'JetBrains Mono',monospace",
            fontSize:7.5,fontWeight:600,color:`${COLORS.purple}cc`}}>Input x</div>
          <div style={{position:"absolute",inset:0,top:18}}>
            <PixelPreview color={COLORS.purple} noisy={false}/>
          </div>
        </div>

        {/* Recon image box */}
        <div style={{position:"absolute",left:RECON_IMG.x,top:RECON_IMG.y,width:RECON_IMG.w,height:RECON_IMG.h,
          background:"rgba(10,14,36,0.93)",border:`1.5px solid ${COLORS.teal}88`,borderRadius:8,
          overflow:"hidden",zIndex:10}}>
          <div style={{position:"absolute",top:5,left:6,fontFamily:"'JetBrains Mono',monospace",
            fontSize:7.5,fontWeight:600,color:`${COLORS.teal}cc`}}>Output x̂</div>
          <div style={{position:"absolute",inset:0,top:18}}>
            <PixelPreview color={COLORS.green} reconstructed={true}/>
          </div>
        </div>

        {/* Latent space box */}
        <div style={{position:"absolute",left:LATENT.x,top:LATENT.y,width:LATENT.w,height:LATENT.h,
          background:"rgba(10,14,36,0.93)",border:`1.5px solid ${COLORS.orange}88`,borderRadius:8,
          overflow:"hidden",zIndex:10}}>
          <div style={{position:"absolute",top:5,left:6,fontFamily:"'JetBrains Mono',monospace",
            fontSize:7.5,fontWeight:600,color:`${COLORS.orange}cc`}}>Latent z</div>
          <div style={{position:"absolute",inset:0,top:18}}>
            <LatentViz active={latActive}/>
          </div>
        </div>
        <PulseRing box={LATENT} color={COLORS.orange}/>

        {/* Loss box */}
        <div style={{position:"absolute",left:LOSS.x,top:LOSS.y,width:LOSS.w,height:LOSS.h,
          background:"rgba(10,14,36,0.93)",border:`1.5px solid ${COLORS.orange}88`,borderRadius:8,
          overflow:"hidden",zIndex:10}}>
          <div style={{position:"absolute",top:5,left:6,fontFamily:"'JetBrains Mono',monospace",
            fontSize:7.5,fontWeight:600,color:`${COLORS.orange}cc`}}>Loss L</div>
          <div style={{position:"absolute",inset:0,top:18}}>
            <LossCurve active={lossActive}/>
          </div>
        </div>
        <PulseRing box={LOSS} color={COLORS.orange}/>

        {/* Layer boxes */}
        <LayerBox box={INPUT}      tipKey="INPUT"      activated={encActive || decActive}/>
        <LayerBox box={ENC1}       tipKey="ENC1"       activated={encActive}/>
        <LayerBox box={ENC2}       tipKey="ENC2"       activated={encActive}/>
        <LayerBox box={BOTTLENECK} tipKey="BOTTLENECK" activated={latActive || encActive || decActive}/>
        <LayerBox box={DEC2}       tipKey="DEC2"       activated={decActive}/>
        <LayerBox box={DEC1}       tipKey="DEC1"       activated={decActive}/>
        <LayerBox box={OUTPUT}     tipKey="OUTPUT"     activated={decActive}/>

        {/* Math tags */}
        <MathTag x={155} y={175} eq="784 → 128" color={COLORS.purple} show={encActive||isActive([5])}/>
        <MathTag x={282} y={222} eq="128 → 64"  color={COLORS.purple} show={encActive||isActive([5])}/>
        <MathTag x={555} y={222} eq="64 → 128"  color={COLORS.teal}   show={decActive||isActive([5])}/>
        <MathTag x={682} y={175} eq="128 → 784" color={COLORS.teal}   show={decActive||isActive([5])}/>
        <MathTag x={420} y={356} eq="64 → 2"    color={COLORS.orange} show={latActive||isActive([5])}/>

        {/* SVG Arrows */}
        <svg style={{position:"absolute",top:0,left:0,width:W,height:H,pointerEvents:"none",overflow:"visible"}}>
          <defs>
            {[{id:"arw-purple",color:COLORS.purple},{id:"arw-green",color:COLORS.green},
              {id:"arw-orange",color:COLORS.orange},{id:"arw-teal",color:COLORS.teal},
              {id:"arw-pink",color:COLORS.pink},{id:"arw-blue",color:COLORS.blue}].map(({id,color})=>(
              <marker key={id} id={id} markerWidth={8} markerHeight={8} refX={7} refY={3} orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={color}/>
              </marker>
            ))}
          </defs>

          {/* Encode */}
          {arrowShow("ie1") &&<path d={pts2d(pathInputToEnc1)}       fill="none" stroke={COLORS.purple} strokeWidth={1.8} strokeDasharray="5 4" opacity={0.83} markerEnd="url(#arw-purple)"/>}
          {arrowShow("e1e2")&&<path d={pts2d(pathEnc1ToEnc2)}        fill="none" stroke={COLORS.purple} strokeWidth={1.8} strokeDasharray="5 4" opacity={0.83} markerEnd="url(#arw-purple)"/>}
          {arrowShow("e2bn")&&<path d={pts2d(pathEnc2ToBottleneck)}  fill="none" stroke={COLORS.green}  strokeWidth={1.8} strokeDasharray="5 4" opacity={0.84} markerEnd="url(#arw-green)"/>}
          {/* Latent */}
          {arrowShow("bnl") &&<path d={pts2d(pathBottleneckToLatent)}fill="none" stroke={COLORS.orange} strokeWidth={1.8} strokeDasharray="5 4" opacity={0.83} markerEnd="url(#arw-orange)"/>}
          {/* Decode */}
          {arrowShow("bnd2")&&<path d={pts2d(pathBottleneckToDec2)}  fill="none" stroke={COLORS.green}  strokeWidth={1.8} strokeDasharray="5 4" opacity={0.84} markerEnd="url(#arw-green)"/>}
          {arrowShow("d2d1")&&<path d={pts2d(pathDec2ToDec1)}        fill="none" stroke={COLORS.teal}   strokeWidth={1.8} strokeDasharray="5 4" opacity={0.84} markerEnd="url(#arw-teal)"/>}
          {arrowShow("d1o") &&<path d={pts2d(pathDec1ToOutput)}      fill="none" stroke={COLORS.teal}   strokeWidth={1.8} strokeDasharray="5 4" opacity={0.84} markerEnd="url(#arw-teal)"/>}
          {/* Loss */}
          {arrowShow("oli") &&<path d={pts2d(pathOutputToLoss)}      fill="none" stroke={COLORS.orange} strokeWidth={1.8} strokeDasharray="5 4" opacity={0.83} markerEnd="url(#arw-orange)"/>}
          {arrowShow("ili") &&<path d={pts2d(pathInputToLoss)}       fill="none" stroke={COLORS.orange} strokeWidth={1.8} strokeDasharray="5 4" opacity={0.83} markerEnd="url(#arw-orange)"/>}
          {arrowShow("lg")  &&<path d={pts2d(pathLossToEnc1)}        fill="none" stroke={COLORS.pink}   strokeWidth={1.8} strokeDasharray="4 3" opacity={0.82} markerEnd="url(#arw-pink)"/>}
          {/* Image connectors */}
          {arrowShow("ie1") &&<path d={pts2d(pathOrigToInput)}       fill="none" stroke={COLORS.purple} strokeWidth={1.4} strokeDasharray="3 3" opacity={0.6} markerEnd="url(#arw-purple)"/>}
          {arrowShow("d1o") &&<path d={pts2d(pathOutputToRecon)}     fill="none" stroke={COLORS.teal}   strokeWidth={1.4} strokeDasharray="3 3" opacity={0.6} markerEnd="url(#arw-teal)"/>}
        </svg>

        {/* Packets */}
        {packets.map((p,i)=>(
          <Packet key={i} points={p.path} color={p.color} duration={p.dur}
            delay={p.del} active={isActive(p.req)} shape={p.shape} tipKey={p.tipKey}/>
        ))}

        {/* Callouts */}
        <Callout sx={8} sy={48} accentColor={COLORS.orange} step="Overview"
          text="An Autoencoder compresses input into a small latent code z, then reconstructs it. The loss trains the whole network end-to-end."
          show={stage===0}/>
        <Callout sx={8} sy={420} accentColor={COLORS.purple} step="① Encode"
          text="Input x passes through encoder layers with ReLU activations. Each layer shrinks the representation: 784→128→64→2."
          show={stage===1}/>
        <Callout sx={8} sy={48} accentColor={COLORS.orange} step="② Latent z"
          text="The bottleneck compresses all information into a 2D latent vector z. This is the learned abstract representation of the data."
          show={stage===2}/>
        <Callout sx={8} sy={420} accentColor={COLORS.teal} step="③ Decode"
          text="The decoder expands z back: 2→64→128→784. The sigmoid output x̂ should match the original input x."
          show={stage===3}/>
        <Callout sx={8} sy={48} accentColor={COLORS.orange} step="④ Loss + Backprop"
          text="MSE Loss = ||x - x̂||² is computed. Gradients flow backward through all layers updating weights W via Adam optimizer."
          show={stage===4}/>

        {/* Laser cursor */}
        <LaserCursor containerRef={canvasRef}/>
      </div>

      {/* Legend */}
      <div style={{marginTop:22,display:"flex",gap:22,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
        {[
          {color:COLORS.purple, label:"Encoding pass ◆"},
          {color:COLORS.green,  label:"Bottleneck transition ■"},
          {color:COLORS.orange, label:"Latent z / Loss ★"},
          {color:COLORS.teal,   label:"Decoding pass ■"},
          {color:COLORS.pink,   label:"Backpropagation ●"},
          {color:"#ff4444",     label:"🔴 Laser cursor"},
        ].map(({color,label})=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:18,height:2,background:color,borderRadius:2}}/>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#3d4f60"}}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{marginTop:10,fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#1a2535",letterSpacing:1,textAlign:"center"}}>
        🧠 Autoencoder Simulator · Encoder φ · Latent z · Decoder ψ · Backprop · React JSX Educational Tool
      </div>
    </div>
  );
}
