# VentureGate website — Supabase-connected starter

## What this version does
- Reads published films from your Supabase database.
- Lets your admin account sign in through Supabase Auth.
- Checks the `profiles.role` value before showing the studio tools.
- Lets the admin add and remove films in the shared database.
- Plays YouTube, Vimeo, and direct MP4 links.

## First setup
1. Open `config.js` in Notepad.
2. Replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with the publishable key you copied.
3. Save the file.
4. In Supabase, open SQL Editor, create a new query, paste the contents of `SUPABASE-SETUP.sql`, and click Run.
5. Put all five website files (`index.html`, `styles.css`, `app.js`, `config.js`) in the same folder. Keep the SQL file for setup reference.
6. Open `index.html` to test, or upload the folder to your web host.

## Admin login
Click Admin on the website and sign in using the email/password for the Supabase Auth account whose `profiles.role` is `admin`.

## Important
- The publishable key is intended for browser use. Never put a Supabase secret/service-role key in `config.js`.
- Your RLS policies protect database actions. Do not disable RLS.
- The film form publishes entries immediately. Add only videos you own or have permission to distribute.
- YouTube/Vimeo embeds are links, not private video hosting. YouTube may show its own ads even if VentureGate later has its own ad-free membership.
- The £25 payment button is still a placeholder; Stripe checkout and verified payment handling have not been connected.
- AdSense is not connected and approval is not guaranteed.
- This is a starter integration; test it before public launch.
