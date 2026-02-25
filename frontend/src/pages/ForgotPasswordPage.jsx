import { useState } from "react";
import { Mail, MessageSquare, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthImagePattern from "../components/AuthImagePattern";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return;

        setIsSubmitting(true);
        try {
            await axiosInstance.post("/auth/forgot-password", { email: normalizedEmail });
            toast.success("OTP sent to your email");
            navigate("/reset-password");
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to send OTP");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-screen grid lg:grid-cols-2">
            <div className="flex flex-col justify-center items-center p-6 sm:p-12">
                <div className="w-full max-w-md space-y-8">

                    <div className="text-center mb-8">
                        <div className="flex flex-col items-center gap-2 group">
                            <div
                                className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20
              transition-colors"
                            >
                                <MessageSquare className="w-6 h-6 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold mt-2">Forgot Password</h1>
                            <p className="text-base-content/60">Enter your email to reset your password</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Email Address</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-base-content/40" />
                                </div>
                                <input
                                    type="email"
                                    className={`input input-bordered w-full pl-10`}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
                            Send OTP
                        </button>
                    </form>

                    <div className="text-center">
                        <Link to="/login" className="link link-primary inline-flex items-center gap-2">
                            <ArrowLeft className="size-4" />
                            Back to login
                        </Link>
                    </div>
                </div>
            </div>
            <AuthImagePattern
                title={"Recover your account"}
                subtitle={"Don't worry, it happens to the best of us. Just enter your email and we'll help you get back in."}
            />
        </div>
    );
};

export default ForgotPasswordPage;
