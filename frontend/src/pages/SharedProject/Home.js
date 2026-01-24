import React from 'react';
import { useSharedProject } from './Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function SharedProjectHome() {
    const { project, permissions } = useSharedProject();

    // If specific files are allowed, maybe list them here?
    // But for now just show project overview

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-2">
                <h1 className="text-4xl font-mono font-bold tracking-tight">{project.name}</h1>
                <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Created {format(new Date(project.created_at), 'PPP')}</span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">{project.status}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-secondary/10 border-white/5">
                    <CardHeader><CardTitle>Project Overview</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">This is a shared view of the project.</p>
                        {permissions.allow_all_files ? (
                            <p className="mt-2 text-green-400 text-sm">✓ Full file access enabled</p>
                        ) : (
                            <p className="mt-2 text-yellow-400 text-sm">⚠ Limited file access</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* File List could go here or separate page */}
        </div>
    );
}
