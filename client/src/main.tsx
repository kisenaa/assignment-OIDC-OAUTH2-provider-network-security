import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AppRouter from './AppRouter.tsx';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import config from './config/index.ts';
import './index.css';

// 0. Setup queryClient
const queryClient = new QueryClient();


createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  </React.StrictMode>
);
