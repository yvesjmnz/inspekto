import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './LandingPage'
import SubmitComplaintPage from './complaints_module/pages/SubmitComplaintPage'
import VerifyEmailPage from './complaints_module/pages/VerifyEmailPage'
import TrackingPage from './tracking_module/ui/TrackingPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/complaints/submit" element={<SubmitComplaintPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route path="/tracking" element={<TrackingPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
