'use client';

import {useState} from 'react';

type PasswordFieldProps = {autoComplete: string};

export function PasswordField({autoComplete}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field">
    <input name="password" type={visible ? 'text' : 'password'} minLength={8} placeholder="At least 8 characters" autoComplete={autoComplete} required />
    <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button>
  </div>;
}
