import './globals.css';

export const metadata = {
  title: 'Jodein — Campus Intelligence Platform',
  description: 'Next-generation AI-powered WhatsApp campus assistant platform for Indian colleges. Automate student support, onboarding, and attendance with Gemini Flash.',
  keywords: 'WhatsApp bot, campus assistant, AI, college, student support, ADIP, Jodein',
  openGraph: {
    title: 'Jodein — Campus Intelligence Platform',
    description: 'AI-powered WhatsApp campus assistant for Indian colleges',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6d51e8',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark h-full scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#6d51e8" />
      </head>
      <body className="h-full antialiased overflow-x-hidden bg-[#020408] text-slate-100">
        {/* Noise texture overlay for premium feel */}
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
