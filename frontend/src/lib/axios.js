import axios from "axios";
import { API } from "../constants/index.js";

const BASE_URL = import.meta.env.MODE === "development" 
  ? `${API.DEV_BACKEND_URL}${API.API_PREFIX}` 
  : import.meta.env.VITE_BACKEND_URL + API.API_PREFIX;

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});
