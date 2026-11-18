import type { Metadata } from 'next';
import { Nunito, Noto_Nastaliq_Urdu } from 'next/font/google';
import './globals.css';

const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'], display: 'swap' });
const nastaliq = Noto_Nastaliq_Urdu({ variable: '--font-nastaliq', subsets: ['arabic'], weight: ['400', '600'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Parent Coach — A calmer you is closer',
  description: 'A little space to reset. Gentle, practical parenting support in English and Urdu.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${nunito.variable} ${nastaliq.variable} h-full antialiased`}><body>{children}</body></html>;
}
