# Get Doorstep live — no coding needed

You'll go from this folder to a real URL (like `doorstep-femi.vercel.app`) in about
10 minutes. Two free accounts required: GitHub and Vercel.

## Step 1 — Create a GitHub account (skip if you have one)
Go to https://github.com/signup and create a free account.

## Step 2 — Create a new repository
1. Click the **+** icon (top right) → **New repository**.
2. Name it `doorstep`.
3. Leave it **Public** (fine for this — there's no secret data or API keys in this
   project since it doesn't use a backend yet).
4. Click **Create repository**. Don't add a README — leave everything else default.

## Step 3 — Upload the project files
1. On the new empty repo page, click **uploading an existing file**.
2. On your computer, unzip the `doorstep-app.zip` you downloaded from this chat.
3. Drag the **entire contents** of the unzipped `doorstep-app` folder (not the
   folder itself — its contents: `src`, `package.json`, `index.html`,
   `vite.config.js`, `.gitignore`, this file) into the GitHub upload box.
   - You do **not** need to upload `node_modules` or `dist` if they exist locally
     — the `.gitignore` handles that, but GitHub's drag-and-drop won't create
     them anyway unless you ran `npm install` locally.
4. Scroll down, click **Commit changes**.

## Step 4 — Deploy on Vercel
1. Go to https://vercel.com/signup and choose **Continue with GitHub**.
2. Click **Add New… → Project**.
3. Find your `doorstep` repo in the list and click **Import**.
4. Vercel auto-detects it's a Vite project — you don't need to change any
   settings. Click **Deploy**.
5. Wait ~60 seconds. You'll get a live URL like `doorstep-xyz.vercel.app`.

That's it — that URL is now your live app. Bookmark it, add it to your phone's
home screen (Safari/Chrome → Share → Add to Home Screen) so it feels like a real
app, and start adding your real leads.

## A few things to know about this version
- **Your data lives in your browser only** (localStorage), not in the cloud. It
  will stay put as long as you use the same browser on the same device and don't
  clear site data — but it won't sync across your phone and laptop, and clearing
  browser data will erase it. That's fine for testing solo; we'll fix this in the
  next step by adding a real database + accounts.
- **Every time you want to update the app** (new features, bug fixes), you'll
  repeat Step 3 (upload the changed files to GitHub) and Vercel will
  auto-redeploy within a minute — no extra steps needed on the Vercel side.
- **When you're ready for other agents to use it too**, that's when we add
  Supabase (real accounts, cloud database so your data follows you across
  devices) and Stripe (billing). Just say the word.
