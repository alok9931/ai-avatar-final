# 🚀 Deploying to Hostinger Node.js Hosting

There are **two ways** to host this on Hostinger:

| Method | Best for | Difficulty |
|---|---|---|
| **Method A — Node.js Web Apps** (hPanel) | Non-technical, GitHub deploy | Easy |
| **Method B — VPS with PM2 + Nginx** | Full control, custom domain, SSL | Medium |

---

## ✅ Method A — Hostinger Node.js Web Apps (Recommended)

Hostinger auto-detects Next.js, runs `npm run build`, and starts `npm run start` for you.
Requires: **Business or Cloud hosting plan** (not shared hosting).

### Step 1 — Push your code to GitHub

```bash
# In the ai-webinar-hostinger folder:
git init
git add .
git commit -m "Initial webinar app"
# Create a repo at github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/ai-webinar.git
git push -u origin main
```

### Step 2 — Add the app in hPanel

1. Log in at **hpanel.hostinger.com**
2. Go to **Websites** → **Add Website**
3. Select **Node.js Apps**
4. Select **Import Git Repository**
5. Authorize GitHub → select your repo
6. Hostinger will auto-detect these settings:
   ```
   Build command:   npm run build
   Start command:   npm run start
   Node version:    18.x or 20.x
   Port:            3000
   ```

### Step 3 — Add environment variables

In the Hostinger app dashboard → **Environment Variables**, add each key:

```
HEYGEN_API_KEY              = your_heygen_key
NEXT_PUBLIC_AVATAR_ID       = your_avatar_id
OPENAI_API_KEY              = your_openai_key
NEXT_PUBLIC_FIREBASE_API_KEY         = ...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN     = ...
NEXT_PUBLIC_FIREBASE_PROJECT_ID      = ...
NEXT_PUBLIC_FIREBASE_DATABASE_URL    = ...
NEXT_PUBLIC_WEBINAR_TITLE   = My Webinar
NEXT_PUBLIC_AVATAR_PERSONA  = You are a professional webinar host...
```

### Step 4 — Deploy

Click **Deploy**. Hostinger will:
- Run `npm install`
- Run `npm run build`
- Start `npm run start` on port 3000
- Give you a live URL instantly

### Step 5 — Connect your domain (optional)

In hPanel → **Domains** → point your domain to the app. Free SSL is auto-provisioned.

---

## ⚙️ Method B — Hostinger VPS (Full Control)

Use this if you want a VPS plan (KVM1 is enough to start).

### Step 1 — SSH into your VPS

```bash
ssh root@YOUR_VPS_IP
```

### Step 2 — Install Node.js via NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts
node -v   # should show v20.x or v22.x
npm -v
```

### Step 3 — Install PM2 (keeps app alive after terminal closes)

```bash
npm install -g pm2
```

### Step 4 — Upload your project

**Option A — via GitHub:**
```bash
git clone https://github.com/YOUR_USERNAME/ai-webinar.git
cd ai-webinar
```

**Option B — via ZIP upload (Hostinger File Manager or SFTP):**
```bash
# Upload ai-webinar-hostinger.zip via hPanel File Manager, then:
unzip ai-webinar-hostinger.zip
cd ai-webinar-hostinger
```

### Step 5 — Configure environment variables

```bash
cp .env.example .env.local
nano .env.local   # fill in all your API keys
```

### Step 6 — Build and start with PM2

```bash
npm install
npm run build

# Start with PM2
pm2 start npm --name "ai-webinar" -- start
pm2 save
pm2 startup   # run the command it outputs, to auto-restart on reboot
```

Check it's running:
```bash
pm2 status
pm2 logs ai-webinar
```
App is now live at `http://YOUR_VPS_IP:3000`

### Step 7 — Install Nginx as reverse proxy

```bash
apt update && apt install nginx -y
```

Create config:
```bash
nano /etc/nginx/sites-available/ai-webinar
```

Paste this (replace `yourdomain.com`):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Disable buffering for WebRTC streaming responses
    proxy_buffering off;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Required for LiveAvatar WebRTC streaming
        add_header X-Accel-Buffering no;
    }
}
```

Enable and start:
```bash
ln -s /etc/nginx/sites-available/ai-webinar /etc/nginx/sites-enabled/
nginx -t       # test config
systemctl restart nginx
```

### Step 8 — Add free SSL with Certbot

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Your app will be live at `https://yourdomain.com`.

### Step 9 — Point your domain to the VPS

In Hostinger hPanel → **DNS Zone** for your domain:
- Delete old A records
- Add: `A record @ → YOUR_VPS_IP`
- Add: `A record www → YOUR_VPS_IP`

DNS takes 15–30 minutes to propagate.

---

## 🔄 Updating your app after changes

**Method A (GitHub auto-deploy):**
```bash
git push origin main   # Hostinger auto-redeploys
```

**Method B (VPS):**
```bash
cd ~/ai-webinar
git pull
npm install
npm run build
pm2 restart ai-webinar
```

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| App shows 502 Bad Gateway | PM2 isn't running — run `pm2 restart ai-webinar` |
| Avatar doesn't connect | Check `HEYGEN_API_KEY` in env vars |
| Chat not updating | Check Firebase config keys |
| Build fails on Hostinger | Make sure Node.js version is 18+ in hPanel settings |
| SSL not working | Re-run `certbot --nginx` after DNS propagates |

---

## 📂 Where files live (VPS)

```
/root/ai-webinar/        ← your source code
/root/ai-webinar/.next/  ← build output
/etc/nginx/sites-available/ai-webinar  ← Nginx config
```

PM2 keeps `npm run start` running at all times, Nginx forwards port 80/443 → 3000.
