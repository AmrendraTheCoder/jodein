'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Users, Clock, MessageSquare, Sparkles, Upload, FileText,
  CheckCircle2, Settings, Key, Shield, RefreshCw, Sliders, ChevronDown,
  Power, Info, Check, AlertTriangle, Terminal, Database, Zap, Globe,
  BarChart2, Activity, Bot, Code2, Copy, ExternalLink, ArrowRight,
  ChevronRight, Layers, Network, BookOpen, BellRing, Star, X,
  Play, Pause, RotateCcw, Download, Filter, Search, MoreHorizontal,
  TrendingDown, Cpu, Server, Lock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line, ReferenceLine,
} from 'recharts';

/* ============================================================
   CONSTANTS & MOCK DATA
   ============================================================ */
const COLLEGES = {
  lnmiit: {
    name: 'LNM Institute of Information Technology',
    short: 'LNMIIT',
    city: 'Jaipur',
    color: '#6d51e8',
    metrics: { activeStudents: 1420, deflectionRate: 84.6, avgResponseTime: 1.15, messagesHandled: 12480, newToday: 47, pendingQueue: 3 },
    systemPrompt: `You are the campus assistant for LNM Institute of Information Technology (LNMIIT), Jaipur.
You help students with syllabus queries, timetables, exam schedules, attendance status, and general campus information.
Always respond in the same language the student uses — Hindi, English, or Hinglish.
If you don't have specific information, say: "Iske baare mein main confirm nahi kar sakta — please apne department se verify karein."
Keep answers concise — this is WhatsApp, not an email.
Never share sensitive data like full phone numbers or CGPA without explicit consent.`,
    model: 'gemini-1.5-flash-latest',
    temperature: 0.6,
    maxTokens: 800,
    features: { webSearch: false, imageUnderstanding: true, voiceTranscription: false, ragEnabled: true, parentAlerts: true },
    chartData: [
      { day: 'Mon', total: 420, deflected: 360, manual: 60, responseTime: 1.1, cost: 0.42 },
      { day: 'Tue', total: 510, deflected: 440, manual: 70, responseTime: 1.2, cost: 0.51 },
      { day: 'Wed', total: 680, deflected: 590, manual: 90, responseTime: 1.15, cost: 0.68 },
      { day: 'Thu', total: 490, deflected: 410, manual: 80, responseTime: 1.25, cost: 0.49 },
      { day: 'Fri', total: 720, deflected: 620, manual: 100, responseTime: 1.05, cost: 0.72 },
      { day: 'Sat', total: 310, deflected: 260, manual: 50, responseTime: 0.95, cost: 0.31 },
      { day: 'Sun', total: 250, deflected: 215, manual: 35, responseTime: 0.9, cost: 0.25 },
    ],
  },
  poornima: {
    name: 'Poornima College of Engineering',
    short: 'PCE',
    city: 'Jaipur',
    color: '#10b981',
    metrics: { activeStudents: 850, deflectionRate: 76.2, avgResponseTime: 1.42, messagesHandled: 6820, newToday: 22, pendingQueue: 7 },
    systemPrompt: `You are the campus assistant for Poornima College of Engineering, Jaipur.
Provide guidance on hostel timings, library details, college buses, exam departments, and syllabus.
Keep responses friendly and translate complex academic words into simple Hinglish.
Always ask students to verify major dates from their notice board.
Do not answer questions unrelated to the college.`,
    model: 'gemini-1.5-flash-latest',
    temperature: 0.7,
    maxTokens: 600,
    features: { webSearch: true, imageUnderstanding: false, voiceTranscription: false, ragEnabled: false, parentAlerts: false },
    chartData: [
      { day: 'Mon', total: 210, deflected: 150, manual: 60, responseTime: 1.35, cost: 0.21 },
      { day: 'Tue', total: 290, deflected: 215, manual: 75, responseTime: 1.45, cost: 0.29 },
      { day: 'Wed', total: 320, deflected: 250, manual: 70, responseTime: 1.5, cost: 0.32 },
      { day: 'Thu', total: 270, deflected: 200, manual: 70, responseTime: 1.4, cost: 0.27 },
      { day: 'Fri', total: 390, deflected: 310, manual: 80, responseTime: 1.3, cost: 0.39 },
      { day: 'Sat', total: 180, deflected: 140, manual: 40, responseTime: 1.25, cost: 0.18 },
      { day: 'Sun', total: 120, deflected: 95, manual: 25, responseTime: 1.2, cost: 0.12 },
    ],
  },
};

const ADIP_ENDPOINTS = [
  { method: 'GET', path: '/adip/v1/institution/:collegeId', desc: 'Fetch institution metadata & config', color: '#22d3ee' },
  { method: 'GET', path: '/adip/v1/students', desc: 'List all students with filters', color: '#22d3ee' },
  { method: 'GET', path: '/adip/v1/attendance/:studentId', desc: 'Get student attendance summary', color: '#22d3ee' },
  { method: 'POST', path: '/adip/v1/dispatch', desc: 'Trigger bulk notification blast', color: '#34d399' },
  { method: 'POST', path: '/adip/v1/onboard', desc: 'Seed student from CSV record', color: '#34d399' },
];

const ADIP_RESPONSES = {
  '/adip/v1/institution/:collegeId': `{
  "collegeId": "lnmiit",
  "name": "LNM Institute of Information Technology",
  "city": "Jaipur",
  "botStatus": "active",
  "activeStudents": 1420,
  "deflectionRate": 84.6,
  "model": "gemini-1.5-flash-latest",
  "rateLimit": "20 req/hr per student",
  "ragEnabled": true,
  "createdAt": "2024-08-01T00:00:00Z"
}`,
  '/adip/v1/students': `{
  "students": [
    {
      "studentId": "2022CSE001",
      "name": "Rahul Sharma",
      "branch": "CSE",
      "year": 3,
      "phone": "+91987654****",
      "activated": true,
      "lastSeen": "2026-05-25T18:30:00Z"
    },
    {
      "studentId": "2022CSE002",
      "name": "Priya Singh",
      "branch": "CSE",
      "year": 3,
      "phone": "+91987654****",
      "activated": true,
      "lastSeen": "2026-05-25T16:45:00Z"
    }
  ],
  "total": 1420,
  "page": 1,
  "limit": 20
}`,
  '/adip/v1/attendance/:studentId': `{
  "studentId": "2022CSE001",
  "name": "Rahul Sharma",
  "semester": "VI",
  "courses": [
    { "code": "CS-301", "name": "DBMS", "attended": 28, "total": 34, "pct": 82.4 },
    { "code": "CS-302", "name": "Operating Systems", "attended": 26, "total": 34, "pct": 76.5 },
    { "code": "CS-303", "name": "ADA", "attended": 23, "total": 34, "pct": 67.6 }
  ],
  "overall": 75.5,
  "shortfall": ["CS-303"]
}`,
  '/adip/v1/dispatch': `{
  "jobId": "bull-notify-a4f2c1",
  "status": "queued",
  "recipients": 1420,
  "template": "ATTENDANCE_ALERT",
  "estimatedDelivery": "~3 minutes",
  "dlqEnabled": true
}`,
  '/adip/v1/onboard': `{
  "studentId": "2022ECE101",
  "status": "seeded",
  "phone": "+919876543213",
  "activationQueued": true,
  "bullJobId": "bull-activate-b7e3d9",
  "message": "WhatsApp activation scheduled"
}`,
};

const CSV_STAGES = [
  { icon: FileText, label: 'Read CSV File', color: '#8b73f5', log: '→ Parsing stream from FormData...' },
  { icon: Filter, label: 'Map Columns', color: '#22d3ee', log: '→ Detected headers: studentId, name, branch, year, phone, parentPhone' },
  { icon: Shield, label: 'E.164 Validation', color: '#fbbf24', log: '→ Normalizing 3 phones to +91 prefix format...' },
  { icon: Database, label: 'Seed MongoDB', color: '#34d399', log: '→ Inserted 3 documents to students collection' },
  { icon: BellRing, label: 'BullMQ Dispatch', color: '#f472b6', log: '→ 3 activation jobs queued · DLQ enabled' },
];

const MOCK_STUDENTS = [
  { id: '2022CSE001', name: 'Rahul Sharma', phone: '+919876543210', branch: 'CSE', status: 'Active' },
  { id: '2022CSE002', name: 'Priya Singh', phone: '+919876543211', branch: 'CSE', status: 'Active' },
  { id: '2022ECE001', name: 'Amit Kumar', phone: '+919876543212', branch: 'ECE', status: 'Active' },
];

/* ============================================================
   UTILITY COMPONENTS
   ============================================================ */

function Toggle({ checked, onChange, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="toggle-track flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      style={checked
        ? { background: 'linear-gradient(135deg, #6d51e8, #5538d4)', border: '1px solid rgba(109,81,232,0.5)', boxShadow: '0 0 12px rgba(109,81,232,0.3)' }
        : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }
      }
    >
      <div
        className="toggle-thumb"
        style={checked ? { left: 22 } : { left: 4 }}
      />
    </button>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, trend, trendUp }) {
  const colorMap = {
    indigo: { bg: 'rgba(109,81,232,0.08)', text: '#a99bff', glow: 'rgba(109,81,232,0.15)', border: 'rgba(109,81,232,0.15)' },
    emerald: { bg: 'rgba(16,185,129,0.08)', text: '#34d399', glow: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.15)' },
    amber: { bg: 'rgba(245,158,11,0.08)', text: '#fbbf24', glow: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.15)' },
    rose: { bg: 'rgba(244,63,94,0.08)', text: '#fb7185', glow: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.12)' },
    cyan: { bg: 'rgba(6,182,212,0.08)', text: '#22d3ee', glow: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.12)' },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div
      className="kpi-card group transition-all duration-300"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = c.border;
        e.currentTarget.style.boxShadow = `0 4px 32px rgba(0,0,0,0.4), 0 0 40px ${c.glow}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          <Icon className="w-5 h-5" style={{ color: c.text }} />
        </div>
        {trend && (
          <span
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
            style={{
              background: trendUp ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
              color: trendUp ? '#34d399' : '#fb7185',
            }}
          >
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </span>
        )}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">{label}</p>
      <p className="text-3xl font-extrabold text-white mb-1.5 tracking-tight">{value}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function SectionPanel({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ icon: Icon, iconColor, title, subtitle, badge, badgeColor }) {
  return (
    <div className="section-header">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${iconColor}12`, border: `1px solid ${iconColor}25` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {badge && (
        <span
          className="badge text-[9px]"
          style={badgeColor === 'success'
            ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }
            : { background: 'rgba(109,81,232,0.1)', color: '#a99bff', border: '1px solid rgba(109,81,232,0.2)' }
          }
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/* ============================================================
   CHARTS
   ============================================================ */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-xs"
      style={{ background: '#06090f', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
    >
      <p className="font-bold text-slate-300 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   CSV ONBOARDER
   ============================================================ */
function CsvOnboarder({ collegeId }) {
  const [stage, setStage] = useState(-1);
  const [logs, setLogs] = useState([]);
  const [students, setStudents] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const logsRef = useRef(null);

  const runSimulation = useCallback(() => {
    if (stage >= 0) return;
    setStage(0);
    setLogs([]);
    setStudents([]);

    CSV_STAGES.forEach((s, i) => {
      setTimeout(() => {
        setStage(i);
        setLogs((prev) => [
          ...prev,
          { time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), msg: s.log, color: s.color },
        ]);
        if (i === CSV_STAGES.length - 1) {
          setTimeout(() => {
            setStudents(MOCK_STUDENTS);
          }, 400);
        }
      }, i * 900);
    });
  }, [stage]);

  const reset = () => { setStage(-1); setLogs([]); setStudents([]); };

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  return (
    <SectionPanel>
      <PanelHeader
        icon={Upload}
        iconColor="#10b981"
        title="Bulk Student Ingestion"
        subtitle="CSV → MongoDB → BullMQ activation pipeline"
        badge={stage === CSV_STAGES.length - 1 ? '✓ Complete' : stage >= 0 ? 'Processing' : 'Ready'}
        badgeColor={stage === CSV_STAGES.length - 1 ? 'success' : 'brand'}
      />

      {/* Dropzone */}
      <div
        className="rounded-xl mb-5 text-center transition-all duration-300 cursor-pointer"
        style={{
          border: `2px dashed ${isDragging ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`,
          background: isDragging ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.01)',
          padding: '28px 20px',
        }}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDrop={() => { setIsDragging(false); runSimulation(); }}
        onClick={runSimulation}
      >
        <div
          className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
        >
          <FileText className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-[13px] font-bold text-slate-300 mb-1">
          {stage >= 0 ? 'Running pipeline...' : 'Drop CSV or click to simulate'}
        </p>
        <p className="text-[10px] text-slate-500">
          Required: studentId, name, branch, year, phone, parentPhone
        </p>
        {stage < 0 && (
          <div
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[11px] font-bold text-emerald-400"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
          >
            <Play className="w-3 h-3" />
            Simulate Ingestion
          </div>
        )}
      </div>

      {/* Stage tracker */}
      {stage >= 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400">Pipeline Progress</span>
            {stage === CSV_STAGES.length - 1 && (
              <button onClick={reset} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
          <div className="flex gap-1.5 mb-3">
            {CSV_STAGES.map((s, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-all duration-500"
                style={{ background: i <= stage ? s.color : 'rgba(255,255,255,0.06)' }}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CSV_STAGES.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 min-w-[52px] text-center transition-all duration-300"
                  style={{ opacity: i <= stage ? 1 : 0.3 }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{
                      background: i <= stage ? `${s.color}20` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${i <= stage ? `${s.color}40` : 'transparent'}`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: i <= stage ? s.color : '#475569' }} />
                  </div>
                  <span className="text-[8px] text-slate-500 font-semibold leading-tight">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Console log */}
      {logs.length > 0 && (
        <div
          ref={logsRef}
          className="terminal rounded-xl mb-4 max-h-[120px] overflow-y-auto p-3"
          style={{ fontSize: '10px', lineHeight: '1.8' }}
        >
          {logs.map((l, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-600 shrink-0">[{l.time}]</span>
              <span style={{ color: l.color }}>{l.msg}</span>
            </div>
          ))}
          {stage < CSV_STAGES.length - 1 && (
            <div className="flex items-center gap-2 text-slate-500">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
            Seeded Students ({students.length})
          </p>
          <div className="space-y-2">
            {students.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div>
                  <p className="text-[12px] font-bold text-slate-200">{s.name}</p>
                  <p className="text-[10px] text-slate-500">{s.id} · {s.branch} · {s.phone}</p>
                </div>
                <span className="badge badge-success text-[9px]">
                  <span className="dot-live mr-1" style={{ width: 4, height: 4 }} />
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionPanel>
  );
}

/* ============================================================
   ADIP PLAYGROUND TERMINAL
   ============================================================ */
function AdipPlayground({ collegeId }) {
  const [activeEndpoint, setActiveEndpoint] = useState(ADIP_ENDPOINTS[0]);
  const [response, setResponse] = useState(ADIP_RESPONSES[ADIP_ENDPOINTS[0].path]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fire = (ep) => {
    setActiveEndpoint(ep);
    setResponse('');
    setLoading(true);
    setTimeout(() => {
      setResponse(ADIP_RESPONSES[ep.path] || '{"status":"ok"}');
      setLoading(false);
    }, 700 + Math.random() * 400);
  };

  const copy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlight JSON
  const highlight = (json) =>
    json
      .replace(/("[\w]+")\s*:/g, '<span style="color:#22d3ee">$1</span>:')
      .replace(/:\s*(".*?")/g, ': <span style="color:#34d399">$1</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#a99bff">$1</span>')
      .replace(/:\s*(true|false|null)/g, ': <span style="color:#fbbf24">$1</span>');

  return (
    <SectionPanel>
      <PanelHeader
        icon={Terminal}
        iconColor="#8b73f5"
        title="ADIP API Playground"
        subtitle="Live interactive endpoint explorer"
        badge="v1 Spec"
        badgeColor="brand"
      />

      {/* Endpoint list */}
      <div className="space-y-1.5 mb-5">
        {ADIP_ENDPOINTS.map((ep, i) => (
          <button
            key={i}
            onClick={() => fire(ep)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200"
            style={{
              background: activeEndpoint.path === ep.path ? 'rgba(109,81,232,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${activeEndpoint.path === ep.path ? 'rgba(109,81,232,0.25)' : 'rgba(255,255,255,0.04)'}`,
            }}
          >
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded font-mono shrink-0"
              style={{
                background: ep.method === 'GET' ? 'rgba(34,211,238,0.12)' : 'rgba(52,211,153,0.12)',
                color: ep.method === 'GET' ? '#22d3ee' : '#34d399',
                border: `1px solid ${ep.method === 'GET' ? 'rgba(34,211,238,0.2)' : 'rgba(52,211,153,0.2)'}`,
              }}
            >
              {ep.method}
            </span>
            <span className="text-[11px] font-mono text-slate-300 flex-1 truncate">{ep.path}</span>
          </button>
        ))}
      </div>

      {/* Response terminal */}
      <div className="terminal rounded-xl overflow-hidden">
        <div className="terminal-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="terminal-dot" style={{ background: '#f87171' }} />
            <div className="terminal-dot" style={{ background: '#fbbf24' }} />
            <div className="terminal-dot" style={{ background: '#34d399' }} />
            <span className="text-[10px] font-mono text-slate-500 ml-2">
              {activeEndpoint.method} {activeEndpoint.path}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!loading && response && (
              <button
                onClick={copy}
                className="flex items-center gap-1 text-[10px] font-semibold transition-colors"
                style={{ color: copied ? '#34d399' : '#475569' }}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
        </div>
        <div className="p-4 max-h-[260px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="text-[11px]">Fetching from ADIP server...</span>
            </div>
          ) : (
            <pre
              className="text-[10px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlight(response) }}
            />
          )}
        </div>
      </div>
    </SectionPanel>
  );
}

/* ============================================================
   AI CONFIG PANEL
   ============================================================ */
function AiConfigPanel({ config, onChange }) {
  const [promptVal, setPromptVal] = useState(config.systemPrompt);
  const [tempVal, setTempVal] = useState(config.temperature);
  const [model, setModel] = useState(config.model);
  const [features, setFeatures] = useState(config.features);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPromptVal(config.systemPrompt);
    setTempVal(config.temperature);
    setModel(config.model);
    setFeatures(config.features);
  }, [config]);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const FEAT_LABELS = {
    webSearch: { label: 'Web Search API', desc: 'Allow bot to search the internet' },
    imageUnderstanding: { label: 'Image Understanding', desc: 'Process screenshot messages' },
    voiceTranscription: { label: 'Voice Transcription', desc: 'Transcribe WhatsApp voice notes' },
    ragEnabled: { label: 'Knowledge Base (RAG)', desc: 'Query Pinecone vector namespace' },
    parentAlerts: { label: 'Parent Alerts', desc: 'Notify parents on attendance shortfall' },
  };

  return (
    <SectionPanel className="col-span-7">
      <PanelHeader
        icon={Sliders}
        iconColor="#6d51e8"
        title="Dynamic AI Persona Config"
        subtitle="Customize LLM behavior per college tenant"
        badge="Active Config"
        badgeColor="success"
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* System prompt */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
            System Prompt
          </label>
          <div
            className="relative rounded-xl overflow-hidden"
            style={{ background: '#06090f', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Line numbers */}
            <div className="absolute top-0 left-0 bottom-0 w-10 flex flex-col pt-3 pb-3 items-center"
              style={{ borderRight: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
              {Array.from({ length: Math.max(promptVal.split('\n').length, 8) }, (_, i) => (
                <span key={i} className="text-[9px] font-mono text-slate-700 leading-[18px]">{i + 1}</span>
              ))}
            </div>
            <textarea
              value={promptVal}
              onChange={(e) => setPromptVal(e.target.value)}
              rows={8}
              className="w-full pl-12 pr-4 py-3 text-[11px] leading-[18px] text-slate-300 resize-none focus:outline-none"
              style={{ background: 'transparent', fontFamily: "'JetBrains Mono', monospace" }}
              placeholder="Write system persona guidelines..."
              id="system-prompt-editor"
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">
            💡 Injected with live student metadata at runtime. Markdown formatting supported.
          </p>
        </div>

        {/* Model + Temperature */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              LLM Model
            </label>
            <div className="space-y-2">
              {[
                { id: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash', badge: 'Recommended', badgeColor: '#34d399' },
                { id: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro', badge: 'Complex', badgeColor: '#fbbf24' },
                { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', badge: 'Latest', badgeColor: '#a99bff' },
              ].map((m) => (
                <label
                  key={m.id}
                  className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: model === m.id ? 'rgba(109,81,232,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${model === m.id ? 'rgba(109,81,232,0.25)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: model === m.id ? '#6d51e8' : '#334155' }}
                    >
                      {model === m.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                    </div>
                    <span className="text-[12px] font-semibold text-slate-200">{m.label}</span>
                  </div>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `${m.badgeColor}15`, color: m.badgeColor }}
                  >
                    {m.badge}
                  </span>
                  <input type="radio" name="model" value={m.id} checked={model === m.id}
                    onChange={() => setModel(m.id)} className="sr-only" />
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Temperature
              </label>
              <span
                className="text-sm font-mono font-extrabold"
                style={{ color: tempVal > 0.7 ? '#fbbf24' : '#a99bff' }}
              >
                {tempVal}
              </span>
            </div>
            <input
              type="range" min="0.1" max="1.0" step="0.05"
              value={tempVal}
              onChange={(e) => setTempVal(parseFloat(e.target.value))}
              className="w-full mb-2"
              style={{
                background: `linear-gradient(to right, #6d51e8 ${((tempVal - 0.1) / 0.9) * 100}%, rgba(255,255,255,0.06) 0%)`,
                height: 4, borderRadius: 100,
              }}
              id="temperature-slider"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>0.1 · Deterministic</span>
              <span>1.0 · Creative</span>
            </div>

            {/* Max tokens */}
            <div className="mt-5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                Max Output Tokens
              </label>
              <div className="relative">
                <input
                  type="number" min="100" max="2048" step="50"
                  defaultValue={config.maxTokens}
                  className="w-full input-dark px-3 py-2 text-[12px] font-mono"
                  style={{ borderRadius: 10 }}
                  id="max-tokens-input"
                />
              </div>
              <p className="text-[9px] text-slate-600 mt-1">WhatsApp optimal: 400–800 tokens</p>
            </div>
          </div>
        </div>

        {/* Feature toggles */}
        <div className="border-t pt-5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            Module Integrations
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(FEAT_LABELS).map(([key, { label, desc }]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-xl transition-all"
                style={{
                  background: features[key] ? 'rgba(109,81,232,0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${features[key] ? 'rgba(109,81,232,0.15)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <div>
                  <p className="text-[12px] font-bold text-slate-200">{label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                </div>
                <Toggle
                  id={`toggle-${key}`}
                  checked={features[key]}
                  onChange={(val) => setFeatures((prev) => ({ ...prev, [key]: val }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4 border-t pt-5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <button type="submit" className="btn-primary text-sm py-2.5 px-6" id="save-config-btn">
            <Check className="w-4 h-4" />
            Save Configuration
          </button>
          {saved && (
            <div className="flex items-center gap-2 text-emerald-400 text-[12px] font-bold animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              Config saved · Redis cache invalidated
            </div>
          )}
        </div>
      </form>
    </SectionPanel>
  );
}

/* ============================================================
   MAIN ADMIN PAGE
   ============================================================ */
export default function AdminPage() {
  const [selectedCollege, setSelectedCollege] = useState('lnmiit');
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#020408' }}>
        <div className="flex items-center gap-3 text-slate-400">
          <div
            className="w-5 h-5 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: '#6d51e8' }}
          />
          <span className="text-sm font-semibold">Loading Jodein Console...</span>
        </div>
      </div>
    );
  }

  const college = COLLEGES[selectedCollege];
  const { metrics, chartData } = college;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'ai', label: 'AI Config', icon: Sparkles },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'api', label: 'API Playground', icon: Terminal },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#020408' }}>
      {/* Ambient bg */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            top: '-10%', left: '-5%',
            background: 'radial-gradient(circle, rgba(109,81,232,0.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            bottom: '20%', right: '5%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.008) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.008) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── TOP HEADER ── */}
      <header
        className="relative z-40 sticky top-0 px-6 py-3.5"
        style={{ background: 'rgba(2,4,8,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6d51e8, #10b981)', boxShadow: '0 4px 12px rgba(109,81,232,0.35)' }}
              aria-label="Back to landing page"
            >
              <MessageSquare className="w-4.5 h-4.5 text-white" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[16px] text-white tracking-tight">Jodein Console</span>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(109,81,232,0.12)', color: '#a99bff', border: '1px solid rgba(109,81,232,0.2)' }}
                >
                  v1.1
                </span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Multi-Tenant Bot Control Room</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live status */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}
            >
              <span className="dot-live" />
              <span className="text-emerald-400">All systems nominal</span>
            </div>

            {/* College selector */}
            <div className="relative">
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                id="college-selector"
                className="appearance-none pl-3 pr-9 py-2 rounded-xl text-[12px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f1f5f9',
                }}
              >
                <option value="lnmiit">🎓 LNMIIT Jaipur</option>
                <option value="poornima">🏫 Poornima College</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* User avatar */}
            <div className="flex items-center gap-2.5 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white"
                style={{ background: 'linear-gradient(135deg, #6d51e8, #10b981)' }}
              >
                JD
              </div>
              <div className="hidden lg:block">
                <p className="text-[11px] font-bold text-slate-200">Admin Staff</p>
                <p className="text-[9px] text-emerald-400 font-semibold">Authenticated</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── TAB NAV ── */}
      <div
        className="relative z-30 sticky top-[57px] px-6 py-0"
        style={{ background: 'rgba(2,4,8,0.75)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                id={`tab-${tab.id}`}
                className="flex items-center gap-2 px-4 py-3.5 text-[12px] font-semibold transition-all relative"
                style={{
                  color: active ? '#fff' : '#64748b',
                  borderBottom: active ? '2px solid #6d51e8' : '2px solid transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && (
          <>
            {/* College banner */}
            <div
              className="rounded-2xl px-6 py-5 flex items-center justify-between"
              style={{
                background: `linear-gradient(135deg, ${college.color}12 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${college.color}25`,
              }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Active Tenant</p>
                <h2 className="text-lg font-extrabold text-white">{college.name}</h2>
                <p className="text-xs text-slate-400">{college.city} · ADIP v1 · {college.model}</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="px-4 py-2 rounded-xl text-xs font-bold"
                  style={{ background: `${college.color}15`, color: college.color, border: `1px solid ${college.color}30` }}
                >
                  {metrics.pendingQueue} queued
                </div>
                <div className="badge badge-success">
                  <span className="dot-live mr-1" />
                  Bot Live
                </div>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard icon={Users} label="Active Students" value={metrics.activeStudents.toLocaleString()} sub="Total enrolled" color="indigo" trend="+12%" trendUp={true} />
              <KpiCard icon={TrendingUp} label="AI Deflection" value={`${metrics.deflectionRate}%`} sub="Target: >75%" color="emerald" trend="+3.4%" trendUp={true} />
              <KpiCard icon={Clock} label="Response Time" value={`${metrics.avgResponseTime}s`} sub="Gemini Flash median" color="amber" trend="-0.1s" trendUp={true} />
              <KpiCard icon={MessageSquare} label="Messages Handled" value={metrics.messagesHandled.toLocaleString()} sub="Lifetime total" color="rose" />
              <KpiCard icon={Zap} label="New Today" value={metrics.newToday} sub="New activations" color="cyan" trend="+8" trendUp={true} />
              <KpiCard icon={Server} label="Queue Pending" value={metrics.pendingQueue} sub="BullMQ jobs" color="indigo" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Area chart */}
              <SectionPanel className="lg:col-span-8">
                <PanelHeader
                  icon={Activity}
                  iconColor="#6d51e8"
                  title="Message Volume & AI Deflections"
                  subtitle="Queries resolved without staff intervention — last 7 days"
                  badge="7-Day View"
                />
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6d51e8" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#6d51e8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gDeflected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="day" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top" height={30} iconType="circle"
                        wrapperStyle={{ fontSize: 10, color: '#64748b', paddingBottom: 8 }}
                      />
                      <Area name="Total Incoming" type="monotone" dataKey="total" stroke="#6d51e8" strokeWidth={2} fill="url(#gTotal)" dot={false} />
                      <Area name="AI Deflected" type="monotone" dataKey="deflected" stroke="#10b981" strokeWidth={2} fill="url(#gDeflected)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionPanel>

              {/* Bar chart */}
              <SectionPanel className="lg:col-span-4">
                <PanelHeader
                  icon={Clock}
                  iconColor="#f59e0b"
                  title="AI Latency"
                  subtitle="Gemini Flash response time (seconds)"
                  badge="Live"
                />
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="gLatency" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="day" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} unit="s" />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={1.5} stroke="rgba(244,63,94,0.3)" strokeDasharray="3 3" label={{ value: 'SLA', fill: '#f87171', fontSize: 9 }} />
                      <Bar name="Latency (s)" dataKey="responseTime" fill="url(#gLatency)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionPanel>
            </div>

            {/* Cost chart + Security summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <SectionPanel className="lg:col-span-5">
                <PanelHeader
                  icon={Zap}
                  iconColor="#22d3ee"
                  title="Daily API Cost (₹)"
                  subtitle="Gemini Flash token billing estimate"
                />
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="day" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#334155" fontSize={10} tickLine={false} axisLine={false} unit="₹" />
                      <Tooltip content={<CustomTooltip />} />
                      <Line name="Cost (₹)" type="monotone" dataKey="cost" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3, fill: '#22d3ee' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionPanel>

              <SectionPanel className="lg:col-span-7">
                <PanelHeader icon={Lock} iconColor="#34d399" title="Security & Compliance" subtitle="Cybersec hardening status" badge="All Clear" badgeColor="success" />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'HMAC-SHA256 Verification', ok: true, desc: 'timingSafeEqual on all webhooks' },
                    { label: 'NoSQL Injection Guard', ok: true, desc: '$ and . stripped from all inputs' },
                    { label: 'Rate Limiting (Upstash)', ok: true, desc: '20 req/hr per student · sliding window' },
                    { label: 'Redis Deduplication', ok: true, desc: 'Message ID TTL 10s prevents replays' },
                    { label: 'Sentry Error Telemetry', ok: true, desc: 'PII scrubbed before transport' },
                    { label: 'BullMQ Dead Letter Queue', ok: true, desc: 'Failed jobs retained for review' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)' }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-slate-200">{item.label}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionPanel>
            </div>
          </>
        )}

        {/* ═══ AI CONFIG TAB ═══ */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <AiConfigPanel config={college} onChange={() => {}} />
            </div>
            <div className="lg:col-span-4 space-y-5">
              {/* Clerk auth stub */}
              <SectionPanel>
                <PanelHeader icon={Shield} iconColor="#a99bff" title="Auth Gateway" subtitle="Clerk identity configuration" />
                <div
                  className="p-3 rounded-xl mb-4 text-[10px] text-slate-400 leading-relaxed"
                  style={{ background: 'rgba(109,81,232,0.06)', border: '1px solid rgba(109,81,232,0.12)' }}
                >
                  <Info className="w-3.5 h-3.5 text-indigo-400 inline mr-2" />
                  Clerk provides secure OAuth for HOD and staff roles. Fill environment variables to enable.
                </div>
                <div className="space-y-3">
                  {['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'].map((k) => (
                    <div key={k}>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-600 block mb-1">{k}</label>
                      <div className="relative">
                        <Key className="w-3 h-3 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={k.includes('SECRET') ? 'password' : 'text'}
                          className="input-dark w-full pl-8 pr-3 py-2 text-[10px] font-mono"
                          placeholder={`Enter ${k.toLowerCase().replace(/_/g, '-')}...`}
                          style={{ borderRadius: 10 }}
                        />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-600 block mb-1">Authorized Domains</label>
                    <select className="input-dark w-full px-3 py-2 text-[11px]" style={{ borderRadius: 10 }}>
                      <option>*.edu.in — HODs Only</option>
                      <option>Staff & Faculty</option>
                      <option>All Domain Registrars</option>
                    </select>
                  </div>
                </div>
              </SectionPanel>

              {/* Webhook config */}
              <SectionPanel>
                <PanelHeader icon={Network} iconColor="#22d3ee" title="Webhook Config" subtitle="Meta Cloud API integration" />
                <div className="space-y-3 text-[11px]">
                  {[
                    { label: 'Verify Token', value: 'jodein_verify_••••••' },
                    { label: 'App Secret', value: 'EAAYEzd••••••••••••••' },
                    { label: 'Phone ID', value: '12340956789••••' },
                    { label: 'API Version', value: 'v19.0' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-slate-500">{label}</span>
                      <code className="text-slate-300 font-mono text-[10px]">{value}</code>
                    </div>
                  ))}
                  <div
                    className="mt-2 p-2.5 rounded-lg text-[9px] text-amber-400 flex gap-2 items-start"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Expose via ngrok or deploy to Railway to complete webhook handshake.
                  </div>
                </div>
              </SectionPanel>
            </div>
          </div>
        )}

        {/* ═══ STUDENTS TAB ═══ */}
        {activeTab === 'students' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6">
              <CsvOnboarder collegeId={selectedCollege} />
            </div>
            <div className="lg:col-span-6">
              <SectionPanel>
                <PanelHeader
                  icon={Users}
                  iconColor="#6d51e8"
                  title="Student Registry"
                  subtitle="Active student roster for this tenant"
                  badge={`${metrics.activeStudents.toLocaleString()} total`}
                />
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, roll number..."
                    className="input-dark w-full pl-9 pr-4 py-2.5 text-[12px]"
                    style={{ borderRadius: 12 }}
                    id="student-search"
                  />
                </div>
                {/* Sample rows */}
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {Array.from({ length: 12 }, (_, i) => ({
                    id: `2022CSE${String(i + 1).padStart(3, '0')}`,
                    name: ['Rahul Sharma', 'Priya Singh', 'Amit Kumar', 'Sneha Patel', 'Vikram Yadav', 'Pooja Gupta', 'Rohan Verma', 'Ananya Joshi', 'Karan Mehta', 'Divya Soni', 'Arjun Nair', 'Kavya Reddy'][i],
                    branch: ['CSE', 'CSE', 'ECE', 'CSE', 'ECE', 'ME', 'CSE', 'CSE', 'CE', 'ECE', 'ME', 'CSE'][i],
                    status: i < 9 ? 'Active' : 'Pending',
                    att: Math.floor(65 + Math.random() * 30),
                  })).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-xl transition-all"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: `hsl(${(s.id.charCodeAt(7) * 47) % 360}, 60%, 40%)` }}
                        >
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-slate-200">{s.name}</p>
                          <p className="text-[10px] text-slate-500">{s.id} · {s.branch}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-[11px] font-bold" style={{ color: s.att < 75 ? '#fb7185' : '#34d399' }}>{s.att}%</p>
                          <p className="text-[9px] text-slate-600">attendance</p>
                        </div>
                        <span
                          className="badge text-[9px]"
                          style={s.status === 'Active'
                            ? { background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.15)' }
                            : { background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.15)' }
                          }
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionPanel>
            </div>
          </div>
        )}

        {/* ═══ API PLAYGROUND TAB ═══ */}
        {activeTab === 'api' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AdipPlayground collegeId={selectedCollege} />
            <SectionPanel>
              <PanelHeader
                icon={Code2}
                iconColor="#22d3ee"
                title="ADIP SDK Quickstart"
                subtitle="Node.js integration in 3 lines"
              />
              <div className="space-y-5">
                {[
                  {
                    title: 'Install', lang: 'bash',
                    code: `npm install @jodein/adip-sdk`,
                    color: '#fbbf24',
                  },
                  {
                    title: 'Initialize', lang: 'js',
                    code: `import { ADIP } from '@jodein/adip-sdk';
const client = new ADIP({
  collegeId: 'lnmiit',
  apiKey: process.env.ADIP_KEY,
  baseUrl: 'https://api.jodein.in',
});`,
                    color: '#a99bff',
                  },
                  {
                    title: 'Query', lang: 'js',
                    code: `const attendance = await client
  .students('2022CSE001')
  .attendance({ semester: 'VI' });

console.log(attendance.overall); // 75.5`,
                    color: '#34d399',
                  },
                ].map(({ title, lang, code, color }) => (
                  <div key={title}>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color }}
                      >
                        {title}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(code)}
                        className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        <Copy className="w-2.5 h-2.5" /> Copy
                      </button>
                    </div>
                    <div className="terminal rounded-xl p-3 overflow-x-auto">
                      <pre className="text-[10px] leading-relaxed" style={{ color: '#94a3b8' }}>{code}</pre>
                    </div>
                  </div>
                ))}

                {/* OpenAPI badge */}
                <div
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-300">OpenAPI 3.0 Spec available</span>
                  </div>
                  <a
                    href="#"
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Download <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </SectionPanel>
          </div>
        )}

      </main>

      {/* ── FOOTER ── */}
      <footer
        className="relative z-10 px-6 py-5 mt-8"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(2,4,8,0.6)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-slate-600">
          <span>Jodein Console © {new Date().getFullYear()} · ADIP v1 · MIT License</span>
          <div className="flex gap-6">
            {['Webhook Status', 'MongoDB Health', 'Redis Metrics', 'System Logs'].map((l) => (
              <a key={l} href="#" className="hover:text-slate-400 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
