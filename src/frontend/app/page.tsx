'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Activity, Brain, Shield, Users, Zap, ChevronRight, Heart, Stethoscope } from 'lucide-react';

const ROLE_ROUTES: Record<string, string> = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  receptionist: '/reception/dashboard',
  pharmacist: '/pharmacy/dashboard',
  admin: '/admin/dashboard',
};

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push(ROLE_ROUTES[user.role] || '/patient/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading MediFlow AI...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-800/20 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">MediFlow AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
          <Zap className="w-3 h-3" />
          Powered by Google Gemini AI
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          The Future of<br />
          <span className="gradient-text">Healthcare is Here</span>
        </h1>

        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mb-4 leading-relaxed">
          MediFlow AI is an intelligent Hospital Operating System that unifies the complete patient journey.
          <br />
          <span className="text-slate-300 font-medium">One Patient ID. One AI Brain. One Seamless Healthcare Journey.</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link
            href="/register"
            className="group flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all text-lg glow-blue"
          >
            Register as Patient
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all text-lg border border-slate-700"
          >
            Staff Login
          </Link>
        </div>

        {/* Quick Login Hints */}
        <div className="mt-8 glass-card rounded-2xl p-4 max-w-md text-left">
          <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">Demo Credentials</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Patient:</span>
              <span>phone: 9876543210 / demo1234</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Doctor:</span>
              <span>dr.sharma@mediflow.ai / demo1234</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Reception:</span>
              <span>reception@mediflow.ai / demo1234</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Pharmacy:</span>
              <span>pharmacist@mediflow.ai / demo1234</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 px-6 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          Complete Hospital in <span className="gradient-text">One Platform</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Heart, title: 'Patient-First Design', desc: 'QR check-in, AI symptom triage, medicine reminders, and your complete health history in one place.', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
            { icon: Brain, title: 'Gemini AI Intelligence', desc: 'SOAP note generation, prescription assistant, drug interaction detection, and alternative medicine suggestions.', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            { icon: Stethoscope, title: 'Doctor Dashboard', desc: 'Instant patient summary, full medical timeline, AI-assisted prescriptions, and queue management.', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { icon: Users, title: 'Reception & Queue', desc: 'Real-time queue board, QR-based check-in, appointment verification, and priority management.', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
            { icon: Shield, title: 'Smart Pharmacy', desc: 'Prescription viewer, inventory tracking, AI alternative medicines, and integrated billing.', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { icon: Zap, title: 'Real-time Operations', desc: 'Live queue updates, instant check-ins, same-session prescription-to-pharmacy delivery.', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
          ].map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className={`glass-card rounded-2xl p-6 border ${bg} animate-fadeIn`}>
              <div className={`w-10 h-10 rounded-xl ${bg} border flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
