import React from 'react';
import { FileText, Calendar } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function SmartText({ text, className = "" }) {
    const { projectId } = useParams();
    const navigate = useNavigate();

    if (!text) return null;

    // Regex for file mentions: @[filename.ext]
    const mentionRegex = /@\[([\w\s.-]+)\]/g;

    // Regex for smart date phrases (simple heuristic)
    // Matches: "in X days", "on Monday", "tomorrow", "today"
    const dateRegex = /\b(in \d+ days?|on (?:mon|tues|wednes|thurs|fri|satur|sun)day|tomorrow|today)\b/gi;

    const parts = [];
    let lastIndex = 0;

    // We need to combine both regexes to split the text correctly.
    // simpler approach: split by spaces and check tokens, or replace and render with dangerous HTML (no).
    // Better approach: Iterate and find matches.

    // Let's use a simpler tokenizing approach for robustness
    // 1. Replace all mentions with a unique placeholder
    // 2. Replace all dates with a unique placeholder
    // 3. Split by placeholders and reconstruct

    // Actually, let's just use split logic.
    // We will prioritize Mentions, then Dates.

    // Function to parse a segment for dates
    const parseDates = (segment) => {
        const segParts = [];
        let segLastIndex = 0;
        let match;

        // Reset regex state
        dateRegex.lastIndex = 0;

        while ((match = dateRegex.exec(segment)) !== null) {
            if (match.index > segLastIndex) {
                segParts.push(segment.substring(segLastIndex, match.index));
            }

            // Render Date Badge
            segParts.push(
                <span key={`date-${match.index}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-accent/10 text-accent font-medium text-[inherit] text-xs align-middle border border-accent/20">
                    <Calendar className="h-3 w-3" />
                    {match[0].toLowerCase()}
                </span>
            );

            segLastIndex = match.index + match[0].length;
        }

        if (segLastIndex < segment.length) {
            segParts.push(segment.substring(segLastIndex));
        }

        return segParts;
    };


    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const rawText = text.substring(lastIndex, match.index);
            parts.push(...parseDates(rawText));
        }

        const fileName = match[1];

        // Render Mention Badge
        parts.push(
            <button
                key={`mention-${match.index}`}
                onClick={(e) => {
                    e.stopPropagation();
                    // Navigate to the Editor page which exists in App.js: /project/:projectId/editor
                    navigate(`/project/${projectId}/editor?file=${encodeURIComponent(fileName)}`);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/20 text-primary font-medium text-[inherit] text-xs align-middle hover:bg-primary/30 transition-colors border border-primary/30 cursor-pointer"
            >
                <FileText className="h-3 w-3" />
                {fileName}
            </button>
        );

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push(...parseDates(text.substring(lastIndex)));
    }

    return (
        <span className={className}>
            {parts.length > 0 ? parts : text}
        </span>
    );
}
