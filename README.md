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

- Klik gambar mini untuk membukanya di jendela pratinjau mengambang; seret bilah judulnya untuk memindahkan jendela, lalu klik × atau tekan Esc untuk menutupnya.
- Teks panjang dan tautan akan membungkus otomatis di dalam gelembung chat.

## Admin (mengubah nama pengguna lain)

- Pengguna komputer yang menjalankan aplikasi otomatis menjadi admin: browser di komputer server (melalui `localhost` atau alamat IP komputer tersebut) mendapatkan fitur admin.
- Untuk menjadi admin dari komputer lain, buat `config.json` di samping `server.js` / `lan-chat.exe` (salin `config.example.json`) dan atur `adminPassword`. Di chat buka Pengaturan (ikon roda gigi), lalu pilih **Masuk sebagai admin**.
- Atur `"localhostAdmin": false` untuk mewajibkan kata sandi di semua komputer.
- Admin dapat melihat daftar pengguna online di Pengaturan dan mengubah nama siapa pun. Pesan lama tetap menggunakan nama sebelumnya.

## Pesan yang terhapus otomatis

- Pesan dihapus otomatis dari layar setelah timer pembaca berakhir; pesan yang belum dibaca dihapus setelah batas `maxUnreadHours`.
- Admin: Pengaturan -> **Hapus semua chat** menghapus pesan dan file bersama dari server.
- Ubah di `config.json`: `selfDestruct` (true/false), `secondsPerMessage` (default 15 detik), `maxUnreadHours`.

## Tampilan pojok dan Picture-in-Picture

- Tombol **Pojok** membuka chat di jendela mengambang (Picture-in-Picture) yang tetap di atas aplikasi lain, di luar tab. Klik **Tutup** di jendela itu (atau **Kembalikan chat ke sini** di tab) untuk mengembalikan chat ke halaman. Pesan yang tampil di jendela ini dianggap sudah dibaca, dan suara pesan baru tetap berbunyi saat tab tidak aktif.
- Picture-in-Picture memerlukan Chrome/Edge desktop terbaru dan konteks aman (`localhost` atau HTTPS). Pada alamat biasa seperti `http://192.168.1.20:3000`, browser menyembunyikan fitur ini.
- Jika tidak tersedia (alamat `http://` biasa, Firefox, Safari), **Pojok** menampilkan panel mengambang kecil di dalam tab. Seret garis di bagian atasnya untuk memindahkan; panel menempel ke sudut terdekat dan posisinya diingat.
- Agar PiP asli berfungsi lewat alamat IP kantor di Chrome/Edge: buka `chrome://flags/#unsafely-treat-insecure-origin-as-secure` (Edge: `edge://flags/#unsafely-treat-insecure-origin-as-secure`), tambahkan alamat server (mis. `http://192.168.1.20:3000`), pilih Enabled, lalu mulai ulang browser. Pengaturan ini berlaku per komputer.

## Pengaturan

Di bagian atas `server.js`: `PORT` (default 3000) dan `MAX_FILE_MB` (default 50).

## Catatan

- Tidak ada login: siapa pun di jaringan lokal dapat menggunakan nama apa saja. Gunakan hanya di kantor tepercaya.
- Gunakan alamat IP tetap untuk komputer server agar tautannya tidak berubah.

(c) 2026 fadhlihsani
