import React from 'react';
import {
    Layers,
    Users,
    Inbox,
    UserCircle,
    Settings
} from 'lucide-react';
import { motion } from 'framer-motion';

const MobileTabItem = ({ id, label, icon: Icon, active, onClick, badge }) => (
    <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onClick(id)}
        className={`
      relative flex flex-col items-center justify-center w-full py-3 gap-1 overflow-hidden
      ${active ? 'text-blue-500' : 'text-zinc-500'}
    `}
    >
        <div className="relative p-1">
            <Icon size={22} strokeWidth={active ? 2.5 : 2} className="transition-all duration-300" />
            {badge > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-blue-500 text-[9px] font-bold text-white rounded-full shadow-lg shadow-blue-500/40 animate-pulse border border-black">
                    {badge}
                </span>
            )}
        </div>

        {/* Active Indicator (Glow) */}
        {active && (
            <motion.div
                layoutId="mobileNavIndicator"
                className="absolute -top-3 w-12 h-1 bg-blue-500 rounded-full blur-[2px]"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
        )}

        {/* Label (Optional: Could be hidden for simpler look, but let's keep it minimal) */}
        {/* <span className="text-[10px] font-medium tracking-tight">{label}</span> */}
    </motion.button>
);

export default function MobileBottomNav({ activeTab, onTabChange, inboxCount }) {
    const tabs = [
        { id: 'projects', label: 'Projects', icon: Layers },
        { id: 'shared', label: 'Shared', icon: Users },
        { id: 'inbox', label: 'Inbox', icon: Inbox, badge: inboxCount },
        { id: 'profile', label: 'Profile', icon: UserCircle },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
            {/* Gradient Fade to Transparent (Above bar) */}
            <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-black to-transparent pointer-events-none" />

            <div className="bg-zinc-950/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-1 px-2 safe-area-bottom">
                <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                    {tabs.map((tab) => (
                        <MobileTabItem
                            key={tab.id}
                            {...tab}
                            active={activeTab === tab.id}
                            onClick={onTabChange}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
