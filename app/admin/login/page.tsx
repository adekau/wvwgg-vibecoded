'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Shield, Loader2, Lock } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { login, completeNewPassword, error, isLoading, needsNewPassword } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await login(username, password)
      if (!needsNewPassword) {
        router.push('/admin/dashboard')
      }
    } catch (err) {
      // Error is handled by context
      console.error('Login failed:', err)
    }
  }

  const handleNewPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      // You could set a local error state here, but for simplicity we'll just return
      return
    }

    try {
      await completeNewPassword(newPassword)
      router.push('/admin/dashboard')
    } catch (err) {
      console.error('Failed to set new password:', err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md panel-border">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-accent/10">
              {needsNewPassword ? (
                <Lock className="h-8 w-8 text-accent" />
              ) : (
                <Shield className="h-8 w-8 text-accent" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {needsNewPassword ? 'Set New Password' : 'Admin Login'}
          </CardTitle>
          <CardDescription>
            {needsNewPassword
              ? 'Choose a new password for your account'
              : 'Enter your credentials to access the guild admin panel'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needsNewPassword ? (
            <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  minLength={12}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 12 characters with uppercase, lowercase, numbers, and symbols
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-destructive">Passwords do not match</p>
              )}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || newPassword !== confirmPassword || !newPassword}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting password...
                  </>
                ) : (
                  'Set New Password'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username or Email</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              {needsNewPassword
                ? 'Your password must meet security requirements'
                : 'Admin access is invite-only. Contact Pacas if you need access.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
