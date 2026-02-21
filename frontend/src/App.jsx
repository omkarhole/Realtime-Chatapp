import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage"
import ProfilePage from "./pages/ProfilePage"
import HomePage from "./pages/HomePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useAuthStore } from "./store/useAuthStore";
import { useEffect } from "react";
import { Loader } from "lucide-react"
import { Toaster } from "react-hot-toast";
import { useThemeStore } from "./store/useThemeStore";
const App = () => {
  const { authUser, checkAuth, isCheckingAuth, onlineUsers } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth])

  console.log("onlineUsers in App.jsx", onlineUsers);
  console.log("authUser in App.jsx", authUser);
  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex items-center justify-center h-screen">

        <Loader className="size-10 animate-spin" />
      </div>
    )
  }
  return (
    <div data-theme={theme}>
      <Navbar />
      <Routes>
        <Route path='/' element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to="/login" />} />
        <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path='/forgot-password' element={!authUser ? <ForgotPasswordPage /> : <Navigate to="/" />} />
        <Route path='/reset-password' element={!authUser ? <ResetPasswordPage /> : <Navigate to="/" />} />
        <Route path='/Settings' element={<SettingsPage />} />
        <Route path='/Profile' element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
