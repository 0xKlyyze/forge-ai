import React from 'react';
import { Toaster } from 'sonner';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {children}
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
