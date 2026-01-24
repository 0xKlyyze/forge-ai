import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'sonner';
import { useAuth } from '../authContext';

export default function InviteHandler() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [status, setStatus] = useState('processing');
    const [errorDetails, setErrorDetails] = useState('');

    useEffect(() => {
        if (loading) return;
        if (!user) {
            // If not logged in, redirect to login with return path
            // For now, simple redirect
            toast.error("Please login to accept invite");
            navigate('/login', { state: { from: `/invite/${token}` } });
            return;
        }

        const acceptInvite = async () => {
            try {
                const res = await api.post(`/invites/${token}/accept`);
                toast.success("Joined project successfully!");
                navigate(`/project/${res.data.project_id}`);
            } catch (error) {
                console.error("Invite error", error);
                setStatus('error');
                if (error.response?.data?.detail === "Already a collaborator") {
                    navigate(`/project/${error.response.data.project_id}`);
                    toast.info("You are already a collaborator");
                } else {
                    setErrorDetails(error.response?.data?.detail || "Failed to accept invite");
                }
            }
        };
        acceptInvite();
    }, [token, navigate, user, loading]);

    if (loading || status === 'processing') return (
        <div className="h-screen flex items-center justify-center bg-black text-white">
            <div className="text-center space-y-4">
                <h2 className="text-xl font-bold anim-pulse">Processing Invite...</h2>
            </div>
        </div>
    );

    if (status === 'error') return (
        <div className="h-screen flex items-center justify-center bg-black text-white">
            <div className="text-center space-y-4">
                <h2 className="text-xl font-bold text-destructive">Invite Failed</h2>
                <p className="text-muted-foreground">{errorDetails}</p>
                <button onClick={() => navigate('/dashboard')} className="text-blue-400 hover:underline">Go to Dashboard</button>
            </div>
        </div>
    );

    return null;
}
