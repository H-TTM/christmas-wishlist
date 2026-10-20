# 🎄 Christmas Gift Wishlist Web Application

A festive, real-time Christmas gift registry created so you can share gift ideas for your daughter with family and friends. Guests can claim items they have bought, preventing duplicate purchases, while **only you (the parent) can see who bought what**.

---

## ✨ Features

- 🎁 **Shareable Wishlist**: Share a single link with family, relatives, and friends.
- ⚡ **Instant Real-Time Sync**: Uses Server-Sent Events (SSE). When someone reserves an item, it updates immediately on everyone else's screen without needing to refresh.
- 🔒 **Private Buyer Tracking**:
  - When a guest clicks **"I'll Buy This"**, they enter their name and an optional note.
  - **Other visitors ONLY see the item marked as "Claimed / Purchased"** with no purchaser name shown.
  - **Only you (in Parent Mode)** can see who bought each gift, their notes, and when it was claimed.
- 👑 **Parent Mode / Admin Dashboard**:
  - Protected with a PIN (Default: `santa2026`).
  - View purchaser names and notes on each card.
  - Add new gift ideas with title, category, price, store link, photo, priority, and notes (e.g., sizes or color preferences).
  - Edit or delete items anytime.
  - Unclaim / release items if plans change.
  - **Printable / Downloadable Thank-You Checklist**: Clean table of who bought what to make writing thank-you cards effortless on Christmas Day!
  - Customizable daughter's name, page title, and welcoming intro message.
- ❄️ **Festive Holiday Design**:
  - Days-until-Christmas countdown badge.
  - Subtle falling snowflakes animation (with toggle).
  - Category filters (Toys & Games, Books, Clothes, Arts & Crafts, Tech, Stocking Fillers).
  - Search bar to filter gifts.
  - Mobile-first, fully responsive design that looks great on iPhones, Androids, tablets, and desktops.
- 🚀 **Zero External Dependencies**:
  - Built entirely using standard Node.js (Node 22+) built-in modules (`node:http`, `node:sqlite`, `node:crypto`).
  - No `node_modules` installation needed, no vulnerability alerts, instant startup!

---

## 🚀 How to Run

### 1. Start the Server
Open your terminal in this directory and run:

```bash
node server.js
```
*(Or `npm start`)*

The server will start on:
```
http://localhost:3000
```

### 2. Accessing Parent Mode
1. Click **"🔒 Parent Sign In"** in the top right corner.
2. Enter the PIN: `santa2026`
3. You will now see the gold Parent Mode banner, buyer names on claimed items, and options to add/edit gifts and change your PIN.

---

## 🌐 How to Share with Family & Friends

You have several easy options to share this website:

### Option A: Within Your Home / Wi-Fi
If family or friends are on the same Wi-Fi network:
1. Find your computer's local IP address (in Mac System Settings → Wi-Fi → Details, e.g. `192.168.1.45`).
2. Have them visit:
   ```
   http://192.168.1.45:3000
   ```

### Option B: Free Cloudflare Tunnel (Fastest & Secure)
You can expose the local app to a public `https://...` link for free without configuring router ports:
```bash
# If you have cloudflared installed:
cloudflared tunnel --url http://localhost:3000
```
This gives you an instant, secure HTTPS URL to text or message to anyone.

### Option C: Ngrok
```bash
ngrok http 3000
```

### Option D: Host Online for Free (Render, Railway, or VPS)
Because this app has zero external dependencies and uses an embedded SQLite database (`wishlist.db`), you can deploy it to any free hosting provider (such as [Render.com](https://render.com) or [Railway.app](https://railway.app)):
- Build Command: *(leave empty or `npm install`)*
- Start Command: `node server.js`
- Port: `3000` (or uses `process.env.PORT`)

---

## 🧪 Testing

Run the automated test suite verifying public privacy masking and parent authorization:
```bash
npm test
```
