import { create } from "zustand"
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import {io} from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" 
  ? "http://localhost:5001" 
  : import.meta.env.VITE_BACKEND_URL;

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,

    isCheckingAuth: true,
    onlineUsers: [],
    socket: null,

    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");
            set({ authUser: res.data })
            get().connectSocket()
        }
        catch (err) {
            console.log("error in checking auth", err);
            set({ authUser: null })
        }
        finally {
            set({ isCheckingAuth: false })
        }
    },
    login: async (data) => {
        set({ isLoggingIn: true });
        try {
            const login = await axiosInstance.post("/auth/login", data);
            set({ authUser: login.data });
            toast.success("logged in successfully");
            get().connectSocket()

        }
        catch (err) {
            console.log("error in login", err);
            toast.error(err.response.data.message);
        }
        finally {
            set({ isLoggingIn: false });
        }
    },
    signup: async (data) => {
        set({ isSigningUp: true });
        try {
            const response = await axiosInstance.post("/auth/signup", data);
            set({ authUser: response.data });
            toast.success("account created successfully");
            get().connectSocket()
        }
        catch (err) {
            console.log("error in signup", err);
            toast.error(err.response.data.message);
        }
        finally {
            set({ isSigningUp: false });
        }
    },

    logout: async () => {
        try {
            const logout = axiosInstance.post("auth/logout");
            set({ authUser: null });
            toast.success("logged out successfully");
            get().disConnectSocket();
        }
        catch (err) {
            console.log("error in logout", err);
            toast.error(err.response.data.message);
        }
    },

    updateProfile: async (data) => {
        set({ isUpdatingProfile: true });
        try {
            const profileImg = await axiosInstance.put("/auth/update-profile", data);
            set({ authUser: profileImg.data });
            toast.success("profile updated successfully");
        }
        catch (err) {
            console.log("error in updating profile", err);
            toast.error(err.response.data.message);
        }
        finally {
            set({ isUpdatingProfile: false });
        }
    },
    connectSocket: () => {
        const {authUser}=get();
        if(!authUser||get().socket?.connected) return;

        // Get the JWT token from cookies
        const token = document.cookie
            .split('; ')
            .find(row => row.startsWith('jwt='))
            ?.split('=')[1];

        const socket=io(BASE_URL,{
            query:{userId:authUser._id},
            auth: { token }
        });
        socket.connect();
        set({socket:socket});
        socket.on("getOnlineUsers",(userIds)=>{
            set({onlineUsers:userIds});
        })

    },
     disConnectSocket: () => {
        if(get().socket?.connected) get().socket.disconnect();
     },
}))
