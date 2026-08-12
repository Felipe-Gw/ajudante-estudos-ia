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

  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

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

function ProgressBar({ value, colorClass = "bg-indigo-600" }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${colorClass} rounded-full transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function MasteryDot({ level }) {
  const map = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-rose-500",
  };
  const label = { green: "Dominado", yellow: "Em desenvolvimento", red: "Precisa estudar" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={`w-2 h-2 rounded-full ${map[level] || "bg-slate-300"}`} />
      {label[level] || "Sem dados"}
    </span>
  );
}

function Spinner({ className = "w-5 h-5" }) {
  return <Loader2 className={`${className} animate-spin`} />;
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

// ----------------------------- calculator -----------------------------

function Calculator({ onClose }) {
  const [expr, setExpr] = useState("");
  const press = (v) => setExpr((e) => e + v);
  const clear = () => setExpr("");
  const backspace = () => setExpr((e) => e.slice(0, -1));
  const equals = () => {
    try {
      const sanitized = expr.replace(/[^0-9+\-×÷().,]/g, "")
        .replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".");
      // eslint-disable-next-line no-new-func
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

// ----------------------------- INPUT -----------------------------

function InputScreen({ onBack, onSubmit }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [fileError, setFileError] = useState(null);
  
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const addFile = (file) => {
    setFileError(null);
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      setFileError("Selecione um arquivo de imagem válido.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFileError("Não foi possível ler essa imagem. Tente outra.");
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = String(dataUrl).split(",")[1];
      if (!base64) { setFileError("Não foi possível processar essa imagem."); return; }
      setImages((prev) => [...prev, { id: uid(), base64, mediaType: file.type || "image/jpeg", previewUrl: dataUrl }]);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (id) => setImages((prev) => prev.filter((img) => img.id !== id));

  const canContinue = text.trim().length > 0 || images.length > 0;

  return (
    <div className="min-h-screen bg-white pb-28">
      <TopBar title="Novo estudo" onBack={onBack} />
      <div className="p-5">
        <p className="text-sm text-slate-500 mb-3">Escreva o conteúdo, tire fotos ou envie imagens — você pode combinar os dois.</p>

        {fileError && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3 mb-3">{fileError}</p>}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cole ou digite o conteúdo que você quer estudar (opcional se enviar foto)..."
          className="w-full h-40 p-4 rounded-2xl border border-slate-200 focus:border-indigo-400 focus:outline-none resize-none text-slate-800"
        />

        <input 
          ref={cameraInputRef}
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          onChange={(e) => { addFile(e.target.files?.[0]); e.target.value = ""; }} 
        />
        <input 
          ref={galleryInputRef}
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={(e) => { addFile(e.target.files?.[0]); e.target.value = ""; }} 
        />

        <div className="flex gap-3 mt-3">
          <button 
            type="button" 
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:border-indigo-300 hover:bg-indigo-50/40 transition"
          >
            <Camera className="w-4 h-4 text-indigo-600" /> Tirar foto
          </button>
          <button 
            type="button" 
            onClick={() => galleryInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:border-indigo-300 hover:bg-indigo-50/40 transition"
          >
            <ImageIcon className="w-4 h-4 text-violet-600" /> Galeria
          </button>
        </div>

        {images.length > 0 && (
          <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
            {images.map((img) => (
              <div key={img.id} className="relative shrink-0">
                <img src={img.previewUrl} alt="anexo" className="w-20 h-20 object-cover rounded-xl border border-slate-100" />
                <button onClick={() => removeImage(img.id)} className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4">
        <button
          disabled={!canContinue}
          onClick={() => onSubmit({ text: text.trim(), images })}
          className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// ----------------------------- PROCESSING -----------------------------

const PROCESS_STEPS = [
  "Identificando assunto",
  "Separando tópicos",
  "Encontrando conceitos importantes",
  "Preparando explicação",
  "Procurando materiais complementares",
];

function ProcessingScreen({ doneStep }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8">
      <Sparkles className="w-9 h-9 text-indigo-500 mb-4" />
      <p className="font-semibold text-slate-900 mb-6">Analisando seu material...</p>
      <div className="w-full max-w-xs space-y-3">
        {PROCESS_STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-3 text-sm">
            {i < doneStep ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : i === doneStep ? (
              <Spinner className="w-4 h-4 text-indigo-500 shrink-0" />
            ) : (
              <span className="w-4 h-4 rounded-full border border-slate-200 shrink-0" />
            )}
            <span className={i <= doneStep ? "text-slate-700" : "text-slate-300"}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------- LESSON -----------------------------

function LessonScreen({ subject, onBack, onReady, onHome }) {
  const lesson = subject.lesson;
  return (
    <div className="min-h-screen bg-white pb-28">
      <TopBar title={lesson.subject} onBack={onBack} right={<button onClick={onHome}><Home className="w-5 h-5 text-slate-400" /></button>} />
      <div className="px-5 py-2">
        <span className="inline-block text-xs font-medium bg-indigo-50 text-indigo-600 rounded-full px-3 py-1">{lesson.level}</span>
      </div>

      <div className="px-5 mt-4">
        <h2 className="font-semibold text-slate-900 mb-2">O que você vai aprender</h2>
        <ul className="space-y-1.5 mb-6">
          {(lesson.objectives || []).map((o, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600"><span className="text-indigo-400">—</span>{o}</li>
          ))}
        </ul>

        <h2 className="font-semibold text-slate-900 mb-3">Explicação completa</h2>
        <div className="space-y-4 mb-6">
          {(lesson.sections || []).map((sec, i) => (
            <div key={i} className="relative pl-4 border-l-2 border-indigo-100">
              <p className="font-medium text-slate-900">{sec.concept}</p>
              <p className="text-sm text-slate-600 mt-1">{sec.explanation}</p>
              {sec.example && (
                <p className="text-sm text-slate-500 mt-2 bg-slate-50 rounded-xl p-3"><span className="font-medium text-slate-600">Exemplo real: </span>{sec.example}</p>
              )}
              {sec.whyMatters && (
                <p className="text-sm text-indigo-600 mt-2"><span className="font-medium">Por que isso importa? </span>{sec.whyMatters}</p>
              )}
            </div>
          ))}
        </div>

        <h2 className="font-semibold text-slate-900 mb-2">Resumo rápido</h2>
        <p className="text-sm text-slate-600 mb-4">{lesson.summary}</p>

        <h2 className="font-semibold text-slate-900 mb-2">O que você precisa memorizar</h2>
        <ul className="space-y-1.5 mb-4">
          {(lesson.keyPoints || []).map((k, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{k}</li>
          ))}
        </ul>

        <h2 className="font-semibold text-slate-900 mb-2">Erros que você deve evitar</h2>
        <ul className="space-y-1.5 mb-6">
          {(lesson.commonMistakes || []).map((k, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />{k}</li>
          ))}
        </ul>

        {lesson.mindMap && (
          <div className="mb-6">
            <h2 className="font-semibold text-slate-900 mb-3">Mapa mental</h2>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="font-semibold text-indigo-700 text-center mb-3">{lesson.mindMap.center}</p>
              <div className="grid grid-cols-1 gap-2">
                {(lesson.mindMap.branches || []).map((b, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 border border-slate-100">
                    <p className="text-sm font-medium text-slate-800">{b.topic}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(b.children || []).map((c, j) => (
                        <span key={j} className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Youtube className="w-4 h-4 text-rose-500" /> Vídeos recomendados</h2>
          {lesson.videos && lesson.videos.length > 0 ? (
            <div className="space-y-3">
              {lesson.videos.map((v, i) => (
                <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="block border border-slate-100 rounded-2xl p-3 hover:border-indigo-200 transition">
                  <p className="font-medium text-slate-900 text-sm">{v.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{v.channel}{v.duration ? ` · ${v.duration}` : ""}</p>
                  <p className="text-xs text-slate-500 mt-1.5">{v.reason}</p>
                  <span className="inline-block mt-2 text-xs font-medium text-indigo-600">Assistir →</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{lesson.videosNote || "Não encontramos um vídeo suficientemente relevante para este conteúdo."}</p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4">
        <button onClick={onReady} className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition">
          Estou pronto para testar meus conhecimentos <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ----------------------------- QUIZ CONFIG -----------------------------

function QuizConfigScreen({ onBack, onStart, defaultSpec }) {
  const [count, setCount] = useState(10);
  const [customCount, setCustomCount] = useState("");
  const [difficulty, setDifficulty] = useState("misturado");
  const [spec, setSpec] = useState(defaultSpec || "");

  const finalCount = count === "custom" ? (parseInt(customCount, 10) || 10) : count;

  return (
    <div className="min-h-screen bg-white">
      <TopBar title="Fazer um simulado" onBack={onBack} />
      <div className="p-5 space-y-6">
        <div>
          <p className="font-medium text-slate-900 mb-3">Quantidade de questões</p>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 20, 30].map((n) => (
              <button key={n} onClick={() => setCount(n)} className={`px-4 py-2 rounded-xl text-sm font-medium border ${count === n ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600"}`}>{n}</button>
            ))}
            <button onClick={() => setCount("custom")} className={`px-4 py-2 rounded-xl text-sm font-medium border ${count === "custom" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600"}`}>Personalizado</button>
          </div>
          {count === "custom" && (
            <input type="number" min={1} max={60} value={customCount} onChange={(e) => setCustomCount(e.target.value)} placeholder="Nº de questões" className="mt-3 w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-none" />
          )}
        </div>

        <div>
          <p className="font-medium text-slate-900 mb-3">Dificuldade</p>
          <div className="flex flex-wrap gap-2">
            {["fácil", "médio", "difícil", "misturado"].map((d) => (
              <button key={d} onClick={() => setDifficulty(d)} className={`px-4 py-2 rounded-xl text-sm font-medium border capitalize ${difficulty === d ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600"}`}>{d}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-medium text-slate-900 mb-2">Quer alguma especificação?</p>
          <textarea value={spec} onChange={(e) => setSpec(e.target.value)} placeholder='Ex: "Faça questões mais difíceis", "Foque nas causas", "Mais questões de cálculo"...' className="w-full h-24 p-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-none resize-none text-sm" />
        </div>

        <button onClick={() => onStart({ count: finalCount, difficulty, spec })} className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold active:scale-[0.98] transition">
          Gerar simulado
        </button>
      </div>
    </div>
  );
}

// ----------------------------- QUIZ -----------------------------

function QuestionRenderer({ q, value, onChange }) {
  if (q.type === "multiple_choice") {
    return (
      <div className="space-y-2">
        {(q.options || []).map((opt) => (
          <button key={opt.id} onClick={() => onChange(opt.id)} className={`w-full text-left p-3 rounded-xl border text-sm ${value === opt.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700"}`}>
            {opt.text}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "true_false") {
    return (
      <div className="flex gap-3">
        {["Verdadeiro", "Falso"].map((label, i) => {
          const v = i === 0;
          return (
            <button key={label} onClick={() => onChange(v)} className={`flex-1 py-3 rounded-xl border text-sm font-medium ${value === v ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700"}`}>{label}</button>
          );
        })}
      </div>
    );
  }
  if (q.type === "matching") {
    const map = value || {};
    return (
      <div className="space-y-3">
        {(q.pairs || []).map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm text-slate-700 flex-1">{p.left}</span>
            <select value={map[p.left] || ""} onChange={(e) => onChange({ ...map, [p.left]: e.target.value })} className="flex-1 p-2 rounded-lg border border-slate-200 text-sm">
              <option value="">Escolher...</option>
              {(q.rightOptions || []).map((r, j) => <option key={j} value={r}>{r}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={q.type === "essay" ? "Escreva sua resposta completa..." : "Digite sua resposta..."}
      className={`w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-none resize-none text-sm ${q.type === "essay" ? "h-32" : "h-20"}`}
    />
  );
}

function QuizScreen({ subject, quizPack, onFinish, onBack }) {
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

  if (!q) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Nenhuma questão disponível.</div>;
  }

  const gradeLocally = () => {
    if (q.type === "multiple_choice") {
      const correct = answer === q.correctAnswer;
      return { isCorrect: correct, score: correct ? 1 : 0, explanation: q.explanation };
    }
    if (q.type === "true_false") {
      const correct = answer === q.correctAnswer;
      return { isCorrect: correct, score: correct ? 1 : 0, explanation: q.explanation };
    }
    if (q.type === "matching") {
      const map = answer || {};
      let correctCount = 0;
      (q.pairs || []).forEach((p) => { if (map[p.left] === p.right) correctCount++; });
      const score = (q.pairs && q.pairs.length) ? correctCount / q.pairs.length : 0;
      return { isCorrect: score === 1, score, explanation: q.explanation };
    }
    return null;
  };

  const submitAnswer = async () => {
    setSubmitted(true);
    const local = gradeLocally();
    if (local) {
      setFeedback(local);
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
      setResults((r) => [...r, { question: q, userAnswer: answer, ...parsed }]);
    } catch (e) {
      const fallback = { score: 0, isCorrect: false, explanation: q.explanation, missing: "", howTo: "Não foi possível avaliar automaticamente." };
      setFeedback(fallback);
      setResults((r) => [...r, { question: q, userAnswer: answer, ...fallback }]);
    } finally {
      setGrading(false);
    }
  };

  const next = () => {
    if (idx + 1 >= questions.length) {
      onFinish(results);
    } else {
      setIdx(idx + 1);
      setAnswer(null);
      setSubmitted(false);
      setFeedback(null);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      <TopBar title={subject.lesson?.subject || "Simulado"} onBack={onBack} />
      <div className="px-5 pt-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Questão {idx + 1} de {questions.length}</span>
          {q.requiresCalculator && (
            <button onClick={() => setShowCalc(true)} className="flex items-center gap-1 text-indigo-600 font-medium"><CalcIcon className="w-3.5 h-3.5" /> Calculadora</button>
          )}
        </div>
        <ProgressBar value={progress} />
      </div>

      <div className="px-5 mt-6">
        <span className="text-xs font-medium bg-slate-100 text-slate-500 rounded-full px-2.5 py-1 capitalize">{q.topic}</span>
        <p className="font-medium text-slate-900 mt-3 mb-4 leading-relaxed">{q.prompt}</p>

        {!submitted && (
          <>
            <QuestionRenderer q={q} value={answer} onChange={setAnswer} />
            <button
              disabled={answer === null || answer === "" || (q.type === "matching" && Object.keys(answer || {}).length < (q.pairs || []).length)}
              onClick={submitAnswer}
              className="w-full mt-6 bg-indigo-600 text-white rounded-2xl py-3.5 font-semibold disabled:opacity-40"
            >
              Responder
            </button>
          </>
        )}

        {submitted && grading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm mt-4"><Spinner className="w-4 h-4" /> Corrigindo sua resposta...</div>
        )}

        {submitted && !grading && feedback && (
          <div className="mt-4">
            <div className={`rounded-2xl p-4 ${feedback.isCorrect ? "bg-emerald-50 border border-emerald-100" : "bg-rose-50 border border-rose-100"}`}>
              <div className={`flex items-center gap-2 font-semibold mb-2 ${feedback.isCorrect ? "text-emerald-700" : "text-rose-600"}`}>
                {feedback.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                {feedback.isCorrect ? "Correto!" : "Incorreto"}
              </div>
              {!feedback.isCorrect && q.type !== "essay" && q.type !== "short_answer" && (
                <p className="text-sm text-slate-600 mb-1"><span className="font-medium">Sua resposta:</span> {typeof answer === "string" ? answer : JSON.stringify(answer)}</p>
              )}
              {q.correctAnswer && q.type !== "essay" && (
                <p className="text-sm text-slate-600 mb-2"><span className="font-medium">Resposta correta:</span> {typeof q.correctAnswer === "string" ? q.correctAnswer : JSON.stringify(q.correctAnswer)}</p>
              )}
              <p className="text-sm text-slate-700">{feedback.explanation}</p>
              {feedback.missing && <p className="text-sm text-amber-700 mt-2"><span className="font-medium">O que faltou:</span> {feedback.missing}</p>}
              {feedback.howTo && <p className="text-sm text-indigo-700 mt-2"><span className="font-medium">Como pensar corretamente:</span> {feedback.howTo}</p>}
            </div>
            <button onClick={next} className="w-full mt-4 bg-indigo-600 text-white rounded-2xl py-3.5 font-semibold">
              {idx + 1 >= questions.length ? "Ver resultado" : "Próxima questão →"}
            </button>
          </div>
        )}
      </div>

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}
    </div>
  );
}

export default App;
