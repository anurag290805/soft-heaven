import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './AppRouter.tsx'
import { StorefrontProvider } from './state/StorefrontProvider'
import { BagDrawer } from './components/BagDrawer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StorefrontProvider>
      <AppRouter />
      <BagDrawer />
    </StorefrontProvider>
  </StrictMode>,
)
