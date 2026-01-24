import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'sonner';
import { useAuth } from '../authContext';
import { Check, Loader2 } from 'lucide-react';

export default function InviteHandler() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [inviteData, setInviteData] = useState(null);
    const [status, setStatus] = useState('loading'); // loading, ready, accepting, error
    const [errorDetails, setErrorDetails] = useState('');

    useEffect(() => {
        if (!token) return;

        const fetchInvite = async () => {
            try {
                const res = await api.get(`/invites/${token}`);
                setInviteData(res.data);
                setStatus('ready');
            } catch (error) {
                console.error("Failed to fetch invite", error);

                // If 401, it might be because the user needs to login to even see details? 
                // Currently API allows checking invite validity without auth? 
                // Let's assume the endpoint is open or we handle auth error.
                // If the user is NOT logged in, we should redirect to login/register?

                setStatus('error');
                setErrorDetails("Invalid or expired invitation link.");
            }
        };
        fetchInvite();
    }, [token]);

    const handleAccept = async () => {
        if (!user) {
            toast.error("Please login or create an account to join.");
            navigate('/register', { state: { from: `/invite/${token}` } });
            return;
        }

        setStatus('accepting');
        try {
            const res = await api.post(`/invites/${token}/accept`);
            toast.success("Joined project successfully!");
            navigate(`/project/${res.data.project_id}`);
        } catch (error) {
            console.error("Invite error", error);
            if (error.response?.data?.detail === "Already a collaborator") {
                navigate(`/project/${error.response.data.project_id}`);
                toast.info("You are already a collaborator");
            } else {
                setStatus('error');
                setErrorDetails(error.response?.data?.detail || "Failed to accept invite");
            }
        }
    };

    if (loading || status === 'loading') return (
        <div className="h-screen flex items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Verifying invitation...</p>
            </div>
        </div>
    );

    if (status === 'error') return (
        <div className="h-screen flex items-center justify-center bg-black text-white p-4">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-6">
                <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 text-2xl font-bold">!</div>
                <div>
                    <h2 className="text-xl font-bold mb-2">Invitation Error</h2>
                    <p className="text-muted-foreground text-sm">{errorDetails}</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                    Go to Dashboard
                </button>
            </div>
        </div>
    );

    return (
        <div className="h-screen flex items-center justify-center bg-black text-white relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px]" />
            <div className="absolute h-96 w-96 bg-primary/20 rounded-full blur-[128px] -top-20 -left-20" />

            <div className="relative z-10 max-w-md w-full bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-500">

                {/* Header */}
                <div className="text-center space-y-2 mb-8">
                    <p className="text-xs font-bold tracking-widest text-primary uppercase">Project Invitation</p>
                    <h1 className="text-2xl font-bold">Join the Team</h1>
                    <p className="text-zinc-400 text-sm">You've been invited to collaborate.</p>
                </div>

                {/* Project Card */}
                {inviteData && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 mb-8 text-center space-y-4">
                        <div className="h-20 w-20 bg-zinc-800 rounded-2xl mx-auto flex items-center justify-center overflow-hidden border border-white/5 shadow-lg">
                            {inviteData.project_icon && (inviteData.project_icon.startsWith('http') || inviteData.project_icon.startsWith('data:')) ? (
                                <img src={inviteData.project_icon} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-3xl font-bold text-zinc-500">
                                    {inviteData.project_name?.charAt(0) || '?'}
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{inviteData.project_name}</h3>
                            <p className="text-xs text-zinc-500 mt-1">Invited by <span className="text-zinc-300">{inviteData.inviter_email}</span></p>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={handleAccept}
                        disabled={status === 'accepting'}
                        className="w-full py-3.5 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {status === 'accepting' ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Joining Project...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" />
                                Accept Invitation
                            </>
                        )}
                    </button>
                    {!user && (
                        <p className="text-center text-[10px] text-zinc-500 mt-4">
                            You will be asked to login or register.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
