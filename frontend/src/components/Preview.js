import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackPreview 
} from "@codesandbox/sandpack-react";
import { atomDark } from "@codesandbox/sandpack-themes";
import { Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '../components/ui/dialog';

export default function Preview({ file }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!file) return null;

  const PreviewContent = ({ style, showControls = true }) => {
      if (file.type === 'doc') {
        return (
          <div className="h-full w-full overflow-auto bg-[#0d0d0d] p-8 text-zinc-100 prose prose-invert prose-headings:font-mono prose-headings:font-bold prose-h1:text-4xl prose-p:text-zinc-400 max-w-none" style={style}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {file.content}
            </ReactMarkdown>
          </div>
        );
      }

      if (file.type === 'mockup') {
        return (
          <div className="h-full w-full bg-[#0d0d0d] flex flex-col" style={style}>
             <SandpackProvider
                template="react"
                theme={atomDark}
                files={{
                  "/App.js": file.content,
                }}
                options={{
                  externalResources: ["https://cdn.tailwindcss.com"]
                }}
                customSetup={{
                  dependencies: {
                    "lucide-react": "latest",
                    "framer-motion": "latest",
                    "clsx": "latest",
                    "tailwind-merge": "latest"
                  }
                }}
              >
                <SandpackLayout style={{ 
                    height: '100%', 
                    border: 'none', 
                    borderRadius: 0,
                    backgroundColor: 'transparent'
                }}>
                  <SandpackPreview 
                    style={{ height: '100%' }} 
                    showOpenInCodeSandbox={false} 
                    showRefreshButton={true}
                  />
                </SandpackLayout>
              </SandpackProvider>
              
              {showControls && (
                  <div className="absolute top-4 right-4 z-50 flex gap-2">
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/80"
                        onClick={() => setIsFullscreen(true)}
                      >
                          <Maximize2 className="h-4 w-4" />
                      </Button>
                  </div>
              )}
          </div>
        );
      }

      if (file.type === 'asset') {
         return (
             <div className="h-full w-full flex items-center justify-center p-8 bg-[#0d0d0d]" style={style}>
                 {file.content.startsWith('data:') || file.content.startsWith('http') ? (
                     <img src={file.content} alt={file.name} className="max-w-full max-h-full rounded-md shadow-2xl border border-white/10" />
                 ) : (
                     <div className="text-center text-muted-foreground">
                         <p>Asset preview not available for raw content.</p>
                     </div>
                 )}
             </div>
         )
      }

      return <div className="p-8 text-muted-foreground bg-[#0d0d0d] h-full flex items-center justify-center">No preview available.</div>;
  };

  return (
    <>
        <div className="h-full w-full relative group">
            <PreviewContent />
        </div>

        <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 border-none bg-black overflow-hidden">
                <div className="relative h-full w-full">
                    <Button 
                        size="icon" 
                        variant="secondary" 
                        className="absolute top-4 right-4 z-50 h-8 w-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/80"
                        onClick={() => setIsFullscreen(false)}
                    >
                        <Minimize2 className="h-4 w-4" />
                    </Button>
                    <PreviewContent showControls={false} />
                </div>
            </DialogContent>
        </Dialog>
    </>
  );
}
