import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../authContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(email, password);
      toast.success("Access granted. Please login.");
      navigate('/login');
    } catch (error) {
      toast.error("Registration failed. Email might be taken.");
    }
  };

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <Card className="w-[350px] bg-secondary/30 border-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-mono text-accent">New Access</CardTitle>
          <CardDescription>Create a new developer profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="dev@example.com" />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <Button className="w-full mt-6 font-mono" variant="secondary" type="submit">Create Profile</Button>
          </form>
        </CardContent>
         <CardFooter className="flex justify-center">
             <span className="text-sm text-muted-foreground">Already have access? <Link to="/login" className="text-accent hover:underline">Login</Link></span>
        </CardFooter>
      </Card>
    </div>
  );
}
