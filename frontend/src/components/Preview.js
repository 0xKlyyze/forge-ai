import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sandpack } from "@codesandbox/sandpack-react";
import { atomDark } from "@codesandbox/sandpack-themes";

export default function Preview({ file }) {
  if (!file) return null;

  if (file.type === 'doc') {
    return (
      <div className="h-full overflow-auto p-8 bg-black text-zinc-100 prose prose-invert prose-headings:font-mono prose-headings:font-bold prose-h1:text-4xl prose-p:text-zinc-400 max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {file.content}
        </ReactMarkdown>
      </div>
    );
  }

  if (file.type === 'mockup') {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex-1">
            <Sandpack
              template="react"
              theme={atomDark}
              files={{
                "/App.js": file.content,
              }}
              options={{
                showNavigator: true,
                showTabs: false, // Hiding tabs since we have the editor on the left
                showConsoleButton: true,
                showInlineErrors: true,
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
            />
        </div>
      </div>
    );
  }

  if (file.type === 'asset') {
     return (
         <div className="h-full w-full flex items-center justify-center p-8 bg-black">
             {file.content.startsWith('http') ? (
                 <img src={file.content} alt={file.name} className="max-w-full max-h-full rounded-md shadow-2xl border border-white/10" />
             ) : (
                 <div className="text-center text-muted-foreground">
                     <p>Asset preview not available for raw content.</p>
                 </div>
             )}
         </div>
     )
  }

  return <div className="p-8 text-muted-foreground">No preview available for this file type.</div>;
}
