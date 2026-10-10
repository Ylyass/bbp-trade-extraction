import {createServerClient} from '@supabase/ssr';
import type {EmailOtpType} from '@supabase/supabase-js';
import {NextResponse} from 'next/server';

function loginError(origin: string) {
  return NextResponse.redirect(`${origin}/login?error=confirmation`);
}

export async function GET(request: Request) {
  const {searchParams, origin} = new URL(request.url);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return loginError(origin);

  const response = NextResponse.redirect(`${origin}/dashboard`);
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.headers.get('cookie')?.split(';').map((pair) => {
          const [name, ...parts] = pair.trim().split('=');
          return {name, value: parts.join('=')};
        }) || [];
      },
      setAll(values) {
        values.forEach(({name, value, options}) => response.cookies.set(name, value, options));
      },
    },
  });

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const error = code
    ? (await supabase.auth.exchangeCodeForSession(code)).error
    : tokenHash && type
      ? (await supabase.auth.verifyOtp({type: type as EmailOtpType, token_hash: tokenHash})).error
      : new Error('Missing confirmation parameters');

  if (error) return loginError(origin);
  return response;
}
