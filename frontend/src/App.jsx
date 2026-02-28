import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage"
import ProfilePage from "./pages/ProfilePage"
import HomePage from "./pages/HomePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import StarredMessagesPage from "./pages/StarredMessagesPage";
import { useAuthStore } from "./store/useAuthStore";
import { useEffect } from "react";
import { Loader } from "lucide-react"
import { Toaster } from "react-hot-toast";
import { useThemeStore } from "./store/useThemeStore";
import { useChatStore } from "./store/useChatStore";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, socket } = useAuthStore();
  const { theme } = useThemeStore();
  const { subscribeToMessages, unSubscribeFromMessages, getUsers } = useChatStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth])

  useEffect(() => {
    if (!authUser || !socket) return;
    subscribeToMessages();
    getUsers("", { silent: true });

    return () => {
      unSubscribeFromMessages();
    };
  }, [authUser, socket, subscribeToMessages, unSubscribeFromMessages, getUsers]);

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
        <Route path='/signup' element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path='/forgot-password' element={!authUser ? <ForgotPasswordPage /> : <Navigate to="/" />} />
        <Route path='/reset-password' element={!authUser ? <ResetPasswordPage /> : <Navigate to="/" />} />
        <Route path='/Settings' element={<SettingsPage />} />
        <Route path='/Profile' element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
        <Route path='/starred' element={authUser ? <StarredMessagesPage /> : <Navigate to="/login" />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
