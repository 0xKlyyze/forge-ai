import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Check, X, Clock, ExternalLink, Shield, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

export default function InboxTab({ invites, onAccept, onDecline, isLoading }) {
    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2].map(i => (
                    <div key={i} className="h-32 rounded-2xl bg-zinc-900/40 border border-white/5 animate-pulse" />
                ))}
            </div>
        );
    }

    if (invites.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 rounded-3xl bg-zinc-900/20 border border-dashed border-white/5">
                <div className="h-20 w-20 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5">
                    <Mail className="h-10 w-10 text-zinc-600" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Your inbox is clear</h3>
                    <p className="text-zinc-500">New project invitations and notifications will appear here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <AnimatePresence mode="popLayout">
                {invites.map((invite) => (
                    <motion.div
                        key={invite.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group relative overflow-hidden rounded-2xl bg-zinc-900/60 border border-white/5 p-6 hover:border-blue-500/30 transition-all duration-300 shadow-xl"
                    >
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                            {/* Inviter Info */}
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="relative">
                                    <Avatar className="h-16 w-16 border-2 border-zinc-800 shadow-lg">
                                        <AvatarImage src={invite.inviter_avatar} />
                                        <AvatarFallback className="bg-zinc-800 text-zinc-500">
                                            <User size={24} />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 rounded-full border-2 border-zinc-950 shadow-lg">
                                        <Mail size={12} className="text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest">
                                    <Shield size={12} /> Collaborative Invite
                                </div>
                                <h3 className="text-lg font-bold text-white leading-tight">
                                    <span className="text-zinc-400 font-medium">{invite.inviter_handle || invite.inviter_email}</span> invited you to collaborate on <span className="text-blue-400">"{invite.project_name}"</span>
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={14} />
                                        <span>{formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                                <Button
                                    onClick={() => onDecline(invite.token)}
                                    variant="ghost"
                                    className="flex-1 md:flex-none h-11 px-6 rounded-xl border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    <X size={18} className="mr-2" /> Decline
                                </Button>
                                <Button
                                    onClick={() => onAccept(invite.token)}
                                    className="flex-1 md:flex-none h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Check size={18} className="mr-2" /> Accept
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
