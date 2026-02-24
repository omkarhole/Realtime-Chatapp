import { create } from "zustand";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5001"
    : import.meta.env.VITE_BACKEND_URL;

const AUTH_TOKEN_KEY = "chatapp_token";

const getStoredToken = () =>
  typeof window !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;

const setStoredToken = (token) => {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
};

const clearStoredToken = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

const getErrorMessage = (err, fallbackMessage) =>
  err?.response?.data?.message || err?.message || fallbackMessage;

export const useAuthStore = create((set, get) => ({
  authUser: null,
  socketToken: getStoredToken(),
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      const { token, ...userData } = res.data;
      if (token) setStoredToken(token);
      set({
        authUser: userData,
        socketToken: token || get().socketToken || getStoredToken(),
      });
      get().connectSocket();
    } catch (err) {
      console.log("error in checking auth", err);
      clearStoredToken();
      set({ authUser: null, socketToken: null });
      get().disConnectSocket();
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      const { token, ...userData } = res.data;

      if (token) setStoredToken(token);

      set({
        authUser: userData,
        socketToken: token || getStoredToken(),
      });
      toast.success("logged in successfully");
      get().connectSocket();
    } catch (err) {
      console.log("error in login", err);
      toast.error(getErrorMessage(err, "Login failed"));
    } finally {
      set({ isLoggingIn: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      const { token, ...userData } = res.data;

      if (token) setStoredToken(token);

      set({
        authUser: userData,
        socketToken: token || getStoredToken(),
      });
      toast.success("account created successfully");
      get().connectSocket();
    } catch (err) {
      console.log("error in signup", err);
      toast.error(getErrorMessage(err, "Signup failed"));
    } finally {
      set({ isSigningUp: false });
    }
  },

  logout: async () => {
    let logoutFailed = false;
    try {
      await axiosInstance.post("/auth/logout");
    } catch (err) {
      logoutFailed = true;
      console.log("error in logout", err);
      toast.error(getErrorMessage(err, "Logout failed"));
    } finally {
      clearStoredToken();
      set({ authUser: null, socketToken: null });
      get().disConnectSocket();
      if (!logoutFailed) {
        toast.success("logged out successfully");
      }
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const profileImg = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: profileImg.data });
      toast.success("profile updated successfully");
    } catch (err) {
      console.log("error in updating profile", err);
      toast.error(getErrorMessage(err, "Profile update failed"));
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser, socketToken } = get();
    if (!authUser) return;

    const existingSocket = get().socket;
    if (existingSocket) {
      if (existingSocket.connected || existingSocket.active) return;
      existingSocket.off("getOnlineUsers");
      existingSocket.off("connect_error");
      existingSocket.disconnect();
    }

    const token = socketToken || getStoredToken();
    const socket = io(BASE_URL, {
      withCredentials: true,
      query: { userId: authUser._id },
      auth: token ? { token } : undefined,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: false,
    });

    socket.connect();
    set({ socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("connect_error", (error) => {
      const isAuthError = typeof error?.message === "string" && error.message.includes("Authentication");
      if (isAuthError) {
        socket.disconnect();
      }
    });
  },

  disConnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.off("getOnlineUsers");
      socket.off("connect_error");
      if (socket.connected || socket.active) socket.disconnect();
    }
    set({ socket: null, onlineUsers: [] });
  },
}));
