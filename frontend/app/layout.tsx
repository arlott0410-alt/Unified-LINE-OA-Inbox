import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Unified LINE OA Inbox',
  description: 'Agent inbox for LINE Official Accounts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
