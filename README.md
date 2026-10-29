# LAN Chat

Lightweight office chat with file sharing. One PC runs the server; everyone else just opens a link in the browser.

## Run it

1. Double-click **`start.bat`**.
2. The window shows links like `http://192.168.1.20:3000`. Send one to your colleagues.
3. If Windows Firewall asks, click **Allow** (private networks).
4. Keep the window open. Closing it stops the chat.

## Files created while running

- `history.jsonl` - chat history (delete it to clear history)
- `uploads/` - shared files (clean it up now and then)

## Settings

At the top of `server.js`: `PORT` (default 3000) and `MAX_FILE_MB` (default 50).

## Notes

- No login: anyone on the LAN can use any name. Fine for a trusted office.
- Give the server PC a fixed IP so the link doesn't change.

(c) 2026 fadhlihsani
