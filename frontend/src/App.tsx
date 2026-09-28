import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ComposePage } from './pages/ComposePage';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { EmailsPage } from './pages/EmailsPage';
import { LoginPage } from './pages/LoginPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        {/* key resets search/page state when switching tabs */}
        <Route path="/scheduled" element={<EmailsPage key="scheduled" tab="scheduled" />} />
        <Route path="/sent" element={<EmailsPage key="sent" tab="sent" />} />
        <Route path="/compose" element={<ComposePage />} />
        <Route path="/emails/:id" element={<EmailDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/scheduled" replace />} />
    </Routes>
  );
}
