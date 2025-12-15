import React, { useState, useRef, useEffect } from 'react';
import { Input } from './ui/input';
import { FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';

export default function SmartInput({ value, onChange, placeholder, className, onKeyDown, onBlur, autoFocus }) {
    const { projectId } = useParams();
    const [showPicker, setShowPicker] = useState(false);
    const [files, setFiles] = useState([]);
    const [query, setQuery] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        // Fetch files when picker opens if not already fetched
        if (showPicker && files.length === 0) {
            api.get(`/projects/${projectId}/files`)
                .then(res => setFiles(res.data))
                .catch(err => console.error("Failed to load files", err));
        }
    }, [showPicker, projectId]);

    const handleChange = (e) => {
        const val = e.target.value;
        onChange(e);

        const lastChar = val.slice(-1);
        const cursorPosition = e.target.selectionStart;

        // Check if we are typing a mention
        // Regex to find word being typed at cursor that starts with @
        const textBeforeCursor = val.slice(0, cursorPosition);
        const match = textBeforeCursor.match(/@([\w\s.-]*)$/);

        if (match) {
            setShowPicker(true);
            setQuery(match[1]);
        } else {
            setShowPicker(false);
        }
    };

    const selectFile = (file) => {
        // Replace the @query with @[filename]
        const cursorPosition = inputRef.current.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPosition);
        const textAfterCursor = value.slice(cursorPosition);

        const match = textBeforeCursor.match(/@([\w\s.-]*)$/);
        if (match) {
            const prefix = textBeforeCursor.slice(0, match.index); // Text before the @
            const newValue = `${prefix}@[${file.name}] ${textAfterCursor}`;

            // Create a synthetic event to update parent
            const event = { target: { value: newValue } };
            onChange(event);

            setShowPicker(false);

            // Restore focus and approximate cursor (difficult in React controlled input without layout effect, but ok for now)
            inputRef.current?.focus();
        }
    };

    const handleKeyDownWrapper = (e) => {
        if (showPicker) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                // Logic to navigate list (skipped for v1 simplicity)
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // Select first match
                const filtered = files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
                if (filtered.length > 0) {
                    selectFile(filtered[0]);
                }
            } else if (e.key === 'Escape') {
                setShowPicker(false);
            }
        }

        if (onKeyDown) onKeyDown(e);
    };

    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="relative w-full" ref={containerRef}>
            <Input
                ref={inputRef}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className={className}
                onKeyDown={handleKeyDownWrapper}
                onBlur={(e) => {
                    // Give time for click event on picker to fire
                    setTimeout(() => setShowPicker(false), 200);
                    if (onBlur) onBlur(e);
                }}
                autoFocus={autoFocus}
            />

            {showPicker && (
                <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-white/5 bg-black/20">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-2">Data Links</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                        {filteredFiles.map(file => (
                            <button
                                key={file.id}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary/20 hover:text-primary text-sm flex items-center gap-2 transition-colors group"
                                onClick={() => selectFile(file)}
                                onMouseDown={(e) => e.preventDefault()} // Prevent blur stealing
                            >
                                <FileText className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                                <span className="truncate">{file.name}</span>
                            </button>
                        ))}
                        {filteredFiles.length === 0 && (
                            <div className="p-3 text-xs text-muted-foreground text-center italic">
                                No matching files found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
