import React, { useEffect, useRef } from 'react';
import {
    Home,
    FileText,
    CheckSquare,
    Settings,
    Code,
    Sparkles,
    LogOut
} from 'lucide-react';
import { Outlet, useNavigate, useParams, NavLink } from 'react-router-dom';
import ColorThief from 'colorthief';
import { ProjectProvider, useProjectContext } from '../../context/ProjectContext';

const MainNavLink = ({ to, label, icon: Icon }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `
            flex flex-col items-center justify-center gap-2 w-20 h-20 rounded-2xl 
            transition-all duration-200 group
            ${isActive ? 'bg-primary text-primary-foreground shadow-lg scale-105' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}
        `}
    >
        <Icon size={24} strokeWidth={2} />
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </NavLink>
);

export default function ProjectLayout() {
    const { projectId } = useParams();

    return (
        <ProjectProvider projectId={projectId}>
            <ProjectLayoutContent />
        </ProjectProvider>
    );
}

function ProjectLayoutContent() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { project } = useProjectContext();
    const containerRef = useRef(null);

    // Apply default gradient on mount
    useEffect(() => {
        if (containerRef.current) {
            // Default gradient with a subtle purple/blue tint
            containerRef.current.style.background = `
                radial-gradient(ellipse 80% 50% at 10% 20%, rgba(99, 102, 241, 0.12), transparent 50%),
                radial-gradient(ellipse 60% 40% at 90% 80%, rgba(99, 102, 241, 0.08), transparent 50%),
                radial-gradient(ellipse 100% 100% at 50% 50%, rgba(99, 102, 241, 0.02), transparent 70%),
                linear-gradient(180deg, #0c0c0d 0%, #09090b 50%, #070708 100%)
            `;
        }
    }, []);

    // Dynamic Theme Logic - enhances with icon colors when available
    useEffect(() => {
        if (project?.icon && containerRef.current) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = project.icon;

            img.onload = () => {
                try {
                    const colorThief = new ColorThief();

                    // Extract dominant color and a palette for richer theming
                    const dominantColor = colorThief.getColor(img);
                    const palette = colorThief.getPalette(img, 3); // Get top 3 colors

                    const [r, g, b] = dominantColor;
                    const { h, s, l } = rgbToHsl(r, g, b);

                    // Get secondary color from palette (if different enough from dominant)
                    let [r2, g2, b2] = palette[1] || dominantColor;
                    const { h: h2, s: s2, l: l2 } = rgbToHsl(r2, g2, b2);

                    // Update CSS Variables for smart color application
                    const root = document.documentElement;

                    // Primary color - for buttons, active states, main accents
                    root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
                    root.style.setProperty('--ring', `${h} ${s}% ${l}%`);

                    // Adjust primary-foreground based on luminance for readability
                    root.style.setProperty('--primary-foreground', l > 50 ? '0 0% 10%' : '0 0% 98%');

                    // Accent color from palette - for highlights, secondary elements
                    root.style.setProperty('--accent', `${h2} ${s2}% ${l2}%`);
                    root.style.setProperty('--accent-foreground', l2 > 50 ? '0 0% 10%' : '0 0% 98%');

                    // Apply a rich, multi-layer gradient background with the dominant color
                    containerRef.current.style.background = `
                        radial-gradient(ellipse 80% 50% at 10% 20%, rgba(${r}, ${g}, ${b}, 0.15), transparent 50%),
                        radial-gradient(ellipse 60% 40% at 90% 80%, rgba(${r}, ${g}, ${b}, 0.10), transparent 50%),
                        radial-gradient(ellipse 100% 100% at 50% 50%, rgba(${r}, ${g}, ${b}, 0.03), transparent 70%),
                        linear-gradient(180deg, #0c0c0d 0%, #09090b 50%, #070708 100%)
                    `;
                } catch (e) {
                    console.error("Color extraction failed", e);
                }
            };
        }
    }, [project?.icon]);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if input/textarea is focused, or within Monaco Editor, or contenteditable
            // Monaco Editor uses synthetic inputs, so we check for its container class
            const activeEl = document.activeElement;
            if (['INPUT', 'TEXTAREA'].includes(activeEl.tagName)) return;
            if (activeEl.isContentEditable) return;
            if (activeEl.closest('.monaco-editor')) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return; // Avoid conflict with browser shortcuts

            switch (e.key.toLowerCase()) {
                // Quick Actions
                case 'n':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('open-new-task'));
                    break;
                case 'd':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('open-new-doc'));
                    break;
                case 'u':
                    e.preventDefault();
                    // Trigger upload input
                    document.getElementById('quick-up')?.click();
                    window.dispatchEvent(new CustomEvent('trigger-upload'));
                    break;

                // Navigation
                case '1': e.preventDefault(); navigate(`/project/${projectId}/home`); break;
                case '2': e.preventDefault(); navigate(`/project/${projectId}/chat`); break;
                case '3': e.preventDefault(); navigate(`/project/${projectId}/files`); break;
                case '4': e.preventDefault(); navigate(`/project/${projectId}/editor`); break;
                case '5': e.preventDefault(); navigate(`/project/${projectId}/tasks`); break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [projectId, navigate]);

    const mainNavItems = [
        { to: `/project/${projectId}/home`, label: 'Home', icon: Home },
        { to: `/project/${projectId}/chat`, label: 'Advisor', icon: Sparkles },
        { to: `/project/${projectId}/tasks`, label: 'Tasks', icon: CheckSquare },
        { to: `/project/${projectId}/files`, label: 'Artifacts', icon: FileText },
        { to: `/project/${projectId}/editor`, label: 'Editor', icon: Code },
    ];

    return (
        <div ref={containerRef} className="h-screen w-screen bg-background flex antialiased overflow-hidden relative transition-colors duration-700">

            {/* Navigation Sidebar */}
            <nav className="w-28 flex-shrink-0 flex flex-col items-center pt-10 pb-3 z-20 bg-background/50 backdrop-blur-xl h-full">
                {/* 1. App Icon - uses static favicon */}
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl mb-6 cursor-pointer overflow-hidden transition-transform hover:scale-105" onClick={() => navigate('/dashboard')}>
                    <img src="/favicon-96x96.png" alt="Forge AI" className="w-full h-full object-contain" />
                </div>

                {/* Main Navigation - centered with flex-1 */}
                <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full px-2">
                    {mainNavItems.map(item => (
                        <MainNavLink key={item.to} {...item} />
                    ))}
                </div>

                {/* Utilities - at absolute bottom */}
                <div className="flex flex-col items-center gap-3">
                    <NavLink
                        to={`/project/${projectId}/settings`}
                        title="Settings"
                        className={({ isActive }) => `
                        p-3 rounded-xl transition-all duration-200
                        ${isActive
                                ? 'bg-primary/20 text-primary shadow-sm'
                                : 'bg-secondary/30 border border-border/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30'}
                    `}
                    >
                        <Settings size={20} />
                    </NavLink>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-3 text-muted-foreground hover:text-destructive transition-colors"
                        title="Exit Project"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </nav>

            {/* Main content wrapper */}
            <div className="flex-1 min-w-0 h-screen pt-3 pr-3 pb-3 pl-0 z-10">
                <main className="h-full w-full bg-black/40 flex flex-col relative overflow-hidden rounded-2xl border border-white/5 shadow-2xl backdrop-blur-md">
                    {/* Frame Gradient Overlays - Visible Inside The Glass */}
                    {/* Top Left: Primary Glow with multiple layers for depth */}
                    <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-primary/10 rounded-full blur-[150px] pointer-events-none z-0 mix-blend-screen" />
                    <div className="absolute top-[5%] left-[5%] w-[30%] h-[30%] bg-primary/15 rounded-full blur-[90px] pointer-events-none z-0 mix-blend-screen" />

                    {/* Accent Glow - Also moved to Top-Left/Center area for unified light source */}
                    <div className="absolute -top-[10%] left-[0%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-screen" />

                    {/* Subtle ambient fill - kept low */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-primary/5 pointer-events-none z-0" />

                    <div className="flex-1 overflow-y-auto relative z-10">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
