import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { ServiceWorkerRegistration } from '@/components/sw-register';
import { PWAInstallPromptWrapper } from '@/components/pwa-install-wrapper';

const inter = Inter({ subsets: ['latin'] });

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: '#d4af37',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: 'Storyshot Creator | Cinematic Image Prompts',
  description: 'Build detailed cinematic image prompts for storyboarding. Select visual styles, camera settings, lighting, and more to craft the perfect prompt.',
  keywords: 'storyboard, prompt builder, cinematic, film, photography, image generation, AI prompts',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SSC',
    startupImage: '/icon-512x512.png',
  },
  openGraph: {
    title: 'Storyshot Creator',
    description: 'Craft cinematic image prompts with precision',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon-32x32.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('spb-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}` }} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SSC" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ServiceWorkerRegistration />
        <PWAInstallPromptWrapper />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
