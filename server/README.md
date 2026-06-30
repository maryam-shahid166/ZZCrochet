# Z&Z Crochet — Backend Setup

This adds real functionality to your site:
- When a customer submits the order form, it's saved on a server and **two real emails are sent**: a confirmation to the customer, and a notification to you (the admin).
- You get a password-protected **admin dashboard** (`admin.html`) to see every order, mark it New / In progress / Completed, view uploaded reference images, and delete old ones.

A plain HTML file (your storefront) can't do any of this by itself — it needs a server to actually send email and store data. This folder is that server.

## 1. Install requirements

You need [Node.js](https://nodejs.org) installed (v18+). Then, inside the `server` folder:

```bash
cd server
npm install
```

## 2. Configure your email + admin login

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `ADMIN_USER` / `ADMIN_PASSWORD` — whatever you want to log into the admin dashboard with.
- `SMTP_USER` / `SMTP_PASS` — your email credentials. Easiest path with Gmail:
  1. Turn on 2-Step Verification on your Google account.
  2. Go to Google Account → Security → App Passwords → generate one for "Mail".
  3. Use that 16-character password as `SMTP_PASS` (not your normal Gmail password).
- `ADMIN_EMAIL` — where new-order notifications should land (can be the same Gmail address).

(You can also use a transactional email service like Resend, SendGrid, or Mailgun instead of Gmail — just swap the SMTP_HOST/PORT/USER/PASS for the ones they give you.)

## 3. Run it locally to test

```bash
npm start
```

This starts the server at `http://localhost:4000`. Your storefront's order form is already pointed at this address (see `API_BASE` near the bottom of `index.html`'s `<script>`), so open `index.html` in a browser, fill out an order, and submit — you should get a real email, and see the order appear at `http://localhost:4000/admin.html`.

## 4. Deploy it so it works for real customers

Running it on your laptop only works while your laptop is on. To make this live 24/7, deploy the `server` folder to a free host like **Render** or **Railway**:

**Render (recommended, free tier):**
1. Push this `server` folder to a GitHub repo.
2. On [render.com](https://render.com), click "New Web Service", connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add all the variables from your `.env` file under Render's "Environment" tab (don't upload `.env` itself).
5. Once deployed, Render gives you a URL like `https://zz-crochet-api.onrender.com`.

Then open `index.html`, find this line near the bottom of the `<script>` tag:

```js
const API_BASE = "http://localhost:4000";
```

and change it to your live URL:

```js
const API_BASE = "https://zz-crochet-api.onrender.com";
```

Re-upload `index.html` wherever your storefront is hosted (Netlify, Vercel static, GitHub Pages, etc.) and orders will flow through for real.

## 5. Using the admin dashboard

Visit `https://your-backend-url/admin.html`, sign in with the `ADMIN_USER` / `ADMIN_PASSWORD` you set, and you'll see every order — colors picked, yarn type, uploaded photos, and a status dropdown you can update as you work through orders.

## Notes

- Orders are stored in `server/data/orders.json` and uploaded photos in `server/uploads/` — simple file-based storage, fine for a small shop. If you outgrow it, swap in a real database later.
- The admin login uses HTTP Basic Auth — simple and fine for one or two people; nothing fancier needed at this scale.
