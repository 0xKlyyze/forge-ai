import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Home,
    Sparkles,
    CheckSquare,
    FileText,
    Code,
    Settings,
    LogOut,
    LogIn
} from 'lucide-react';

const MobileNavItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `
            relative flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-300
            ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
        `}
    >
        {({ isActive }) => (
            <>
                {isActive && (
                    <motion.div
                        layoutId="projectMobileNavActive"
                        className="absolute inset-0 bg-primary/20 rounded-full blur-[2px]"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                )}
                <div className={`relative z-10 p-2 rounded-full ${isActive ? 'bg-primary shadow-lg shadow-primary/40' : ''}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
            </>
        )}
    </NavLink>
);

export default function ProjectMobileNav({ baseUrl, readOnly }) {
    // Nav Items - matched with Layout.js
    const navItems = [
        { to: `${baseUrl}/home`, label: 'Home', icon: Home },
        { to: `${baseUrl}/chat`, label: 'Advisor', icon: Sparkles },
        { to: `${baseUrl}/tasks`, label: 'Tasks', icon: CheckSquare },
        { to: `${baseUrl}/files`, label: 'Files', icon: FileText },
        { to: `${baseUrl}/editor`, label: 'Editor', icon: Code },
    ];

    return (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full px-4 max-w-sm">
            <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-full p-2 shadow-2xl flex items-center justify-between">

                {/* Main Nav Items */}
                <div className="flex items-center justify-between flex-1 px-2">
                    {navItems.map((item) => (
                        <MobileNavItem key={item.to} {...item} />
                    ))}
                </div>

                {/* Settings / Auth Separator */}
                <div className="w-px h-8 bg-white/10 mx-1" />

                {/* Settings / Auth Action */}
                <div className="pl-1 pr-2">
                    {!readOnly ? (
                        <NavLink to={`${baseUrl}/settings`} className={({ isActive }) => `flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white transition-colors ${isActive ? 'text-white border-white/20' : ''}`}>
                            <Settings size={18} />
                        </NavLink>
                    ) : (
                        <a href="/login" className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white transition-colors">
                            <LogIn size={18} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
