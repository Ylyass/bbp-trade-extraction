// Deliberately disabled: no unauthenticated account-data logging endpoint.
export async function POST(){return Response.json({error:'use_handshake_then_sync'},{status:501});}
