'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Activity, Brain, Shield, Users, Zap, ChevronRight, Heart, Stethoscope, ArrowRight } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm">Loading MediFlow AI...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white overflow-hidden">
      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-neutral-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-neutral-900">MediFlow AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-semibold bg-neutral-900 hover:bg-neutral-700 text-white rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f5f5f5_1px,transparent_1px),linear-gradient(to_bottom,#f5f5f5_1px,transparent_1px)] bg-[size:48px_48px] opacity-60 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-600 text-xs font-medium mb-8">
            <Zap className="w-3 h-3" />
            Powered by Google Gemini AI
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-neutral-900 mb-6 leading-[1.1] tracking-tight">
            The Future of<br />
            Healthcare is Here
          </h1>

          <p className="text-neutral-500 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            MediFlow AI is an intelligent Hospital Operating System that unifies the complete patient journey.{' '}
            <span className="text-neutral-900 font-semibold">One Patient ID. One AI Brain. One Seamless Healthcare Journey.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-neutral-900 hover:bg-neutral-700 text-white rounded-xl font-semibold transition-all text-base"
            >
              Register as Patient
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white hover:bg-neutral-50 text-neutral-900 rounded-xl font-semibold transition-all text-base border border-neutral-200"
            >
              Staff Login
            </Link>
          </div>

          {/* Demo Credentials */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 max-w-md mx-auto text-left shadow-sm">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Demo Credentials</p>
            <div className="space-y-2 text-sm">
              {[
                { role: 'Patient', cred: '9876543210 / demo1234' },
                { role: 'Doctor', cred: 'dr.sharma@mediflow.ai / demo1234' },
                { role: 'Reception', cred: 'reception@mediflow.ai / demo1234' },
                { role: 'Pharmacy', cred: 'pharmacist@mediflow.ai / demo1234' },
              ].map(({ role, cred }) => (
                <div key={role} className="flex items-center justify-between gap-4">
                  <span className="text-neutral-400 font-medium w-20 flex-shrink-0">{role}</span>
                  <span className="text-neutral-700 font-mono text-xs">{cred}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-20 max-w-6xl mx-auto border-t border-neutral-100">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-900 mb-3">Complete Hospital in One Platform</h2>
          <p className="text-neutral-500 max-w-xl mx-auto text-base">Everything your team needs — from patient intake to pharmacy dispensing — in one unified system.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Heart, title: 'Patient-First Design', desc: 'QR check-in, AI symptom triage, medicine reminders, and your complete health history in one place.' },
            { icon: Brain, title: 'Gemini AI Intelligence', desc: 'SOAP note generation, prescription assistant, drug interaction detection, and alternative medicine suggestions.' },
            { icon: Stethoscope, title: 'Doctor Dashboard', desc: 'Instant patient summary, full medical timeline, AI-assisted prescriptions, and queue management.' },
            { icon: Users, title: 'Reception & Queue', desc: 'Real-time queue board, QR-based check-in, appointment verification, and priority management.' },
            { icon: Shield, title: 'Smart Pharmacy', desc: 'Prescription viewer, inventory tracking, AI alternative medicines, and integrated billing.' },
            { icon: Zap, title: 'Real-time Operations', desc: 'Live queue updates, instant check-ins, same-session prescription-to-pharmacy delivery.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-neutral-200 rounded-xl p-6 hover:border-neutral-400 hover:shadow-sm transition-all">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-neutral-700" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-1.5">{title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-neutral-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-neutral-900 rounded flex items-center justify-center">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="font-medium text-neutral-600">MediFlow AI</span>
          </div>
          <span>Built for the OverClocked Hackathon</span>
        </div>
      </footer>
    </main>
  );
}
