import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Circle Accountability',
  description: 'Complete the circle together.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}
