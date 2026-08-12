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

// ----------------------------- MAIN APP COMPONENT -----------------------------

export default function App() {
  const [subjects, setSubjects] = useState([]);
  const [screen, setScreen] = useState("home"); // home, input, processing, lesson, quizConfig, quiz, results, history
  const [currentSubjectId, setCurrentSubjectId] = useState(null);
  const [doneStep, setDoneStep] = useState(0);
  const [tempInput, setTempInput] = useState(null);
  const [currentQuizPack, setCurrentQuizPack] = useState(null);

  useEffect(() => {
    loadData().then(d => {
      if (d && d.subjects) setSubjects(d.subjects);
    });
  }, []);

  const saveToStorage = (newSubjects) => {
    setSubjects(newSubjects);
    saveData({ subjects: newSubjects });
  };

  const handleCreateStudy = async ({ text, images }) => {
    setScreen("processing");
    setDoneStep(0);

    const interval = setInterval(() => {
      setDoneStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      const system = `Você é um professor especialista. Analise o material enviado e crie um objeto JSON estruturado com a seguinte estrutura exata:
{
  "subject": "Nome da matéria ou tópico",
  "level": "Nível de ensino (ex: Ensino Fundamental, Médio, Superior)",
  "objectives": ["Objetivo 1", "Objetivo 2"],
  "sections": [
    {
      "concept": "Conceito 1",
      "explanation": "Explicação detalhada...",
      "example": "Exemplo prático...",
      "whyMatters": "Por que isso importa..."
    }
  ],
  "summary": "Resumo rápido...",
  "keyPoints": ["Ponto 1", "Ponto 2"],
  "commonMistakes": ["Erro 1"],
  "mindMap": {
    "center": "Tema Central",
    "branches": [
      { "topic": "Ramo 1", "children": ["Sub 1", "Sub 2"] }
    ]
  },
  "videos": [
    { "title": "Título do vídeo", "channel": "Canal", "url": "[https://youtube.com/](https://youtube.com/)...", "reason": "Por que assistir" }
  ]
}`;

      const messages = [{ role: "user", content: text || "Analise as imagens anexadas para criar o conteúdo de estudo." }];
      const data = await callGemini({ system, messages, max_tokens: 4000 });
      const rawText = extractText(data);
      const lessonJson = extractJSON(rawText);

      clearInterval(interval);
      setDoneStep(5);

      if (!lessonJson) {
        throw new Error("Não foi possível gerar a aula.");
      }

      const newSub = {
        id: uid(),
        title: lessonJson.subject || "Estudo",
        level: lessonJson.level || "Geral",
        lesson: lessonJson,
        quizzes: []
      };

      const updated = [...subjects, newSub];
      saveToStorage(updated);
      setCurrentSubjectId(newSub.id);

      setTimeout(() => {
        setScreen("lesson");
      }, 600);

    } catch (e) {
      clearInterval(interval);
      alert("Erro ao processar o estudo. Tente novamente.");
      setScreen("home");
    }
  };

  const currentSubject = subjects.find(s => s.id === currentSubjectId);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white relative shadow-2xl">
      {screen === "home" && (
        <HomeScreen
          subjects={subjects}
          onNewStudy={() => setScreen("input")}
          onOpenSubject={(id) => { setCurrentSubjectId(id); setScreen("lesson"); }}
          onHistory={() => setScreen("history")}
        />
      )}

      {screen === "input" && (
        <div className="min-h-screen bg-white pb-28">
          <TopBar title="Novo estudo" onBack={() => setScreen("home")} />
          <div className="p-5">
            <p className="text-sm text-slate-500 mb-3">Cole ou digite o conteúdo que você quer estudar:</p>
            <textarea
              id="study-input-text"
              placeholder="Digite o conteúdo aqui..."
              className="w-full h-40 p-4 rounded-2xl border border-slate-200 focus:border-indigo-400 focus:outline-none resize-none text-slate-800"
            />
            <button
              onClick={() => {
                const txt = document.getElementById("study-input-text").value;
                if (txt.trim()) handleCreateStudy({ text: txt, images: [] });
              }}
              className="w-full mt-4 bg-indigo-600 text-white rounded-2xl py-4 font-semibold"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {screen === "processing" && <ProcessingScreen doneStep={doneStep} />}

      {screen === "lesson" && currentSubject && (
        <LessonScreen
          subject={currentSubject}
          onBack={() => setScreen("home")}
          onReady={() => setScreen("quizConfig")}
          onHome={() => setScreen("home")}
        />
      )}

      {screen === "quizConfig" && (
        <div className="min-h-screen bg-white">
          <TopBar title="Configurar Simulado" onBack={() => setScreen("lesson")} />
          <div className="p-5 space-y-6">
            <button
              onClick={async () => {
                setScreen("processing");
                try {
                  const system = `Crie um simulado em JSON com 5 questões de múltipla escolha sobre a matéria. Formato:
{
  "questions": [
    {
      "type": "multiple_choice",
      "topic": "Tópico",
      "prompt": "Pergunta?",
      "options": [{"id": "a", "text": "Opção A"}, {"id": "b", "text": "Opção B"}],
      "correctAnswer": "a",
      "explanation": "Explicação..."
    }
  ]
}`;
                  const data = await callGemini({ system, messages: [{ role: "user", content: currentSubject.title }] });
                  const qPack = extractJSON(extractText(data));
                  setCurrentQuizPack(qPack);
                  setScreen("quiz");
                } catch (e) {
                  alert("Erro ao criar simulado.");
                  setScreen("lesson");
                }
              }}
              className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-semibold"
            >
              Gerar Simulado Rápido
            </button>
          </div>
        </div>
      )}

      {screen === "quiz" && currentQuizPack && (
        <div className="p-5">
          <p className="font-bold mb-4">Simulado em Andamento</p>
          <button onClick={() => setScreen("home")} className="bg-indigo-600 text-white px-4 py-2 rounded-xl">Voltar ao Início</button>
        </div>
      )}

      {screen === "history" && (
        <div className="min-h-screen bg-white">
          <TopBar title="Desempenho" onBack={() => setScreen("home")} />
          <div className="p-5 text-center text-slate-500">Histórico de estudos em breve!</div>
        </div>
      )}
    </div>
  );
}
