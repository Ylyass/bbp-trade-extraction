# BBP launch checklist

Do these in order. Do not deploy the dashboard before steps 1–3 are complete.

## 1. Apply the new Supabase migration

1. Open the BBP Supabase project.
2. Open **SQL Editor**, then select **New query**.
3. Open `supabase/migrations/202610100003_dashboard_auth_and_metrics.sql` in VS Code.
4. Copy the entire file into the Supabase query editor.
5. Click **Run**.
6. Wait for the green success message. If you see an error, copy the full error message before changing anything.

This adds automatic student profiles, student/mentor permissions, floating profit/loss, margin figures and drawdown calculations.

## 2. Configure Supabase Authentication

1. In Supabase, open **Authentication** then **URL Configuration**.
2. Set **Site URL** to `https://bbp-trade-extraction.vercel.app`.
3. Under **Redirect URLs**, add `https://bbp-trade-extraction.vercel.app/auth/confirm`.
4. Under **Authentication** → **Providers** → **Email**, keep email enabled. Keep confirmation email enabled for the first launch.
5. In the top **Connect** panel, or **Project Settings** → **API**, copy the **Project URL** and the default **Publishable key**. Do not copy the secret key here.

## 3. Add Vercel variables

Open Vercel → BBP project → **Settings** → **Environment Variables**. Add these for **Production**, **Preview**, and **Development**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase default Publishable key |
| `NEXT_PUBLIC_SITE_URL` | `https://bbp-trade-extraction.vercel.app` |

Keep these existing variables exactly as they are:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your server-only secret key |

The `NEXT_PUBLIC` publishable key is safe in the website. Never put the secret key in a `NEXT_PUBLIC` variable.

## 4. Publish the BBP update

From the repository folder in PowerShell, run:

```powershell
git add .
git commit -m "Add student login, mentor dashboard and account risk metrics"
git push
```

Open Vercel → **Deployments** and wait for the new deployment to become **Ready**. If the deployment does not appear automatically, use the three dots on the Deployments page → **Create Deployment**, choose branch `main`, then deploy to Production.

## 5. Create the mentor login

1. Open `https://bbp-trade-extraction.vercel.app/login?mode=signup`.
2. Sign up using your mentor email and a new strong password.
3. Open the confirmation email and click the link.
4. Go back to Supabase → **SQL Editor** → **New query**.
5. Run this once, replacing the email only if you used a different one:

```sql
update public.profiles
set role = 'admin', name = 'Ylyass'
where email = 'tkmcity@gmail.com';
```

6. Sign out and sign back in to BBP. You should now see **Mentor workspace** and the account roster.

If the update says `0 rows`, complete the website sign-up and email confirmation first, then run it again.

## 6. Upgrade the MT5 collector to version 0.2

1. In the repository, open `collectors/mt5/BBPCollectorMT5.mq5`.
2. Copy it over the existing `BBPCollectorMT5.mq5` in your MT5 data folder: `MQL5/Experts/BBP`.
3. In MT5, press **F4** to open MetaEditor.
4. Open the new BBP collector file and press **F7** to compile. It must say `0 errors`.
5. Return to MT5. In Navigator, right-click **Expert Advisors** and choose **Refresh**.
6. Remove the old collector from the chart, then drag the new one back onto any chart for the same account.
7. Keep **Allow Algo Trading** checked. On Inputs, keep your existing `ApiOrigin` and private `ConnectionToken` unchanged.
8. Click **OK**. Confirm the Experts tab shows `BBP handshake HTTP 200`, then `BBP sync HTTP 200`.

The chart symbol still does not matter. One collector covers the whole connected MT5 account.

## 7. Confirm version 0.2 data

1. Supabase → **Table Editor** → `account_snapshots`.
2. Refresh after one minute.
3. Scroll right. New rows should have values for `floating_pl`, `margin`, `free_margin`, `margin_level`, `equity_peak`, and drawdown columns.
4. Open the BBP website dashboard in a new tab and sign in.

When there are no open trades, floating P/L and margin can legitimately show zero. The later positions/history release is what adds individual Gold, EURUSD and other trade rows.

## If something does not work

| What you see | Check this first |
| --- | --- |
| Website says Supabase credentials are not configured | All three `NEXT_PUBLIC_*` variables exist in Vercel, then redeploy. |
| Confirmation email link returns to the wrong site | Recheck both Supabase URL Configuration entries exactly. |
| Dashboard says profile is being prepared | Confirm the SQL migration ran; sign out and sign in again. |
| Dashboard says no account connected | Confirm you signed in with the same student profile that owns the MT5 account. |
| MT5 says HTTP 400 after the collector upgrade | Confirm Vercel deployed the new code and the migration ran before attaching version 0.2. |
| MT5 says HTTP 401 | The token is expired, revoked, or has a typo. Issue a new token; do not send it in chat. |
| MT5 says HTTP -1 | Check **Tools** → **Options** → **Experts** and confirm the exact Vercel URL is on the WebRequest allow-list. |
