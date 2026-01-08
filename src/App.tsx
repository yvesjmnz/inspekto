import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import SubmitComplaintPage from './pages/SubmitComplaintPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SubmitComplaintPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
