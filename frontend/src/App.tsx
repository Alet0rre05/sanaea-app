import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/routing/RequireAuth';
import { PreferencesProvider } from './context/PreferencesContext';
import { AuroraBackground } from './components/ui/AuroraBackground';
import { SessionProvider } from './context/SessionContext';
import { HomePage } from './pages/HomePage';
import { LegalAcceptancePage } from './pages/LegalAcceptancePage';
import { PasswordResetPage, RegisterPage, VerifyPage } from './pages/AuthFlowPages';
import { LoginPage } from './pages/LoginPage';
import { ScansPage } from './pages/ScansPage';
import { SettlementsPage } from './pages/SettlementsPage';
import { ChatsPage } from './pages/ChatsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AccountPage } from './pages/AccountPage';
import { FamilyLinksPage } from './pages/FamilyLinksPage';
import { ConsentPage } from './pages/ConsentPage';
import { EvolutionsPage } from './pages/EvolutionsPage';
import { ImportPage } from './pages/ImportPage';
import { CatalogPage } from './pages/CatalogPage';
import { TutorialsPage } from './pages/TutorialsPage';
import { HelpPage } from './pages/HelpPage';

export function App() {
  return (
    <SessionProvider>
      <PreferencesProvider>
        <AuroraBackground />
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
              <Route path="/chat" element={<ChatsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/cuenta" element={<AccountPage />} />
              <Route path="/vinculos" element={<FamilyLinksPage />} />
              <Route path="/consentimiento" element={<ConsentPage />} />
              <Route path="/evoluciones" element={<EvolutionsPage />} />
              <Route path="/tutoriales" element={<TutorialsPage />} />
              <Route path="/ayuda" element={<HelpPage />} />
              <Route path="/importar" element={<ImportPage />} />
              <Route path="/fichas" element={<CatalogPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PreferencesProvider>
    </SessionProvider>
  );
}
