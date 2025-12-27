import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { User, LogOut, Settings } from 'lucide-react';

export default function UserMenu() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const initials = user?.email
        ? user.email.substring(0, 2).toUpperCase()
        : 'U';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-white/10 transition-colors">
                    <Avatar className="h-10 w-10 border border-white/10 transition-transform group-hover:scale-105">
                        <AvatarImage src={user?.avatar_url} alt={user?.email} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-medium">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-black/95 backdrop-blur-xl border-white/10 text-white" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-white">{user?.name || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user?.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                    className="focus:bg-white/10 focus:text-white cursor-pointer"
                    onClick={() => navigate('/profile')}
                >
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="focus:bg-white/10 focus:text-white cursor-pointer"
                    onClick={() => navigate('/settings')}
                >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                    className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
