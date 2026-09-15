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
type AuthResult = { ok: boolean; message?: string; code?: string };
type Auth = {
  member: Member | null;
  ready: boolean;
  login(email: string, password: string): Promise<AuthResult>;
  register(
    name: string,
    email: string,
    password: string,
    marketingOptIn: boolean,
  ): Promise<AuthResult>;
  refresh(): Promise<void>;
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
      code: response.ok
        ? undefined
        : (payload.error?.code as string | undefined),
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

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/customer/me', {
        cache: 'no-store',
      });
      const payload = await response.json();
      setMember(response.ok ? payload.data : null);
    } catch {
      setMember(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await requestAuth('/api/v1/customer/login', {
      email,
      password,
    });
    if (result.ok && result.member) setMember(result.member);
    return { ok: result.ok, message: result.message, code: result.code };
  }, []);

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      marketingOptIn: boolean,
    ) => {
      const result = await requestAuth('/api/v1/customer/register', {
        name,
        email,
        password,
        marketingOptIn,
      });
      return { ok: result.ok, message: result.message, code: result.code };
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch('/api/v1/customer/logout', { method: 'POST' });
    setMember(null);
  }, []);

  const value = useMemo<Auth>(
    () => ({ member, ready, login, register, refresh, logout }),
    [member, ready, login, register, refresh, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth unavailable');
  return value;
};
