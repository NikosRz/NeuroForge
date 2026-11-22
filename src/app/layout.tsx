import type { Metadata } from 'next';
import {
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Press_Start_2P,
  Silkscreen,
} from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const silkscreen = Silkscreen({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-silkscreen',
  display: 'swap',
});

const pressStart2P = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-press-start',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NeuroForge AI',
  description: 'Self-hosted ADHD-friendly 16-bit arcade RPG wrapper for JIRA with local Ollama AI.',
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html
    lang="en"
    className={`${plusJakartaSans.variable} ${silkscreen.variable} ${pressStart2P.variable} ${jetBrainsMono.variable}`}
  >
    <body className="antialiased">{children}</body>
  </html>
);

export default RootLayout;
