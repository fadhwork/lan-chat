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

## Pratinjau dan ukuran gambar

- Gambar ditampilkan kecil (maksimum 80 × 80 piksel) dan dapat diubah ukurannya dengan menyeret sudut kanan bawah.
- Teks panjang dan tautan akan membungkus otomatis di dalam gelembung chat.

## Admin (mengubah nama pengguna lain)

- Pengguna komputer yang menjalankan aplikasi otomatis menjadi admin: browser di komputer server (melalui `localhost` atau alamat IP komputer tersebut) mendapatkan fitur admin.
- Untuk menjadi admin dari komputer lain, buat `config.json` di samping `server.js` / `lan-chat.exe` (salin `config.example.json`) dan atur `adminPassword`. Di chat buka Pengaturan (ikon roda gigi), lalu pilih **Masuk sebagai admin**.
- Atur `"localhostAdmin": false` untuk mewajibkan kata sandi di semua komputer.
- Admin dapat melihat daftar pengguna online di Pengaturan dan mengubah nama siapa pun. Pesan lama tetap menggunakan nama sebelumnya.

## Pesan yang terhapus otomatis

- Pesan hilang dari layar 15 detik setelah dibaca. Jika beberapa pesan tiba bersamaan, pesan dihapus bergiliran (15 detik, 30 detik, 45 detik, dan seterusnya).
- Pesan dianggap sudah dibaca saat tab chat terbuka dan terlihat. Pesan yang Anda kirim akan hilang dari layar Anda dengan cara yang sama.
- Pengguna dikenali berdasarkan nama pengguna. Pesan yang belum dilihat tetap tersedia saat chat dibuka; penghitung waktu dimulai saat itu.
- Pesan dihapus dari server (beserta file yang diunggah) setelah semua penerima membacanya dan waktunya habis, atau paling lambat setelah 24 jam.
- Admin: Pengaturan -> **Hapus semua chat** langsung menghapus semuanya.
- Ubah di `config.json`: `selfDestruct` (true/false), `secondsPerMessage` (default 15 detik), `maxUnreadHours`.
- Batasan: fitur ini tidak mencegah tangkapan layar atau salin-tempel. Siapa pun dapat menggunakan nama orang lain dan membaca pesan yang belum dibaca karena tidak ada kata sandi pengguna.

## Pengaturan

Di bagian atas `server.js`: `PORT` (default 3000) dan `MAX_FILE_MB` (default 50).

## Catatan

- Tidak ada login: siapa pun di jaringan lokal dapat menggunakan nama apa saja. Gunakan hanya di kantor tepercaya.
- Gunakan alamat IP tetap untuk komputer server agar tautannya tidak berubah.

(c) 2026 fadhlihsani
