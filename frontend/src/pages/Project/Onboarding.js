import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Rocket, FileText, Code, Layers, Palette, Link, ArrowRight, ArrowLeft, SkipForward, AlertTriangle, Cpu, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import FileEditor from '../../components/Editor';

const STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to Forge',
        description: "Let's set up your new project for success. We'll guide you through defining the core documentation and integrations.",
        icon: Rocket
    },
    {
        id: 'overview',
        title: 'Project Overview',
        description: 'Define the core concept, target user, and key features.',
        file: 'Project-Overview.md',
        icon: FileText
    },
    {
        id: 'plan',
        title: 'Implementation Plan',
        description: 'Outline the phases of development and milestones.',
        file: 'Implementation-Plan.md',
        icon: Layers
    },
    {
        id: 'stack',
        title: 'Technical Stack',
        description: 'Specify the technologies, frameworks, and tools you will use.',
        file: 'Technical-Stack.md',
        icon: Code
    },
    {
        id: 'guidelines',
        title: 'UI/Design Guidelines',
        description: 'Set the tone for colors, typography, and design principles.',
        file: 'UI-Guidelines.md',
        icon: Palette
    },
    {
        id: 'links',
        title: 'Integrations',
        description: 'Connect your resources for easy access.',
        icon: Link
    }
];

const LOADING_MESSAGES = [
    "Consulting the oracle of silica...",
    "Analyzing project potential...",
    "Checking technical feasibility...",
    "Evaluating market viability...",
    "Reviewing architectural patterns...",
    "Calculating innovation score..."
];

const ICONS = {
    "ai-studio": "https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/aistudio.png",
    "firebase": "https://brandlogos.net/wp-content/uploads/2025/03/firebase_icon-logo_brandlogos.net_tcvck-512x646.png",
    "google-cloud": "https://cdn.creazilla.com/icons/3253833/google-cloud-icon-sm.png",
    "github": "https://cdn-icons-png.flaticon.com/512/2111/2111432.png"
};

export default function Onboarding() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [files, setFiles] = useState([]);
    const [project, setProject] = useState(null);

    // State for content and modification tracking
    const [fileContents, setFileContents] = useState({});
    const [initialFileContents, setInitialFileContents] = useState({});

    // Track set of modified files to ensure we don't lose track if user goes back
    const [modifiedFilesSet, setModifiedFilesSet] = useState(new Set());

    const [links, setLinks] = useState({
        firebase: '',
        aiStudio: '',
        gcp: '',
        github: ''
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Assessment State
    const [showAssessment, setShowAssessment] = useState(false);
    const [assessmentLoading, setAssessmentLoading] = useState(false);
    const [assessmentData, setAssessmentData] = useState(null);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [projRes, filesRes] = await Promise.all([
                    api.get(`/projects/${projectId}`),
                    api.get(`/projects/${projectId}/files`)
                ]);
                setProject(projRes.data);
                setFiles(filesRes.data);

                // Populate content
                const contents = {};
                filesRes.data.forEach(f => {
                    contents[f.name] = f.content;
                });
                setFileContents(contents);
                setInitialFileContents(contents);

                // Populate links
                const linkMap = {};
                (projRes.data.links || []).forEach(l => {
                    if (l.type) linkMap[l.type] = l.url;
                });
                setLinks(prev => ({ ...prev, ...linkMap }));

                setLoading(false);
            } catch (error) {
                toast.error("Failed to load project data");
                navigate('/dashboard');
            }
        };
        fetchData();
    }, [projectId, navigate]);

    // Cycling loading messages
    useEffect(() => {
        if (assessmentLoading) {
            const interval = setInterval(() => {
                setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [assessmentLoading]);

    const handleFileChange = (fileName, newContent) => {
        setFileContents(prev => ({ ...prev, [fileName]: newContent }));

        // Check if truly modified from initial
        if (newContent !== initialFileContents[fileName]) {
            setModifiedFilesSet(prev => new Set(prev).add(fileName));
        }
    };

    const handleNext = async () => {
        const step = STEPS[currentStep];
        setSaving(true);

        try {
            // Save current step data if it's a file step
            if (step.file) {
                const file = files.find(f => f.name === step.file);
                const content = fileContents[step.file];

                // Only save if modified from what we initially loaded (or last saved)
                if (file && content !== undefined && content !== initialFileContents[step.file]) {
                    await api.put(`/files/${file.id}`, { content: content });

                    // Update initial content to reflect saved state
                    setInitialFileContents(prev => ({ ...prev, [step.file]: content }));

                    // Add to modified set (should already be there, but double check)
                    setModifiedFilesSet(prev => new Set(prev).add(step.file));
                }
            }

            // Navigation logic
            if (currentStep < STEPS.length - 1) {
                setCurrentStep(c => c + 1);
            } else {
                // Last step (Links)
                await saveLinks();

                // Trigger Assessment if ANY files were modified during this session
                if (modifiedFilesSet.size > 0 && !assessmentData) {
                    setShowAssessment(true);
                    generateAssessment();
                } else {
                    completeOnboarding();
                }
            }
        } catch (error) {
            console.error("Save failed", error);
            toast.error("Failed to save progress");
        } finally {
            setSaving(false);
        }
    };

    const saveLinks = async () => {
        const newLinks = [];
        if (links.firebase) newLinks.push({ title: 'Firebase Console', url: links.firebase, type: 'firebase' });
        if (links.aiStudio) newLinks.push({ title: 'Google AI Studio', url: links.aiStudio, type: 'ai-studio' });
        if (links.gcp) newLinks.push({ title: 'Google Cloud Platform', url: links.gcp, type: 'gcp' });
        if (links.github) newLinks.push({ title: 'GitHub Repository', url: links.github, type: 'github' });

        if (newLinks.length > 0) {
            await api.put(`/projects/${projectId}`, { links: newLinks });
        }
    };

    const handleBack = () => {
        if (showAssessment) {
            setShowAssessment(false);
            return;
        }
        if (currentStep > 0) {
            setCurrentStep(c => c - 1);
        }
    };

    const handleSkip = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(c => c + 1);
        } else {
            completeOnboarding();
        }
    };

    const handleSkipSetup = () => {
        navigate(`/project/${projectId}/home`);
    }

    const completeOnboarding = () => {
        toast.success("Project setup complete!");
        navigate(`/project/${projectId}/home`);
    };

    const generateAssessment = async () => {
        setAssessmentLoading(true);
        try {
            const res = await api.post(`/projects/${projectId}/assessment`);
            setAssessmentData(res.data);
        } catch (error) {
            console.error("Assessment failed", error);
            // Don't auto-skip, let user see error and decide
            toast.error("Assessment generation failed. Taking you to dashboard...");
            setTimeout(completeOnboarding, 1500);
        } finally {
            setAssessmentLoading(false);
        }
    };

    const renderStepContent = () => {
        const step = STEPS[currentStep];

        // Welcome Step
        if (step.id === 'welcome') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                        <div className="h-32 w-32 bg-secondary/30 rounded-3xl border border-white/10 flex items-center justify-center relative backdrop-blur-sm">
                            <Rocket className="h-16 w-16 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.6)]" />
                        </div>
                    </div>

                    <div className="space-y-4 max-w-2xl">
                        <h2 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/50">
                            Welcome to {project?.name}
                        </h2>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            Your new workspace is ready. Let's spend a moment to define the vision and set up your tools for maximum productivity.
                        </p>
                    </div>

                    <div className="pt-8 flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
                        <Button size="lg" onClick={handleNext} className="rounded-full px-8 text-lg h-14 w-full shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all">
                            Start Setup <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        <Button variant="outline" size="lg" onClick={handleSkipSetup} className="rounded-full px-8 text-lg h-14 w-full bg-transparent border-white/10 hover:bg-white/5">
                            Skip Setup
                        </Button>
                    </div>
                </div>
            );
        }

        // Links Step with Cards
        if (step.id === 'links') {
            const integrations = [
                { label: 'Firebase Console', key: 'firebase', placeholder: 'https://console.firebase.google.com/...', icon: ICONS.firebase },
                { label: 'Google AI Studio', key: 'aiStudio', placeholder: 'https://aistudio.google.com/...', icon: ICONS['ai-studio'] },
                { label: 'Google Cloud Platform', key: 'gcp', placeholder: 'https://console.cloud.google.com/...', icon: ICONS['google-cloud'] },
                { label: 'GitHub Repository', key: 'github', placeholder: 'https://github.com/...', icon: ICONS.github }
            ];

            return (
                <div className="h-full flex flex-col max-w-4xl mx-auto w-full animate-in slide-in-from-right-10 duration-500 overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {integrations.map((field) => (
                            <div key={field.key} className="bg-secondary/20 hover:bg-secondary/30 border border-white/5 hover:border-primary/20 transition-all rounded-2xl p-5 group flex flex-col gap-4">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center p-2 group-hover:bg-white/10 transition-colors">
                                        <img src={field.icon} alt={field.label} className="w-full h-full object-contain" />
                                    </div>
                                    <h3 className="font-semibold text-lg">{field.label}</h3>
                                </div>
                                <div className="space-y-1">
                                    <div className="relative">
                                        <Input
                                            value={links[field.key]}
                                            onChange={e => setLinks({ ...links, [field.key]: e.target.value })}
                                            placeholder={field.placeholder}
                                            className="bg-black/20 border-white/10 h-10 text-sm focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-primary/50 pr-8"
                                        />
                                        {links[field.key] && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                                                <ExternalLink className="h-3 w-3" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Markdown File Steps (Editor)
        return (
            <div className="h-[calc(100vh-200px)] flex flex-col animate-in slide-in-from-right-10 duration-500">
                <div className="bg-[#1e1e1e] rounded-xl border border-white/10 flex-1 relative overflow-hidden flex flex-col shadow-2xl">
                    <div className="h-10 border-b border-white/5 bg-black/40 flex justify-between items-center px-4 shrink-0">
                        <div className="flex items-center gap-2">
                            <step.icon className="h-4 w-4 text-primary" />
                            <span className="text-xs font-mono text-muted-foreground">{step.file}</span>
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                        </div>
                    </div>
                    {/*
                        Use FileEditor here.
                        We construct a mock 'file' object because Editor expects {name, content}
                    */}
                    <div className="flex-1 min-h-0 relative">
                        <FileEditor
                            file={{
                                name: step.file,
                                content: fileContents[step.file] || '' // Fallback to empty string
                            }}
                            onChange={(val) => handleFileChange(step.file, val)}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const renderAssessment = () => {
        if (assessmentLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-12 animate-in fade-in duration-700">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
                        <div className="relative h-32 w-32 rounded-full border-2 border-primary/30 flex items-center justify-center">
                            <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin" />
                            <Cpu className="h-12 w-12 text-primary animate-pulse" />
                        </div>
                    </div>
                    <div className="space-y-4 max-w-md mx-auto">
                        <h3 className="text-3xl font-bold tracking-tight">AI Assessment</h3>
                        <div className="h-6 overflow-hidden relative">
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={loadingMessageIndex}
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -20, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-lg text-muted-foreground text-center w-full absolute"
                                >
                                    {LOADING_MESSAGES[loadingMessageIndex]}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={completeOnboarding} className="text-muted-foreground hover:text-white border border-white/5 hover:bg-white/5 rounded-full px-6">
                        Skip Assessment
                    </Button>
                </div>
            )
        }

        if (!assessmentData) return null;

        return (
            <div className="flex flex-col h-full max-w-5xl mx-auto animate-in fade-in zoom-in duration-500 py-10">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-4 ring-1 ring-primary/30">
                        <Cpu className="h-5 w-5 text-primary mr-2" />
                        <span className="text-xs font-bold text-primary uppercase tracking-widest">Analysis Complete</span>
                    </div>
                    <h2 className="text-5xl font-black mb-3 tracking-tighter sm:text-6xl">Brutal Assessment</h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Here is an honest, AI-generated look at your project's potential based on your initial documentation.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {[
                        { label: 'Innovation', value: assessmentData.ratings?.innovation, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
                        { label: 'Feasibility', value: assessmentData.ratings?.feasibility, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
                        { label: 'Market Potential', value: assessmentData.ratings?.market_potential, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' }
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`p-8 rounded-3xl text-center relative overflow-hidden backdrop-blur-sm border ${stat.border}`}
                        >
                            <div className={`absolute inset-0 ${stat.bg} blur-xl opacity-50`} />
                            <div className="relative">
                                <div className={`text-6xl font-black mb-3 ${stat.color}`}>{stat.value}<span className="text-2xl text-muted-foreground/50">/10</span></div>
                                <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex-1 bg-[#151515] border border-white/10 rounded-3xl p-8 space-y-8 overflow-y-auto shadow-2xl relative"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />

                    <div>
                        <h4 className="flex items-center gap-2 font-bold text-xl mb-4 text-red-400">
                            <AlertTriangle className="h-5 w-5" /> Critical Considerations
                        </h4>
                        <ul className="grid gap-3">
                            {assessmentData.unclear_areas?.map((item, i) => (
                                <li key={i} className="flex gap-3 text-muted-foreground bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="flex items-center gap-2 font-bold text-xl mb-4 text-white">
                            The Verdict
                        </h4>
                        <div className="text-lg leading-relaxed text-white/90 p-6 bg-white/5 rounded-2xl border-l-4 border-primary italic">
                            "{assessmentData.summary}"
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 flex justify-center"
                >
                    <Button size="lg" className="rounded-full px-12 h-14 text-lg shadow-lg hover:shadow-primary/25 transition-all" onClick={completeOnboarding}>
                        Enter Workspace <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </motion.div>
            </div>
        )
    };

    if (loading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
    );

    // Show Assessment View
    if (showAssessment) {
        return (
            <div className="min-h-screen bg-background flex flex-col p-4 md:p-8">
                {renderAssessment()}
            </div>
        );
    }

    const currentStepData = STEPS[currentStep];

    return (
        <div className="min-h-screen bg-background flex flex-col overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none user-select-none">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Simple Progress Bar */}
            <div className="h-1 bg-white/5 w-full fixed top-0 left-0 z-50">
                <motion.div
                    className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep) / (STEPS.length - 1)) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                />
            </div>

            <div className="flex-1 flex flex-col container mx-auto px-4 py-6 max-w-6xl h-screen relative z-10">
                {/* Header */}
                {currentStep > 0 && (
                    <div className="mb-4 text-center shrink-0 pt-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="flex items-center justify-center gap-2 text-primary mb-3">
                                    <div className="bg-primary/10 p-1.5 rounded-lg">
                                        <currentStepData.icon className="h-4 w-4" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-primary/80">Step {currentStep} of {STEPS.length - 1}</span>
                                </div>
                                <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">{currentStepData.title}</h1>
                                <p className="text-lg text-muted-foreground">{currentStepData.description}</p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 relative mb-4 min-h-0 flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="h-full flex flex-col"
                        >
                            {renderStepContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Floating Navigation Dock */}
                {currentStep > 0 && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[#151515]/80 backdrop-blur-xl border border-white/10 rounded-full p-2 pl-6 pr-2 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-500 hover:border-primary/30 transition-colors">
                        <Button
                            variant="ghost"
                            onClick={handleBack}
                            disabled={loading || saving}
                            className="text-muted-foreground hover:text-white rounded-full hover:bg-white/5"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>

                        <div className="h-6 w-px bg-white/10" />

                        <Button
                            variant="ghost"
                            onClick={handleSkip}
                            disabled={saving}
                            className="text-muted-foreground hover:text-white rounded-full hover:bg-white/5"
                        >
                            Skip
                        </Button>
                        <Button
                            onClick={handleNext}
                            disabled={saving}
                            size="lg"
                            className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all h-10"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                </>
                            ) : currentStep === STEPS.length - 1 ? (
                                modifiedFilesSet.size > 0 ? 'Analyze & Finish' : 'Finish'
                            ) : (
                                <>
                                    Next <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
