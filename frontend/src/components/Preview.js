import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, memo, useCallback } from 'react';
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
  RotateCcw, Minus, Plus, ChevronDown, Check, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent } from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Slider } from '../components/ui/slider';
import XmlViewer from '../components/XmlViewer';

// Helper to check if a file is XML
const isXmlFile = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  return ['xml', 'svg', 'xsl', 'xslt', 'xsd', 'plist', 'config'].includes(ext);
};

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

// Custom components for Markdown to inject source line info
const createSourcePosComponent = (Tag) => ({ node, ...props }) => {
  return <Tag data-source-line={node?.position?.start?.line} {...props} />;
};

const MarkdownComponents = {
  p: createSourcePosComponent('p'),
  h1: createSourcePosComponent('h1'),
  h2: createSourcePosComponent('h2'),
  h3: createSourcePosComponent('h3'),
  h4: createSourcePosComponent('h4'),
  h5: createSourcePosComponent('h5'),
  h6: createSourcePosComponent('h6'),
  li: createSourcePosComponent('li'),
  blockquote: createSourcePosComponent('blockquote'),
  code: ({ node, inline, ...props }) => {
    // Only block code usually has meaningful line numbers for navigation
    return <code data-source-line={!inline ? node?.position?.start?.line : undefined} {...props} />;
  }
};

// Extracted ZoomToolbar component
const ZoomToolbar = memo(({ 
  isFullscreenMode = false, 
  currentDevice, 
  devicePreset, 
  onDeviceChange, 
  zoom, 
  onZoomChange, 
  onRefresh, 
  onToggleFullscreen 
}) => {
  const CurrentDeviceIcon = currentDevice?.icon || Monitor;
  
  const handleZoomIn = () => onZoomChange(Math.min(zoom + 25, 200));
  const handleZoomOut = () => onZoomChange(Math.max(zoom - 25, 25));

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-black/80 backdrop-blur-xl border-b border-white/10 flex-shrink-0 gap-2 overflow-x-auto scrollbar-hide">
      {/* Device Dropdown - Flex-1 on mobile to fill space */}
      <div className="flex-1 md:flex-none md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-full justify-start gap-2 px-2 text-muted-foreground hover:text-foreground border border-white/5 bg-white/5">
              <CurrentDeviceIcon className="h-4 w-4" />
              <span className="truncate">{currentDevice?.label || 'Responsive'}</span>
              <ChevronDown className="h-3 w-3 opacity-50 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-[#111] border-white/10 w-[200px]">
            {DEVICE_PRESETS.map(device => (
              <DropdownMenuItem
                key={device.id}
                onClick={() => onDeviceChange(device.id)}
                className="gap-2 focus:bg-white/10 focus:text-white cursor-pointer"
              >
                <device.icon className="h-4 w-4" />
                <span>{device.label}</span>
                {devicePreset === device.id && <Check className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop: Device Icons Row */}
      <div className="hidden md:flex items-center gap-1 border-r border-white/10 pr-3 mr-1">
        {DEVICE_PRESETS.map(device => (
          <button
            key={device.id}
            onClick={() => onDeviceChange(device.id)}
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

      <div className="flex items-center gap-2">
        {/* Mobile: Compact Zoom Controls - Larger Touch Targets */}
        <div className="flex md:hidden items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 25}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 disabled:opacity-30 transition-all active:bg-white/10"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground font-mono w-10 text-center select-none font-medium">
            {zoom}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 disabled:opacity-30 transition-all active:bg-white/10"
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop: Expanded Zoom Controls */}
        <div className="hidden md:flex items-center gap-2">
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
              onValueChange={([val]) => onZoomChange(val)}
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

        {/* Desktop: Zoom Presets */}
        <div className="hidden md:flex items-center gap-1 border-l border-white/10 pl-3 ml-1">
          {[50, 100, 150].map(preset => (
            <button
              key={preset}
              onClick={() => onZoomChange(preset)}
              className={`px-2 py-1 rounded-md text-xs font-mono transition-all ${zoom === preset
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
            >
              {preset}%
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 pl-1 md:border-l md:border-white/10 md:pl-2">
          <button
            onClick={onRefresh}
            className="p-2 md:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:bg-white/10"
            title="Refresh preview"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={onToggleFullscreen}
            className="p-2 md:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all active:bg-white/10"
            title={isFullscreenMode ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
});

// Extracted Content Component to prevent re-renders and preserve scroll
const PreviewContent = memo(({ 
  file, 
  zoom, 
  devicePreset, 
  currentDevice, 
  refreshKey, 
  dependencies,
  onSyncEditor 
}) => {
  const [tooltipPos, setTooltipPos] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const containerRef = useRef(null);

  // Scroll preservation
  const scrollRef = useRef(0);
  
  const handleScroll = useCallback((e) => {
    scrollRef.current = e.target.scrollTop;
  }, []);

  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = scrollRef.current;
    }
  }, [file.content, file.name]); // Restore on content change

  // Calculate frame dimensions
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

  const zoomStyle = {
    zoom: zoom / 100,
    MozTransform: `scale(${zoom / 100})`,
    MozTransformOrigin: '0 0',
  };

  // Handle text selection for AI tooltip
  const handleMouseUp = useCallback(() => {
    if (!onSyncEditor) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setTooltipPos(null);
      setSelectedLine(null);
      return;
    }

    // Try to find source line
    let node = selection.anchorNode;
    let foundLine = null;
    
    // Traverse up to find element with data-source-line
    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.hasAttribute('data-source-line')) {
        foundLine = parseInt(node.getAttribute('data-source-line'), 10);
        break;
      }
      node = node.parentNode;
    }

    if (foundLine) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      if (containerRect) {
        setTooltipPos({
          top: rect.top - containerRect.top - 40, // Position above selection
          left: rect.left - containerRect.left
        });
        setSelectedLine(foundLine);
      }
    } else {
      setTooltipPos(null);
      setSelectedLine(null);
    }
  }, [onSyncEditor]);

  // Handle AI action
  const handleAIAction = () => {
    if (selectedLine && onSyncEditor) {
      onSyncEditor(selectedLine);
      setTooltipPos(null);
      
      // Clear selection
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    }
  };

  if (file.type === 'doc') {
    if (isXmlFile(file.name)) {
      return (
        <div className="h-full w-full bg-[#0d0d0d]" style={zoomStyle}>
          <XmlViewer content={file.content || ''} fileName={file.name} />
        </div>
      );
    }

    return (
      <div 
        ref={containerRef}
        className="h-full w-full overflow-auto bg-[#0d0d0d] flex justify-center p-4 relative"
        onScroll={handleScroll}
      >
        <div
          className="bg-[#111] rounded-xl border border-white/10 overflow-auto"
          style={getFrameStyle()}
          onMouseUp={handleMouseUp}
        >
          <div
            className="p-8 text-zinc-100 prose prose-invert prose-headings:font-mono prose-headings:font-bold prose-h1:text-4xl prose-p:text-zinc-400 max-w-none origin-top-left"
            style={zoomStyle}
          >
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={MarkdownComponents}
            >
              {file.content}
            </ReactMarkdown>
          </div>
        </div>
        
        {/* AI Tooltip */}
        {tooltipPos && (
          <div 
            className="absolute z-50 animate-in fade-in zoom-in-95 duration-200"
            style={{ top: Math.max(0, tooltipPos.top), left: Math.max(0, tooltipPos.left) }}
          >
            <Button 
              size="sm" 
              onClick={handleAIAction}
              className="h-8 shadow-xl bg-violet-600 hover:bg-violet-700 text-white border-violet-500 gap-2"
            >
              <Sparkles className="h-3 w-3" />
              Edit in Source
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (file.type === 'mockup') {
    if (!currentDevice?.width) {
      return (
        <div className="h-full w-full bg-[#0d0d0d] flex flex-col" style={zoomStyle}>
          <SandpackProvider
            key={refreshKey}
            template="react"
            theme={atomDark}
            files={{ "/App.js": file.content }}
            options={{ externalResources: ["https://cdn.tailwindcss.com"] }}
            customSetup={{ dependencies: dependencies }}
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
          <div className="flex-1 overflow-auto origin-top-left" style={zoomStyle}>
            <SandpackProvider
              key={refreshKey}
              template="react"
              theme={atomDark}
              files={{ "/App.js": file.content }}
              options={{ externalResources: ["https://cdn.tailwindcss.com"] }}
              customSetup={{ dependencies: dependencies }}
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
});

export default function Preview({ file, projectId, onSyncEditor }) {
  const ZOOM_KEY = `forge-ai-preview-zoom-${projectId}`;
  const DEVICE_KEY = `forge-ai-preview-device-${projectId}`;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem(ZOOM_KEY);
    return saved ? parseInt(saved, 10) : 100;
  });
  const [devicePreset, setDevicePreset] = useState(() => {
    return localStorage.getItem(DEVICE_KEY) || 'responsive';
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevFileNameRef = useRef(file?.name);

  useEffect(() => {
    if (file?.name && prevFileNameRef.current !== file.name) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
      prevFileNameRef.current = file.name;
      return () => clearTimeout(timer);
    }
  }, [file?.name]);

  const handleZoomChange = useCallback((newZoom) => {
    setZoom(newZoom);
    localStorage.setItem(ZOOM_KEY, String(newZoom));
  }, [ZOOM_KEY]);

  const handleDeviceChange = useCallback((newDevice) => {
    setDevicePreset(newDevice);
    localStorage.setItem(DEVICE_KEY, newDevice);
  }, [DEVICE_KEY]);

  const dependencies = useMemo(() => extractDependencies(file?.content), [file?.content]);
  const currentDevice = DEVICE_PRESETS.find(d => d.id === devicePreset);

  const handleRefresh = useCallback(() => setRefreshKey(prev => prev + 1), []);
  const handleToggleFullscreen = useCallback(() => setIsFullscreen(prev => !prev), []);

  if (!file) return null;

  const contentProps = {
    file,
    zoom,
    devicePreset,
    currentDevice,
    refreshKey,
    dependencies,
    onSyncEditor
  };

  return (
    <>
      <div className="h-full w-full flex flex-col bg-[#0a0a0a]">
        <ZoomToolbar 
          isFullscreenMode={false}
          currentDevice={currentDevice}
          devicePreset={devicePreset}
          onDeviceChange={handleDeviceChange}
          zoom={zoom}
          onZoomChange={handleZoomChange}
          onRefresh={handleRefresh}
          onToggleFullscreen={handleToggleFullscreen}
        />
        <div className="flex-1 overflow-hidden">
          <div
            className="h-full w-full transition-all duration-200 ease-out"
            style={{
              opacity: isTransitioning ? 0 : 1,
              transform: isTransitioning ? 'scale(0.98)' : 'scale(1)',
            }}
          >
            <PreviewContent {...contentProps} />
          </div>
        </div>
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 border-none bg-[#0a0a0a] overflow-hidden flex flex-col">
          <ZoomToolbar 
            isFullscreenMode={true}
            currentDevice={currentDevice}
            devicePreset={devicePreset}
            onDeviceChange={handleDeviceChange}
            zoom={zoom}
            onZoomChange={handleZoomChange}
            onRefresh={handleRefresh}
            onToggleFullscreen={handleToggleFullscreen}
          />
          <div className="flex-1 overflow-hidden">
            <div
              className="h-full w-full transition-all duration-200 ease-out"
              style={{
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning ? 'scale(0.98)' : 'scale(1)',
              }}
            >
              <PreviewContent {...contentProps} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
