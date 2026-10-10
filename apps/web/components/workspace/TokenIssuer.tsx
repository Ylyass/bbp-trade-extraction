'use client';

import {useActionState, useState} from 'react';
import {Icon} from '@/components/Icon';
import {initialIssueTokenState, issueConnectionToken} from '@/app/dashboard/students/actions';

type Student = {id: string; name: string; email: string | null};

export function TokenIssuer({students}: {students: Student[]}) {
  const [state, formAction, pending] = useActionState(issueConnectionToken, initialIssueTokenState);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!state.token) return;
    await navigator.clipboard.writeText(state.token);
    setCopied(true);
  };
  return <section className="token-issuer"><div className="token-issuer-title"><div><p>Step 2</p><h2>Issue a private MT5 token</h2><span>Create one token for one student. It is shown once, then only its protected version remains in the database.</span></div><Icon name="shield" size={24}/></div>{state.status === 'success' ? <div className="token-result"><span className="eyebrow">TOKEN READY FOR {state.studentName?.toUpperCase()}</span><h3>Copy this now. It will not be shown again.</h3><code>{state.token}</code><button className="copy-token" type="button" onClick={copy}><Icon name="copy" size={16}/>{copied ? 'Copied' : 'Copy token'}</button><p>Send it privately to the student. They paste it into the <b>ConnectionToken</b> field in their own MT5 BBP collector.</p></div> : <form action={formAction} className="token-form"><label>Student<select name="studentId" defaultValue="" required disabled={!students.length}><option value="" disabled>{students.length ? 'Choose a student' : 'No student accounts yet'}</option>{students.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.email || 'No email'}</option>)}</select></label><button className="primary-button" type="submit" disabled={pending || !students.length}>{pending ? 'Creating token…' : 'Create private token'}</button>{state.status === 'error' && <p className="token-error">{state.message}</p>}</form>}</section>;
}