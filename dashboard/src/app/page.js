'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  MessageSquare, 
  Sparkles, 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  ChevronRight, 
  ArrowRight,
  Database,
  Terminal,
  Zap,
  Globe,
  Settings,
  Clock
} from 'lucide-react';

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [simMessages, setSimMessages] = useState([
    { sender: 'system', text: 'Hi Rahul! 👋\n\nAapka college ka WhatsApp assistant ready hai.\n\n*LNM Institute of IT* ka campus bot aapko help karega:\n• Syllabus aur timetable queries\n• Exam schedule\n• Attendance status\n• Campus information\n\nActivate karne ke liye, apna *Student ID* reply karein:\nExample: `2022CSE001`', delay: 1000 }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Phone simulation replies
  const handleSimSend = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userText = userInput.trim();
    setSimMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setUserInput('');
    setIsTyping(true);

    setTimeout(() => {
      let botResponse = '';
      const cleanInput = userText.toUpperCase().replace(/\s+/g, '');
      
      if (cleanInput.includes('2022CSE001') || cleanInput.includes('CSE')) {
        botResponse = '✅ Welcome, Rahul Sharma!\n\nAapka account activate ho gaya.\n\nAap mujhse poochh sakte hain:\n• *syllabus* — semester ke subjects\n• *timetable* — class schedule\n• *attendance* — aapki attendance\n• *exams* — upcoming exam dates\n\nKya help chahiye?';
      } else if (cleanInput.includes('ATTENDANCE')) {
        botResponse = '📊 *Attendance Summary for Rahul Sharma*:\n\n• CS-301 (DBMS): *82%* ✅\n• CS-302 (OS): *77%* ✅\n• CS-303 (ADA): *68%* ⚠️ (Short of 75%)\n\nOverall Attendance: *75.6%*\n_Tip: 3 more ADA classes attend karne par clear ho jayega._';
      } else if (cleanInput.includes('SYLLABUS') || cleanInput.includes('SUBJECT')) {
        botResponse = '📚 *DBMS (CS-301) Syllabus*:\n\nUnit 1: ER Diagrams & Relational Model\nUnit 2: SQL Queries & Normalization (1NF to BCNF)\nUnit 3: Transactions & Concurrency Control\nUnit 4: Indexing & Hashing\n\n_Syllabus PDF download karne ke liye link par click karein: https://lnmiit.ac.in/syllabus/cs-301.pdf_';
      } else {
        botResponse = `Aapke query ke liye main ready hun! Lekin direct academic details ke liye, please standard words use karein: *syllabus*, *timetable*, *attendance*, or *exams*.`;
      }

      setSimMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <MessageSquare className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Jodein</span>
              <span className="text-xs block text-slate-500 font-semibold uppercase tracking-wider">Campus Intelligence</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-slate-100 transition-colors">Features</a>
            <a href="#demo" className="hover:text-slate-100 transition-colors">Interactive Demo</a>
            <a href="#architecture" className="hover:text-slate-100 transition-colors">Architecture</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link 
              href="/admin" 
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 text-sm font-semibold transition-all flex items-center gap-2"
            >
              HOD Login
            </Link>
            <Link 
              href="/admin" 
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-650 hover:to-indigo-750 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all flex items-center gap-2"
            >
              Admin Portal
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6 w-fit">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300">Next-Gen Campus Intelligence Platform</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Bring Your Campus Intelligence to <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">WhatsApp</span>
          </h1>
          <p className="text-lg text-slate-400 mb-8 max-w-xl leading-relaxed">
            Jodein connects students directly with academic records, timetables, and automated alerts on WhatsApp. Powered by high-speed generative AI, designed for instant queries and massive deflection rates.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link 
              href="/admin"
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-emerald-500 text-slate-950 font-bold hover:shadow-xl hover:shadow-indigo-500/10 transition-all flex items-center gap-3 text-base"
            >
              Configure Campus Bot
              <ArrowRight className="w-5 h-5 text-slate-950" />
            </Link>
            <a 
              href="#demo"
              className="px-8 py-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold transition-all flex items-center gap-2 text-base"
            >
              Watch Interactive Demo
            </a>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-8 border-t border-slate-900 mt-16 pt-8 max-w-lg">
            <div>
              <span className="text-3xl font-extrabold text-white block">84%</span>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mt-1">Deflection Rate</span>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-white block">&lt; 1.2s</span>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mt-1">AI Response Time</span>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-white block">10k+</span>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mt-1">Active Students</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Mobile Simulator */}
        <div id="demo" className="lg:col-span-5 flex justify-center">
          <div className="w-[360px] h-[640px] rounded-[40px] bg-slate-900 border-[8px] border-slate-800 shadow-2xl relative flex flex-col overflow-hidden">
            {/* Phone Speaker/Camera Notch */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-20 flex items-center justify-center">
              <div className="w-12 h-1 bg-slate-950 rounded-full" />
            </div>

            {/* WhatsApp Header */}
            <div className="bg-slate-900 border-b border-slate-850 px-4 pt-8 pb-3 flex items-center gap-3 relative z-10">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-bold text-slate-950 text-sm">
                J
              </div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">Jodein Assistant</h4>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-400">online</span>
                </div>
              </div>
            </div>

            {/* WhatsApp Chat Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-opacity-5">
              {simMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'user' 
                      ? 'bg-indigo-650 text-white ml-auto rounded-tr-none' 
                      : msg.sender === 'system' || msg.sender === 'bot'
                      ? 'bg-slate-850 text-slate-200 mr-auto rounded-tl-none border border-slate-800'
                      : 'bg-slate-900/60 text-slate-400 mx-auto text-center py-1.5 rounded-lg border border-slate-850'
                  }`}
                >
                  <pre className="font-sans whitespace-pre-wrap">{msg.text}</pre>
                </div>
              ))}
              {isTyping && (
                <div className="bg-slate-850 text-slate-400 mr-auto rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs border border-slate-800 w-fit flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            {/* WhatsApp Input Field */}
            <form onSubmit={handleSimSend} className="bg-slate-900 p-3 border-t border-slate-850 flex gap-2 items-center">
              <input 
                type="text" 
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type '2022CSE001' or 'attendance'..." 
                className="flex-1 bg-slate-950 border border-slate-800 rounded-full px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button 
                type="submit" 
                className="w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-slate-950 font-bold text-xs"
              >
                ➔
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 border-t border-slate-900 bg-slate-950/50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Everything You Need to Manage Student Support</h2>
            <p className="text-slate-400 leading-relaxed">
              Equip HODs, academic coordinators, and admins with a premium dashboard to upload CSV student registers, tweak AI prompts, and track deflection graphs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl glass-card">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Bulk Onboarding</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Drag-and-drop Student Registries via simple CSV. Automate personalized WhatsApp activation greetings instantly with robust E.164 phone parsing.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl glass-card">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Gemini-Flash Orchestrator</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Leverage advanced LLMs configured dynamically per college tenant. Personalize context windows and system prompts to direct AI persona.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl glass-card">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Deflection Analytics</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Track how many queries are successfully answered by the AI bot, minimizing workload on administrative office desks up to 84%.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="relative z-10 border-t border-slate-900 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">Enterprise Multi-Tenant Architecture</h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Jodein runs on a fast, asynchronous processing queue backed by BullMQ and Redis. Incoming WhatsApp webhooks are parsed, queued, and resolved by worker services in under 1 second.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1">
                    <Database className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Dynamic Configuration Cache</h4>
                    <p className="text-xs text-slate-400 mt-1">Mongoose dynamic configurations are cached in-memory with a 5-min TTL to sustain high message volumes without database stress.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Webhook Verification Handshake</h4>
                    <p className="text-xs text-slate-400 mt-1">Seamless Meta integration including raw body hash validation for reliable message delivery security.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              {/* Interactive Architecture Flow Graph */}
              <div className="rounded-3xl border border-slate-900 bg-slate-900/20 p-8 glass">
                <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-mono text-slate-400">jodein-system-flow.dot</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-400">
                    Active
                  </span>
                </div>

                <div className="space-y-6 font-mono text-xs text-slate-300">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-850">
                    <span className="text-indigo-400">1. WhatsApp API (Meta Cloud Webhook)</span>
                    <span className="text-slate-500">➔ POST /webhook/:collegeId</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 ml-4 border-l-2 border-l-indigo-500">
                    <span className="text-purple-400">2. Fastify Webhook Handler</span>
                    <span className="text-slate-500">➔ Queue job to BullMQ</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 ml-8 border-l-2 border-l-purple-500">
                    <span className="text-indigo-300">3. BullMQ Queue Worker</span>
                    <span className="text-slate-500">➔ Ingest & verify student phone</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 ml-12 border-l-2 border-l-pink-500">
                    <span className="text-emerald-400">4. Gemini Flash AI Engine</span>
                    <span className="text-slate-500">➔ Personalized prompt generation</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 ml-8 border-l-2 border-l-indigo-500">
                    <span className="text-slate-300">5. Meta Outgoing Cloud API</span>
                    <span className="text-slate-500">➔ Deliver reply to user device</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 relative z-10 text-slate-500 text-xs font-medium">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-slate-950" />
            </div>
            <span className="text-sm font-bold text-slate-400">Jodein Dashboard</span>
          </div>
          <div>
            © {new Date().getFullYear()} Jodein. Premium Open-Source Campus Assistant. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300">Terms of Service</a>
            <a href="#" className="hover:text-slate-300">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
