import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import { Button } from '../components/ui/button';
import { ArrowLeft, LogOut, Mail, Shield, Calendar, Camera, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { toast } from 'sonner';

export default function Profile() {
    const { user, logout, updateUser } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        setIsUploading(true);
        // Mock upload - convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            updateUser({ avatar_url: reader.result });
            toast.success('Profile picture updated');
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const initials = user?.email
        ? user.email.substring(0, 2).toUpperCase()
        : 'U';

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 100 }
        }
    };

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto px-6 py-12 relative z-10 max-w-2xl">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-8"
                >
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/dashboard')}
                        className="text-muted-foreground hover:text-white hover:bg-white/10 gap-2 pl-0 pr-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    {/* Header Card */}
                    <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur-sm">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-50" />
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="relative mb-6 group cursor-pointer" onClick={handleAvatarClick}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
                                <Avatar className="h-32 w-32 border-2 border-black relative shadow-2xl group-hover:scale-105 transition-transform duration-300">
                                    <AvatarImage src={user?.avatar_url} alt={user?.email} className="object-cover" />
                                    <AvatarFallback className="bg-gradient-to-br from-gray-800 to-black text-4xl font-medium text-white">
                                        {initials}
                                    </AvatarFallback>

                                    {/* Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <Camera className="w-8 h-8 text-white/80" />
                                    </div>
                                </Avatar>

                                <div className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full border border-black shadow-lg translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform">
                                    {isUploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4 text-white" />}
                                </div>
                            </div>

                            <h1 className="text-3xl font-bold text-white mb-2">{user?.name || 'User'}</h1>

                            <div className="relative group/edit">
                                <input
                                    defaultValue={user?.handle || ''}
                                    placeholder="@username"
                                    className="bg-transparent text-center text-blue-400 font-mono text-sm border-none focus:ring-0 focus:outline-none placeholder:text-blue-400/50"
                                    onBlur={(e) => {
                                        let val = e.target.value.trim();
                                        if (val && !val.startsWith('@')) val = '@' + val;
                                        if (val !== user?.handle) {
                                            updateUser({ handle: val });
                                            toast.success("Handle updated");
                                        }
                                    }}
                                />
                                <span className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/edit:opacity-100 transition-opacity text-xs text-muted-foreground">
                                    Edit
                                </span>
                            </div>

                            <p className="text-muted-foreground flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full text-sm border border-white/5 mt-4">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Active Account
                            </p>
                        </div>
                    </motion.div>

                    {/* Details Card */}
                    <motion.div variants={itemVariants} className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/5 backdrop-blur-sm overflow-hidden">
                        <div className="p-6 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-0.5">Email Address</p>
                                <p className="font-medium text-white">{user?.email}</p>
                            </div>
                        </div>

                        <div className="p-6 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-0.5">Account Type</p>
                                <p className="font-medium text-white capitalize">{user?.role || 'Developer'}</p>
                            </div>
                        </div>

                        <div className="p-6 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-0.5">Member Since</p>
                                <p className="font-medium text-white">December 2024</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div variants={itemVariants} className="pt-4">
                        <Button
                            variant="destructive"
                            className="w-full h-12 text-base bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-5 w-5" />
                            Sign Out
                        </Button>
                    </motion.div>

                </motion.div>
            </div>
        </div>
    );
}
