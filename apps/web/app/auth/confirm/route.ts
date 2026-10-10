import {NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';

export async function GET(request:Request){
 const {searchParams,origin}=new URL(request.url);
 const tokenHash=searchParams.get('token_hash');
 const type=searchParams.get('type');
 if(tokenHash&&type){
  const response=NextResponse.redirect(`${origin}/dashboard`);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(url&&key){
   const supabase=createServerClient(url,key,{cookies:{getAll(){return request.headers.get('cookie')?.split(';').map(pair=>{const [name,...parts]=pair.trim().split('=');return {name,value:parts.join('=')};})||[];},setAll(values){values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
   await supabase.auth.verifyOtp({type:type as 'signup',token_hash:tokenHash});
  }
  return response;
 }
 return NextResponse.redirect(`${origin}/login?error=The%20confirmation%20link%20is%20invalid%20or%20expired.`);
}
