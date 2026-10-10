# BBP end-to-end test guide

Use this exact order. Do not replace the collector that is currently reporting from the mentor demo account until Step 6.

## What already works

The existing MetaQuotes-Demo account `113347721` is attached to the mentor profile. Repeated `BBP sync HTTP 200` messages prove it is reporting account snapshots. The MetaQuotes **MQL5 Community** login window is unrelated to this connection; close it if it appears.

## 1. Publish the app and apply the database update

1. Open the BBP project in Vercel after the deployment finishes.
2. Open Supabase, select the BBP project, then open **SQL Editor**.
3. Create a new query.
4. Open `supabase/migrations/202610100004_collector_trade_events.sql` from this repository.
5. Copy its complete contents into the query and choose **Run**.
6. Confirm that Supabase shows a success message. Do this once only.

This adds storage for open positions and closed deal events. The existing v0.200 collector continues to report balance and equity before and after this update.

## 2. Make confirmation email reliable

Students use email confirmation links, not a Gmail code.

1. In Supabase, open **Authentication** and find **SMTP Settings**.
2. Configure a production mail sender (for example, Resend, Postmark, or your own SMTP service).
3. Set the Site URL to your production BBP Vercel URL.
4. Add the same URL plus `https://your-domain/auth/confirm` to the allowed redirect URLs.
5. Send one test confirmation email to an address that is not a Supabase team member.

Do not add students to your Supabase project team just to receive email. That would give them dashboard access they do not need.

## 3. Create a real student test account

1. Open the public BBP site in a private/incognito browser window.
2. Choose **Create student account**. Do not use the Mentor sign-in page.
3. Use a fresh test email address and create the account.
4. Open the confirmation email and choose the confirmation link.
5. Sign in on the **Student** page.
6. The student dashboard should say it is waiting for an MT5 connection.

A normal public sign-up is always a student. Mentor access is not public: it is assigned by the workspace owner to an approved profile.

## 4. Issue that student’s private connection token

1. In a normal browser window, sign in at `/mentor` with the existing Ylyass mentor email.
2. Open **Students** in the left navigation.
3. Verify the new student appears in the roster.
4. Choose the student and select **Create private token**.
5. Copy the token immediately and give it only to that student. It begins with `BBP_`.

The token is deliberately shown only once. If it is lost, revoke/replace it from the database or issue a new token after the previous token is revoked.

## 5. Prepare a separate student MT5 demo account

1. In MT5, open a **second demo trading account** for the student test. Do not use the existing mentor-linked account `113347721` for this test.
2. Sign in to that broker/demo account in MT5. This is the account login shown in the MT5 title bar.
3. Do not sign in to the MQL5 Community popup; it is not required.
4. In **Tools → Options → Expert Advisors**, enable algorithmic trading and add `https://bbp-trade-extraction.vercel.app` to the allowed WebRequest URLs.

## 6. Install collector 0.210 on the student terminal

1. Copy `collectors/mt5/BBPCollectorMT5.mq5` into the student terminal’s `MQL5/Experts/BBP` folder.
2. Open MetaEditor, open the file, and choose **Compile**. It must show `0 errors`.
3. Back in MT5, refresh Expert Advisors.
4. Drag **BBPCollectorMT5** onto one chart. The chart symbol and timeframe do not matter.
5. On the **Inputs** tab enter:
   - `ApiOrigin`: `https://bbp-trade-extraction.vercel.app`
   - `ConnectionToken`: the one private `BBP_...` token issued for this student
   - `SyncIntervalSeconds`: `30`
6. On the **Common** tab tick **Allow Algo Trading**, then choose **OK**.
7. Open the **Experts** tab in MT5. Wait for `BBP handshake HTTP 200`, then `BBP sync HTTP 200`.

`HTTP 200` means the student terminal has connected. If it is `401`, the token is wrong or expired. If it is `-1`, check the WebRequest URL list.

## 7. Test live account, open position, and close result

Only use a demo account for this test.

1. Keep the student’s MT5 terminal open with the collector attached.
2. Open the student dashboard in the private browser. Within about 30 seconds it should show the correct balance, equity, connection status, and account number.
3. Refresh the mentor dashboard or wait for its automatic refresh. The student account should show as reporting.
4. Manually open one small demo buy or sell order in the student MT5 terminal. BBP does not place the order.
5. Wait up to two collector cycles (about 60 seconds), then open **Activity** in either dashboard. The open position should appear.
6. Manually close the demo order in MT5.
7. Wait up to two collector cycles, then reopen **Activity**. The closed deal should appear with realized net: profit + commission + swap + fee.

A position that stays open changes **Open P/L**. A closed deal becomes an historical result. These are intentionally shown separately.

## Expected result

- Student sees only their own account, positions, and closed deal events.
- Mentor sees every student account permitted by BBP, including online status and the same read-only figures.
- The original mentor demo account remains a mentor test account and does not pretend to be a student.
- Neither dashboard has any ability to open, change, or close a trade.
