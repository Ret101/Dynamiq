import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dynamiq — Vehicle Engineering Platform',
  description: 'Cloud-based suspension design, kinematics, CVT calculator, and vehicle dynamics simulation for Formula SAE, Baja SAE, and competitive motorsport.',
  keywords: ['suspension', 'vehicle dynamics', 'kinematics', 'FSAE', 'Baja SAE', 'CVT calculator', 'Dynamiq'],
  authors: [{ name: 'Dynamiq' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased overflow-hidden h-screen w-screen">
        {children}
      </body>
    </html>
  );
}
