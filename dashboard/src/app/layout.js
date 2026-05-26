import './globals.css';

export const metadata = {
  title: 'Jodein — Campus Intelligence Dashboard',
  description: 'AI-Powered student engagement and WhatsApp bot management portal for colleges and HODs.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full font-['Plus_Jakarta_Sans',sans-serif] bg-slate-950 text-slate-100 antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
