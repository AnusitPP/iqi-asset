import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';
import './legacy.css';
import './dashboard.css';
import './globals.css';
import { AppProviders } from '@/providers/app-providers';
export const metadata: Metadata = {
  title: 'IQI Asset Checker — ค้นหาครุภัณฑ์',
  description: 'ระบบตรวจสอบครุภัณฑ์ IQI',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
