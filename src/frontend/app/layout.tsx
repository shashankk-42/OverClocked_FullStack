import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'MediFlow AI — Hospital Operating System',
  description: 'AI-powered hospital management system. One Patient ID. One AI Brain. One Seamless Healthcare Journey.',
  keywords: 'hospital, AI, healthcare, patient management, MediFlow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={`${inter.variable} font-sans antialiased bg-neutral-50 text-neutral-900 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
