import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera, Image as ImageIcon, PenLine, Plus, ChevronRight, ChevronLeft,
  CheckCircle2, XCircle, Loader2, TrendingUp, BookOpen, Sparkles,
  Calculator as CalcIcon, Youtube, ArrowLeft, RotateCcw, Trophy, Brain,
  Target, AlertTriangle, History as HistoryIcon, X, Delete, Home
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ----------------------------- helpers -----------------------------

const MODEL = "gemini-2.5-flash";

function extractText(data) {
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return textOutput;
}

function extractJSON(raw) {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  const start = s.indexOf("{") === -1 ? s.indexOf("[") : Math.min(...[s.indexOf("{"), s.indexOf("[")].filter(i => i !== -1));
  const lastCurly = s.lastIndexOf("}");
  const lastBracket = s.lastIndexOf("]");
  const end = Math.max(lastCurly, lastBracket);
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    try { return JSON.parse(s); } catch (e2) { return null; }
  }
}

async function callGemini({ system, messages, max_tokens = 4096 }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const contents = messages.map(m => {
    if (Array.isArray(m.content)) {
      const parts = m.content.map(c => {
        if (c.type === "text") return { text: c.text };
        if (c.type === "image") {
          return {
            inlineData: {
              mimeType: c.source.media_type,
              data: c.source.data
            }
          };
        }
        return { text: "" };
      });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    };
  });

  if (system) {
    contents.unshift({
      role: "user",
      parts: [{ text: `[Instrução do Sistema]: ${system}` }]
    });
  }

  const body = {
    contents,
    generationConfig: { maxOutputTokens: max_tokens }
  };

  const resp = await fetch(`[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  const data = await resp.json();
  return data;
}

// ----------------------------- storage -----------------------------

const STORAGE_KEY = "study-app-data-v1";

async function loadData() {
  try {
    if (window.storage && typeof window.storage.get === "function") {
      const res = await window.storage.get(STORAGE_KEY, false);
      if (res && res.value) return JSON.parse(res.value);
    } else {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) return JSON.parse(local);
    }
  } catch (e) { /* no key yet */ }
  return { subjects: [] };
}

async function saveData(data) {
  try {
    if (window.storage && typeof window.storage.set === "function") {
      await window.storage.set(STORAGE_KEY, JSON.stringify(data), false);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.error("storage save failed", e);
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ----------------------------- small UI -----------------------------

function Spinner({ className = "w-6 h-6 animate-spin text-indigo-600" }) {
  return <Loader2 className={className} />;
}

function ProgressBar({ value, colorClass = "bg-indigo-600" }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${colorClass} rounded-full transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-white/90 backdrop-blur border-b border-slate-100 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="font-semibold text-slate-900 tracking-tight truncate">{title}</h1>
      </div>
      {right}
    </div>
  );
}

function MasteryDot({ level }) {
  const colors = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-rose-500"
  };
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${colors[level] || "bg-slate-300"}`} />;
}

// ----------------------------- CALCULATOR -----------------------------

function Calculator({ onClose }) {
  const [expr, setExpr] = useState("");
  const press = (v) => setExpr((e) => e + v);
  const clear = () => setExpr("");
  const backspace = () => setExpr((e) => e.slice(0, -1));
  const equals = () => {
    try {
      const sanitized = expr.replace(/[^0-9+\-×÷().,]/g, "")
        .replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".");
      const result = Function(`"use strict";return (${sanitized})`)();
      setExpr(String(result));
    } catch (e) {
      setExpr("Erro");
    }
  };
  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "(", "+"];
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5"><CalcIcon className="w-4 h-4" /> Calculadora</span>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="bg-slate-50 rounded-2xl px-4 py-4 text-right text-2xl font-mono text-slate-800 mb-3 min-h-[64px] break-all">{expr || "0"}</div>
        <div className="grid grid-cols-4 gap-2">
          {keys.map((k) => (
            <button key={k} onClick={() => press(k)} className="py-3 rounded-xl bg-slate-100 text-slate-800 font-medium hover:bg-slate-200 active:scale-95 transition">{k}</button>
          ))}
          <button onClick={backspace} className="py-3 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Delete className="w-4 h-4" /></button>
          <button onClick={clear} className="py-3 rounded-xl bg-rose-100 text-rose-700 font-medium col-span-2">Limpar</button>
          <button onClick={equals} className="py-3 rounded-xl bg-indigo-600 text-white font-semibold">=</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- HOME -----------------------------

function HomeScreen({ subjects, onNewStudy, onOpenSubject, onHistory }) {
  return (
    <div className="min-h-screen bg-white pb-10">
      <div className="px-5 pt-8 pb-6 bg-gradient-to-b from-indigo-50 to-white">
        <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase mb-1">Seu tutor de IA</p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Estudos</h1>
        <button
          onClick={onNewStudy}
          className="w-full bg-indigo-600 text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-semibold text-base shadow-lg shadow-indigo-200 active:scale-[0.98] transition"
        >
          <Plus className="w-5 h-5" /> Novo estudo
        </button>
      </div>

      <div className="px-5 mt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Meus estudos</h2>
          {subjects.length > 0 && (
            <button onClick={onHistory} className="text-sm text-indigo-600 font-medium flex items-center gap-1">
              Desempenho <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {subjects.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum estudo ainda.<br />Toque em "Novo estudo" para começar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subjects.slice().reverse().map((s) => {
              const lastQuiz = s.quizzes[s.quizzes.length - 1];
              const pct = lastQuiz ? lastQuiz.percent : null;
              return (
                <button key={s.id} onClick={() => onOpenSubject(s.id)} className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:border-indigo-200 hover:shadow-sm transition">
                  <div className="min-w-0 pr-3">
                    <p className="font-medium text-slate-900 truncate">{s.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.level}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {pct != null ? (
                      <span className={`text-sm font-semibold ${pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-rose-500"}`}>{pct}%</span>
                    ) : (
                      <span className="text-xs text-slate-400">Sem simulado</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------- INPUT SCREEN -----------------------------

function InputScreen({ onBack, onSubmit }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Full = e.target.result;
        const [meta, base64Data] = base64Full.split(",");
        const mediaType = meta.split(":")[1].split(";")[0];
        setImages((prev) => [...prev, { base64: base64Data, mediaType, previewUrl: base64Full }]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-white pb-28 flex flex-col">
      <TopBar title="Novo estudo" onBack={onBack} />
      <div className="px-5 py-4 flex-1 flex flex-col">
        <p className="text-sm text-slate-500 mb-3">Cole seu texto ou adicione fotos de apostilas, quadros e anotações:</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: Resumo de história sobre a Revolução Francesa, ou cole o texto do seu material..."
          className="w-full h-40 p-4 rounded-2xl border border-slate-200 focus:border-indigo-400 focus:outline-none resize-none text-slate-800 text-sm mb-4"
        />

        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-slate-900/60 text-white rounded-full p-1 hover:bg-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
          >
            <Camera className="w-4 h-4 text-indigo-600" /> Tirar foto
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
          >
            <ImageIcon className="w-4 h-4 text-indigo-600" /> Galeria
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 max-w-md mx-auto">
        <button
          onClick={() => {
            if (!text.trim() && images.length === 0) return;
            onSubmit({ text, images });
          }}
          disabled={!text.trim() && images.length === 0}
          className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold shadow-lg shadow-indigo-100 disabled:opacity-40 disabled:shadow-none"
        >
          Gerar aula inteligente
        </button>
      </div>
    </div>
  );
}

// ----------------------------- PROCESSING -----------------------------

function ProcessingScreen({ doneStep }) {
  const steps = [
    "Lendo e analisando conteúdo...",
    "Estruturando explicações e exemplos...",
    "Preparando mapas mentais...",
    "Buscando vídeos recomendados...",
    "Finalizando sua aula..."
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center animate-pulse">
          <Sparkles className="w-8 h-8 text-indigo-600" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Criando seu estudo</h2>
      <p className="text-sm text-slate-500 mb-8 max-w-xs">Nossa IA está transformando seu material em uma experiência completa de aprendizado.</p>

      <div className="w-full max-w-xs space-y-3 text-left">
        {steps.map((s, idx) => {
          const isDone = doneStep > idx;
          const isCurrent = doneStep === idx;
          return (
            <div key={idx} className={`flex items-center gap-3 text-sm transition-all ${isDone ? "text-emerald-600 font-medium" : isCurrent ? "text-indigo-600 font-semibold" : "text-slate-300"}`}>
              {isDone ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : isCurrent ? <Spinner className="w-5 h-5 shrink-0" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />}
              <span className="truncate">{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------- LESSON SCREEN -----------------------------

function LessonScreen({ subject, onBack, onReady, onHome }) {
  const [activeTab, setActiveTab] = useState("content");
  const lesson = subject.lesson;

  return (
    <div className="min-h-screen bg-white pb-28">
      <TopBar
        title={lesson.subject}
        onBack={onBack}
        right={<button onClick={onHome}><Home className="w-5 h-5 text-slate-400" /></button>}
      />

      <div className="flex border-b border-slate-100 px-5 bg-white sticky top-[57px] z-10">
        <button onClick={() => setActiveTab("content")} className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${activeTab === "content" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"}`}>Aula</button>
        <button onClick={() => setActiveTab("mindmap")} className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${activeTab === "mindmap" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"}`}>Mapa mental</button>
        <button onClick={() => setActiveTab("videos")} className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${activeTab === "videos" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"}`}>Vídeos</button>
      </div>

      <div className="px-5 py-6">
        {activeTab === "content" && (
          <div className="space-y-6">
            <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">Objetivos</p>
              <ul className="space-y-1.5">
                {(lesson.objectives || []).map((obj, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span> {obj}
                  </li>
                ))}
              </ul>
            </div>

            {(lesson.sections || []).map((sec, idx) => (
              <div key={idx} className="border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-900 text-base">{idx + 1}. {sec.concept}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{sec.explanation}</p>
                {sec.example && (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 border-l-2 border-indigo-500">
                    <span className="font-semibold text-slate-900">Exemplo prático: </span>{sec.example}
                  </div>
                )}
                {sec.whyMatters && (
                  <p className="text-xs text-indigo-600 font-medium">Por que importa: {sec.whyMatters}</p>
                )}
              </div>
            ))}

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
              <h3 className="font-semibold text-emerald-900 mb-2 text-sm">Resumo rápido</h3>
              <p className="text-xs text-emerald-800 leading-relaxed">{lesson.summary}</p>
            </div>
          </div>
        )}

        {activeTab === "mindmap" && (
          <div className="space-y-4">
            <div className="bg-indigo-600 text-white rounded-2xl p-5 text-center shadow-lg shadow-indigo-100">
              <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Tema central</p>
              <h3 className="font-bold text-lg">{lesson.mindMap?.center || lesson.subject}</h3>
            </div>
            {(lesson.mindMap?.branches || []).map((b, i) => (
              <div key={i} className="border border-slate-100 rounded-2xl p-4 space-y-2">
                <p className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> {b.topic}
                </p>
                <div className="pl-4 flex flex-wrap gap-1.5">
                  {(b.children || []).map((c, j) => (
                    <span key={j} className="text-xs bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 py-1 text-slate-700">{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "videos" && (
          <div className="space-y-4">
            {lesson.videosNote && <p className="text-xs text-slate-500 italic">{lesson.videosNote}</p>}
            {(lesson.videos || []).length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">Nenhum vídeo recomendado encontrado.</div>
            ) : (
              (lesson.videos || []).map((v, i) => (
                <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="block border border-slate-100 rounded-2xl p-4 hover:border-indigo-200 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <Youtube className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 text-sm truncate">{v.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{v.channel} {v.duration && `• ${v.duration}`}</p>
                      {v.reason && <p className="text-xs text-slate-600 mt-2">{v.reason}</p>}
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 max-w-md mx-auto">
        <button onClick={onReady} className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
          Estou pronto para o simulado <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ----------------------------- QUIZ CONFIG -----------------------------

function QuizConfigScreen({ onBack, defaultSpec, onStart }) {
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("médio");
  const [spec, setSpec] = useState(defaultSpec || "");

  return (
    <div className="min-h-screen bg-white pb-28 flex flex-col">
      <TopBar title="Configurar simulado" onBack={onBack} />
      <div className="px-5 py-6 flex-1 space-y-6">
        <div>
          <label className="text-sm font-medium text-slate-900 block mb-2">Quantidade de questões</label>
          <div className="grid grid-cols-3 gap-3">
            {[3, 5, 10].map((c) => (
              <button
                key={c}
                onClick={() => setCount(c)}
                className={`py-3 rounded-2xl border text-sm font-medium transition ${count === c ? "border-indigo-600 bg-indigo-50/50 text-indigo-600" : "border-slate-200 text-slate-700"}`}
              >
                {c} questões
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900 block mb-2">Nível de dificuldade</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "fácil", label: "Fácil" },
              { id: "médio", label: "Médio" },
              { id: "difícil", label: "Difícil" }
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`py-3 rounded-2xl border text-sm font-medium transition ${difficulty === d.id ? "border-indigo-600 bg-indigo-50/50 text-indigo-600" : "border-slate-200 text-slate-700"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900 block mb-2">Instrução especial (opcional)</label>
          <input
            type="text"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Ex: Foque mais em cálculos, ou pergunte sobre datas..."
            className="w-full p-4 rounded-2xl border border-slate-200 focus:border-indigo-400 focus:outline-none text-sm text-slate-800"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 max-w-md mx-auto">
        <button
          onClick={() => onStart({ count, difficulty, spec })}
          className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold shadow-lg shadow-indigo-100"
        >
          Gerar simulado
        </button>
      </div>
    </div>
  );
}

// ----------------------------- QUIZ SCREEN -----------------------------

function QuizScreen({ subject, quizPack, onBack, onFinish }) {
  const questions = quizPack.questions || [];
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showCalc, setShowCalc] = useState(false);
  const [results, setResults] = useState([]);

  const q = questions[idx];
  const progress = questions.length ? ((idx) / questions.length) * 100 : 0;

  const handleNext = () => {
    setAnswer(null);
    setSubmitted(false);
    setFeedback(null);
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
    } else {
      onFinish(results);
    }
  };

  const handleCheck = async () => {
    if (answer == null || (typeof answer === "string" && !answer.trim())) return;

    if (q.type === "multiple_choice") {
      const isCorrect = answer === q.correctAnswer;
      const local = { score: isCorrect ? 1 : 0, isCorrect, explanation: q.explanation, missing: "", howTo: "" };
      setFeedback(local);
      setSubmitted(true);
      setResults((r) => [...r, { question: q, userAnswer: answer, ...local }]);
      return;
    }

    if (q.type === "true_false") {
      const isCorrect = answer === q.correctAnswer;
      const local = { score: isCorrect ? 1 : 0, isCorrect, explanation: q.explanation, missing: "", howTo: "" };
      setFeedback(local);
      setSubmitted(true);
      setResults((r) => [...r, { question: q, userAnswer: answer, ...local }]);
      return;
    }

    setGrading(true);
    try {
      const system = `Você é um tutor de IA corrigindo uma resposta de estudante. Responda APENAS com um JSON válido no formato:
{"score": 0.0 a 1.0, "isCorrect": true/false, "explanation": "por que a resposta correta está certa", "missing": "conceitos que faltaram (ou vazio)", "howTo": "como pensar corretamente"}
Avalie o conteúdo semântico, não exija palavras exatas. Considere respostas parcialmente corretas.`;
      const userMsg = `Pergunta: ${q.prompt}\nTipo: ${q.type}\nResposta esperada / gabarito: ${q.correctAnswer || q.explanation}\nResposta do estudante: ${typeof answer === "string" ? answer : JSON.stringify(answer)}`;
      const data = await callGemini({ system, messages: [{ role: "user", content: userMsg }], max_tokens: 800 });
      const parsed = extractJSON(extractText(data)) || { score: 0, isCorrect: false, explanation: q.explanation, missing: "", howTo: "" };
      setFeedback(parsed);
      setSubmitted(true);
      setResults((r) => [...r, { question: q, userAnswer: answer, ...parsed }]);
    } catch (e) {
      const isCorrect = String(answer).toLowerCase().includes(String(q.correctAnswer).toLowerCase());
      const local = { score: isCorrect ? 1 : 0, isCorrect, explanation: q.explanation, missing: "", howTo: "" };
      setFeedback(local);
      setSubmitted(true);
      setResults((r) => [...r, { question: q, userAnswer: answer, ...local }]);
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-28 flex flex-col">
      <TopBar
        title={`Questão ${idx + 1} de ${questions.length}`}
        onBack={onBack}
        right={q.requiresCalculator ? <button onClick={() => setShowCalc(true)} className="p-2 rounded-xl bg-slate-100 text-slate-700"><CalcIcon className="w-4 h-4" /></button> : null}
      />
      <div className="px-5 pt-2"><ProgressBar value={progress} /></div>

      <div className="px-5 py-6 flex-1 space-y-6">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">{q.topic || "Geral"}</span>
          <h2 className="text-base font-semibold text-slate-900 mt-1 leading-relaxed">{q.prompt}</h2>
        </div>

        {q.type === "multiple_choice" && (
          <div className="space-y-3">
            {(q.options || []).map((opt) => (
              <button
                key={opt.id}
                disabled={submitted}
                onClick={() => setAnswer(opt.id)}
                className={`w-full text-left p-4 rounded-2xl border text-sm transition ${answer === opt.id ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 font-medium" : "border-slate-200 text-slate-700"}`}
              >
                <span className="font-semibold mr-2 uppercase">{opt.id})</span> {opt.text}
              </button>
            ))}
          </div>
        )}

        {q.type === "true_false" && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: true, label: "Verdadeiro" },
              { val: false, label: "Falso" }
            ].map((tf) => (
              <button
                key={String(tf.val)}
                disabled={submitted}
                onClick={() => setAnswer(tf.val)}
                className={`py-4 rounded-2xl border text-sm font-medium transition ${answer === tf.val ? "border-indigo-600 bg-indigo-50/50 text-indigo-900" : "border-slate-200 text-slate-700"}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}

        {(q.type === "short_answer" || q.type === "essay" || q.type === "calculation") && (
          <textarea
            value={answer || ""}
            disabled={submitted}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Digite sua resposta aqui..."
            className="w-full h-32 p-4 rounded-2xl border border-slate-200 focus:border-indigo-400 focus:outline-none text-sm text-slate-800 resize-none"
          />
        )}

        {submitted && feedback && (
          <div className={`p-4 rounded-2xl border space-y-2 ${feedback.isCorrect ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-rose-50 border-rose-100 text-rose-900"}`}>
            <div className="flex items-center gap-2 font-semibold text-sm">
              {feedback.isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-rose-500" />}
              {feedback.isCorrect ? "Resposta correta!" : "Não foi dessa vez"}
            </div>
            <p className="text-xs leading-relaxed">{feedback.explanation}</p>
            {feedback.howTo && <p className="text-xs font-medium mt-1">Como pensar: {feedback.howTo}</p>}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 max-w-md mx-auto">
        {!submitted ? (
          <button
            onClick={handleCheck}
            disabled={answer == null || grading}
            className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold shadow-lg shadow-indigo-100 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {grading && <Spinner className="w-4 h-4 text-white" />}
            {grading corrigindoing ? "Corrigindo com IA..." : "Responder"}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            Próxima questão <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}
    </div>
  );
}

// ----------------------------- RESULT SCREEN -----------------------------

function ResultScreen({ quiz, subject, onReviewErrors, onNewQuiz, onBackToLesson, onHome }) {
  const radarData = [
    { area: "Conceitos", value: quiz?.byCategory?.conceitos ?? 0 },
    { area: "Aplicação", value: quiz?.byCategory?.aplicacao ?? 0 },
    { area: "Cálculos", value: quiz?.byCategory?.calculos ?? 0 },
    { area: "Interpretação", value: quiz?.byCategory?.interpretacao ?? 0 },
  ];

  if (!quiz) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Resultado não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <TopBar title="Resultado" right={<button onClick={onHome}><Home className="w-5 h-5 text-slate-400" /></button>} />
      <div className="px-5 py-6 text-center">
        <Trophy className="w-9 h-9 text-amber-400 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Seu resultado</p>
        <p className="text-4xl font-bold text-slate-900 mt-1">{quiz.score}/100</p>
        <p className="text-sm text-slate-500 mt-1">{quiz.correctCount}/{quiz.total} acertos · {quiz.percent}% de desempenho</p>
      </div>

      <div className="px-5 mb-6">
        <div className="bg-slate-50 rounded-2xl p-4">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="area" tick={{ fontSize: 11, fill: "#64748b" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {quiz.weakTopics && quiz.weakTopics.length > 0 && (
        <div className="px-5 mb-6">
          <h2 className="font-semibold text-slate-900 mb-3">Onde você precisa melhorar</h2>
          <div className="space-y-2">
            {quiz.weakTopics.map((w, i) => (
              <div key={i} className="border border-amber-100 bg-amber-50 rounded-2xl p-3">
                <div className="flex justify-between items-baseline">
                  <p className="font-medium text-slate-800 text-sm capitalize">{i + 1}. {w.topic}</p>
                  <span className="text-sm font-semibold text-amber-600">{w.percent}%</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{w.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 mb-6">
        <h2 className="font-semibold text-slate-900 mb-3">Domínio do assunto</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(subject?.mastery || {}).map(([topic, level]) => (
            <div key={topic} className="border border-slate-100 rounded-xl px-3 py-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700 capitalize">{topic}</span>
              <MasteryDot level={level} />
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-2.5">
        {quiz.weakTopics && quiz.weakTopics.length > 0 && (
          <button onClick={onReviewErrors} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-2xl py-3.5 font-semibold">
            <BookOpen className="w-4 h-4" /> Revisar meus erros
          </button>
        )}
        <button onClick={onNewQuiz} className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-700 rounded-2xl py-3.5 font-semibold">
          <RotateCcw className="w-4 h-4" /> Fazer novo simulado
        </button>
        <button onClick={onBackToLesson} className="w-full flex items-center justify-center gap-2 text-slate-500 rounded-2xl py-3 text-sm">
          Voltar para a aula
        </button>
      </div>
    </div>
  );
}

// ----------------------------- REVIEW SCREEN -----------------------------

function ReviewScreen({ review, onBack, onStartFocusedQuiz }) {
  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500"><Spinner className="w-4 h-4" /> Preparando revisão...</div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-white pb-28">
      <TopBar title="Revisão personalizada" onBack={onBack} />
      <div className="px-5 py-4">
        {(review.topics || []).map((t, i) => (
          <div key={i} className="mb-5 pl-4 border-l-2 border-amber-200">
            <p className="font-medium text-slate-900 capitalize">{t.topic}</p>
            <p className="text-sm text-slate-600 mt-1">{t.explanation}</p>
            {t.tip && <p className="text-sm text-indigo-600 mt-2"><span className="font-medium">Dica: </span>{t.tip}</p>}
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4">
        <button onClick={onStartFocusedQuiz} className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold">
          Testar esses pontos novamente
        </button>
      </div>
    </div>
  );
}

// ----------------------------- HISTORY SCREEN -----------------------------

function HistoryScreen({ subjects, onBack }) {
  const allQuizzes = subjects.flatMap((s) => (s.quizzes || []).map((q) => ({ ...q, subjectTitle: s.title })));
  const evolutionData = allQuizzes
    .sort((a, b) => a.date - b.date)
    .map((q, i) => ({ name: `#${i + 1}`, percent: q.percent }));

  const totalQuizzes = allQuizzes.length;
  const avg = totalQuizzes ? Math.round(allQuizzes.reduce((a, q) => a + q.percent, 0) / totalQuizzes) : 0;
  const masteryCounts = { green: 0, yellow: 0, red: 0 };
  subjects.forEach((s) => Object.values(s.mastery || {}).forEach((v) => { masteryCounts[v] = (masteryCounts[v] || 0) + 1; }));

  return (
    <div className="min-h-screen bg-white pb-10">
      <TopBar title="Meu desempenho" onBack={onBack} />
      <div className="px-5 py-5">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-50 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-slate-900">{subjects.length}</p>
            <p className="text-xs text-slate-500">Assuntos</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-slate-900">{totalQuizzes}</p>
            <p className="text-xs text-slate-500">Simulados</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-slate-900">{avg}%</p>
            <p className="text-xs text-slate-500">Média geral</p>
          </div>
        </div>

        {evolutionData.length > 1 && (
          <div className="mb-6">
            <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500" /> Evolução</h2>
            <div className="bg-slate-50 rounded-2xl p-3">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="percent" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="font-semibold text-slate-900 mb-3">Domínio geral</h2>
          <div className="flex gap-3">
            <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center"><p className="font-bold text-emerald-600">{masteryCounts.green}</p><p className="text-xs text-emerald-700">Dominados</p></div>
            <div className="flex-1 bg-amber-50 rounded-xl p-3 text-center"><p className="font-bold text-amber-600">{masteryCounts.yellow}</p><p className="text-xs text-amber-700">Em progresso</p></div>
            <div className="flex-1 bg-rose-50 rounded-xl p-3 text-center"><p className="font-bold text-rose-500">{masteryCounts.red}</p><p className="text-xs text-rose-600">A estudar</p></div>
          </div>
        </div>

        <h2 className="font-semibold text-slate-900 mb-3">Assuntos estudados</h2>
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id} className="border border-slate-100 rounded-2xl p-3">
              <div className="flex justify-between items-center">
                <p className="font-medium text-slate-800 text-sm">{s.title}</p>
                <span className="text-xs text-slate-400">{(s.quizzes || []).length} simulado(s)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(s.mastery || {}).map(([t, l]) => (
                  <span key={t} className="text-xs bg-slate-50 rounded-full px-2 py-0.5 text-slate-600 capitalize">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------- MAIN APP COMPONENT -----------------------------

export default function App() {
  const [data, setData] = useState({ subjects: [] });
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("home");
  const [currentSubjectId, setCurrentSubjectId] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [quizPack, setQuizPack] = useState(null);
  const [quizConfig, setQuizConfig] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [lastQuiz, setLastQuiz] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData().then((d) => { setData(d || { subjects: [] }); setLoaded(true); });
  }, []);

  const persist = useCallback((next) => {
    setData(next);
    saveData(next);
  }, []);

  const currentSubject = (data.subjects || []).find((s) => s.id === currentSubjectId) || null;

  const handleContentSubmit = async (input) => {
    setView("processing");
    setProcessingStep(0);
    setError(null);
    try {
      setProcessingStep(1);
      const system = `Você é um tutor de IA especialista em transformar qualquer conteúdo em uma aula completa e personalizada.
Analise o conteúdo enviado (texto ou imagem) e responda APENAS com um JSON válido, sem markdown, no formato exato:
{
  "subject": "nome curto do assunto",
  "level": "nível aproximado",
  "objectives": ["objetivo 1", "objetivo 2", "objetivo 3"],
  "sections": [{"concept": "nome do conceito", "explanation": "explicação clara", "example": "exemplo real", "whyMatters": "por que isso importa"}],
  "summary": "resumo rápido",
  "keyPoints": ["ponto 1"],
  "commonMistakes": ["erro 1"],
  "mindMap": {"center": "tema central", "branches": [{"topic": "ramo 1", "children": ["sub 1", "sub 2"]}]},
  "videos": [
    { "title": "Título do vídeo", "channel": "Canal", "url": "[https://youtube.com/watch?v=exemplo](https://youtube.com/watch?v=exemplo)", "duration": "10:00", "reason": "Por que assistir" }
  ]
}
Baseie a aula exclusivamente no conteúdo enviado. Preencha a lista de "videos" com 2 ou 3 vídeos reais e úteis do YouTube relevantes ao assunto.`;

      const userContent = [];
      if (input.images && input.images.length > 0) {
        input.images.forEach((img) => {
          userContent.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
        });
        userContent.push({
          type: "text",
          text: input.text
            ? `Estas são fotos de material de estudo. O estudante também escreveu:\n\n${input.text}\n\nUse as imagens e o texto para criar a aula.`
            : "Estas são fotos de material de estudo. Crie a aula baseada nelas."
        });
      } else {
        userContent.push({ type: "text", text: `Conteúdo enviado pelo estudante:\n\n${input.text}` });
      }

      setProcessingStep(2);
      const lessonResp = await callGemini({ system, messages: [{ role: "user", content: userContent }], max_tokens: 4096 });
      const lessonRaw = extractText(lessonResp);
      const lessonJson = extractJSON(lessonRaw);
      if (!lessonJson) throw new Error("Não foi possível interpretar a resposta da IA.");

      setProcessingStep(3);
      setProcessingStep(4);

      const subject = {
        id: uid(),
        title: lessonJson.subject || "Estudo",
        level: lessonJson.level || "Geral",
        createdAt: Date.now(),
        lesson: lessonJson,
        quizzes: [],
        mastery: {},
      };

      const next = { ...data, subjects: [...(data.subjects || []), subject] };
      persist(next);
      setCurrentSubjectId(subject.id);
      setProcessingStep(5);
      setTimeout(() => setView("lesson"), 300);
    } catch (e) {
      console.error(e);
      setError("Não foi possível analisar o conteúdo. Tente novamente.");
      setView("home");
    }
  };

  const generateQuiz = async (subject, config, focusTopics) => {
    setView("processing");
    setProcessingStep(2);
    try {
      const system = `Você cria simulados de estudo baseados exclusivamente no conteúdo de uma aula. Responda APENAS com um JSON válido no formato:
{"questions": [{"id": "q1", "type": "multiple_choice|true_false|short_answer|essay|calculation", "prompt": "texto da questão", "topic": "tópico relacionado", "difficulty": "fácil|médio|difícil", "points": 10, "requiresCalculator": false,
  "options": [{"id":"a","text":"..."}],
  "correctAnswer": "id da opção correta OU true/false OU texto/número esperado",
  "explanation": "explicação"
}]}
Regras: gere exatamente ${config.count} questões. Dificuldade: ${config.difficulty}. A soma de "points" deve ser 100.
${focusTopics && focusTopics.length ? `Dê peso extra aos tópicos: ${focusTopics.join(", ")}.` : ""}
${config.spec ? `Instrução extra: "${config.spec}"` : ""}`;

      const lesson = subject.lesson;
      const userMsg = `Aula estudada:\nAssunto: ${lesson.subject}\nNível: ${lesson.level}\nTópicos: ${(lesson.sections || []).map((s) => s.concept).join(", ")}\nResumo: ${lesson.summary}`;

      const resp = await callGemini({ system, messages: [{ role: "user", content: userMsg }], max_tokens: 4096 });
      const parsed = extractJSON(extractText(resp));
      if (!parsed || !parsed.questions || !parsed.questions.length) throw new Error("Falha ao gerar simulado.");
      setQuizPack({ questions: parsed.questions, config });
      setView("quiz");
    } catch (e) {
      console.error(e);
      setError("Não foi possível gerar o simulado. Tente novamente.");
      setView("lesson");
    }
  };

  const handleQuizFinish = (results, subject, config) => {
    const total = results.length;
    let earnedPoints = 0;
    let maxPoints = 0;
    let correctCount = 0;
    const catTotals = { conceitos: [0, 0], aplicacao: [0, 0], calculos: [0, 0], interpretacao: [0, 0] };
    const topicScores = {};

    results.forEach((r) => {
      const q = r.question;
      const points = q.points || (100 / total);
      maxPoints += points;
      const score = r.score != null ? r.score : (r.isCorrect ? 1 : 0);
      earnedPoints += points * score;
      if (r.isCorrect) correctCount++;

      let cat = "interpretacao";
      if (q.type === "true_false") cat = "conceitos";
      else if (q.type === "essay") cat = "aplicacao";
      else if (q.type === "calculation") cat = "calculos";
      catTotals[cat][0] += score; catTotals[cat][1] += 1;

      const t = q.topic || "geral";
      if (!topicScores[t]) topicScores[t] = { sum: 0, count: 0 };
      topicScores[t].sum += score; topicScores[t].count += 1;
    });

    const scoreOn100 = Math.round((earnedPoints / (maxPoints || 1)) * 100);
    const byCategory = {};
    Object.entries(catTotals).forEach(([k, [sum, count]]) => { byCategory[k] = count ? Math.round((sum / count) * 100) : 0; });

    const weakTopics = Object.entries(topicScores)
      .map(([topic, { sum, count }]) => ({ topic, percent: Math.round((sum / count) * 100), count }))
      .filter((t) => t.percent < 70)
      .sort((a, b) => a.percent - b.percent)
      .map((t) => ({ ...t, note: `Você teve dificuldade em ${t.count} questão(ões) sobre ${t.topic}.` }));

    const mastery = { ...(subject.mastery || {}) };
    Object.entries(topicScores).forEach(([topic, { sum, count }]) => {
      const pct = (sum / count) * 100;
      mastery[topic] = pct >= 85 ? "green" : pct >= 60 ? "yellow" : "red";
    });

    const quiz = {
      id: uid(),
      date: Date.now(),
      numQuestions: total,
      difficulty: config.difficulty,
      spec: config.spec,
      score: scoreOn100,
      percent: scoreOn100,
      correctCount,
      total,
      byCategory,
      weakTopics,
      questions: results.map((r) => ({ id: r.question.id, type: r.question.type, topic: r.question.topic, score: r.score != null ? r.score : (r.isCorrect ? 1 : 0) })),
    };

    const updatedSubject = { ...subject, quizzes: [...(subject.quizzes || []), quiz], mastery };
    const nextSubjects = (data.subjects || []).map((s) => (s.id === subject.id ? updatedSubject : s));
    persist({ ...data, subjects: nextSubjects });
    return quiz;
  };

  const generateReview = async (subject, weakTopics) => {
    setView("review");
    setReviewData(null);
    try {
      const system = `Você é um tutor de IA. Crie uma revisão curta e objetiva apenas sobre os tópicos fracos informados. Responda APENAS com um JSON válido:
{"topics": [{"topic": "...", "explanation": "explicação objetiva reensinando o conceito", "tip": "dica prática"}]}`;
      const userMsg = `Assunto geral: ${subject.lesson.subject}\nTópicos com dificuldade: ${weakTopics.map((w) => `${w.topic} (${w.percent}%)`).join(", ")}`;
      const resp = await callGemini({ system, messages: [{ role: "user", content: userMsg }], max_tokens: 2048 });
      const parsed = extractJSON(extractText(resp));
      setReviewData(parsed || { topics: weakTopics.map((w) => ({ topic: w.topic, explanation: w.note, tip: "" })) });
    } catch (e) {
      setReviewData({ topics: weakTopics.map((w) => ({ topic: w.topic, explanation: w.note, tip: "" })) });
    }
  };

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400"><Spinner /></div>;
  }

  if (view === "home") {
    return (
      <>
        {error && (
          <div className="fixed top-4 left-4 right-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3 z-50 text-center">{error}</div>
        )}
        <HomeScreen
          subjects={data.subjects || []}
          onNewStudy={() => setView("input")}
          onOpenSubject={(id) => { setCurrentSubjectId(id); setView("lesson"); }}
          onHistory={() => setView("history")}
        />
      </>
    );
  }

  if (view === "input") {
    return <InputScreen onBack={() => setView("home")} onSubmit={handleContentSubmit} />;
  }

  if (view === "processing") {
    return <ProcessingScreen doneStep={processingStep} />;
  }

  if (view === "lesson" && currentSubject) {
    return (
      <LessonScreen
        subject={currentSubject}
        onBack={() => setView("home")}
        onHome={() => setView("home")}
        onReady={() => setView("quizConfig")}
      />
    );
  }

  if (view === "quizConfig" && currentSubject) {
    return (
      <QuizConfigScreen
        onBack={() => setView("lesson")}
        defaultSpec={quizConfig?.spec}
        onStart={(config) => { setQuizConfig(config); generateQuiz(currentSubject, config, quizConfig?.focusTopics); }}
      />
    );
  }

  if (view === "quiz" && quizPack && currentSubject) {
    return (
      <QuizScreen
        subject={currentSubject}
        quizPack={quizPack}
        onBack={() => setView("lesson")}
        onFinish={(results) => {
          const quiz = handleQuizFinish(results, currentSubject, quizPack.config);
          setLastQuiz(quiz);
          setView("result");
        }}
      />
    );
  }

  if (view === "result" && currentSubject) {
    const freshSubject = (data.subjects || []).find((s) => s.id === currentSubject.id) || currentSubject;
    return (
      <ResultScreen
        quiz={lastQuiz}
        subject={freshSubject}
        onHome={() => setView("home")}
        onReviewErrors={() => generateReview(freshSubject, lastQuiz?.weakTopics || [])}
        onNewQuiz={() => { setQuizConfig({ spec: "", focusTopics: (lastQuiz?.weakTopics || []).map((w) => w.topic) }); setView("quizConfig"); }}
        onBackToLesson={() => setView("lesson")}
      />
    );
  }

  if (view === "review" && currentSubject) {
    return (
      <ReviewScreen
        review={reviewData}
        onBack={() => setView("result")}
        onStartFocusedQuiz={() => {
          const weakList = lastQuiz?.weakTopics || [];
          setQuizConfig({ spec: `Foque nestes tópicos: ${weakList.map((w) => w.topic).join(", ")}`, focusTopics: weakList.map((w) => w.topic) });
          setView("quizConfig");
        }}
      />
    );
  }

  if (view === "history") {
    return <HistoryScreen subjects={data.subjects || []} onBack={() => setView("home")} />;
  }

  return <HomeScreen subjects={data.subjects || []} onNewStudy={() => setView("input")} onOpenSubject={(id) => { setCurrentSubjectId(id); setView("lesson"); }} onHistory={() => setView("history")} />;
}
