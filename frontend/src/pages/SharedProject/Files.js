import React, { useEffect, useState } from 'react';
import { useSharedProject } from './Layout';
import api from '../../utils/api';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { FileText, Code } from 'lucide-react';

export default function SharedProjectFiles() {
    const { token } = useParams();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const res = await api.get(`/shared/${token}/files`);
                setFiles(res.data);
                setLoading(false);
            } catch (error) {
                console.error(error);
                setLoading(false);
            }
        };
        fetchFiles();
    }, [token]);

    if (loading) return <div>Loading files...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Files</h2>
            <div className="grid grid-cols-1 gap-4">
                {files.length > 0 ? (
                    files.map(file => (
                        <Card key={file.id} className="bg-secondary/10 border-white/5 hover:bg-secondary/20 transition-colors">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="h-10 w-10 rounded bg-primary/20 flex items-center justify-center">
                                    {file.type === 'doc' ? <FileText className="h-5 w-5" /> : <Code className="h-5 w-5" />}
                                </div>
                                <div className="flex-1">
                                    <div className="font-medium">{file.name}</div>
                                    <div className="text-xs text-muted-foreground">{file.category}</div>
                                </div>
                                {/* Maybe a 'View' button or Read-only editor later */}
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="text-muted-foreground">No files shared.</div>
                )}
            </div>
        </div>
    );
}
