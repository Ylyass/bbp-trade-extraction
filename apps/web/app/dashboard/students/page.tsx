import {redirect} from 'next/navigation';
import {Icon} from '@/components/Icon';
import {ConnectionStatus} from '@/components/workspace/DashboardWidgets';
import {TokenIssuer} from '@/components/workspace/TokenIssuer';
import {createClient} from '@/lib/supabase/server';
import {accountProfile, age, getWorkspace, isLive, money} from '@/lib/workspace';

export const dynamic = 'force-dynamic';

type Student = {id: string; name: string; email: string | null};

export default async function StudentsPage() {
  const workspace = await getWorkspace();
  if (workspace.role !== 'admin') redirect('/dashboard');
  const supabase = await createClient();
  const {data: rawStudents} = await supabase.from('profiles').select('id,name,email').eq('role', 'student').order('name');
  const students = (rawStudents || []) as Student[];
  const accountsByStudent = new Map(workspace.accounts.map((account) => [account.student_id, account]));
  return <section className="dashboard-page students-page">
    <header className="page-heading"><div><p>Mentor desk</p><h1>Students and connections.</h1><span>Students sign up themselves. You issue a private collector token only after their account appears here.</span></div></header>
    <section className="student-flow"><div><span>1</span><b>Student creates a student account</b><small>They use Student access, not Mentor access.</small></div><div><span>2</span><b>You issue one private token</b><small>Copy it once and give it only to that student.</small></div><div><span>3</span><b>Student connects their own MT5</b><small>Their account appears after the first HTTP 200 sync.</small></div></section>
    <TokenIssuer students={students} />
    <section className="student-roster"><div className="panel-title"><div><p>Student roster</p><h2>{students.length ? `${students.length} student account${students.length === 1 ? '' : 's'}` : 'No student accounts yet'}</h2></div></div>{students.length ? <div className="student-list">{students.map((student) => {const account = accountsByStudent.get(student.id); const snapshot = account ? workspace.latest.get(account.id) : undefined; return <article className="student-row" key={student.id}><div className="student-avatar">{student.name.slice(0, 1).toUpperCase()}</div><div className="student-name"><b>{student.name}</b><span>{student.email || 'Email unavailable'}</span></div><div><span>MT5 account</span><b>{account ? `${account.broker_server} · ${account.broker_login}` : 'Not connected yet'}</b></div><div><span>Equity</span><b>{account ? money(snapshot?.equity, account.currency) : '—'}</b></div><div><span>Last update</span><b>{account ? age(account.last_seen_at) : '—'}</b></div>{account ? <ConnectionStatus live={isLive(account)} text={isLive(account) ? 'Reporting' : 'Paused'} /> : <ConnectionStatus live={false} text="Awaiting setup" />}</article>;})}</div> : <div className="roster-empty"><Icon name="users" size={22}/><span>Ask the test student to create an account first. Their name will appear here after email confirmation.</span></div>}</section>
  </section>;
}