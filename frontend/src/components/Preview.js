import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview
} from "@codesandbox/sandpack-react";
import { atomDark } from "@codesandbox/sandpack-themes";
import {
  Maximize2, Minimize2, Monitor, Tablet, Smartphone,
  RotateCcw, Minus, Plus
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { Slider } from '../components/ui/slider';

// Dependency Detection Helper
const DEPENDENCY_MAP = {
  'framer-motion': 'latest',
  'recharts': 'latest',
  'lucide-react': 'latest',
  'clsx': 'latest',
  'tailwind-merge': 'latest',
  'date-fns': 'latest',
  'lodash': 'latest',
  'axios': 'latest',
  'react-router-dom': 'latest',
  '@radix-ui/react-dialog': 'latest',
  '@radix-ui/react-slot': 'latest',
  'zod': 'latest',
  'react-hook-form': 'latest',
  'react-is': 'latest'
};

const extractDependencies = (code) => {
  const deps = {
    "lucide-react": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  };

  if (!code) return deps;

  Object.keys(DEPENDENCY_MAP).forEach(pkg => {
    if (code.includes(`from '${pkg}'`) || code.includes(`from "${pkg}"`)) {
      deps[pkg] = DEPENDENCY_MAP[pkg];
    }
  });

  return deps;
};

// Device presets for responsive testing
const DEVICE_PRESETS = [
  { id: 'responsive', label: 'Responsive', width: null, icon: Monitor },
  { id: 'desktop', label: 'Desktop (1280px)', width: 1280, icon: Monitor },
  { id: 'tablet', label: 'Tablet (768px)', width: 768, icon: Tablet },
  { id: 'mobile', label: 'Mobile (375px)', width: 375, icon: Smartphone },
];

export default function Preview({ file }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [devicePreset, setDevicePreset] = useState('responsive');
  const [refreshKey, setRefreshKey] = useState(0);

  const dependencies = useMemo(() => extractDependencies(file?.content), [file?.content]);
  const currentDevice = DEVICE_PRESETS.find(d => d.id === devicePreset);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  if (!file) return null;

  // Zoom Toolbar Component
  const ZoomToolbar = ({ isFullscreenMode = false }) => (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-xl border-b border-white/10 flex-shrink-0">
      {/* Device Presets */}
      <div className="flex items-center gap-1 border-r border-white/10 pr-3 mr-1">
        {DEVICE_PRESETS.map(device => (
          <button
            key={device.id}
            onClick={() => setDevicePreset(device.id)}
            className={`p-1.5 rounded-lg transition-all ${devicePreset === device.id
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            title={device.label}
          >
            <device.icon className="h-4 w-4" />
          </button>
        ))}
        {currentDevice?.width && (
          <span className="text-xs text-muted-foreground font-mono ml-1">
            {currentDevice.width}px
          </span>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 25}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 min-w-[140px]">
          <Slider
            value={[zoom]}
            onValueChange={([val]) => setZoom(val)}
            min={25}
            max={200}
            step={5}
            className="w-20"
          />
          <span className="text-xs text-muted-foreground font-mono w-10 text-center">
            {zoom}%
          </span>
        </div>

        <button
          onClick={handleZoomIn}
          disabled={zoom >= 200}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          title="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Zoom Presets */}
      <div className="flex items-center gap-1 border-l border-white/10 pl-3 ml-1">
        {[50, 100, 150].map(preset => (
          <button
            key={preset}
            onClick={() => setZoom(preset)}
            className={`px-2 py-1 rounded-md text-xs font-mono transition-all ${zoom === preset
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
          >
            {preset}%
          </button>
        ))}
      </div>

      {/* Refresh & Fullscreen */}
      <div className="flex items-center gap-1 border-l border-white/10 pl-3 ml-auto">
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          title="Refresh preview"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        {!isFullscreenMode && (
          <button
            onClick={() => setIsFullscreen(true)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
        {isFullscreenMode && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            title="Exit fullscreen"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  // Calculate frame dimensions - frame stays fixed, content zooms inside
  const getFrameStyle = () => {
    if (currentDevice?.width) {
      return {
        width: `${currentDevice.width}px`,
        maxWidth: '100%',
        margin: '0 auto',
      };
    }
    return {
      width: '100%',
      height: '100%',
    };
  };

  const PreviewContent = () => {
    // CSS zoom property works like browser zoom - scales content inside fixed frame
    const zoomStyle = {
      zoom: zoom / 100,
      // Fallback for Firefox which doesn't support zoom
      MozTransform: `scale(${zoom / 100})`,
      MozTransformOrigin: '0 0',
    };

    if (file.type === 'doc') {
      return (
        <div className="h-full w-full overflow-auto bg-[#0d0d0d] flex justify-center p-4">
          <div
            className="bg-[#111] rounded-xl border border-white/10 overflow-auto"
            style={getFrameStyle()}
          >
            <div
              className="p-8 text-zinc-100 prose prose-invert prose-headings:font-mono prose-headings:font-bold prose-h1:text-4xl prose-p:text-zinc-400 max-w-none origin-top-left"
              style={zoomStyle}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {file.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      );
    }

    if (file.type === 'mockup') {
      // Responsive mode - no frame, fill space
      if (!currentDevice?.width) {
        return (
          <div className="h-full w-full bg-[#0d0d0d] flex flex-col" style={zoomStyle}>
            <SandpackProvider
              key={refreshKey}
              template="react"
              theme={atomDark}
              files={{
                "/App.js": file.content,
              }}
              options={{
                externalResources: ["https://cdn.tailwindcss.com"],
              }}
              customSetup={{
                dependencies: dependencies
              }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <SandpackLayout style={{
                border: 'none',
                borderRadius: 0,
                backgroundColor: 'transparent',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <SandpackPreview
                  style={{ flex: 1 }}
                  showOpenInCodeSandbox={false}
                  showRefreshButton={false}
                />
              </SandpackLayout>
            </SandpackProvider>
          </div>
        );
      }

      // Device preset mode - show in frame with browser header
      return (
        <div className="h-full w-full bg-[#0d0d0d] overflow-auto flex justify-center p-4">
          <div
            className="bg-[#111] rounded-xl border border-white/10 overflow-hidden flex flex-col"
            style={{
              ...getFrameStyle(),
              height: 'fit-content',
              minHeight: '500px',
            }}
          >
            {/* Browser-like header */}
            <div className="flex items-center gap-2 px-4 py-2 bg-black/50 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-white/5 rounded-md px-3 py-1 text-xs text-muted-foreground font-mono text-center">
                  localhost:3000
                </div>
              </div>
            </div>

            {/* Preview iframe with zoom */}
            <div
              className="flex-1 overflow-auto origin-top-left"
              style={zoomStyle}
            >
              <SandpackProvider
                key={refreshKey}
                template="react"
                theme={atomDark}
                files={{
                  "/App.js": file.content,
                }}
                options={{
                  externalResources: ["https://cdn.tailwindcss.com"],
                }}
                customSetup={{
                  dependencies: dependencies
                }}
              >
                <SandpackLayout style={{
                  border: 'none',
                  borderRadius: 0,
                  backgroundColor: 'transparent',
                  minHeight: '400px',
                }}>
                  <SandpackPreview
                    style={{ minHeight: '400px' }}
                    showOpenInCodeSandbox={false}
                    showRefreshButton={false}
                  />
                </SandpackLayout>
              </SandpackProvider>
            </div>
          </div>
        </div>
      );
    }

    if (file.type === 'asset') {
      return (
        <div className="h-full w-full flex items-center justify-center p-8 bg-[#0d0d0d] overflow-auto">
          <div style={zoomStyle} className="origin-center">
            {file.content.startsWith('data:') || file.content.startsWith('http') ? (
              <img src={file.content} alt={file.name} className="max-w-full rounded-md shadow-2xl border border-white/10" />
            ) : (
              <div className="text-center text-muted-foreground">
                <p>Asset preview not available for raw content.</p>
              </div>
            )}
          </div>
        </div>
      )
    }

    return <div className="p-8 text-muted-foreground bg-[#0d0d0d] h-full flex items-center justify-center">No preview available.</div>;
  };

  return (
    <>
      <div className="h-full w-full flex flex-col bg-[#0a0a0a]">
        <ZoomToolbar />
        <div className="flex-1 overflow-hidden">
          <PreviewContent />
        </div>
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 border-none bg-[#0a0a0a] overflow-hidden flex flex-col">
          <ZoomToolbar isFullscreenMode={true} />
          <div className="flex-1 overflow-hidden">
            <PreviewContent />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
