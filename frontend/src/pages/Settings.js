import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, Monitor, Keyboard, Sliders, Command } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';

export default function Settings() {
    const navigate = useNavigate();

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
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto px-6 py-12 relative z-10 max-w-4xl">
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
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                    <p className="text-muted-foreground">Manage your workspace preferences and shortcuts.</p>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="bg-white/5 border border-white/10 p-1 mb-8">
                            <TabsTrigger value="general" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground">
                                <Sliders className="w-4 h-4 mr-2" />
                                General
                            </TabsTrigger>
                            <TabsTrigger value="appearance" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground">
                                <Monitor className="w-4 h-4 mr-2" />
                                Appearance
                            </TabsTrigger>
                            <TabsTrigger value="shortcuts" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground">
                                <Keyboard className="w-4 h-4 mr-2" />
                                Shortcuts
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="general">
                            <motion.div variants={itemVariants} initial="hidden" animate="visible">
                                <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                                    <CardHeader>
                                        <CardTitle>Workspace Preferences</CardTitle>
                                        <CardDescription className="text-muted-foreground">Customize your general workflow settings.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base text-white">Auto-save</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    Automatically save changes in the editor.
                                                </p>
                                            </div>
                                            <Switch defaultChecked />
                                        </div>
                                        <Separator className="bg-white/10" />
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base text-white">Notifications</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    Receive toast notifications for actions.
                                                </p>
                                            </div>
                                            <Switch defaultChecked />
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </TabsContent>

                        <TabsContent value="appearance">
                            <motion.div variants={itemVariants} initial="hidden" animate="visible">
                                <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                                    <CardHeader>
                                        <CardTitle>Theme Settings</CardTitle>
                                        <CardDescription className="text-muted-foreground">Adjust the look and feel of the environment.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base text-white">Reduced Motion</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    Disable complex animations.
                                                </p>
                                            </div>
                                            <Switch />
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </TabsContent>

                        <TabsContent value="shortcuts">
                            <motion.div variants={itemVariants} initial="hidden" animate="visible">
                                <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                                    <CardHeader>
                                        <CardTitle>Keyboard Shortcuts</CardTitle>
                                        <CardDescription className="text-muted-foreground">Speed up your workflow with these hotkeys.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-4">
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-md bg-blue-500/10 text-blue-400">
                                                        <Command className="w-5 h-5" />
                                                    </div>
                                                    <span className="font-medium">Create New Project</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-2 font-mono text-xs font-medium opacity-100">
                                                        N
                                                    </kbd>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-md bg-purple-500/10 text-purple-400">
                                                        <Search className="w-5 h-5" />
                                                    </div>
                                                    <span className="font-medium">Focus Search</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-2 font-mono text-xs font-medium opacity-100">
                                                        /
                                                    </kbd>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </TabsContent>
                    </Tabs>
                </motion.div>
            </div>
        </div>
    );
}

function Search({ className }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    )
}
