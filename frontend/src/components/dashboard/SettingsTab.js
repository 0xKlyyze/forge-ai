import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { motion } from 'framer-motion';
import { Sliders, Monitor, Keyboard, Command, Search, Zap } from 'lucide-react';

export default function SettingsTab() {
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
            className="max-w-4xl mx-auto space-y-8 py-4 px-2"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* General Settings */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900/50 border-white/5 text-white backdrop-blur-xl rounded-3xl overflow-hidden h-full">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                    <Sliders size={18} />
                                </div>
                                <CardTitle className="text-lg">Workspace</CardTitle>
                            </div>
                            <CardDescription className="text-zinc-500">Configure your global development preferences.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-2">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium text-zinc-200">Auto-save</Label>
                                    <p className="text-xs text-zinc-500">Automatically save changes in the editor.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator className="bg-white/5" />
                            <div className="flex items-center justify-between p-2">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium text-zinc-200">AI Assistance</Label>
                                    <p className="text-xs text-zinc-500">Enable proactive AI suggestions.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Appearance */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900/50 border-white/5 text-white backdrop-blur-xl rounded-3xl overflow-hidden h-full">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                                    <Monitor size={18} />
                                </div>
                                <CardTitle className="text-lg">Interface</CardTitle>
                            </div>
                            <CardDescription className="text-zinc-500">Customize the look and feel of your experience.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-2">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium text-zinc-200">3D Effects</Label>
                                    <p className="text-xs text-zinc-500">Enable 3D tilt and depth animations.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator className="bg-white/5" />
                            <div className="flex items-center justify-between p-2">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium text-zinc-200">High Contrast</Label>
                                    <p className="text-xs text-zinc-500">Enhance visibility for UI elements.</p>
                                </div>
                                <Switch />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Shortcuts */}
                <motion.div variants={itemVariants} className="md:col-span-2">
                    <Card className="bg-zinc-900/50 border-white/5 text-white backdrop-blur-xl rounded-3xl overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                                    <Keyboard size={18} />
                                </div>
                                <CardTitle className="text-lg">Keyboard Hotkeys</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Zap className="w-4 h-4 text-zinc-500" />
                                        <span className="text-sm text-zinc-300">New Project</span>
                                    </div>
                                    <kbd className="h-6 px-2 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-400">N</kbd>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Search className="w-4 h-4 text-zinc-500" />
                                        <span className="text-sm text-zinc-300">Universal Search</span>
                                    </div>
                                    <kbd className="h-6 px-2 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-400">/</kbd>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Command className="w-4 h-4 text-zinc-500" />
                                        <span className="text-sm text-zinc-300">Command Palette</span>
                                    </div>
                                    <kbd className="h-6 px-2 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-400">Ctrl+K</kbd>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </motion.div>
    );
}
