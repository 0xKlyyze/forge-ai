import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../authContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate('/dashboard');
    } catch (error) {
      toast.error("Invalid credentials");
    }
  };

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <Card className="w-[350px] bg-secondary/30 border-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-mono text-primary">System Login</CardTitle>
          <CardDescription>Enter credentials to access the console.</CardDescription>
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
            <Button className="w-full mt-6 font-mono" type="submit">Initialize Session</Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
             <span className="text-sm text-muted-foreground">New user? <Link to="/register" className="text-primary hover:underline">Register access</Link></span>
        </CardFooter>
      </Card>
    </div>
  );
}
