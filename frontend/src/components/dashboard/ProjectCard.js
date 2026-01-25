import React, { useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import {
    Clock,
    Trash2,
    Code,
    FileText,
    CheckCircle2,
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ColorThief from 'colorthief';

// --- 3D Tilt Hook (Reused) ---
function use3DTilt(stiffness = 500, damping = 100, intensity = 5) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness, damping });
    const mouseY = useSpring(y, { stiffness, damping });

    function onMouseMove({ currentTarget, clientX, clientY }) {
        const { left, top, width, height } = currentTarget.getBoundingClientRect();
        const xPct = (clientX - left) / width - 0.5;
        const yPct = (clientY - top) / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    }

    function onMouseLeave() {
        x.set(0);
        y.set(0);
    }

    const rotateX = useTransform(mouseY, [-0.5, 0.5], [intensity, -intensity]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-intensity, intensity]);

    return { onMouseMove, onMouseLeave, rotateX, rotateY };
}

// --- Helper: RGB to HSL ---
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

// --- Helper: Generate Consistent Fallback Color ---
const getFallbackColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return {
        bg: `hsla(${hue}, 70%, 50%, 0.1)`,
        border: `hsla(${hue}, 70%, 50%, 0.3)`,
        glow: `hsla(${hue}, 70%, 50%, 0.5)`,
        text: `hsla(${hue}, 80%, 70%, 1)`
    };
};

export default function ProjectCard({ project, onDelete }) {
    const { onMouseMove, onMouseLeave, rotateX, rotateY } = use3DTilt();
    const [colors, setColors] = useState(getFallbackColor(project.id + project.name));
    const processedRef = useRef(false);

    // Extract dominant color from logo if available
    useEffect(() => {
        if (project.icon && !processedRef.current) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = project.icon;

            img.onload = () => {
                try {
                    const colorThief = new ColorThief();
                    const [r, g, b] = colorThief.getColor(img);
                    const { h, s, l } = rgbToHsl(r, g, b);

                    // Create palette based on extracted HSL
                    // We increase saturation/lightness slightly for the glow/text to ensure visibility on dark bg
                    setColors({
                        bg: `hsla(${h}, ${s}%, ${l}%, 0.1)`,
                        border: `hsla(${h}, ${s}%, ${l}%, 0.3)`,
                        glow: `hsla(${h}, ${s}%, ${l}%, 0.5)`,
                        text: `hsla(${h}, ${Math.min(s + 10, 100)}%, ${Math.max(l, 70)}%, 1)` // Ensure text is light enough
                    });
                    processedRef.current = true;
                } catch (e) {
                    console.warn("Color extraction failed, using fallback", e);
                }
            };
        }
    }, [project.icon]);


    // Calculate Progress
    const totalTasks = project.task_count || 0;
    const completedTasks = project.completed_tasks || 0;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            layoutId={project.id}
            className="group relative h-[280px]" // Fixed height for consistency
            style={{ perspective: 1000 }}
        >
            <Link to={`/project/${project.id}`} className="block h-full">
                <motion.div
                    onMouseMove={onMouseMove}
                    onMouseLeave={onMouseLeave}
                    style={{
                        rotateX,
                        rotateY,
                        transformStyle: "preserve-3d",
                        background: `linear-gradient(145deg, rgba(24, 24, 27, 0.9), rgba(9, 9, 11, 0.95))`,
                    }}
                    className="h-full rounded-3xl border border-white/5 relative overflow-hidden transition-all duration-300 shadow-xl group-hover:shadow-2xl"
                >
                    {/* Dynamic colored glow effect on hover */}
                    <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                        style={{
                            background: `radial-gradient(circle at 50% 0%, ${colors.bg}, transparent 70%)`
                        }}
                    />

                    {/* Top Border Accent */}
                    <div
                        className="absolute top-0 left-0 right-0 h-[1px] opacity-20 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: `linear-gradient(90deg, transparent, ${colors.glow}, transparent)` }}
                    />

                    {/* Content Container */}
                    <div className="relative z-10 h-full flex flex-col p-6" style={{ transform: "translateZ(20px)" }}>

                        {/* Header: Icon & Options */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="relative">
                                {project.icon ? (
                                    <div className="h-14 w-14 rounded-2xl bg-black/50 overflow-hidden shadow-lg border border-white/10 group-hover:border-white/20 transition-colors">
                                        <img src={project.icon} alt={project.name} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div
                                        className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg border border-white/10 transition-colors"
                                        style={{ background: `linear-gradient(135deg, ${colors.bg}, rgba(0,0,0,0.5))` }}
                                    >
                                        <Code className="h-6 w-6" style={{ color: colors.text }} />
                                    </div>
                                )}
                                {/* Status Dot */}
                                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-zinc-950 flex items-center justify-center">
                                    <span className={`h-2.5 w-2.5 rounded-full ${project.status === 'planning' ? 'bg-amber-500' : project.status === 'building' ? 'bg-blue-500' : 'bg-green-500'}`} />
                                </div>
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDelete(project);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Project Info */}
                        <div className="mb-auto">
                            <h3 className="text-xl font-bold text-zinc-100 group-hover:text-white transition-colors truncate mb-1">
                                {project.name}
                            </h3>
                            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {project.last_edited ? formatDistanceToNow(new Date(project.last_edited), { addSuffix: true }) : 'Just now'}
                            </p>
                        </div>

                        {/* Stats & Progress */}
                        <div className="space-y-4 mt-4">
                            {/* Simple Stats Row */}
                            <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
                                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                                    <span>{project.file_count || 0} Files</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                    <span>{completedTasks}/{totalTasks} Tasks</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-1000 ease-out"
                                    style={{
                                        width: `${progress}%`,
                                        background: `linear-gradient(90deg, ${colors.glow}, ${colors.text})`
                                    }}
                                />
                            </div>

                            {/* Hover CTA */}
                            <div className="flex items-center justify-between pt-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-300">
                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.text }}>Open Project</span>
                                <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
                                    <ArrowRight className="w-3 h-3 text-white" />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Bottom Gradient Fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                </motion.div>
            </Link>
        </motion.div>
    );
}
