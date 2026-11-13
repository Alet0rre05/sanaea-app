import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/routing/RequireAuth';
import { PreferencesProvider } from './context/PreferencesContext';
import { SessionProvider } from './context/SessionContext';
import { HomePage } from './pages/HomePage';
import { LegalAcceptancePage } from './pages/LegalAcceptancePage';
import { PasswordResetPage, RegisterPage, VerifyPage } from './pages/AuthFlowPages';
import { LoginPage } from './pages/LoginPage';
import { ScansPage } from './pages/ScansPage';
import { SettlementsPage } from './pages/SettlementsPage';

export function App() {
  return (
    <SessionProvider>
      <PreferencesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/password/reset" element={<PasswordResetPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="/legal" element={<LegalAcceptancePage />} />
              <Route path="/scans" element={<ScansPage />} />
              <Route path="/settlements" element={<SettlementsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PreferencesProvider>
    </SessionProvider>
  );
}
