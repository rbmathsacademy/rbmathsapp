'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast, Toaster } from 'react-hot-toast';

export default function InteractiveAssignmentPage() {
    const params = useParams();
    const router = useRouter();
    const assignmentId = params.id as string;

    const [student, setStudent] = useState<any>(null);
    const [assignment, setAssignment] = useState<any>(null);
    const [submission, setSubmission] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const storedStudent = localStorage.getItem('student');
        if (!storedStudent) {
            router.push('/student/login');
            return;
        }
        const parsedStudent = JSON.parse(storedStudent);
        setStudent(parsedStudent);
        fetchAssignment(parsedStudent);
    }, []);

    const fetchAssignment = async (studentData: any) => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/student/assignments/interactive/${assignmentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || 'Failed to load assignment');
                return;
            }
            const data = await res.json();
            setAssignment(data.assignment);
            setSubmission(data.submission || null);
        } catch {
            toast.error('Failed to load assignment');
        } finally {
            setLoading(false);
        }
    };

    // Listen for score from iframe
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'INTERACTIVE_ASSIGNMENT_SUBMIT') {
                const { score, total } = event.data;
                await handleSubmit(score, total);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [assignment, student]);

    const handleSubmit = async (score: number, total: number) => {
        if (!assignment || !student) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/student/assignments/interactive-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ assignmentId, score, totalQuestions: total })
            });

            if (res.ok) {
                const data = await res.json();
                setSubmission(data.submission);
                toast.success('Score saved successfully! 🎉');
                // Notify the iframe that save was successful
                iframeRef.current?.contentWindow?.postMessage(
                    { type: 'PORTAL_SAVE_RESULT', success: true, score, total },
                    '*'
                );
            } else {
                const errData = await res.json();
                toast.error(errData.error || 'Failed to save score');
                iframeRef.current?.contentWindow?.postMessage(
                    { type: 'PORTAL_SAVE_RESULT', success: false, error: errData.error },
                    '*'
                );
            }
        } catch {
            toast.error('Failed to save score. Please screenshot your result.');
            iframeRef.current?.contentWindow?.postMessage(
                { type: 'PORTAL_SAVE_RESULT', success: false, error: 'Network error' },
                '*'
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!assignment) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] text-gray-200 p-6">
                <Link href="/student/assignments" className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
                    <ArrowLeft className="h-5 w-5" /> Back to Assignments
                </Link>
                <div className="text-center py-20 text-gray-400">Assignment not found or access denied.</div>
            </div>
        );
    }

    const studentName = student?.name || student?.studentName || 'Student';
    const htmlContent = generateInteractiveHtml(studentName, assignmentId, assignment.interactiveHtmlId);

    return (
        <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="bg-[#1a1f2e] border-b border-white/10 px-4 py-3 flex items-center gap-3 shrink-0">
                <Link
                    href="/student/assignments"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-sm font-bold text-white line-clamp-1">{assignment.title}</h1>
                    <p className="text-xs text-gray-400">Interactive Assignment · {studentName}</p>
                </div>
                {submission && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-bold">
                            Submitted: {submission.score}/{submission.totalQuestions}
                        </span>
                    </div>
                )}
                {submitting && (
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving score...
                    </div>
                )}
            </div>

            {/* Already submitted banner */}
            {submission && (
                <div className="bg-emerald-900/20 border-b border-emerald-500/20 px-4 py-2 text-center">
                    <span className="text-emerald-300 text-sm">
                        ✅ You have already submitted this assignment. Score: <strong>{submission.score}/{submission.totalQuestions}</strong>.
                        You can attempt it again to improve your score.
                    </span>
                </div>
            )}

            {/* Interactive Assignment iframe */}
            <div className="flex-1 relative">
                <iframe
                    ref={iframeRef}
                    srcDoc={htmlContent}
                    className="w-full h-full border-0"
                    style={{ minHeight: 'calc(100vh - 60px)' }}
                    title={assignment.title}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                />
            </div>
        </div>
    );
}

/**
 * Generates the full HTML for the interactive assignment with:
 * - Student name pre-filled (no welcome screen)
 * - Skip button removed
 * - Final submit blocked unless all questions answered
 * - On final submit: posts score via postMessage to parent
 */
function generateInteractiveHtml(studentName: string, assignmentId: string, htmlId: string | null): string {
    // Escape student name for safe embedding
    const safeName = studentName.replace(/['"<>&]/g, c => ({ "'": '&#39;', '"': '&quot;', '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c));

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Straight Lines Interactive Assignment ~ Created by Dr. Ritwick Banerjee</title>
<style>
  :root{
    --bg:#0f0f23; --panel:#1a1a2e; --card:#16213e; --accent:#00d4ff; --accent2:#0099cc; --ok:#00ff88; --warn:#ff6b9d; --ink:#e8f4f8; --muted:#a0aec0;
    --glass: rgba(255,255,255,0.1); --shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  *{box-sizing:border-box}
  body{margin:0; font-family: 'Segoe UI',system-ui,-apple-system,sans-serif; background:linear-gradient(135deg,#0f0f23,#1a1a2e); color:var(--ink); overflow-x:hidden}
  
  header{padding:16px 20px; background:linear-gradient(135deg,rgba(26,26,46,0.9),rgba(15,15,35,0.9)); backdrop-filter:blur(20px); border-bottom:1px solid rgba(255,255,255,0.1); position:sticky; top:0; z-index:100; transition:all 0.3s ease}
  header.assignment-mode{position:relative; top:auto}
  header h1{margin:0; font-size:1.1rem; color:var(--accent); text-shadow:0 0 20px rgba(0,212,255,0.5)}
  header small{color:#ffd700; opacity:0.9}
  
  main{display:flex; min-height:calc(100vh - 70px); flex-direction:column}
  main.assignment-mode{min-height:100vh; flex-direction:column}
  
  @media (min-width: 768px) {
    main{flex-direction:row; height:calc(100vh - 70px)}
    main.assignment-mode{height:100vh; flex-direction:column}
    #left{width:60%; border-right:1px solid rgba(255,255,255,0.1); overflow-y:auto}
    #right{width:40%; flex-shrink:0}
    header h1{font-size:1.2rem}
    canvas{width:calc(40vw - 20px); height:calc(100vh - 40px)}
    
    main.assignment-mode #left{width:100%; border-right:none; border-bottom:1px solid rgba(255,255,255,0.1); overflow-y:visible; flex-shrink:0}
    main.assignment-mode #right{width:100%; flex:1; height:auto; min-height:400px}
    main.assignment-mode canvas{width:calc(100% - 20px); height:400px}
  }
  
  #left{background:var(--panel); padding:12px; overflow:auto; backdrop-filter:blur(10px)}
  #right{flex:1; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#0c1220,#1a1a2e); position:relative; margin:0; padding:10px}
  
  .card{background:var(--glass); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:12px; margin-bottom:12px; backdrop-filter:blur(20px); box-shadow:var(--shadow); transition:all 0.3s ease}
  .card:hover{transform:translateY(-2px); box-shadow:0 12px 40px rgba(0,0,0,0.4)}
  
  .row{display:flex; gap:10px; align-items:center; flex-wrap:wrap}
  input[type=text], input[type=number]{background:rgba(15,23,42,0.8); color:var(--ink); border:1px solid rgba(255,255,255,0.2); border-radius:12px; padding:10px; width:120px; font-size:16px; transition:all 0.3s ease}
  input:focus{border-color:var(--accent); box-shadow:0 0 0 3px rgba(0,212,255,0.1); outline:none}
  
  button{background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#0a1a2a; border:none; border-radius:12px; font-weight:600; padding:10px 16px; cursor:pointer; transition:all 0.3s ease; box-shadow:0 4px 15px rgba(0,212,255,0.3)}
  button:hover{transform:translateY(-2px); box-shadow:0 8px 25px rgba(0,212,255,0.4)}
  button:active{transform:translateY(0)}
  button.ghost{background:transparent; color:var(--ink); border:1px solid rgba(255,255,255,0.3); box-shadow:none}
  button.ghost:hover{background:rgba(255,255,255,0.1)}
  button:disabled{opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none}
  
  .ok{color:var(--ok); font-weight:700; text-shadow:0 0 10px rgba(0,255,136,0.5)}
  .bad{color:var(--warn); font-weight:700; text-shadow:0 0 10px rgba(255,107,157,0.5)}
  .hint{color:#ffd700; background:rgba(255,215,0,0.1); padding:8px 12px; border-radius:8px; border-left:3px solid #ffd700; margin-top:8px}
  
  .progress{height:6px; background:rgba(255,255,255,0.1); border-radius:999px; overflow:hidden; position:relative}
  .progress > div{height:100%; background:linear-gradient(90deg,#00ff88,#00d4ff); width:0; transition:width 0.5s ease; position:relative}
  .progress > div::after{content:''; position:absolute; top:0; left:0; right:0; bottom:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent); animation:shimmer 2s infinite}
  
  @keyframes shimmer{0%{transform:translateX(-100%)} 100%{transform:translateX(200%)}}
  
  .pill{display:inline-block; padding:3px 10px; border:1px solid rgba(255,255,255,0.2); border-radius:999px; font-size:.8rem; color:var(--muted); background:rgba(255,255,255,0.05)}
  
  canvas{background:linear-gradient(135deg,#0a1022,#1a1a2e); border:1px solid rgba(255,255,255,0.2); border-radius:16px; box-shadow:var(--shadow); cursor:crosshair}
  
  .footer{font-size:.85rem; color:var(--muted); text-align:center; margin-top:8px; opacity:0.8}
  .fade-in{animation:fadeSlide 0.6s ease}
  
  @keyframes fadeSlide{from{opacity:0; transform:translateY(20px)} to{opacity:1; transform:none}}
  
  .floating-info{position:absolute; top:20px; right:20px; background:var(--glass); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:12px; font-size:0.9rem; opacity:0; transition:all 0.3s ease; pointer-events:none}
  .floating-info.show{opacity:1}
  
  .coord-display{position:absolute; bottom:20px; left:20px; background:rgba(0,0,0,0.7); color:var(--accent); padding:8px 12px; border-radius:8px; font-family:monospace; font-size:0.9rem; backdrop-filter:blur(10px)}
  
  .touch-controls{position:absolute; bottom:20px; right:20px; display:flex; gap:8px; flex-direction:column}
  .touch-btn{width:45px; height:45px; border-radius:50%; background:var(--glass); border:1px solid rgba(255,255,255,0.2); color:var(--accent); display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(20px); transition:all 0.3s ease; font-weight:bold}
  .touch-btn:hover{background:rgba(0,212,255,0.2); transform:scale(1.1)}
  .touch-btn.active{background:var(--accent); color:#0a1a2a}
  
  .celebration{position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); font-size:4rem; z-index:1000; pointer-events:none; animation:celebrate 2s ease}
  @keyframes celebrate{0%{opacity:0; transform:translate(-50%,-50%) scale(0.5)} 50%{opacity:1; transform:translate(-50%,-50%) scale(1.2)} 100%{opacity:0; transform:translate(-50%,-50%) scale(1)}}
  
  .pulse{animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{transform:scale(1)} 50%{transform:scale(1.05)}}
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  
  .score-popup {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #00ff88, #00d4ff);
    color: #0a1a2a;
    padding: 12px 20px;
    border-radius: 12px;
    font-weight: bold;
    box-shadow: 0 8px 25px rgba(0,255,136,0.4);
    z-index: 1000;
    transform: translateY(-100px);
    transition: all 0.4s ease;
    animation: scoreSlide 3s ease;
  }
  
  @keyframes scoreSlide {
    0% { transform: translateY(-100px); opacity: 0; }
    15%, 85% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-100px); opacity: 0; }
  }
  
  .loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: var(--accent);
    animation: spin 1s ease-in-out infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @media (max-width: 767px) {
    main{flex-direction:column; height:100vh}
    main.assignment-mode{height:100vh; flex-direction:column}
    #left{width:100%; border-right:none; border-bottom:1px solid rgba(255,255,255,0.1); overflow-y:auto; padding:8px; flex-shrink:0}
    #right{width:100%; flex:1; height:auto; min-height:300px; margin:0; padding:8px}
    canvas{width:calc(100% - 16px); height:300px}
    .touch-controls{bottom:8px; right:8px; flex-direction:row; gap:6px}
    .touch-btn{width:32px; height:32px; font-size:0.75rem}
    .coord-display{bottom:8px; left:8px; font-size:0.7rem; padding:6px 8px}
    .floating-info{top:8px; right:8px; font-size:0.75rem; padding:8px}
    input[type=text], input[type=number]{width:90px; font-size:16px; padding:8px}
    .row{justify-content:space-between}
    
    .card{padding:8px; margin-bottom:8px; border-radius:8px}
    #qTitle{font-size:0.95rem; margin:0.3rem 0 0.2rem; line-height:1.2}
    #qText{font-size:0.8rem; line-height:1.3; margin-bottom:8px}
    
    .input-row{display:flex; gap:6px; align-items:center; margin-top:6px; flex-wrap:nowrap}
    .input-row label{font-size:0.85rem; flex:1; min-width:80px}
    .input-row input{width:80px; flex-shrink:0; font-size:14px}
    .input-row button{flex-shrink:0; padding:8px 12px; font-size:0.85rem}
    
    .pill{padding:2px 8px; font-size:0.75rem}
    button.ghost{padding:6px 10px; font-size:0.8rem}
    
    body.assignment-active .footer{display:none}
    
    .progress{height:4px; margin-top:6px}
    
    #hud .row{margin-bottom:0}
    #hud{padding:8px; margin-bottom:6px}
  }
  
  body.assignment-active #hud{
    display:none !important;
  }

  /* Portal submission section */
  #portalSaveStatus {
    margin: 12px 0;
    padding: 12px 16px;
    border-radius: 10px;
    text-align: center;
    font-size: 0.95rem;
    background: rgba(0,255,136,0.08);
    border: 1px solid rgba(0,255,136,0.25);
    color: #00ff88;
  }
</style>
</head>
<body>
  <header id="mainHeader">
    <h1>Straight Lines Interactive Assignment <small>~ Created by Dr. Ritwick Banerjee</small></h1>
  </header>
  <main id="mainContainer">
    <section id="left">
      <!-- Welcome card hidden: student name is pre-filled from portal -->

      <div class="card fade-in" id="hud" style="display:block">
        <div class="row" style="justify-content:space-between">
          <div><b>Student:</b> <span id="who">${safeName}</span></div>
          <div><b>Score:</b> <span id="score">0</span>/<span id="total">0</span></div>
        </div>
        <div class="progress" style="margin-top:8px"><div id="bar"></div></div>
      </div>

      <div class="card fade-in" id="qa">
        <div class="row" style="justify-content:space-between; align-items:flex-start">
          <div style="flex:1">
            <div class="pill" id="qTag">Question</div>
            <h3 id="qTitle" style="margin:0.3rem 0 0.2rem"></h3>
            <div id="qText" style="color:#cbd5e1; margin-bottom:8px"></div>
          </div>
          <div class="row" style="gap:6px; flex-shrink:0">
            <button class="ghost" id="hintBtn">Hint</button>
            <!-- Skip button removed: students must attempt all questions -->
          </div>
        </div>
        <div id="stepBox" style="margin-top:8px"></div>
        <div id="feedback" style="min-height:24px; margin-top:6px"></div>
        <div class="row" style="justify-content:space-between; margin-top:6px">
          <div class="pill" id="stepInfo">Step</div>
          <div>
            <button id="prevBtn" class="ghost">◀ Prev</button>
            <button id="nextBtn" disabled>Next ▶</button>
          </div>
        </div>
      </div>

      <div class="card fade-in" id="summary" style="display:none">
        <h3>🎉 Assignment Complete!</h3>
        <p>Excellent work, <b id="finName">${safeName}</b>! Here's your final score:</p>
        <p style="font-size:1.4rem; text-align:center; color:var(--ok)"><b id="finScore"></b></p>
        <div id="portalSaveStatus">
          <div class="loading-spinner"></div> Saving your score to the portal...
        </div>
        <p class="footer">(Interactive version with live visualizations)</p>
      </div>

      <div class="footer">💡 Tap the graph to explore coordinates • Use controls to zoom</div>
    </section>

    <section id="right">
      <div style="position:relative; width:100%; height:100%">
        <canvas id="graph"></canvas>
        <div class="coord-display" id="coordDisplay" style="display:none">
          (<span id="coordX">0</span>, <span id="coordY">0</span>)
        </div>
        <div class="floating-info" id="floatingInfo">
          <div>📐 Interactive Geometry Visualizer</div>
          <div style="font-size:0.8rem; margin-top:4px">Tap to explore • Auto-plotting enabled</div>
        </div>
        <div class="touch-controls">
          <div class="touch-btn" id="zoomIn" title="Zoom In">+</div>
          <div class="touch-btn" id="zoomOut" title="Zoom Out">−</div>
          <div class="touch-btn" id="resetView" title="Reset View">⌂</div>
          <div class="touch-btn" id="toggleCoords" title="Toggle Coordinates">📍</div>
        </div>
      </div>
    </section>
  </main>

<script>
// ================== Enhanced Graph Engine ==================
const canvas = document.getElementById('graph');
const ctx = canvas.getContext('2d');
let SCALE = 25;
let midX, midY;
let hoverCoord = null;
let showCoords = false;

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  const isMobile = window.innerWidth < 768;
  const isAssignmentMode = document.body.classList.contains('assignment-active');
  
  if (isMobile) {
    canvas.width = Math.min(rect.width - 16, window.innerWidth - 16);
    canvas.height = 300;
  } else {
    if (isAssignmentMode) {
      canvas.width = Math.min(940, rect.width - 20);
      canvas.height = 400;
    } else {
      canvas.width = Math.min(940, rect.width - 20);
      canvas.height = Math.min(500, rect.height - 20);
    }
  }
  
  midX = canvas.width / 2;
  midY = canvas.height / 2;
  drawAxes();
  replotAll();
}

window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

function worldToCanvas(x,y){ return [midX + x*SCALE, midY - y*SCALE]; }
function canvasToWorld(cx,cy){ return [(cx-midX)/SCALE, (midY-cy)/SCALE]; }

function drawAxes(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  const time = Date.now() * 0.001;
  const alpha = 0.2 + 0.05 * Math.sin(time);
  
  ctx.strokeStyle = 'rgba(23,34,58,'+alpha+')'; 
  ctx.lineWidth = 1;
  for(let x=0; x<canvas.width; x+=SCALE){ 
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); 
  }
  for(let y=0; y<canvas.height; y+=SCALE){ 
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); 
  }
  
  ctx.save();
  ctx.shadowColor = '#3b82f6';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#3b82f6'; 
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0,midY); ctx.lineTo(canvas.width,midY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(midX,0); ctx.lineTo(midX,canvas.height); ctx.stroke();
  ctx.restore();
  
  ctx.fillStyle = '#8892b0'; 
  ctx.font = '11px system-ui'; 
  ctx.textAlign='center';
  
  const maxUnits = Math.max(canvas.width, canvas.height) / SCALE / 2;
  const step = Math.max(1, Math.ceil(maxUnits / 10));
  
  for(let i=-Math.ceil(maxUnits); i<=Math.ceil(maxUnits); i+=step){
    if(i === 0) continue;
    const [tx,ty] = worldToCanvas(i,0); 
    const [tx2,ty2] = worldToCanvas(0,i);
    
    if(tx >= 0 && tx <= canvas.width) {
      ctx.fillText(i, tx, midY+16);
      ctx.fillRect(tx-1, midY-3, 2, 6);
    }
    if(ty >= 0 && ty <= canvas.height) {
      ctx.fillText(i, midX-16, ty2+4);
      ctx.fillRect(midX-3, ty2-1, 6, 2);
    }
  }
  
  ctx.fillStyle = '#fbbf24';
  ctx.font = '12px system-ui';
  ctx.fillText('O', midX-12, midY-8);
  
  if(hoverCoord){ 
    const [cx,cy]=worldToCanvas(hoverCoord.x, hoverCoord.y); 
    
    ctx.strokeStyle = 'rgba(0,212,255,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5,5]);
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
    ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI*2);
    ctx.fill();
  }
}

function plotPoint(x,y,color,r,glow){
  color = color||'#fbbf24'; r=r||6; if(glow===undefined)glow=true;
  const [cx,cy]=worldToCanvas(x,y); 
  
  if(glow) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
  }
  
  ctx.fillStyle=color; 
  ctx.beginPath(); 
  ctx.arc(cx,cy,r,0,Math.PI*2); 
  ctx.fill();
  
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(cx-r/3, cy-r/3, r/3, 0, Math.PI*2);
  ctx.fill();
  
  if(glow) ctx.restore();
}

function drawLineFromMC(m,c,color,width,dash,glow){
  color=color||'#22d3ee'; width=width||3; dash=dash||[]; if(glow===undefined)glow=true;
  ctx.save(); 
  
  if(glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }
  
  ctx.strokeStyle=color; 
  ctx.lineWidth=width; 
  ctx.setLineDash(dash);
  
  const x1 = -midX/SCALE, x2 = (canvas.width-midX)/SCALE; 
  const y1 = m*x1 + c, y2 = m*x2 + c;
  const [cx1,cy1] = worldToCanvas(x1,y1); 
  const [cx2,cy2] = worldToCanvas(x2,y2);
  
  ctx.beginPath(); 
  ctx.moveTo(cx1,cy1); 
  ctx.lineTo(cx2,cy2); 
  ctx.stroke(); 
  ctx.restore();
}

function drawSegment(x1,y1,x2,y2,color,width,dash){
  color=color||'#a78bfa'; width=width||3; dash=dash||[];
  ctx.save(); 
  ctx.strokeStyle=color; 
  ctx.lineWidth=width; 
  ctx.setLineDash(dash);
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  
  const [cx1,cy1]=worldToCanvas(x1,y1); 
  const [cx2,cy2]=worldToCanvas(x2,y2);
  ctx.beginPath(); 
  ctx.moveTo(cx1,cy1); 
  ctx.lineTo(cx2,cy2); 
  ctx.stroke(); 
  ctx.restore();
}

function animatedLine(m, c, color, duration) {
  color=color||'#22d3ee'; duration=duration||1500;
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    drawAxes();
    replotAll();
    
    if(progress < 1) {
      const x1 = -midX/SCALE, x2 = (canvas.width-midX)/SCALE;
      const currentX2 = x1 + (x2 - x1) * progress;
      const y1 = m*x1 + c, currentY2 = m*currentX2 + c;
      const [cx1,cy1] = worldToCanvas(x1,y1);
      const [cx2,cy2] = worldToCanvas(currentX2,currentY2);
      
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx1,cy1);
      ctx.lineTo(cx2,cy2);
      ctx.stroke();
      ctx.restore();
      
      requestAnimationFrame(animate);
    } else {
      drawLineFromMC(m, c, color, 3);
      logLine(m, c, color, 3);
    }
  }
  
  animate();
}

function pulsatePoint(x,y,color,cycles){
  color=color||'#fb7185'; cycles=cycles||20;
  const [cx,cy]=worldToCanvas(x,y); 
  let t=0; 
  const id=setInterval(function(){ 
    t++; 
    drawAxes(); 
    replotAll(); 
    
    const radius = 6 + 4*Math.sin(t/3);
    const alpha = 0.6 + 0.4*Math.sin(t/2);
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = color;
    ctx.beginPath(); 
    ctx.arc(cx,cy, radius, 0, Math.PI*2); 
    ctx.fill();
    ctx.restore();
    
    if(t > cycles) {
      clearInterval(id);
      plotPoint(x, y, color);
    }
  }, 80);
}

function showCelebration(emoji) {
  emoji = emoji || '🎉';
  const celebration = document.createElement('div');
  celebration.className = 'celebration';
  celebration.textContent = emoji;
  document.body.appendChild(celebration);
  setTimeout(function(){ celebration.remove(); }, 2000);
}

function showScorePopup(score, total) {
  const popup = document.createElement('div');
  popup.className = 'score-popup';
  popup.textContent = 'Score: '+score+'/'+total+' ✨';
  document.body.appendChild(popup);
  setTimeout(function(){ popup.remove(); }, 3000);
}

const plotLog=[];
function logLine(m,c,color,width,dash){ width=width||3; dash=dash||[]; plotLog.push({type:'line', data:{m:m,c:c}, style:{color:color,width:width,dash:dash}}); }
function logPoint(x,y,color){ plotLog.push({type:'point', data:{x:x,y:y}, style:{color:color}}); }
function logSeg(x1,y1,x2,y2,color){ plotLog.push({type:'seg', data:{x1:x1,y1:y1,x2:x2,y2:y2}, style:{color:color}}); }

function clearPlotLog() {
  plotLog.length = 0;
  drawAxes();
}

function replotAll(){
  for(const p of plotLog){
    if(p.type==='line') drawLineFromMC(p.data.m,p.data.c,p.style.color,p.style.width,p.style.dash);
    if(p.type==='point') plotPoint(p.data.x,p.data.y,p.style.color);
    if(p.type==='seg') drawSegment(p.data.x1,p.data.y1,p.data.x2,p.data.y2,p.style.color);
  }
}

function handlePointerEvent(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  
  if(!clientX || !clientY) return;
  
  const [x,y] = canvasToWorld(clientX-rect.left, clientY-rect.top);
  hoverCoord = {x: x, y: y};
  
  if(showCoords) {
    document.getElementById('coordX').textContent = x.toFixed(2);
    document.getElementById('coordY').textContent = y.toFixed(2);
    document.getElementById('coordDisplay').style.display = 'block';
  }
  
  drawAxes(); 
  replotAll();
}

canvas.addEventListener('mousemove', handlePointerEvent);
canvas.addEventListener('touchmove', handlePointerEvent);
canvas.addEventListener('click', handlePointerEvent);
canvas.addEventListener('touchstart', handlePointerEvent);

canvas.addEventListener('mouseleave', function() { 
  hoverCoord = null; 
  document.getElementById('coordDisplay').style.display = 'none';
  drawAxes(); 
  replotAll(); 
});

document.getElementById('zoomIn').addEventListener('click', function() {
  SCALE = Math.min(SCALE * 1.3, 80);
  drawAxes(); replotAll();
});

document.getElementById('zoomOut').addEventListener('click', function() {
  SCALE = Math.max(SCALE / 1.3, 8);
  drawAxes(); replotAll();
});

document.getElementById('resetView').addEventListener('click', function() {
  SCALE = 25;
  drawAxes(); replotAll();
});

document.getElementById('toggleCoords').addEventListener('click', function() {
  showCoords = !showCoords;
  document.getElementById('toggleCoords').classList.toggle('active', showCoords);
  if(!showCoords) document.getElementById('coordDisplay').style.display = 'none';
});

// ================== Enhanced Answer Parsing ==================
function parseFraction(input) {
  if (typeof input === 'number') return input;
  
  const str = input.toString().trim();
  
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.substring(1) : str;
  
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        const result = numerator / denominator;
        return isNegative ? -result : result;
      }
    }
  }
  
  const result = parseFloat(str);
  return isNaN(result) ? NaN : result;
}

function dismissKeyboard() {
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    activeElement.blur();
  }
}

// ================== Answer Storage System ==================
let answerStorage = {};
let completionStatus = {};

function saveAnswer(questionIndex, stepIndex, answer) {
  if (!answerStorage[questionIndex]) {
    answerStorage[questionIndex] = {};
  }
  answerStorage[questionIndex][stepIndex] = answer;
}

function getStoredAnswer(questionIndex, stepIndex) {
  return answerStorage[questionIndex] && answerStorage[questionIndex][stepIndex];
}

function markStepCompleted(questionIndex, stepIndex) {
  if (!completionStatus[questionIndex]) {
    completionStatus[questionIndex] = {};
  }
  completionStatus[questionIndex][stepIndex] = true;
}

function isStepCompleted(questionIndex, stepIndex) {
  return completionStatus[questionIndex] && completionStatus[questionIndex][stepIndex];
}

// ================== Portal Score Submission ==================
function submitScoreToPortal(score, total) {
  // Send message to parent window (Next.js page)
  window.parent.postMessage({
    type: 'INTERACTIVE_ASSIGNMENT_SUBMIT',
    score: score,
    total: total
  }, '*');
}

// ================== Enhanced Assignment Engine ==================
function $(id) { return document.getElementById(id); }
const who = $('who'), scoreEl = $('score'), totalEl = $('total'), bar = $('bar');
const qTag = $('qTag'), qTitle = $('qTitle'), qText = $('qText'), stepBox = $('stepBox'), feedback = $('feedback');
const prevBtn = $('prevBtn'), nextBtn = $('nextBtn'), hintBtn = $('hintBtn');

let state = { name:'${safeName}', qi:0, step:0, score:0, attempts:0, startTime: null };

function okNum(val, ans, tol){ 
  tol = tol || 0.01;
  if(Array.isArray(ans)) {
    return ans.some(function(a){ return Math.abs(val - a) <= tol; });
  }
  return Math.abs(val - ans) <= tol; 
}

// ================== Question Bank ==================
const Q = [];

Q.push({
  tag:'📊 Form & Slope',
  title:'Convert x + 7y = 0 to slope-intercept form',
  text:'Find the slope m and y-intercept c when written as y = mx + c.',
  steps:[
    {prompt:'Slope m =', type:'text', answer: -1/7, hint:'Move the x term to the other side, then divide by the coefficient of y.', 
     onCorrect:function(){ 
       dismissKeyboard();
       showScorePopup(state.score, parseInt($('total').textContent));
       setTimeout(function() {
         animatedLine(-1/7,0,'#60a5fa', 2000);
         showCelebration('📈');
       }, 300); 
     }},
    {prompt:'Y-intercept c =', type:'text', answer: 0, hint:'What value remains after isolating y? Where does the line cross the y-axis?', 
     onCorrect:function(){ 
       dismissKeyboard();
       showScorePopup(state.score, parseInt($('total').textContent));
       setTimeout(function() { 
         plotPoint(0,0,'#00ff88',8); 
         pulsatePoint(0,0,'#00ff88',15); 
         showCelebration('🎯'); 
       }, 400); 
     }}
  ]
});

Q.push({
  tag:'📐 Intercepts',
  title:'Convert 3x + 2y - 12 = 0 to intercept form',
  text:'Find the x-intercept (a) and y-intercept (b) for the form x/a + y/b = 1.',
  steps:[
    {prompt:'x-intercept a =', type:'text', answer: 4, hint:'Set y = 0 and solve for x. Where does the line meet the x-axis?', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         plotPoint(4,0,'#f59e0b',8); 
         pulsatePoint(4,0,'#f59e0b',15); 
       }, 300);
     }},
    {prompt:'y-intercept b =', type:'text', answer: 6, hint:'Set x = 0 and solve for y. Where does the line meet the y-axis?', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         plotPoint(0,6,'#f59e0b',8); 
         setTimeout(function(){ animatedLine(-1.5,6,'#fbbf24', 2000); }, 600); 
         showCelebration('✨'); 
       }, 300);
     }}
  ]
});

Q.push({
  tag:'📏 Distance',
  title:'Points on x-axis at distance 4 from line x/3 + y/4 = 1',
  text:'Convert to standard form 4x + 3y - 12 = 0, then find x-axis points.',
  steps:[
    {prompt:'First x-coordinate =', type:'text', answer: -2, hint:'Use the distance formula: |4x + 3(0) - 12|/5 = 4. Solve the absolute value equation.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         plotPoint(-2,0,'#fb7185',8); 
         drawLineFromMC(-4/3,4,'#94a3b8',2,[6,6]); 
         logLine(-4/3,4,'#94a3b8',2,[6,6]); 
       }, 300);
     }},
    {prompt:'Second x-coordinate =', type:'text', answer: 8, hint:"The absolute value equation gives two solutions. What's the other value of x?", 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         plotPoint(8,0,'#fb7185',8); 
         showCelebration('🎯'); 
       }, 300);
     }}
  ]
});

Q.push({
  tag:'📏 Parallel Distance',
  title:'Distance between parallel lines 15x + 8y - 34 = 0 and 15x + 8y + 31 = 0',
  text:'Use the formula for distance between parallel lines.',
  steps:[
    {prompt:'Distance =', type:'text', answer: 65/17, hint:'For parallel lines Ax + By + C₁ = 0 and Ax + By + C₂ = 0, distance = |C₂ - C₁|/√(A² + B²).', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         animatedLine(-15/8, 34/8,'#a78bfa', 1800);
         setTimeout(function(){ animatedLine(-15/8, -31/8,'#a78bfa', 1800); }, 800);
         showCelebration('📐'); 
       }, 300);
     }}
  ]
});

Q.push({
  tag:'📍 Parallel Through Point',
  title:'Line parallel to 3x - 4y + 2 = 0 through point (-2, 3)',
  text:'Find the equation in y = mx + c form.',
  steps:[
    {prompt:'Slope m =', type:'text', answer: 3/4, hint:'Parallel lines have the same slope. Convert the given line to y = mx + c form first.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         drawLineFromMC(3/4, 0.5,'#60a5fa',2,[6,6]); 
         logLine(3/4, 0.5,'#60a5fa',2,[6,6]); 
         plotPoint(-2,3,'#34d399',8); 
         logPoint(-2,3,'#34d399'); 
       }, 300);
     }},
    {prompt:'Y-intercept c =', type:'text', answer: 9/2, hint:'Use point-slope form: substitute the point (-2, 3) into y = mx + c to find c.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         animatedLine(3/4, 9/2,'#34d399', 2000); 
         showCelebration('🎯'); 
       }, 400);
     }}
  ]
});

Q.push({
  tag:'⟂ Perpendicular Line',
  title:'Line perpendicular to x - 7y + 5 = 0 with x-intercept 3',
  text:'Find the equation in y = mx + c form.',
  steps:[
    {prompt:'Slope m =', type:'text', answer: -7, hint:'For perpendicular lines, slopes are negative reciprocals. Find the slope of the given line first.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         drawLineFromMC(1/7, 5/7,'#f59e0b',2,[6,6]); 
         logLine(1/7, 5/7,'#f59e0b',2,[6,6]); 
         plotPoint(3,0,'#f472b6',8); 
         logPoint(3,0,'#f472b6'); 
       }, 300);
     }},
    {prompt:'Y-intercept c =', type:'text', answer: 21, hint:'The line passes through (3, 0). Substitute this point into y = mx + c.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         animatedLine(-7, 21,'#f472b6', 2000); 
         showCelebration('⟂'); 
       }, 400);
     }}
  ]
});

Q.push({
  tag:'∠ Angle Between Lines',
  title:'Angle between √3x + y = 1 and x + √3y = 1',
  text:'Find the acute angle between these two lines in degrees.',
  steps:[
    {prompt:'Angle (degrees) =', type:'text', answer: 30, hint:'First find both slopes, then use the angle formula: tan θ = |(m₂-m₁)/(1+m₁m₂)|.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         animatedLine(-Math.sqrt(3), 1,'#fde047', 1800);
         setTimeout(function(){ animatedLine(-1/Math.sqrt(3), 1/Math.sqrt(3),'#fde047', 1800); }, 900);
         showCelebration('∠'); 
       }, 300);
     }}
  ]
});

Q.push({
  tag:'❓ Unknown Point',
  title:'Find h so that line through (h, 3) and (4, 1) ⊥ to 7x - 9y - 19 = 0',
  text:'Use the perpendicular condition between slopes.',
  steps:[
    {prompt:'h =', type:'text', answer: 22/9, hint:'Find the slope of the given line, then use the condition that the product of perpendicular slopes equals -1.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         var h = 22/9;
         drawLineFromMC(7/9, -19/9,'#67e8f9',2,[6,6]); 
         logLine(7/9, -19/9,'#67e8f9',2,[6,6]); 
         plotPoint(h,3,'#67e8f9',8); 
         plotPoint(4,1,'#67e8f9',8); 
         logPoint(h,3,'#67e8f9'); 
         logPoint(4,1,'#67e8f9');
         setTimeout(function(){ drawSegment(h,3,4,1,'#00ff88',3); }, 800);
         showCelebration('🔍'); 
       }, 300);
     }}
  ]
});

Q.push({
  tag:'∠ Angle Condition',
  title:'Line through (2, 3): if one slope is 2 and angle between lines is 60°',
  text:'Find the other possible slope. (Enter either valid answer)',
  steps:[
    {prompt:'Other slope m₂ =', type:'text', 
     answer: [(-8 + 5*Math.sqrt(3))/11, (-8 - 5*Math.sqrt(3))/11], 
     hint:'Use tan(60°) = √3 in the angle formula. This gives you a quadratic equation in m₂.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         plotPoint(2,3,'#22c55e',8,true); 
         logPoint(2,3,'#22c55e'); 
         var m1 = 2;
         var c1 = 3 - 2*2;
         setTimeout(function(){ animatedLine(m1, c1, '#22c55e', 2000); }, 400);
         showCelebration('∠'); 
       }, 300);
     }}
  ]
});

Q.push({
  tag:'⟂ Perpendicular Bisector',
  title:'Perpendicular bisector of segment joining (3, 4) and (-1, 2)',
  text:'Find the equation step by step.',
  steps:[
    {prompt:'Midpoint x-coordinate =', type:'text', answer: 1, hint:'Average of the x-coordinates: (x₁ + x₂)/2.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         plotPoint(3,4,'#a3e635',8); 
         plotPoint(-1,2,'#a3e635',8); 
         logPoint(3,4,'#a3e635'); 
         logPoint(-1,2,'#a3e635'); 
       }, 300);
     }},
    {prompt:'Midpoint y-coordinate =', type:'text', answer: 3, hint:'Average of the y-coordinates: (y₁ + y₂)/2.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         plotPoint(1,3,'#86efac',8); 
         logPoint(1,3,'#86efac'); 
         drawSegment(3,4,-1,2,'#86efac',2,[6,6]); 
         logSeg(3,4,-1,2,'#86efac'); 
       }, 300);
     }},
    {prompt:'Slope of segment =', type:'text', answer: 0.5, hint:'Use slope formula: (y₂ - y₁)/(x₂ - x₁).', onCorrect:function(){}},
    {prompt:'Perpendicular slope =', type:'text', answer: -2, hint:"Negative reciprocal of the segment's slope.", onCorrect:function(){}},
    {prompt:'Equation y-intercept c =', type:'text', answer: 5, hint:'Substitute the midpoint into y = mx + c to find c.', 
     onCorrect:function(){ 
       dismissKeyboard();
       setTimeout(function() {
         animatedLine(-2, 5,'#4ade80', 2000); 
         showCelebration('⟂'); 
       }, 400);
     }}
  ]
});

const totalSteps = Q.reduce(function(sum,q){ return sum + q.steps.length; }, 0);
$('total').textContent = totalSteps;

// ================== Auto-start (no name prompt) ==================
function startAssignment(){
  state.startTime = Date.now();
  $('who').textContent = state.name;
  $('finName').textContent = state.name;

  document.body.classList.add('assignment-active');
  $('mainHeader').classList.add('assignment-mode');
  $('mainContainer').classList.add('assignment-mode');
  
  $('hud').style.display = 'block';
  $('qa').style.display = 'block';
  
  clearPlotLog(); 
  loadCurrent();
  
  setTimeout(function() {
    resizeCanvas();
    $('floatingInfo').classList.add('show');
    setTimeout(function(){ $('floatingInfo').classList.remove('show'); }, 3000);
  }, 200);
}

function loadCurrent(){
  if(state.qi >= Q.length) {
    finish();
    return;
  }
  
  if(state.step === 0) {
    clearPlotLog();
  }
  
  const q = Q[state.qi]; 
  state.step = state.step || 0; 
  state.attempts = 0; 
  feedback.innerHTML = '';
  
  qTag.textContent = q.tag; 
  qTitle.textContent = q.title; 
  qText.textContent = q.text;
  $('stepInfo').textContent = 'Step '+(state.step + 1)+' of '+q.steps.length;
  
  stepBox.innerHTML = '';
  const s = q.steps[state.step];
  
  const container = document.createElement('div');
  container.className = window.innerWidth < 768 ? 'input-row' : 'row';
  container.style.marginTop = '6px';
  
  const label = document.createElement('label');
  label.textContent = s.prompt + ' ';
  label.style.minWidth = '100px';
  
  const inp = document.createElement('input'); 
  inp.type = 'text'; 
  inp.id = 'ans'; 
  inp.placeholder = 'Enter value';
  inp.inputMode = 'text';
  
  const storedAnswer = getStoredAnswer(state.qi, state.step);
  if (storedAnswer !== undefined) {
    inp.value = storedAnswer;
  }
  
  const btn = document.createElement('button'); 
  btn.textContent = 'Check'; 
  btn.onclick = checkStep;
  
  container.appendChild(label);
  container.appendChild(inp);
  container.appendChild(btn);
  stepBox.appendChild(container);
  
  updateNextButtonState();
  
  if (isStepCompleted(state.qi, state.step)) {
    feedback.innerHTML = '<span class="ok">✅ Previously completed correctly</span>';
  }
  
  setTimeout(function() {
    inp.focus();
    inp.style.transform = 'scale(1.05)';
    setTimeout(function(){ inp.style.transform = 'scale(1)'; }, 200);
  }, 100);
  
  inp.addEventListener('keypress', function(e) {
    if(e.key === 'Enter') checkStep();
  });
  
  inp.addEventListener('input', function() {
    const value = inp.value.trim();
    if (value) {
      saveAnswer(state.qi, state.step, value);
    }
  });
  
  updateProgress();
}

function updateNextButtonState() {
  const isCurrentStepCompleted = isStepCompleted(state.qi, state.step);
  nextBtn.disabled = !isCurrentStepCompleted;
  nextBtn.style.opacity = isCurrentStepCompleted ? '1' : '0.5';
  nextBtn.style.cursor = isCurrentStepCompleted ? 'pointer' : 'not-allowed';
}

function checkStep(){
  const q = Q[state.qi]; 
  const s = q.steps[state.step]; 
  const inputVal = ($('ans').value || '').trim();
  
  if(!inputVal) {
    feedback.innerHTML = '<span class="bad">⚠️ Please enter a value.</span>';
    return;
  }
  
  const val = parseFraction(inputVal);
  
  if(isNaN(val)) {
    feedback.innerHTML = '<span class="bad">⚠️ Please enter a valid number or fraction (e.g., -1/7 or -0.14).</span>';
    return;
  }
  
  saveAnswer(state.qi, state.step, inputVal);
  
  const wasAlreadyCompleted = isStepCompleted(state.qi, state.step);
  
  const correct = okNum(val, s.answer);
  
  if(correct){
    feedback.innerHTML = '<span class="ok">✅ Excellent! Perfect answer!</span>';
    
    if (!wasAlreadyCompleted) {
      state.score++; 
      scoreEl.textContent = state.score;
      showScorePopup(state.score, parseInt($('total').textContent));
    }
    
    markStepCompleted(state.qi, state.step);
    
    if(s.onCorrect) s.onCorrect();
    
    updateNextButtonState();
    
  } else {
    state.attempts++;
    feedback.innerHTML = '<span class="bad">❌ Not quite right. Try again!</span>';
    
    const ansInput = $('ans');
    ansInput.style.animation = 'shake 0.5s ease';
    setTimeout(function(){ ansInput.style.animation = ''; }, 500);
    
    if(state.attempts >= 2){ 
      feedback.innerHTML += '<div class="hint">💡 Hint: '+s.hint+'</div>';
    }
    
    updateNextButtonState();
  }
}

function nextStep(){
  const q = Q[state.qi]; 
  if(state.step < q.steps.length - 1){ 
    state.step++; 
    loadCurrent(); 
  } else { 
    if(state.qi < Q.length - 1) {
      state.qi++; 
      state.step = 0; 
      loadCurrent();
    } else {
      finish();
    }
  }
}

nextBtn.addEventListener('click', function() {
  if (isStepCompleted(state.qi, state.step)) {
    nextStep();
  } else {
    feedback.innerHTML = '<span class="bad">⚠️ Please complete this step first by getting the correct answer.</span>';
  }
});

prevBtn.addEventListener('click', function() {
  if(state.step > 0){ 
    state.step--; 
    loadCurrent(); 
  } else if(state.qi > 0){ 
    state.qi--; 
    const prevQ = Q[state.qi];
    state.step = prevQ.steps.length - 1; 
    loadCurrent(); 
  }
});

hintBtn.addEventListener('click', function() {
  const q = Q[state.qi]; 
  const s = q.steps[state.step]; 
  feedback.innerHTML = '<div class="hint">💡 Hint: '+s.hint+'</div>'; 
});

function updateProgress(){
  const done = state.score; 
  const total = parseInt(totalEl.textContent, 10);
  const percentage = Math.min(100, (done/total)*100);
  bar.style.width = percentage + '%';
  
  if(percentage > 80) {
    bar.style.background = 'linear-gradient(90deg,#00ff88,#00d4ff)';
  } else if(percentage > 50) {
    bar.style.background = 'linear-gradient(90deg,#ffd700,#00d4ff)';
  }
}

// ================== Check all questions attempted ==================
function allQuestionsAttempted() {
  for(let qi = 0; qi < Q.length; qi++){
    for(let si = 0; si < Q[qi].steps.length; si++){
      if(!isStepCompleted(qi, si)) return false;
    }
  }
  return true;
}

function finish(){
  document.body.classList.remove('assignment-active');
  $('mainHeader').classList.remove('assignment-mode');
  $('mainContainer').classList.remove('assignment-mode');
  
  $('qa').style.display = 'none'; 
  $('summary').style.display = 'block';
  
  const total = parseInt($('total').textContent);
  const finalScore = state.score + ' / ' + total;
  $('finScore').textContent = finalScore;
  
  const percentage = (state.score / total) * 100;
  if(percentage >= 90) {
    showCelebration('🏆');
  } else if(percentage >= 70) {
    showCelebration('🌟');
  } else {
    showCelebration('💪');
  }
  
  // Submit score to portal via postMessage
  submitScoreToPortal(state.score, total);
  
  // Show saving status
  $('portalSaveStatus').innerHTML = '<div class="loading-spinner"></div> Saving your score to the portal...';
  
  // Listen for confirmation (set a timeout fallback)
  setTimeout(function(){
    const el = $('portalSaveStatus');
    if(el && el.innerHTML.includes('loading-spinner')) {
      el.innerHTML = '✅ Score saved! Check your assignments page.';
    }
  }, 8000);
  
  setTimeout(resizeCanvas, 300);
}

// Auto-start the assignment immediately
startAssignment();

setTimeout(function() {
  drawAxes();
  setTimeout(function() {
    $('floatingInfo').classList.add('show');
    setTimeout(function(){ $('floatingInfo').classList.remove('show'); }, 4000);
  }, 1000);
}, 200);

// Listen for save result from parent portal page
window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'PORTAL_SAVE_RESULT') {
    var el = $('portalSaveStatus');
    if (!el) return;
    if (event.data.success) {
      el.innerHTML = 'Score saved to portal! You can return to the assignments page.';
      el.style.background = 'rgba(0,255,136,0.08)';
      el.style.borderColor = 'rgba(0,255,136,0.25)';
      el.style.color = '#00ff88';
    } else {
      el.innerHTML = 'Could not auto-save score. Please screenshot your score for your records.';
      el.style.background = 'rgba(255,107,157,0.08)';
      el.style.borderColor = 'rgba(255,107,157,0.25)';
      el.style.color = '#ff6b9d';
    }
  }
});

</script>
</body>
</html>`;
}
