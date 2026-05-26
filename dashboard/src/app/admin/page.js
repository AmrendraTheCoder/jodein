'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  MessageSquare, 
  Sparkles, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Settings, 
  Key, 
  Shield, 
  RefreshCw,
  Sliders,
  ChevronDown,
  Power,
  Info,
  Check,
  AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';

// Mock Data per College
const COLLEGE_MOCK_DATA = {
  lnmiit: {
    name: 'LNM Institute of Information Technology',
    city: 'Jaipur',
    metrics: {
      activeStudents: 1420,
      deflectionRate: 84.6,
      avgResponseTime: 1.15,
      messagesHandled: 12480,
    },
    systemPrompt: `You are the campus assistant for LNM Institute of Information Technology (LNMIIT), Jaipur.
You help students with syllabus queries, timetables, exam schedules, attendance status, and general campus information.
Always respond in the same language the student uses — Hindi, English, or Hinglish.
If you don't have specific information, say: "Iske baare mein main confirm nahi kar sakta — please apne department se verify karein."
Keep answers concise — this is WhatsApp, not an email.`,
    model: 'gemini-1.5-flash-latest',
    temperature: 0.6,
    features: {
      webSearch: false,
      imageUnderstanding: true,
      voiceTranscription: false,
      ragEnabled: true,
    },
    chartData: [
      { day: 'Mon', total: 420, deflected: 360, responseTime: 1.1 },
      { day: 'Tue', total: 510, deflected: 440, responseTime: 1.2 },
      { day: 'Wed', total: 680, deflected: 590, responseTime: 1.15 },
      { day: 'Thu', total: 490, deflected: 410, responseTime: 1.25 },
      { day: 'Fri', total: 720, deflected: 620, responseTime: 1.05 },
      { day: 'Sat', total: 310, deflected: 260, responseTime: 0.95 },
      { day: 'Sun', total: 250, deflected: 215, responseTime: 0.9 },
    ]
  },
  poornima: {
    name: 'Poornima College of Engineering',
    city: 'Jaipur',
    metrics: {
      activeStudents: 850,
      deflectionRate: 76.2,
      avgResponseTime: 1.42,
      messagesHandled: 6820,
    },
    systemPrompt: `You are the campus assistant for Poornima College of Engineering, Jaipur.
Provide guidance on hostel timings, library details, college buses, exam departments, and syllabus.
Keep responses friendly and translate complex academic words into simple Hinglish.
Always ask students to verify major dates from their notice board.`,
    model: 'gemini-1.5-flash-latest',
    temperature: 0.7,
    features: {
      webSearch: true,
      imageUnderstanding: false,
      voiceTranscription: false,
      ragEnabled: false,
    },
    chartData: [
      { day: 'Mon', total: 210, deflected: 150, responseTime: 1.35 },
      { day: 'Tue', total: 290, deflected: 215, responseTime: 1.45 },
      { day: 'Wed', total: 320, deflected: 250, responseTime: 1.5 },
      { day: 'Thu', total: 270, deflected: 200, responseTime: 1.4 },
      { day: 'Fri', total: 390, deflected: 310, responseTime: 1.3 },
      { day: 'Sat', total: 180, deflected: 140, responseTime: 1.25 },
      { day: 'Sun', total: 120, deflected: 95, responseTime: 1.2 },
    ]
  }
};

export default function AdminPage() {
  const [selectedCollege, setSelectedCollege] = useState('lnmiit');
  const [collegeConfig, setCollegeConfig] = useState(COLLEGE_MOCK_DATA.lnmiit);
  const [promptInput, setPromptInput] = useState(COLLEGE_MOCK_DATA.lnmiit.systemPrompt);
  const [tempVal, setTempVal] = useState(COLLEGE_MOCK_DATA.lnmiit.temperature);
  const [selectedModel, setSelectedModel] = useState(COLLEGE_MOCK_DATA.lnmiit.model);
  const [features, setFeatures] = useState(COLLEGE_MOCK_DATA.lnmiit.features);
  
  // Uploader Simulator States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [onboardedStudents, setOnboardedStudents] = useState([]);
  const [csvFileSelected, setCsvFileSelected] = useState(null);

  // Clerk Auth Settings States
  const [clerkEnabled, setClerkEnabled] = useState(false);
  const [clerkPublishableKey, setClerkPublishableKey] = useState('pk_test_am9kZWluLWNsZXJrLXN0dWIta2V5LTQ4LmNsZXJrLmFjY291bnRzLmRldiQ');
  const [clerkSecretKey, setClerkSecretKey] = useState('sk_test_••••••••••••••••••••••••••••••••••••••••');
  const [secureLevel, setSecureLevel] = useState('hod_only');

  const [mounted, setMounted] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Avoid SSR Hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update panel configuration when switching colleges
  const handleCollegeChange = (id) => {
    setSelectedCollege(id);
    const config = COLLEGE_MOCK_DATA[id];
    setCollegeConfig(config);
    setPromptInput(config.systemPrompt);
    setTempVal(config.temperature);
    setSelectedModel(config.model);
    setFeatures(config.features);
  };

  // Simulate Config Save
  const handleSaveConfig = (e) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  // Simulate CSV File Upload
  const simulateCsvUpload = () => {
    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatus('Reading CSV File...');
    
    setTimeout(() => {
      setUploadProgress(40);
      setUploadStatus('Parsing E.164 phone formats...');
    }, 1000);

    setTimeout(() => {
      setUploadProgress(75);
      setUploadStatus('Saving 3 students to MongoDB...');
    }, 2000);

    setTimeout(() => {
      setUploadProgress(100);
      setUploadStatus('Activation triggers dispatched!');
      setOnboardedStudents([
        { id: '2022CSE001', name: 'Rahul Sharma', phone: '919876543210', branch: 'CSE', status: 'Queued' },
        { id: '2022CSE002', name: 'Priya Singh', phone: '919876543211', branch: 'CSE', status: 'Queued' },
        { id: '2022ECE001', name: 'Amit Kumar', phone: '919876543212', branch: 'ECE', status: 'Queued' },
      ]);
      setIsUploading(false);
    }, 3200);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          <span>Loading dynamic admin panels...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center shadow-md">
              <MessageSquare className="w-4.5 h-4.5 text-slate-950 font-bold" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight">Jodein Console</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-500 border border-slate-800 font-semibold">v1.1</span>
              </div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Multi-Tenant Bot Control Room</p>
            </div>
          </div>

          {/* College Selector Dropdown & Clerk Stub Profile */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <select 
                value={selectedCollege} 
                onChange={(e) => handleCollegeChange(e.target.value)}
                className="appearance-none bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-700 pl-4 pr-10 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="lnmiit">LNMIIT Jaipur</option>
                <option value="poornima">Poornima College</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Clerk Skeleton Profile Button */}
            <div className="flex items-center gap-3.5 pl-4 border-l border-slate-900">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                JD
              </div>
              <div className="hidden md:block">
                <span className="text-xs font-bold block text-slate-200">Admin Staff</span>
                <span className="text-[10px] block text-emerald-400 font-medium">Clerk Authenticated</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        
        {/* KPI Metrics Summary Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* KPI 1 */}
          <div className="p-6 rounded-2xl glass-card relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Students</span>
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-3xl font-extrabold text-white">{collegeConfig.metrics.activeStudents}</h3>
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="text-[10px] text-indigo-400 font-semibold">+12% this week</span>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="p-6 rounded-2xl glass-card relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">AI Deflection Rate</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-3xl font-extrabold text-white">{collegeConfig.metrics.deflectionRate}%</h3>
            <div className="flex items-center gap-1.5 mt-2.5 text-emerald-400">
              <span className="text-[10px] font-semibold">Goal: &gt;75% achieved</span>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="p-6 rounded-2xl glass-card relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Avg Response Time</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-3xl font-extrabold text-white">{collegeConfig.metrics.avgResponseTime}s</h3>
            <div className="flex items-center gap-1.5 mt-2.5 text-amber-400">
              <span className="text-[10px] font-semibold">Gemini Flash latency</span>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="p-6 rounded-2xl glass-card relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-xl" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Messages Handled</span>
              <MessageSquare className="w-5 h-5 text-pink-400" />
            </div>
            <h3 className="text-3xl font-extrabold text-white">{collegeConfig.metrics.messagesHandled.toLocaleString()}</h3>
            <div className="flex items-center gap-1.5 mt-2.5 text-slate-500">
              <span className="text-[10px] font-semibold">Cumulative lifetime</span>
            </div>
          </div>

        </section>

        {/* Charts & Graphs Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Chart Panel 1: Deflection Area Chart */}
          <div className="lg:col-span-7 p-6 rounded-3xl border border-slate-900 bg-slate-900/10 glass flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Daily Message Volume & Deflections</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Tracking queries deflect rate (success resolved without staff)</p>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-900 text-[10px] text-slate-400 font-semibold">
                Last 7 Days
              </span>
            </div>
            <div className="h-[280px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={collegeConfig.chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDeflected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                  <XAxis dataKey="day" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                  <Area name="Total Volume" type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                  <Area name="Deflected by AI" type="monotone" dataKey="deflected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorDeflected)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart Panel 2: Latency Bar Chart */}
          <div className="lg:col-span-5 p-6 rounded-3xl border border-slate-900 bg-slate-900/10 glass flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Average AI Latency</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Response latency in seconds driven by Gemini Flash</p>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-900 text-[10px] text-amber-500 bg-amber-500/5 font-semibold">
                Live Status
              </span>
            </div>
            <div className="h-[280px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeConfig.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                  <XAxis dataKey="day" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} unit="s" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Bar name="Latency" dataKey="responseTime" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </section>

        {/* Configurations & Tools Sections */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* AI Orchestrator Form Panel */}
          <div className="lg:col-span-7 p-8 rounded-3xl border border-slate-900 bg-slate-900/10 glass">
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Dynamic AI Persona Config</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Customize LLM system prompts and rules per college</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                Active Config
              </span>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-6">
              
              {/* Textarea: Prompt */}
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-2">College System Prompt</label>
                <textarea 
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3 text-xs leading-relaxed text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono resize-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Configure system persona guidelines..."
                />
                <span className="text-[10px] text-slate-500 mt-1.5 block">
                  💡 This system prompt binds the bot persona. Injected with real student metadata at runtime.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Model selection */}
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-2">LLM Model</label>
                  <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Fast, Recommended)</option>
                    <option value="gemini-1.5-pro-latest">Gemini 1.5 Pro (Complex Reasoning)</option>
                    <option value="claude-3-haiku">Claude 3 Haiku (Stub)</option>
                  </select>
                </div>

                {/* Temperature slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-400 font-semibold">Temperature</label>
                    <span className="text-xs font-mono font-bold text-indigo-400">{tempVal}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.05"
                    value={tempVal}
                    onChange={(e) => setTempVal(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-950 cursor-pointer h-1.5 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>Creative</span>
                    <span>Precise</span>
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="border-t border-slate-900 pt-6">
                <label className="text-xs text-slate-400 font-semibold block mb-4">Module Integrations</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Toggle Web Search */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-850 cursor-pointer select-none">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Web Search API</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Allows bot to search internet</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={features.webSearch} 
                      onChange={(e) => setFeatures({...features, webSearch: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950" 
                    />
                  </label>

                  {/* Toggle RAG */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-850 cursor-pointer select-none">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Knowledge Base (RAG)</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Query college PDFs & files</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={features.ragEnabled}
                      onChange={(e) => setFeatures({...features, ragEnabled: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950" 
                    />
                  </label>

                  {/* Toggle voice */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-850 cursor-pointer select-none">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Voice Transcription</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Supports voice notes inputs</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={features.voiceTranscription}
                      onChange={(e) => setFeatures({...features, voiceTranscription: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950" 
                    />
                  </label>

                  {/* Toggle image */}
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-850 cursor-pointer select-none">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Image Understanding</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Process screenshot alerts</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={features.imageUnderstanding}
                      onChange={(e) => setFeatures({...features, imageUnderstanding: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950" 
                    />
                  </label>

                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex gap-4 border-t border-slate-900 pt-6">
                <button 
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/10 transition-all flex items-center gap-2"
                >
                  Save Configuration
                </button>
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs transition-all">
                    <Check className="w-4 h-4" />
                    <span>Config updated successfully! (Cache invalidated)</span>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Right Column: CSV Student Onboarder & Clerk Stub Configurations */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* CSV Onboarder Panel */}
            <div className="p-6 rounded-3xl border border-slate-900 bg-slate-900/10 glass">
              <div className="flex items-center gap-3 border-b border-slate-900 pb-4 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Bulk Student Register Ingestion</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Queue verification templates in background</p>
                </div>
              </div>

              {/* Upload Dropzone Container */}
              <div className="border border-dashed border-slate-800 hover:border-slate-700 transition-colors bg-slate-950/60 rounded-2xl p-6 text-center">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-xs font-bold text-slate-300">Select Registry CSV File</h4>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
                  Headers must match: studentId, name, branch, year, section, phone, parentPhone
                </p>
                
                {/* Upload Action Button */}
                <div className="mt-4 flex flex-col gap-2">
                  <button 
                    onClick={simulateCsvUpload}
                    disabled={isUploading}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold text-xs transition-all w-fit mx-auto flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>Processing Ingest...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        <span>Simulate CSV Ingestion</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Upload Progress Simulator bar */}
              {uploadProgress > 0 && (
                <div className="mt-6 space-y-2 border-t border-slate-900 pt-4">
                  <div className="flex justify-between items-center text-[10px] font-semibold">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      {uploadProgress < 100 ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      {uploadStatus}
                    </span>
                    <span className="text-slate-300">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Onboarded Students List */}
              {onboardedStudents.length > 0 && (
                <div className="mt-6 space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-900 max-h-[160px] overflow-y-auto">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block border-b border-slate-900 pb-1.5">
                    Newly Seeded Students ({onboardedStudents.length})
                  </span>
                  {onboardedStudents.map((st, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px]">
                      <div>
                        <span className="font-bold text-slate-300 block">{st.name}</span>
                        <span className="text-slate-500">{st.id} • {st.branch}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        {st.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clerk Authentication Stub Control Panel */}
            <div className="p-6 rounded-3xl border border-slate-900 bg-slate-900/10 glass relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Clerk Identity Hub</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Manage secure Staff & HOD auth rules</p>
                  </div>
                </div>

                <button 
                  onClick={() => setClerkEnabled(!clerkEnabled)}
                  className={`w-12 h-6.5 rounded-full p-1 transition-all duration-300 ${
                    clerkEnabled ? 'bg-indigo-500' : 'bg-slate-900 border border-slate-800'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-slate-950 transition-all duration-300 ${
                    clerkEnabled ? 'translate-x-5.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-[10px] text-slate-400 flex items-start gap-2.5 leading-relaxed">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    To deploy proper multi-tenant role controls, Clerk provides secure OAuth gateways. Fill stubs below to complete framework binding.
                  </span>
                </div>

                {/* Clerk publishable key input stub */}
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={clerkPublishableKey}
                      onChange={(e) => setClerkPublishableKey(e.target.value)}
                      disabled={!clerkEnabled}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-[10px] text-slate-300 font-mono placeholder-slate-700 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                    />
                    <Key className="w-3.5 h-3.5 text-slate-650 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>

                {/* Clerk secret key input stub */}
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                    CLERK_SECRET_KEY
                  </label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={clerkSecretKey}
                      onChange={(e) => setClerkSecretKey(e.target.value)}
                      disabled={!clerkEnabled}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-[10px] text-slate-300 font-mono placeholder-slate-700 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                    />
                    <Shield className="w-3.5 h-3.5 text-slate-650 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>

                {/* Secure auth level stub */}
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                    Authorized Sign-In Domains
                  </label>
                  <select 
                    value={secureLevel} 
                    onChange={(e) => setSecureLevel(e.target.value)}
                    disabled={!clerkEnabled}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-[10px] text-slate-300 focus:outline-none focus:border-indigo-500 disabled:opacity-40 font-semibold cursor-pointer"
                  >
                    <option value="hod_only">Strict: College HODs Only (*.edu.in)</option>
                    <option value="staff">Staff & Faculty Members</option>
                    <option value="anyone">All College Domain Registrars</option>
                  </select>
                </div>

                {clerkEnabled && (
                  <div className="p-3 bg-amber-500/5 rounded-2xl border border-amber-500/10 text-[9px] text-amber-500 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Restart local dev server (`pnpm dev`) for Clerk keys to sync.</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-slate-600 text-[10px] font-medium mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>Jodein Console Panel © {new Date().getFullYear()}</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-450">Multi-tenant Webhook Status</a>
            <a href="#" className="hover:text-slate-450">MongoDB Connections</a>
            <a href="#" className="hover:text-slate-450">System Logs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
