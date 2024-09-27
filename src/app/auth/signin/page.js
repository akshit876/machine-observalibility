"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "react-toastify";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLogin) {
      // Handle sign in
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result.error) {
        toast.error("Invalid credentials");
      } else {
        toast.success("Signed in successfully");
        router.push("/");
        router.refresh();
      }
    } else {
      // Handle registration
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });

        if (response.ok) {
          // Registration successful, now sign in
          const result = await signIn("credentials", {
            username,
            password,
            redirect: false,
          });

          if (result.error) {
            toast.error("Registration successful, but unable to sign in");
          } else {
            toast.success("Registered and signed in successfully");
            router.push("/");
            router.refresh();
          }
        } else {
          const data = await response.json();
          toast.error(data.message || "Registration failed");
        }
      } catch (error) {
        toast.error("An error occurred during registration");
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>{isLogin ? "Sign In" : "Register"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "Enter your credentials to sign in"
              : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              {!isLogin && (
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full mt-4">
              {isLogin ? "Sign In" : "Register"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" onClick={() => setIsLogin(!isLogin)}>
            {isLogin
              ? "Don't have an account? Register"
              : "Already have an account? Sign In"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
