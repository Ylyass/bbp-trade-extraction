import {collect} from '@/lib/collector';
export const runtime='nodejs';
export async function POST(request:Request){return collect(request,'handshake');}
