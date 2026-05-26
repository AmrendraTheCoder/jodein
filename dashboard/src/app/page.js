'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Sparkles, ShieldCheck, TrendingUp, Users,
  ArrowRight, Database, Terminal, Zap, Globe, Clock, Bot,
  ChevronRight, Star, Github, ExternalLink, Check, Play,
  BarChart2, Shield, Cpu, Network, BookOpen, BellRing,
  GraduationCap, Building2, Layers, Code2, Activity,
} from 'lucide-react';

/* ============================================================
   DATA
   ============================================================ */
const FEATURES = [
  {
    icon: Users,
    color: 'brand',
    title: 'Bulk Student Onboarding',
    desc: 'Drag-and-drop CSV registration. Parse E.164 phone numbers instantly and dispatch personalized WhatsApp activation messages via BullMQ.',
    tag: 'Automation',
  },
  {
    icon: Sparkles,
    color: 'violet',
    title: 'Gemini Flash Orchestrator',
    desc: 'Dynamic system prompts per college tenant. Inject real student metadata, attendance, and syllabus context into each AI response in milliseconds.',
    tag: 'AI Engine',
  },
  {
    icon: BarChart2,
    color: 'emerald',
    title: 'Deflection Analytics',
    desc: 'Track query deflection rates, response latency, and student engagement across every campus tenant in real time.',
    tag: 'Analytics',
  },
  {
    icon: Shield,
    color: 'amber',
    title: 'HMAC-Hardened Webhooks',
    desc: 'Timing-safe SHA-256 signature verification prevents replay attacks. NoSQL injection stripping on every incoming payload.',
    tag: 'Security',
  },
  {
    icon: Network,
    color: 'cyan',
    title: 'ADIP Standard API',
    desc: 'Machine-readable academic data rails. Expose structured student, course, and attendance schemas for any ERP to connect.',
    tag: 'Protocol',
  },
  {
    icon: Database,
    color: 'rose',
    title: 'Pinecone RAG Engine',
    desc: 'Index syllabi and PYQs as vector embeddings. Semantic retrieval at query time reduces Gemini token costs by 10x.',
    tag: 'RAG',
  },
];

const STATS = [
  { value: '84%', label: 'Query Deflection', sub: 'Avg. across campuses' },
  { value: '<1.2s', label: 'AI Response Time', sub: 'Gemini Flash median' },
  { value: '10k+', label: 'Active Students', sub: 'Across tenants' },
  { value: '99.9%', label: 'Uptime SLA', sub: 'Railway + Redis' },
];

const FLOW_STEPS = [
  { step: '01', label: 'WhatsApp API', desc: 'Meta Cloud Webhook', color: '#8b73f5', endpoint: 'POST /webhook/:collegeId' },
  { step: '02', label: 'HMAC Verifier', desc: 'timingSafeEqual guard', color: '#22d3ee', endpoint: 'SHA-256 + rawBody' },
  { step: '03', label: 'BullMQ Queue', desc: 'Async ingest worker', color: '#34d399', endpoint: 'Redis-backed DLQ' },
  { step: '04', label: 'Gemini Flash', desc: 'Personalized response', color: '#fbbf24', endpoint: 'gemini-1.5-flash-latest' },
  { step: '05', label: 'Meta Send API', desc: 'Deliver to student device', color: '#f472b6', endpoint: 'messages.send()' },
];

const SIM_FLOWS = [
  {
    trigger: ['2022CSE001', 'cse', 'CSE'],
    response: `✅ Welcome, Rahul Sharma!\n\nLNMIIT Campus Bot activated.\n\nAap mujhse poochh sakte hain:\n• syllabus — semester subjects\n• timetable — class schedule\n• attendance — your status\n• exams — upcoming dates\n\nKya help chahiye? 🎓`,
  },
  {
    trigger: ['attendance', 'ATTENDANCE'],
    response: `📊 Attendance Summary — Rahul Sharma\n\n• CS-301 DBMS: 82% ✅\n• CS-302 OS: 77% ✅\n• CS-303 ADA: 68% ⚠️ Short of 75%\n\nOverall: 75.6%\n3 more ADA classes → clear ho jayega!`,
  },
  {
    trigger: ['syllabus', 'SYLLABUS', 'subject'],
    response: `📚 DBMS (CS-301) — Unit Breakdown\n\nUnit 1: ER Diagrams & Relational Model\nUnit 2: SQL & Normalization (1NF–BCNF)\nUnit 3: Transactions & Concurrency\nUnit 4: Indexing & Hashing\n\nPDF: lnmiit.ac.in/syllabus/cs-301.pdf 📄`,
  },
  {
    trigger: ['exams', 'exam'],
    response: `📅 Upcoming Exam Schedule\n\nCS-301 DBMS → June 3, 2:00 PM\nCS-302 OS → June 5, 10:00 AM\nCS-303 ADA → June 7, 2:00 PM\n\nHall Ticket: moodle.lnmiit.ac.in 🎫`,
  },
];

/* ============================================================
   SUBCOMPONENTS
   ============================================================ */

/** Ambient orb background */
function AmbientOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          top: '-20%', left: '-15%',
          background: 'radial-gradient(circle, rgba(109,81,232,0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          bottom: '10%', right: '-10%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          top: '40%', right: '20%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}

/** WhatsApp simulator */
function PhoneSimulator() {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: `👋 Hi there!\n\nAapka campus WhatsApp bot ready hai.\n\nLNM Institute of IT ke liye:\n\n🎓 Student ID type karein activate karne ke liye\n📱 Example: 2022CSE001\n\nOr try: syllabus, attendance, exams`,
      time: now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  function now() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function getResponse(text) {
    const t = text.toLowerCase();
    for (const flow of SIM_FLOWS) {
      if (flow.trigger.some((k) => t.includes(k.toLowerCase()))) return flow.response;
    }
    return `Aapke query ke liye ready hun!\n\nTry karo: syllabus, attendance, timetable, exams\nYa apna Student ID bhejo activate karne ke liye.`;
  }

  const send = useCallback((e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text, time: now() }]);
    setTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: 'bot', text: getResponse(text), time: now() }]);
      setTyping(false);
    }, 1100 + Math.random() * 400);
  }, [input]);

  const quickSend = useCallback((text) => {
    setMessages((prev) => [...prev, { sender: 'user', text, time: now() }]);
    setTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: 'bot', text: getResponse(text), time: now() }]);
      setTyping(false);
    }, 1100 + Math.random() * 400);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  return (
    <div className="relative">
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-[44px] animate-glow-pulse pointer-events-none"
        style={{ boxShadow: '0 0 0 1px rgba(109,81,232,0.2), 0 0 60px rgba(109,81,232,0.15)' }}
        aria-hidden="true"
      />

      {/* Phone frame */}
      <div
        className="relative w-[340px] h-[660px] rounded-[44px] flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0f1520, #0a0f1a)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 z-20 flex items-center justify-center"
          style={{ background: '#0a0f1a', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
          <div className="w-14 h-1 rounded-full" style={{ background: '#1a2540' }} />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-9 pb-2 text-[10px] text-slate-400 font-semibold">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 items-end h-3">
              {[2, 3, 4, 3].map((h, i) => (
                <div key={i} className="w-1 rounded-sm bg-slate-400" style={{ height: `${h * 3}px` }} />
              ))}
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M1.5 8.5C5.36 4.93 10.45 3 15 3s9.64 1.93 13.5 5.5L27 10.5A17.5 17.5 0 0 0 15 6 17.5 17.5 0 0 0 3 10.5L1.5 8.5z" opacity=".5"/></svg>
            <div className="flex items-center gap-0.5">
              <div className="w-5 h-2.5 rounded-sm border border-slate-400 flex items-center px-0.5">
                <div className="h-1.5 w-3 rounded-sm bg-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(6,9,15,0.4)' }}>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #6d51e8, #10b981)' }}
          >J</div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white leading-tight">Jodein Assistant</p>
            <div className="flex items-center gap-1.5">
              <span className="dot-live" />
              <span className="text-[10px] text-slate-400">online · encrypted</span>
            </div>
          </div>
          <div className="flex gap-3 text-slate-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        {/* Chat body */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
          style={{
            background: 'radial-gradient(ellipse at bottom, rgba(109,81,232,0.04) 0%, transparent 60%), #06090f',
          }}
        >
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[82%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed"
                style={
                  msg.sender === 'user'
                    ? {
                        background: 'linear-gradient(135deg, #6d51e8, #5538d4)',
                        color: 'white',
                        borderBottomRightRadius: 4,
                        boxShadow: '0 2px 8px rgba(109,81,232,0.3)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#cbd5e1',
                        borderBottomLeftRadius: 4,
                      }
                }
              >
                <span className="block whitespace-pre-wrap leading-relaxed">{msg.text}</span>
                <div className={`text-[9px] mt-1 ${msg.sender === 'user' ? 'text-indigo-200 text-right' : 'text-slate-600'}`}>
                  {msg.time} {msg.sender === 'user' && '✓✓'}
                </div>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start">
              <div
                className="px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderBottomLeftRadius: 4 }}
              >
                <div className="flex gap-1 items-center h-3">
                  {[0, 150, 300].map((d, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-slate-500"
                      style={{ animation: `bounce-dots 1.2s ease-in-out infinite ${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div className="px-3 py-2 flex gap-2 overflow-x-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {['2022CSE001', 'attendance', 'syllabus', 'exams'].map((q) => (
            <button
              key={q}
              onClick={() => quickSend(q)}
              disabled={typing}
              className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all disabled:opacity-50"
              style={{ background: 'rgba(109,81,232,0.12)', color: '#a99bff', border: '1px solid rgba(109,81,232,0.2)' }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={send}
          className="flex items-center gap-2 px-3 pb-5 pt-2"
          style={{ background: 'rgba(6,9,15,0.6)' }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message..."
            className="flex-1 input-dark px-3.5 py-2 text-[12px]"
            style={{ borderRadius: 20 }}
            id="sim-input"
          />
          <button
            type="submit"
            disabled={typing}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
            style={{ background: 'linear-gradient(135deg, #6d51e8, #5538d4)', boxShadow: '0 4px 12px rgba(109,81,232,0.4)' }}
            aria-label="Send message"
          >
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Feature card */
function FeatureCard({ icon: Icon, color, title, desc, tag, index }) {
  const colorMap = {
    brand: { bg: 'rgba(109,81,232,0.1)', border: 'rgba(109,81,232,0.2)', text: '#a99bff', glow: 'rgba(109,81,232,0.15)' },
    violet: { bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)', text: '#c4b5fd', glow: 'rgba(167,139,250,0.15)' },
    emerald: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.18)', text: '#34d399', glow: 'rgba(16,185,129,0.12)' },
    amber: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', text: '#fbbf24', glow: 'rgba(245,158,11,0.12)' },
    cyan: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.18)', text: '#22d3ee', glow: 'rgba(6,182,212,0.12)' },
    rose: { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.18)', text: '#fb7185', glow: 'rgba(244,63,94,0.12)' },
  };
  const c = colorMap[color];

  return (
    <div
      className="group relative p-6 rounded-2xl transition-all duration-300 cursor-default"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        animationDelay: `${index * 100}ms`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = c.border;
        e.currentTarget.style.boxShadow = `0 8px 40px rgba(0,0,0,0.4), 0 0 30px ${c.glow}`;
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}
      >
        <Icon className="w-5 h-5" style={{ color: c.text }} />
      </div>

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-bold text-white">{title}</h3>
        <span className="badge text-[9px] px-2 py-0.5" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
          {tag}
        </span>
      </div>
      <p className="text-[13px] text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeFlowStep, setActiveFlowStep] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveFlowStep((p) => (p + 1) % FLOW_STEPS.length), 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative min-h-screen text-slate-100 overflow-x-hidden">
      <AmbientOrbs />

      {/* ── NAV ── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'py-3' : 'py-5'
        }`}
        style={{
          background: scrolled ? 'rgba(2,4,8,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #6d51e8, #10b981)',
                boxShadow: '0 4px 16px rgba(109,81,232,0.4)',
              }}
            >
              <MessageSquare className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <span className="text-[17px] font-extrabold tracking-tight text-white">Jodein</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block leading-none mt-0.5">Campus Intelligence</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            {['Features', 'Demo', 'Architecture', 'Open Source'].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase().replace(' ', '-')}`}
                className="hover:text-white transition-colors duration-200"
              >
                {l}
              </a>
            ))}
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/AmrendraTheCoder/jodein"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <Link
              href="/admin"
              id="nav-admin-cta"
              className="btn-primary text-sm py-2 px-5"
            >
              Admin Portal
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: Copy */}
          <div className="animate-slide-up">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-7 text-[11px] font-bold"
              style={{
                background: 'rgba(109,81,232,0.1)',
                border: '1px solid rgba(109,81,232,0.25)',
                color: '#a99bff',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              ADIP Standard · Gemini Flash · Open Source
            </div>

            {/* H1 */}
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
              <span className="text-white">Campus AI on</span>
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #a99bff 40%, #6d51e8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                WhatsApp
              </span>
              <span className="text-white"> — </span>
              <br />
              <span className="text-white">Instantly.</span>
            </h1>

            <p className="text-lg text-slate-400 leading-relaxed max-w-lg mb-9">
              Jodein connects 10,000+ students to real-time syllabus, attendance, and exam data via WhatsApp — no app downloads. Powered by <strong className="text-slate-200">Gemini Flash</strong> and the open <strong className="text-slate-200">ADIP Protocol</strong>.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap gap-4 mb-12">
              <Link href="/admin" id="hero-primary-cta" className="btn-primary">
                Configure Bot
                <ArrowRight className="w-4.5 h-4.5" />
              </Link>
              <a href="#demo" className="btn-secondary">
                <Play className="w-4 h-4" />
                Live Demo
              </a>
            </div>

            {/* Social proof row */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex -space-x-2">
                {['LN', 'PC', 'DT', 'VV'].map((abbr, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-[#020408]"
                    style={{ background: ['#6d51e8', '#10b981', '#06b6d4', '#f59e0b'][i] }}
                  >
                    {abbr}
                  </div>
                ))}
              </div>
              <span>4 colleges live · <span className="text-emerald-400 font-semibold">10,000+ students</span> served</span>
            </div>
          </div>

          {/* Right: Phone Simulator */}
          <div id="demo" className="flex justify-center lg:justify-end animate-fade-in">
            <PhoneSimulator />
          </div>
        </div>

        {/* Stats row */}
        <div className="max-w-7xl mx-auto px-6 mt-20">
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl"
            style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
          >
            {STATS.map(({ value, label, sub }, i) => (
              <div
                key={i}
                className="px-8 py-7 text-center hover:bg-white/[0.02] transition-colors"
                style={{ background: 'rgba(255,255,255,0.01)' }}
              >
                <div
                  className="text-3xl font-extrabold mb-1"
                  style={{
                    background: 'linear-gradient(135deg, #fff, #a99bff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {value}
                </div>
                <div className="text-[13px] font-semibold text-white mb-0.5">{label}</div>
                <div className="text-[11px] text-slate-500">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="relative z-10 py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="badge badge-brand mx-auto mb-5">Platform Capabilities</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">
              Enterprise-grade campus stack
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Every feature built for production: hardened security, multi-tenant isolation, and cost-optimal AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} {...f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE / FLOW ── */}
      <section id="architecture" className="relative z-10 py-28">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(109,81,232,0.06) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left copy */}
            <div>
              <div className="badge badge-brand mb-5">Architecture</div>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-white">
                Sub-second async<br />message pipeline
              </h2>
              <p className="text-slate-400 text-base leading-relaxed mb-8">
                Every WhatsApp message enters a hardened BullMQ queue, verified with HMAC-SHA256, enriched by MongoDB student profiles, and answered by Gemini Flash — all in under 1.2 seconds.
              </p>

              <div className="space-y-4">
                {[
                  { icon: ShieldCheck, color: '#34d399', title: 'Zero-trust webhook verification', desc: 'Timing-safe HMAC prevents signature spoofing' },
                  { icon: Database, color: '#8b73f5', title: 'Multi-tenant data isolation', desc: 'collegeId partitioning on every MongoDB query' },
                  { icon: Zap, color: '#fbbf24', title: 'BullMQ Dead Letter Queue', desc: 'Failed jobs automatically retried with exponential backoff' },
                ].map(({ icon: Icon, color, title, desc }, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{title}</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: animated flow diagram */}
            <div id="open-source">
              <div
                className="rounded-3xl p-6"
                style={{
                  background: 'rgba(6,9,15,0.8)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
              >
                {/* Terminal header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="terminal-dot" style={{ background: '#f87171' }} />
                    <div className="terminal-dot" style={{ background: '#fbbf24' }} />
                    <div className="terminal-dot" style={{ background: '#34d399' }} />
                    <span className="text-xs font-mono text-slate-500 ml-2">jodein-pipeline.flow</span>
                  </div>
                  <span className="badge badge-success text-[9px]">
                    <span className="dot-live mr-1" /> Live
                  </span>
                </div>

                {/* Flow steps */}
                <div className="space-y-3">
                  {FLOW_STEPS.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-3.5 rounded-xl transition-all duration-500"
                      style={{
                        background: i === activeFlowStep ? `${step.color}0d` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${i === activeFlowStep ? `${step.color}30` : 'rgba(255,255,255,0.04)'}`,
                        boxShadow: i === activeFlowStep ? `0 0 20px ${step.color}15` : 'none',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold shrink-0 transition-all"
                        style={{
                          background: i === activeFlowStep ? step.color : 'rgba(255,255,255,0.04)',
                          color: i === activeFlowStep ? '#020408' : '#475569',
                        }}
                      >
                        {step.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-bold transition-colors"
                          style={{ color: i === activeFlowStep ? step.color : '#94a3b8' }}
                        >
                          {step.label}
                        </p>
                        <p className="text-[10px] text-slate-600">{step.desc}</p>
                      </div>
                      <code
                        className="text-[9px] font-mono shrink-0 hidden sm:block"
                        style={{ color: i === activeFlowStep ? step.color : '#334155', opacity: i === activeFlowStep ? 1 : 0.6 }}
                      >
                        {step.endpoint}
                      </code>
                    </div>
                  ))}
                </div>

                {/* Throughput indicator */}
                <div
                  className="mt-5 flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
                >
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                    <Activity className="w-3.5 h-3.5" />
                    Throughput
                  </div>
                  <div className="flex gap-1.5 items-end h-5">
                    {[60, 80, 55, 90, 70, 85, 95, 75, 88].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-t"
                        style={{ height: `${h * 0.2}px`, background: 'linear-gradient(to top, #059669, #34d399)', opacity: 0.8 }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">~840 msg/min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="relative z-10 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div
            className="relative rounded-3xl p-12 text-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(109,81,232,0.15) 0%, rgba(16,185,129,0.08) 100%)',
              border: '1px solid rgba(109,81,232,0.25)',
            }}
          >
            {/* Glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(109,81,232,0.2) 0%, transparent 60%)' }}
              aria-hidden="true"
            />

            <div className="relative">
              <div className="badge badge-brand mx-auto mb-5">Free & Open Source</div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                Ready to deploy?
              </h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto mb-9">
                Self-host in minutes on Railway. Full source code on GitHub. ADIP standard fully documented.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/admin" id="bottom-cta-admin" className="btn-primary">
                  Open Admin Panel
                  <ArrowRight className="w-4.5 h-4.5" />
                </Link>
                <a
                  href="https://github.com/AmrendraTheCoder/jodein"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <Github className="w-4 h-4" />
                  View Source
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t py-12" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6d51e8, #10b981)' }}
            >
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-400">Jodein</span>
          </div>
          <p className="text-xs text-slate-600 text-center">
            © {new Date().getFullYear()} Jodein — ADIP Campus Intelligence. MIT License. Built in India 🇮🇳
          </p>
          <div className="flex gap-6 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Terms</a>
            <a href="https://github.com/AmrendraTheCoder/jodein" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors flex items-center gap-1">
              <Github className="w-3 h-3" /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
