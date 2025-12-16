import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../authContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, Loader2,
  Bot, FileText, CheckCircle2, MessageSquare, Code2, Layers,
  Zap, Target, LayoutGrid, Palette
} from 'lucide-react';

// 3D Tilt Hook
function use3DTilt(stiffness = 400, damping = 90, intensity = 12) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseX = useSpring(x, { stiffness, damping });
  const mouseY = useSpring(y, { stiffness, damping });

  function onMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    x.set((clientX - left) / width - 0.5);
    y.set((clientY - top) / height - 0.5);
  }

  function onMouseLeave() { x.set(0); y.set(0); }

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-intensity, intensity]);

  return { onMouseMove, onMouseLeave, rotateX, rotateY };
}

// Feature showcase data
const FEATURES = [
  {
    icon: Bot,
    title: "AI Advisor",
    description: "Get intelligent guidance on your project",
    color: "from-blue-500 to-cyan-400",
    preview: (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="w-3 h-3 text-blue-400" />
          <span>AI is thinking...</span>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-xs">
          "Based on your project structure, I recommend implementing authentication first..."
        </div>
      </div>
    )
  },
  {
    icon: LayoutGrid,
    title: "Task Management",
    description: "Kanban boards, Eisenhower matrix & more",
    color: "from-purple-500 to-pink-400",
    preview: (
      <div className="flex gap-2">
        {['To Do', 'In Progress', 'Done'].map((col, i) => (
          <div key={col} className="flex-1 bg-white/5 rounded-lg p-2">
            <div className="text-[10px] font-medium text-muted-foreground mb-1">{col}</div>
            {[...Array(3 - i)].map((_, j) => (
              <div key={j} className="h-4 bg-white/10 rounded mb-1" />
            ))}
          </div>
        ))}
      </div>
    )
  },
  {
    icon: Code2,
    title: "Live Editor",
    description: "Code and preview components in real-time",
    color: "from-green-500 to-emerald-400",
    preview: (
      <div className="flex gap-2 h-16">
        <div className="flex-1 bg-black/50 rounded-lg p-2 font-mono text-[8px] text-green-400 overflow-hidden">
          {'<div className="p-4">\n  <h1>Hello</h1>\n</div>'}
        </div>
        <div className="flex-1 bg-white/5 rounded-lg p-2 flex items-center justify-center text-xs">
          <span className="text-white/60">Preview</span>
        </div>
      </div>
    )
  },
  {
    icon: MessageSquare,
    title: "Smart Chat",
    description: "Context-aware conversations with web search",
    color: "from-amber-500 to-orange-400",
    preview: (
      <div className="space-y-1">
        <div className="flex gap-2 items-start">
          <div className="w-4 h-4 rounded-full bg-amber-500/30 flex items-center justify-center text-[8px]">U</div>
          <div className="bg-white/5 rounded-lg px-2 py-1 text-[10px]">How do I deploy?</div>
        </div>
        <div className="flex gap-2 items-start">
          <div className="w-4 h-4 rounded-full bg-blue-500/30 flex items-center justify-center"><Bot className="w-2 h-2" /></div>
          <div className="bg-blue-500/10 rounded-lg px-2 py-1 text-[10px] flex-1">Here's how to deploy to Cloud Run...</div>
        </div>
      </div>
    )
  }
];

// Animated Feature Card
function FeatureCard({ feature, isActive, onClick }) {
  const Icon = feature.icon;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left p-3 rounded-xl border transition-all duration-300 ${isActive
        ? 'bg-white/10 border-white/20 shadow-lg'
        : 'bg-white/5 border-white/5 hover:border-white/10'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{feature.title}</div>
          <div className="text-xs text-muted-foreground truncate">{feature.description}</div>
        </div>
      </div>
    </motion.button>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { onMouseMove, onMouseLeave, rotateX, rotateY } = use3DTilt();

  // Auto-cycle through features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % FEATURES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back to Forge!");
      navigate('/dashboard');
    } catch (error) {
      toast.error("Invalid credentials. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background Gradient Blobs */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute top-[-20%] right-[-5%] w-[700px] h-[700px] bg-blue-600/25 rounded-full blur-[150px] pointer-events-none"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
        className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute top-[50%] left-[30%] w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"
      />

      {/* Main Content - Side by Side Layout */}
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Left Side - App Preview */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
                    className="relative group"
                  >
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity" />
                    <div className="relative bg-black rounded-lg p-2 border border-white/10">
                      <img src="/favicon.svg" alt="Forge" className="w-8 h-8 object-contain" />
                    </div>
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                      Forge AI
                    </h2>
                    <p className="text-xs text-muted-foreground">Development Suite</p>
                  </div>
                </div>
                <p className="text-lg text-white/80 max-w-md">
                  Your AI-powered project management and development companion.
                </p>
              </div>

              {/* Feature Cards */}
              <div className="space-y-2">
                {FEATURES.map((feature, index) => (
                  <FeatureCard
                    key={feature.title}
                    feature={feature}
                    isActive={activeFeature === index}
                    onClick={() => setActiveFeature(index)}
                  />
                ))}
              </div>

              {/* Live Preview Area */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="relative"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur-sm" />
                <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 min-h-[120px]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/50" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                      <div className="w-2 h-2 rounded-full bg-green-500/50" />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono ml-2">
                      {FEATURES[activeFeature].title} Preview
                    </span>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeFeature}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      {FEATURES[activeFeature].preview}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex gap-6 text-center"
              >
                {[
                  { icon: Layers, value: "∞", label: "Projects" },
                  { icon: FileText, value: "∞", label: "Documents" },
                  { icon: Zap, value: "24/7", label: "AI Support" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2">
                    <stat.icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-bold text-white">{stat.value}</div>
                      <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>

          {/* Right Side - Login Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md mx-auto lg:mx-0"
            style={{ perspective: 1000 }}
          >
            <motion.div
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/50"
            >
              {/* Hover Glow */}
              <div className="absolute -inset-px bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-cyan-500/20 opacity-0 hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />

              <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
                {/* Branding - Mobile Only */}
                <div className="lg:hidden flex flex-col items-center mb-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="relative group mb-3"
                  >
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-40" />
                    <div className="relative bg-black/80 rounded-xl p-3 border border-white/10">
                      <img src="/favicon.svg" alt="Forge" className="w-10 h-10 object-contain" />
                    </div>
                  </motion.div>
                  <h1 className="text-xl font-bold text-white">Forge AI</h1>
                </div>

                {/* Welcome */}
                <div className="text-center lg:text-left mb-6">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-white"
                  >
                    Welcome Back
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-muted-foreground text-sm mt-1 flex items-center justify-center lg:justify-start gap-2"
                  >

                    Forge your next masterpiece
                  </motion.p>
                </div>

                {/* Form */}
                <motion.form
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-white/80">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="dev@example.com"
                        className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-white/80">Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-10 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 mt-2 font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all group"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <span>Initialize Session</span>
                          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </motion.form>

                {/* Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 pt-6 border-t border-white/5 text-center"
                >
                  <span className="text-sm text-muted-foreground">
                    New to Forge?{' '}
                    <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium hover:underline transition-colors">
                      Create an account
                    </Link>
                  </span>
                </motion.div>
              </div>
            </motion.div>

            {/* Footer Branding */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 text-center text-xs text-white/20 font-mono"
            >
              <p>FORGE AI • DEVELOPMENT SUITE</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
