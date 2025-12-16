import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../authContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, Eye, EyeOff, Rocket, ArrowRight, Loader2,
  Bot, FileText, CheckCircle2, MessageSquare, Code2, Layers,
  Zap, Target, LayoutGrid, Sparkles
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
    title: "AI-Powered Guidance",
    description: "Get intelligent help at every step",
    color: "from-purple-500 to-pink-400",
    preview: (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-white/80">AI Advisor is ready</div>
          <div className="text-[10px] text-muted-foreground">Ask anything about your project</div>
        </div>
      </div>
    )
  },
  {
    icon: LayoutGrid,
    title: "Visual Task Boards",
    description: "Organize work with Kanban & Matrix views",
    color: "from-cyan-500 to-blue-400",
    preview: (
      <div className="grid grid-cols-4 gap-1">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`h-6 rounded ${i < 2 ? 'bg-red-500/30' : i < 4 ? 'bg-blue-500/30' : i < 6 ? 'bg-amber-500/30' : 'bg-green-500/30'}`}
          />
        ))}
      </div>
    )
  },
  {
    icon: Code2,
    title: "Code & Preview",
    description: "Edit components with live preview",
    color: "from-green-500 to-emerald-400",
    preview: (
      <div className="flex gap-1">
        <div className="flex-1 bg-black/50 rounded p-1.5 font-mono text-[7px] text-green-400 leading-tight">
          {'function App() {\n  return <div>✨</div>\n}'}
        </div>
        <div className="w-12 bg-white/5 rounded flex items-center justify-center text-lg">
          ✨
        </div>
      </div>
    )
  },
  {
    icon: MessageSquare,
    title: "Smart Conversations",
    description: "Context-aware chat with web search",
    color: "from-amber-500 to-orange-400",
    preview: (
      <div className="space-y-1">
        <div className="h-3 bg-white/5 rounded w-3/4" />
        <div className="h-3 bg-amber-500/20 rounded w-full" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
      </div>
    )
  }
];

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

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { onMouseMove, onMouseLeave, rotateX, rotateY } = use3DTilt();

  // Auto-cycle through features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % FEATURES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register(email, password);
      toast.success("Welcome to Forge! Please login to continue.");
      navigate('/login');
    } catch (error) {
      toast.error("Registration failed. Email might be taken.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background Gradient Blobs - Purple/Cyan theme */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute top-[-15%] left-[-10%] w-[700px] h-[700px] bg-purple-600/25 rounded-full blur-[150px] pointer-events-none"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
        className="absolute bottom-[-15%] right-[-5%] w-[600px] h-[600px] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute top-[40%] right-[20%] w-[400px] h-[400px] bg-pink-500/10 rounded-full blur-[100px] pointer-events-none"
      />

      {/* Main Content - Side by Side Layout (Reversed for Register) */}
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Left Side - Register Card */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md mx-auto lg:mx-0 order-2 lg:order-1"
            style={{ perspective: 1000 }}
          >
            <motion.div
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/50"
            >
              {/* Hover Glow - Purple/Cyan */}
              <div className="absolute -inset-px bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-cyan-500/20 opacity-0 hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />

              <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
                {/* Branding - Mobile Only */}
                <div className="lg:hidden flex flex-col items-center mb-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="relative group mb-3"
                  >
                    <div className="absolute -inset-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl blur-lg opacity-40" />
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
                    Join the Forge
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-muted-foreground text-sm mt-1 flex items-center justify-center lg:justify-start gap-2"
                  >

                    Create your developer profile
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
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-purple-400 transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="dev@example.com"
                        className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-white/80">Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-purple-400 transition-colors" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Choose a strong password"
                        className="pl-10 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50 rounded-xl"
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
                      className="w-full h-11 mt-2 font-medium text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all group"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <span>Create Profile</span>
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
                    Already have access?{' '}
                    <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium hover:underline transition-colors">
                      Login
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

          {/* Right Side - App Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block order-1 lg:order-2"
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
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity" />
                    <div className="relative bg-black rounded-lg p-2 border border-white/10">
                      <img src="/favicon.svg" alt="Forge" className="w-8 h-8 object-contain" />
                    </div>
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                      Start Building Today
                    </h2>
                    <p className="text-xs text-muted-foreground">Join developers using Forge AI</p>
                  </div>
                </div>
                <p className="text-lg text-white/80 max-w-md">
                  Everything you need to manage projects and build faster.
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
                <div className="absolute -inset-px bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-cyan-500/20 rounded-2xl blur-sm" />
                <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 min-h-[100px]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/50" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                      <div className="w-2 h-2 rounded-full bg-green-500/50" />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono ml-2">
                      {FEATURES[activeFeature].title}
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

              {/* Benefits */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex flex-wrap gap-3"
              >
                {[
                  { icon: CheckCircle2, text: "Free to start" },
                  { icon: Zap, text: "AI-powered" },
                  { icon: Layers, text: "Unlimited projects" },
                ].map((benefit) => (
                  <div key={benefit.text} className="flex items-center gap-2 text-sm text-muted-foreground bg-white/5 px-3 py-1.5 rounded-full">
                    <benefit.icon className="w-3.5 h-3.5 text-green-500" />
                    <span>{benefit.text}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
