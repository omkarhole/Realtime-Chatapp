import { create } from "zustand"
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

export const useAuthStore = create((set) => ({
    authUser: null,
    isSigningUp: false,
    isLoggingIng: false,
    isUpdatingProfile: false,

    isCheckingAuth: true,
    onlineUsers:[],

    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");
            set({ authUser: res.data })

        }
        catch (err) {
            console.log("error in checking auth", err);
            set({ authUser: null })
        }
        finally {
            set({ isCheckingAuth: false })
        }
    },
    signup: async (data) => {
        set({ isSigningUp: true });
        try {
            const response = await axiosInstance.post("/auth/signup", data);
            set({ authUser: response.data });
            toast.success("account created successfully");
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
        }
        catch (err) {
            console.log("error in logout", err);
            toast.error(err.response.data.message);
        }
    },
    login:async(data)=>{
        set({isLoggingIng:true});
        try{
            const login=await axiosInstance.post("/auth/login",data);
            set({authUser:login.data});
            toast.success("logged in successfully");

        }
        catch(err){
            console.log("error in login",err);
            toast.error(err.response.data.message);
        }
        finally{
            set({isLoggingIng:false});
        }
    },
    updateProfile:async(data)=>{
        set({isUpdatingProfile:true});
        try{
            const profileImg=await axiosInstance.put("/auth/update-profile",data);
            set({authUser:profileImg.data});
            toast.success("profile updated successfully");
        }
        catch(err){
            console.log("error in updating profile",err);
            toast.error(err.response.data.message);
        }
        finally{
            set({isUpdatingProfile:false});
        }
    }
}))