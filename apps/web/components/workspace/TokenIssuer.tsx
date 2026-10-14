'use client';

import {useState} from 'react';
import {Icon} from '@/components/Icon';

type Student = {id: string; name: string; email: string | null};
type TokenState = {status: 'idle' | 'success' | 'error'; message?: string; token?: string; studentName?: string; expiresAt?: string; canReplace?: boolean};
const initialState: TokenState = {status: 'idle'};

export function TokenIssuer({students}: {students: Student[]}) {
  const [state, setState] = useState<TokenState>(initialState);
  const [studentId, setStudentId] = useState('');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const issueToken = async (replaceExisting = false) => {
    if (!studentId) { setState({status: 'error', message: 'Choose a student first.'}); return; }
    setPending(true); setCopied(false);
    try {
      const response = await fetch('/api/mentor/connection-tokens', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({studentId, replaceExisting})});
      const result = await response.json().catch(() => ({message: 'The server returned an unreadable response.'}));
      if (!response.ok) { setState({status: 'error', message: result.message || 'We could not issue a token.', canReplace: result.canReplace === true}); return; }
      setState({status: 'success', token: result.token, studentName: result.studentName, expiresAt: result.expiresAt});
    } catch {
      setState({status: 'error', message: 'The website could not reach the token service. Refresh and try once more.'});
    } finally { setPending(false); }
  };
  const copy = async () => { if (!state.token) return; await navigator.clipboard.writeText(state.token); setCopied(true); };

  return <section className="token-issuer"><div className="token-issuer-title"><div><p>Step 2</p><h2>Issue a private MT5 token</h2><span>Create one token for one student. It is shown once, then only its protected version remains in the database.</span></div><Icon name="shield" size={24}/></div>{state.status === 'success' ? <div className="token-result"><span className="eyebrow">TOKEN READY FOR {state.studentName?.toUpperCase()}</span><h3>Copy this now. It will not be shown again.</h3><code>{state.token}</code><button className="copy-token" type="button" onClick={copy}><Icon name="copy" size={16}/>{copied ? 'Copied' : 'Copy token'}</button><p>Send it privately to the student. They paste it into the <b>ConnectionToken</b> field in their own MT5 BBP collector.</p></div> : <form onSubmit={(event) => {event.preventDefault(); void issueToken();}} className="token-form"><label>Student<select name="studentId" value={studentId} onChange={(event) => setStudentId(event.target.value)} required disabled={!students.length || pending}><option value="" disabled>{students.length ? 'Choose a student' : 'No student accounts yet'}</option>{students.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.email || 'No email'}</option>)}</select></label><button className="primary-button" type="submit" disabled={pending || !students.length}>{pending ? 'Creating token…' : 'Create private token'}</button>{state.status === 'error' && <div className="token-error"><p>{state.message}</p>{state.canReplace && <button className="secondary-button" type="button" onClick={() => void issueToken(true)} disabled={pending}>Replace with a new token</button>}</div>}</form>}</section>;
}
