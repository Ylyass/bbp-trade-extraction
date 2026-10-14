import {createHash, randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const reply = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: {'Cache-Control': 'no-store'}});
const studentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as {studentId?: unknown; replaceExisting?: unknown} | null;
    const studentId = typeof payload?.studentId === 'string' ? payload.studentId : '';
    const replaceExisting = payload?.replaceExisting === true;
    if (!studentIdPattern.test(studentId)) return reply({message: 'Choose a student first.'}, 400);
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return reply({message: 'Token setup is incomplete in Vercel. Add the server-only Supabase URL and service-role key, then redeploy.'}, 503);

    const supabase = await createClient();
    const {data: {user}, error: userError} = await supabase.auth.getUser();
    if (userError || !user) return reply({message: 'Your mentor session has expired. Sign in again.'}, 401);
    const {data: mentor, error: mentorError} = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (mentorError) return reply({message: 'We could not verify your mentor account. Refresh and try again.'}, 503);
    if (mentor?.role !== 'admin') return reply({message: 'Only mentors can issue connection tokens.'}, 403);

    const admin = createAdminClient();
    const {data: student, error: studentError} = await admin.from('profiles').select('id,name,role').eq('id', studentId).maybeSingle();
    if (studentError || !student || student.role !== 'student') return reply({message: 'That student account is not available.'}, 404);

    const {data: activeToken, error: tokenError} = await admin.from('connection_tokens').select('id,used_at,expires_at').eq('student_id', studentId).is('revoked_at', null).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
    if (tokenError) return reply({message: 'We could not check that student’s token status.'}, 503);
    if (activeToken?.used_at) return reply({message: 'This student already has an active token connected to MT5. Do not create a second one.'}, 409);
    if (activeToken && !replaceExisting) return reply({message: 'An unused token already exists for this student. Its value is intentionally not stored, so it cannot be shown again.', canReplace: true}, 409);
    if (activeToken && replaceExisting) {
      const {error: revokeError} = await admin.from('connection_tokens').update({revoked_at: new Date().toISOString()}).eq('id', activeToken.id);
      if (revokeError) return reply({message: 'We could not replace the unused token. Please try again.'}, 503);
      const {error: revokeAuditError} = await admin.from('audit_log').insert({student_id: studentId, action: 'token_revoked', metadata: {reason: 'mentor_reissued_unused_token'}});
      if (revokeAuditError) console.error('Token revocation audit entry failed', revokeAuditError);
    }

    const token = `BBP_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const {error: insertError} = await admin.from('connection_tokens').insert({student_id: studentId, token_hash: createHash('sha256').update(token).digest('hex'), expires_at: expiresAt});
    if (insertError) return reply({message: 'We could not issue a token. Please try again.'}, 503);
    const {error: auditError} = await admin.from('audit_log').insert({student_id: studentId, action: 'token_issued', metadata: {expires_at: expiresAt}});
    if (auditError) console.error('Token audit entry failed', auditError);
    return reply({token, studentName: student.name || 'Student', expiresAt});
  } catch (error) {
    console.error('Token issuance API failed', error);
    return reply({message: 'The token service has a server configuration error. Check the latest Vercel function log.'}, 500);
  }
}
