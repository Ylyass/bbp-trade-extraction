'use server';

import {createHash, randomBytes} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';

export type IssueTokenState = {status: 'idle' | 'success' | 'error'; message?: string; token?: string; studentName?: string; expiresAt?: string};
export const initialIssueTokenState: IssueTokenState = {status: 'idle'};

export async function issueConnectionToken(_: IssueTokenState, formData: FormData): Promise<IssueTokenState> {
  try {
    const studentId = String(formData.get('studentId') || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) return {status: 'error', message: 'Choose a student first.'};

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {status: 'error', message: 'Token setup is incomplete in Vercel. Add the server-only Supabase URL and service-role key, then redeploy.'};
    }

    const supabase = await createClient();
    const {data: {user}, error: userError} = await supabase.auth.getUser();
    if (userError || !user) return {status: 'error', message: 'Your mentor session has expired. Sign in again.'};
    const {data: mentor, error: mentorError} = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (mentorError) return {status: 'error', message: 'We could not verify your mentor account. Refresh and try again.'};
    if (mentor?.role !== 'admin') return {status: 'error', message: 'Only mentors can issue connection tokens.'};

    const admin = createAdminClient();
    const {data: student, error: studentError} = await admin.from('profiles').select('id,name,role').eq('id', studentId).maybeSingle();
    if (studentError || !student || student.role !== 'student') return {status: 'error', message: 'That student account is not available.'};

    const {data: activeToken, error: tokenError} = await admin.from('connection_tokens').select('id,used_at,expires_at').eq('student_id', studentId).is('revoked_at', null).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
    if (tokenError) return {status: 'error', message: 'We could not check that student’s token status.'};
    if (activeToken) return {status: 'error', message: activeToken.used_at ? 'This student already has an active token connected to MT5. Do not create a second one.' : 'This student already has an unused active token. Use that token or revoke it before issuing another.'};

    const token = `BBP_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const {error: insertError} = await admin.from('connection_tokens').insert({student_id: studentId, token_hash: createHash('sha256').update(token).digest('hex'), expires_at: expiresAt});
    if (insertError) return {status: 'error', message: 'We could not issue a token. Please try again.'};
    const {error: auditError} = await admin.from('audit_log').insert({student_id: studentId, action: 'token_issued', metadata: {expires_at: expiresAt}});
    if (auditError) console.error('Token audit entry failed', auditError);
    return {status: 'success', token, studentName: student.name || 'Student', expiresAt};
  } catch (error) {
    console.error('Token issuance failed', error);
    return {status: 'error', message: 'The token service hit a server error. Refresh once and try again. If it repeats, the Vercel log now contains the exact reason.'};
  }
}
