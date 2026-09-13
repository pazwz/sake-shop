'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};
type AuthResult = { ok: boolean; message?: string };
type Auth = {
  member: Member | null;
  ready: boolean;
  login(email: string, password: string): Promise<AuthResult>;
  register(name: string, email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
};

const AuthContext = createContext<Auth | undefined>(undefined);

const requestAuth = async (path: string, body: object) => {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return {
      ok: response.ok,
      member: response.ok ? (payload.data as Member) : undefined,
      message: response.ok
        ? undefined
        : (payload.error?.detail as string | undefined),
    };
  } catch {
    return {
      ok: false,
      message: '通信に失敗しました。もう一度お試しください。',
    };
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/customer/me', { cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (active && response.ok) setMember(payload.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await requestAuth('/api/v1/customer/login', {
      email,
      password,
    });
    if (result.ok && result.member) setMember(result.member);
    return { ok: result.ok, message: result.message };
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await requestAuth('/api/v1/customer/register', {
        name,
        email,
        password,
      });
      if (result.ok && result.member) setMember(result.member);
      return { ok: result.ok, message: result.message };
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch('/api/v1/customer/logout', { method: 'POST' });
    setMember(null);
  }, []);

  const value = useMemo<Auth>(
    () => ({ member, ready, login, register, logout }),
    [member, ready, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth unavailable');
  return value;
};
