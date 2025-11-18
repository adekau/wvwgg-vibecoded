'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'

interface AuthContextType {
  user: CognitoUser | null
  session: CognitoUserSession | null
  isLoading: boolean
  needsNewPassword: boolean
  login: (username: string, password: string) => Promise<void>
  completeNewPassword: (newPassword: string) => Promise<void>
  logout: () => void
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Initialize user pool lazily to avoid build-time errors
let userPool: CognitoUserPool | null = null

function getUserPool(): CognitoUserPool {
  if (!userPool) {
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID

    if (!userPoolId || !clientId) {
      console.warn('Cognito credentials not configured')
      // Return a dummy pool that won't be used
      return new CognitoUserPool({
        UserPoolId: 'dummy',
        ClientId: 'dummy',
      })
    }

    userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    })
  }
  return userPool
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CognitoUser | null>(null)
  const [session, setSession] = useState<CognitoUserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsNewPassword, setNeedsNewPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempUser, setTempUser] = useState<CognitoUser | null>(null)

  // Check if user is already logged in on mount
  useEffect(() => {
    const currentUser = getUserPool().getCurrentUser()
    if (currentUser) {
      currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err) {
          console.error('Session error:', err)
          setIsLoading(false)
          return
        }
        if (session?.isValid()) {
          setUser(currentUser)
          setSession(session)
        }
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (username: string, password: string) => {
    setError(null)
    setIsLoading(true)

    const authenticationDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    })

    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: getUserPool(),
    })

    return new Promise<void>((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session) => {
          setUser(cognitoUser)
          setSession(session)
          setIsLoading(false)
          resolve()
        },
        onFailure: (err) => {
          console.error('Login error:', err)
          setError(err.message || 'Login failed')
          setIsLoading(false)
          reject(err)
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // Handle new password required (for first-time users)
          console.log('New password required for user')
          setTempUser(cognitoUser)
          setNeedsNewPassword(true)
          setIsLoading(false)
          resolve() // Resolve successfully, UI will show password change form
        },
      })
    })
  }

  const completeNewPassword = async (newPassword: string) => {
    if (!tempUser) {
      setError('No user session found')
      return Promise.reject(new Error('No user session found'))
    }

    setError(null)
    setIsLoading(true)

    return new Promise<void>((resolve, reject) => {
      tempUser.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: (session) => {
          setUser(tempUser)
          setSession(session)
          setTempUser(null)
          setNeedsNewPassword(false)
          setIsLoading(false)
          resolve()
        },
        onFailure: (err) => {
          console.error('New password error:', err)
          setError(err.message || 'Failed to set new password')
          setIsLoading(false)
          reject(err)
        },
      })
    })
  }

  const logout = () => {
    const currentUser = getUserPool().getCurrentUser()
    if (currentUser) {
      currentUser.signOut()
    }
    setUser(null)
    setSession(null)
    setTempUser(null)
    setNeedsNewPassword(false)
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, needsNewPassword, login, completeNewPassword, logout, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
