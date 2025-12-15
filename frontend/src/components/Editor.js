import React from 'react';
import Editor from '@monaco-editor/react';

export default function FileEditor({ file, onChange }) {
  const language = file.name.endsWith('.md') ? 'markdown' : 'javascript';
  
  return (
    <div className="h-full w-full bg-[#1e1e1e]">
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        value={file.content || ''}
        theme="vs-dark"
        onChange={(value) => onChange(value || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          padding: { top: 16 },
          fontFamily: 'JetBrains Mono, monospace',
          scrollBeyondLastLine: false,
          smoothScrolling: true
        }}
      />
    </div>
  );
}
