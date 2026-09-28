import 'server-only';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {identitySchema,syncSchema,tokenPattern} from './protocol';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function collect(request:Request, action:'handshake'|'sync'|'heartbeat'){
 const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
 if(!token || !tokenPattern.test(token))return reply({error:'unauthorized'},401);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply({error:'json_required'},415);
 // Count streamed bytes; do not trust Content-Length.
 const reader=request.body?.getReader(); let size=0; const chunks:Uint8Array[]=[];
 if(!reader)return reply({error:'invalid_body'},400);
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return reply({error:'body_too_large'},413);}chunks.push(value);}}catch{return reply({error:'invalid_body'},400);}
 let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply({error:'invalid_json'},400);}
 const parsed=(action==='sync'?syncSchema:identitySchema).safeParse(body);
 if(!parsed.success)return reply({error:'invalid_payload'},400);
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||url.includes('YOUR_PROJECT')||key.startsWith('REPLACE_'))return reply({error:'server_not_configured'},503);
 try{
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc('collector_ingest',{p_token_hash:createHash('sha256').update(token).digest('hex'),p_action:action,p_payload:parsed.data});
 if(error)return reply({error:'storage_unavailable'},503);
 const statuses:Record<string,number>={unauthorized:401,account_mismatch:409,handshake_required:409,account_unavailable:409,rate_limited:429};
 if(data?.error)return reply({error:data.error},statuses[data.error]??500);
 return reply(data);
 }catch{return reply({error:'storage_unavailable'},503);}
}
