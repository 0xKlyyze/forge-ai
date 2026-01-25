import React from 'react';
import {
    Layers,
    Users,
    Inbox,
    UserCircle,
    Settings,
    LogOut,
    ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';

const TabItem = ({ id, label, icon: Icon, active, onClick, badge }) => (
    <motion.button
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onClick(id)}
        className={`
      w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group
      ${active
                ? 'bg-blue-600/10 border border-blue-500/20 text-white shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5 border border-transparent'}
    `}
    >
        <div className="flex items-center gap-3">
            <div className={`
        p-2 rounded-lg transition-colors duration-300
        ${active ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-900 text-zinc-500 group-hover:text-zinc-200'}
      `}>
                <Icon size={18} />
            </div>
            <span className="font-medium text-sm tracking-tight">{label}</span>
        </div>
        <div className="flex items-center gap-2">
            {badge > 0 && (
                <span className="flex items-center justify-center w-5 h-5 bg-blue-500 text-[10px] font-bold text-white rounded-full shadow-lg shadow-blue-500/40 animate-pulse">
                    {badge}
                </span>
            )}
            {active && (
                <motion.div layoutId="activeInd" className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            )}
        </div>
    </motion.button>
);

export default function DashboardSidebar({ activeTab, onTabChange, onLogout, inboxCount }) {
    const tabs = [
        { id: 'projects', label: 'My Projects', icon: Layers },
        { id: 'shared', label: 'Shared Projects', icon: Users },
        { id: 'inbox', label: 'Inbox', icon: Inbox, badge: inboxCount },
        { id: 'profile', label: 'Profile', icon: UserCircle },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="w-72 h-full flex flex-col bg-zinc-950/50 backdrop-blur-2xl border-r border-white/5 p-6 z-20">
            {/* Brand */}
            <div className="flex items-center gap-4 mb-10 px-2">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <div className="relative bg-black rounded-xl p-2.5 border border-white/10">
                        <img src="/favicon.svg" alt="Forge" className="w-6 h-6 object-contain" />
                    </div>
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white">Forge</h1>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em]">Development Suite</p>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 space-y-2">
                <div className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-4 px-4">Menu</div>
                {tabs.slice(0, 3).map((tab) => (
                    <TabItem
                        key={tab.id}
                        {...tab}
                        active={activeTab === tab.id}
                        onClick={onTabChange}
                    />
                ))}

                <div className="pt-6 pb-2 text-[11px] font-bold text-zinc-600 uppercase tracking-widest px-4">Account Setting</div>
                {tabs.slice(3).map((tab) => (
                    <TabItem
                        key={tab.id}
                        {...tab}
                        active={activeTab === tab.id}
                        onClick={onTabChange}
                    />
                ))}
            </div>

            {/* Footer / Logout */}
            <div className="mt-auto pt-6 border-t border-white/5">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all duration-300 group mt-2"
                >
                    <div className="p-2 bg-zinc-900 rounded-lg group-hover:bg-red-500/10 transition-colors">
                        <LogOut size={18} />
                    </div>
                    <span className="font-medium text-sm">Sign Out</span>
                </button>


            </div>
        </div>
    );
}
