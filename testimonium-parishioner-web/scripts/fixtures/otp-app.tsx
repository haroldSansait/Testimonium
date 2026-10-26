// @ts-nocheck
import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { SubmissionProtectionProvider } from '../../src/contexts/SubmissionProtectionContext';
import { ToastProvider } from '../../src/contexts/ToastContext';
import { queryClient } from '../../src/services/queryClient';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';
import VerifyEmailPage from '../../src/pages/public/VerifyEmailPage';
import ForgotPasswordPage from '../../src/pages/public/ForgotPasswordPage';
import LoginPage from '../../src/pages/public/LoginPage';
import SignupPage from '../../src/pages/public/SignupPage';
import { OtpInput } from '../../src/components/ui/OtpInput';
import '../../src/index.css';
function InputFixture() {
  const [code,setCode]=useState('');
  return <OtpInput value={code} onChange={setCode} onComplete={()=>{window.fixture.completions=(window.fixture.completions||0)+1;}} />;
}
function Pages() {
  const auth=useAuth(); const navigate=useNavigate();
  useLayoutEffect(()=>{Object.assign(window.fixture,{auth,navigate});});
  return <Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/signup" element={<SignupPage/>}/>
    <Route path="/verify-email" element={<VerifyEmailPage key={`${auth.user?.uid}:${auth.user?.email}`}/>}/>
    <Route path="/forgot-password" element={<ForgotPasswordPage key={auth.user?.uid ?? "signed-out"}/>}/>
    <Route path="/otp-input" element={<InputFixture/>}/>
    <Route element={<ProtectedRoute/>}><Route path="/dashboard/home" element={<div>Authenticated dashboard fixture</div>}/></Route>
  </Routes>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><QueryClientProvider client={queryClient}>
  <ToastProvider><SubmissionProtectionProvider><AuthProvider><Pages/></AuthProvider></SubmissionProtectionProvider></ToastProvider>
</QueryClientProvider></BrowserRouter>);
