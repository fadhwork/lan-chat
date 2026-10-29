# LAN Chat

Lightweight office chat with file sharing. One PC runs the server; everyone else just opens a link in the browser.

## Easiest: download the ready-made exe (no Node/npm needed)

1. Put this folder in a GitHub repo (the `.github/workflows/build.yml` file builds it).
2. On GitHub open the **Actions** tab, open the latest run, and download **lan-chat-exe**.
3. Unzip it and double-click **lan-chat.exe**. It creates `uploads` and `history.jsonl` next to itself.

## Alternative: portable folder (needs node.exe)

1. Download Node.js **"Windows Binary (.zip)"** from nodejs.org/en/download (not the installer).
2. Open the zip and copy **`node.exe`** into this folder, next to `server.js`.
3. On any PC that has Node/npm, open a terminal in this folder and run `npm install`. This creates the `node_modules` folder.
4. Zip the whole `lan-chat` folder. It now runs on any Windows PC with no installation.

## Run it

1. Double-click **`start.bat`**.
2. The window shows links like `http://192.168.1.20:3000`. Send one to your colleagues.
3. If Windows Firewall asks, click **Allow** (private networks).
4. Keep the window open. Closing it stops the chat.

## Files created while running

- `history.jsonl` - chat history (delete it to clear history)
- `uploads/` - shared files (clean it up now and then)

## Admin (rename other users)

- Whoever runs the app is admin automatically: any browser on the PC that runs the server (via `localhost` or that PC's own IP link) gets the admin tools.
- To be admin from another PC, create `config.json` next to `server.js` / `lan-chat.exe`
  (copy `config.example.json`) and set `adminPassword`. Then in the chat open Settings (gear) and click **Admin login**.
- Set `"localhostAdmin": false` to require the password everywhere.
- Admins see a list of online users in Settings and can rename anyone. Old messages keep the old name.

## Self-destructing messages

- A message vanishes from your screen 30 seconds after you read it. If several arrive at once, they vanish one after another (30 s, 60 s, 90 s...).
- "Read" means the chat tab is open and visible. Messages you write vanish from your own screen the same way.
- A person is identified by their username. Someone who hasn't opened the chat yet still sees the message when they do, and their timer starts then.
- A message is deleted from the server (with its uploaded file) when everyone it was meant for has read it and their timers ended, or after 24 hours at most.
- Admin: Settings -> **Clear all chats** deletes everything immediately.
- Change it in `config.json`: `selfDestruct` (true/false), `secondsPerMessage`, `maxUnreadHours`.
- Limits: this keeps the chat tidy but cannot stop screenshots or copy-paste. Anyone can type another person's username and read that person's unread messages, because there are no passwords.

## Settings

At the top of `server.js`: `PORT` (default 3000) and `MAX_FILE_MB` (default 50).

## Notes

- No login: anyone on the LAN can use any name. Fine for a trusted office.
- Give the server PC a fixed IP so the link doesn't change.

(c) 2026 fadhlihsani
