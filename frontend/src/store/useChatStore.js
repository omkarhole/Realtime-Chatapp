import {create} from "zustand"
import {toast} from "react-hot-toast";
import {axiosInstance} from "../lib/axios"


export const useChatStore=create((set)=>({
    messages:[],
    users:[],
    selectedUser:null,
    isUsersLoading:false,
    isMessagesLoading:false,

    getUsers:async()=>{
        set({isUsersLoading:true});
        try{
            const res=await axiosInstance.get("/messages/users");
            set({users:res.data.filterUsers});
        }
        catch(err){
            console.log("error in getting users",err);
            toast.error("Failed to load users");

        }
        finally{
            set({isUsersLoading:false});
        }
    },
    getMessages:async(userId)=>{
        try{
            set({isMessagesLoading:true})
            const res=await axiosInstance.get(`/messages/${userId}`);
            set({messages:res.data});
        }
        catch(err){
            console.log("error in getting messages",err);
            toast.error("Failed to load messages");
        }
        finally{
            set({isMessagesLoading:false})
        }
    },
    // todo:make it more optmize
    setSelectedUser:(selectedUser)=> set({selectedUser}),

}))