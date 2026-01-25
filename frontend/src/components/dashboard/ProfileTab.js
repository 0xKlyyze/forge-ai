import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../../authContext';
import { Button } from '../ui/button';
import { Mail, Shield, Calendar, Camera, Upload, CheckCircle2, Settings, Edit3, Loader2, Check, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import api from '../../utils/api';

export default function ProfileTab() {
    const { user, updateUser } = useAuth();
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    // Handle Editing State
    const [isEditingHandle, setIsEditingHandle] = useState(false);
    const [newHandle, setNewHandle] = useState(user?.handle || '');
    const [isChecking, setIsChecking] = useState(false);
    const [availability, setAvailability] = useState(null); // { available: bool, reason: string }
    const [isSaving, setIsSaving] = useState(false);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                await updateUser({ avatar_url: reader.result });
                toast.success('Profile picture updated');
            } catch (err) {
                toast.error('Failed to update profile picture');
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    // Debounced handle check
    useEffect(() => {
        if (!isEditingHandle) return;

        const timer = setTimeout(async () => {
            if (!newHandle || newHandle === user?.handle) {
                setAvailability(null);
                return;
            }

            setIsChecking(true);
            try {
                const response = await api.get(`/auth/check-handle?handle=${encodeURIComponent(newHandle)}`);
                setAvailability(response.data);
            } catch (err) {
                console.error("Check handle failed", err);
                setAvailability({ available: false, reason: "Error checking availability" });
            } finally {
                setIsChecking(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [newHandle, isEditingHandle, user?.handle]);

    const handleSaveHandle = async () => {
        if (!availability?.available && newHandle !== user?.handle) {
            toast.error(availability?.reason || "Handle not available");
            return;
        }

        setIsSaving(true);
        try {
            await updateUser({ handle: availability?.handle || newHandle });
            toast.success("Handle updated successfully");
            setIsEditingHandle(false);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to update handle");
        } finally {
            setIsSaving(false);
        }
    };

    const initials = user?.email
        ? user.email.substring(0, 2).toUpperCase()
        : 'U';

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 100 }
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto py-4 px-2"
        >
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Side: Avatar & Basic Info */}
                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                    <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-zinc-900/50 border border-white/5 p-8 backdrop-blur-xl text-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />

                        <div className="relative z-10">
                            <div className="relative mb-6 group cursor-pointer inline-block" onClick={handleAvatarClick}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                <Avatar className="h-40 w-40 border-4 border-black/50 relative shadow-2xl group-hover:scale-105 transition-transform duration-500">
                                    <AvatarImage src={user?.avatar_url} alt={user?.email} className="object-cover" />
                                    <AvatarFallback className="bg-zinc-800 text-5xl font-bold text-zinc-500">
                                        {initials}
                                    </AvatarFallback>
                                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px]">
                                        <Camera className="w-10 h-10 text-white/90" />
                                    </div>
                                </Avatar>

                                <div className="absolute bottom-2 right-2 bg-blue-600 p-2.5 rounded-full border-2 border-zinc-950 shadow-xl translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform">
                                    {isUploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Upload className="w-4 h-4 text-white" />}
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-2">{user?.name || 'User'}</h2>

                            <div className="flex flex-col items-center gap-2">
                                <AnimatePresence mode="wait">
                                    {!isEditingHandle ? (
                                        <motion.div
                                            key="display"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="relative group/edit flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/30 transition-all cursor-pointer"
                                            onClick={() => {
                                                setNewHandle(user?.handle || '');
                                                setIsEditingHandle(true);
                                            }}
                                        >
                                            <span className="text-blue-400 font-mono text-sm">{user?.handle || '@set_handle'}</span>
                                            <Edit3 className="w-3.5 h-3.5 text-blue-400/50 group-hover/edit:text-blue-400 transition-colors" />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="edit"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="w-full space-y-3"
                                        >
                                            <div className="relative">
                                                <Input
                                                    value={newHandle}
                                                    onChange={(e) => setNewHandle(e.target.value)}
                                                    placeholder="@handle"
                                                    className={`
                                                        h-10 bg-black/40 border-white/10 text-center font-mono text-sm rounded-xl focus:ring-blue-500/50
                                                        ${availability?.available === true ? 'border-green-500/30' : ''}
                                                        ${availability?.available === false ? 'border-red-500/30' : ''}
                                                    `}
                                                    autoFocus
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    {isChecking && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                                    {!isChecking && availability?.available === true && <Check className="w-4 h-4 text-green-500" />}
                                                    {!isChecking && availability?.available === false && <X className="w-4 h-4 text-red-500" />}
                                                </div>
                                            </div>

                                            {availability?.available === false && (
                                                <p className="text-[10px] text-red-400/80 font-medium">{availability.reason}</p>
                                            )}

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    className="flex-1 h-9 rounded-xl border border-white/5 text-zinc-400 hover:text-white"
                                                    onClick={() => {
                                                        setIsEditingHandle(false);
                                                        setAvailability(null);
                                                    }}
                                                    disabled={isSaving}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                                                    onClick={handleSaveHandle}
                                                    disabled={isSaving || (newHandle !== user?.handle && !availability?.available)}
                                                >
                                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                                    Save
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-zinc-400 font-medium">Verify Identity Active</span>
                    </motion.div>
                </div>

                {/* Right Side: Detailed Details */}
                <div className="flex-1 space-y-6">
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all group">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                                <Mail className="h-5 w-5" />
                            </div>
                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Email Address</p>
                            <p className="text-white font-medium">{user?.email}</p>
                        </div>

                        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all group">
                            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                                <Shield className="h-5 w-5" />
                            </div>
                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Account Role</p>
                            <p className="text-white font-medium capitalize">{user?.role || 'Developer'}</p>
                        </div>

                        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all group md:col-span-2">
                            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400 mb-4 group-hover:scale-110 transition-transform">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Member Since</p>
                            <p className="text-white font-medium">December 2024</p>
                        </div>
                    </motion.div>

                    <Button className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl shadow-lg">
                        Update Account Settings
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
