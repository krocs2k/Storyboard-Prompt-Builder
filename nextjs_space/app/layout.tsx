import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: 'Storyboard Prompt Builder | Cinematic Image Prompts',
  description: 'Build detailed cinematic image prompts for storyboarding. Select visual styles, camera settings, lighting, and more to craft the perfect prompt.',
  keywords: 'storyboard, prompt builder, cinematic, film, photography, image generation, AI prompts',
  openGraph: {
    title: 'Storyboard Prompt Builder',
    description: 'Craft cinematic image prompts with precision',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
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
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
