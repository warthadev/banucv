# Wartha Sensei

> **A personal development environment for building, exploring, and shipping ideas.**

[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-ffca28?logo=firebase&logoColor=111827)](https://firebase.google.com/)

Wartha Sensei adalah platform web all-in-one milik WarthaDev. Proyek ini menggabungkan dashboard personal, AI tools, pengelolaan media, cloud file access, dan utilitas developer dalam satu pengalaman yang **mobile-first**, responsif, dan dapat dikembangkan secara modular.

> Repository: [`warthadev/banucv`](https://github.com/warthadev/banucv)<br>
> Live app: [`warthasensei.web.app`](https://warthasensei.web.app/)

## Kenapa proyek ini menarik?

Bukan sekadar landing page atau template dashboard. Wartha Sensei dirancang sebagai **ruang kerja digital pribadi**: satu tempat untuk membuka koleksi media, menggunakan AI, mengelola repository, memproses link, dan mengatur pengalaman aplikasi sesuai preferensi pengguna.

```text
┌─────────────────────────────────────────────────────────────┐
│                       WARTHA SENSEI                        │
│  Explore  •  Create  •  Manage  •  Automate  •  Learn      │
├───────────────┬───────────────┬───────────────┬─────────────┤
│ AI Workspace  │ Cloud Library │ Dev Utilities │ Media Hub   │
│ Gemini Chat   │ Telegram      │ GitHub Editor │ Playlist    │
│ API Checker   │ Hugging Face  │ QR / Barcode  │ Downloader  │
└───────────────┴───────────────┴───────────────┴─────────────┘
```

## Fitur utama

### Workspace dan akses

- Autentikasi berbasis Firebase Authentication dengan persistence di browser.
- Protected routes melalui `GateAuth` dan dashboard visit gate.
- Layout responsif untuk Android, tablet, dan desktop.
- Dark/light theme yang mengikuti preferensi sistem serta dapat dikontrol dari aplikasi.
- Lazy-loaded pages dengan loading state agar navigasi tetap ringan.

### AI workspace

- **AI Chat** untuk percakapan berbasis Gemini.
- **API AI Checking** untuk memeriksa status dan konfigurasi API.
- API key Gemini disimpan per-user melalui Firestore, bukan ditulis langsung di source code frontend.

### Cloud library

- **CloudView** untuk menjelajah sumber file terhubung.
- Dukungan sumber **Telegram** dan **Hugging Face**.
- Browser repository/file Hugging Face untuk dataset, model, dan space.
- Preview media, slideshow, thumbnail, metadata, dan playlist cloud.
- Pengumpulan foto melalui fitur **Collect Photo**.

### Developer tools

- **GitHub Editor** untuk workflow repository dari dalam aplikasi.
- Operasi repository dan file yang didukung backend dapat meliputi create, rename, move, delete, dan update.
- **QR/Barcode Generator** untuk membuat kode dari data yang dibutuhkan.
- Syntax highlighting dan Markdown rendering untuk pengalaman membaca serta mengedit konten yang lebih nyaman.

### Media dan quality of life

- Universal downloader dan torrent downloader.
- Audio player global dengan floating player serta cloud playlist.
- Dukungan metadata audio melalui `music-metadata`.
- Transisi dan micro-interactions menggunakan Framer Motion.
- Shortcut/quick actions agar fitur penting mudah dijangkau.

## Teknologi

| Area | Teknologi |
| --- | --- |
| UI | React 19, TypeScript, React Router |
| Build | Vite 8, ES Modules |
| State | Redux Toolkit, React Redux |
| Motion & UI | Framer Motion, Lucide React, React Icons, Sonner |
| Authentication & data | Firebase Authentication, Firestore |
| AI | Google Generative AI / Gemini |
| Integrations | GitHub Octokit, Telegram, Hugging Face |
| Content | React Markdown, Prism syntax highlighting |
| Deployment | Firebase Hosting |

## Arsitektur frontend ↔ backend

`banucv` adalah repository **frontend**. Fitur yang membutuhkan proses server, credential, streaming, atau integrasi eksternal dilayani oleh repository backend terpisah:

- Frontend: [`warthadev/banucv`](https://github.com/warthadev/banucv)
- Backend: [`warthadev/warthadev-backend`](https://github.com/warthadev/warthadev-backend)
- Backend stack: FastAPI + Python, dikemas dengan Docker dan dideploy ke Hugging Face Spaces.

Saat aplikasi dimulai, frontend mencoba endpoint `/health` pada backend, memilih base URL yang aktif, lalu mengambil konfigurasi Firebase dan feature flags dari `/config`.

| Backend module | Prefix | Dipakai untuk |
| --- | --- | --- |
| Telegram | `/telegram` | Session, metadata, streaming file, dan sinkronisasi Firestore |
| Hugging Face | `/hf` | Repository, file/folder, dataset, model, dan space |
| Universal downloader | `/universal` | Ekstraksi serta orkestrasi download media |
| Torrent | `/torrent` | Metadata, session, progress, dan sinkronisasi torrent |
| Proxy | `/proxy` | Streaming media, direct download, dan signed URL |
| Token API | `/token` | Validasi API key dan akses model Gemini |
| Media extractor | `/extract` | Ekstraksi video/audio dengan yt-dlp dan fallback Cobalt |

Konfigurasi CORS backend perlu mengizinkan origin frontend, misalnya `http://localhost:5173` untuk development atau `https://warthasensei.web.app` untuk production.

## Struktur proyek

```text
src/
├── css/                 # Global styles, theme, responsive layout
├── react/
│   ├── animation/       # Motion variants dan animation presets
│   ├── config/          # API, Firebase, Telegram, cloud, dan helper config
│   ├── control/         # Komponen kontrol bersama
│   ├── default/         # Home, login, dashboard, settings
│   ├── feature/         # AI, downloader, cloud, GitHub, barcode, playlist
│   ├── hook/            # Custom hooks untuk state dan integrasi
│   ├── redux/           # Store serta slices aplikasi
│   └── system/          # Auth gate, audio player, quick actions, media system
├── App.tsx              # Root router dan global UI orchestration
└── main.tsx             # Application entry point
```

## Route aplikasi

| Route | Akses | Fungsi |
| --- | --- | --- |
| `/` | Publik | Home dan pengenalan platform |
| `/login` | Publik | Login/authentication |
| `/dashboard` | Authenticated | Dashboard personal |
| `/ai-check` | Authenticated | Pemeriksaan AI/API |
| `/ai-chat` | Authenticated | Gemini AI chat |
| `/downloader` | Authenticated | Video/audio downloader |
| `/github-editor` | Authenticated | GitHub repository editor |
| `/barcode` | Authenticated | QR/barcode generator |
| `/collect-photo` | Authenticated | Collect photo workflow |
| `/cloudview` | Authenticated | Cloud file browser |
| `/setting` | Authenticated | Pengaturan user, audio, dan visual |

## Menjalankan secara lokal

### Prasyarat

- Node.js 20 atau lebih baru
- npm, pnpm, atau Yarn
- Backend Wartha Sensei yang menyediakan endpoint `/health` dan `/config`
- Project Firebase dengan Authentication dan Firestore yang telah dikonfigurasi

### Instalasi

```bash
git clone https://github.com/warthadev/banucv.git
cd banucv
npm install
```

### Environment variable

Buat file `.env` di root project. Jangan commit file ini atau memasukkan secret ke dalam bundle frontend.

```env
# URL backend utama yang menyediakan /health dan /config
VITE_API_URL=https://your-api.example.com

# Opsional: fallback backend, dipisahkan dengan koma
VITE_API_FALLBACKS=https://backup-api.example.com,https://another-api.example.com
```

Aplikasi akan melakukan health check terhadap kandidat backend, mengambil konfigurasi Firebase/feature flag dari endpoint `/config`, lalu menyimpan base URL aktif selama sesi browser.

### Development

```bash
npm run dev
```

Vite akan menampilkan URL development di terminal. Script `dev` menggunakan `--host`, sehingga dapat diakses dari perangkat lain di jaringan yang sama bila firewall mengizinkan.

### Validasi production

```bash
npm run lint
npm run build
npm run preview
```

## Deployment ke Firebase Hosting

Konfigurasi hosting tersedia di [`firebase.json`](./firebase.json). Build output diarahkan ke `dist` dan seluruh route SPA di-rewrite ke `index.html`.

```bash
npm run build
firebase deploy --only hosting
```

Pastikan Firebase CLI sudah login dan project aktif sebelum deployment. Untuk environment production, gunakan secret/configuration management di sisi backend dan jangan menaruh token layanan di repository.

## Catatan keamanan

- `.env` bersifat lokal dan tidak boleh di-commit.
- Firebase API key client bukan pengganti authorization; keamanan tetap harus ditegakkan melalui Firebase Auth rules, Firestore Security Rules, dan validasi backend.
- Token Telegram, Hugging Face, GitHub, dan Gemini harus diperlakukan sebagai credential sensitif.
- Fitur yang memproses URL atau file sebaiknya dijalankan hanya terhadap konten yang pengguna berhak akses atau unduh.
- Sebelum deployment publik, audit CORS, rate limit, logging, dan permission setiap endpoint backend.

## Kontribusi

Kontribusi yang menjaga aplikasi tetap modular dan mudah dirawat sangat terbuka. Alur yang disarankan:

1. Fork repository ini.
2. Buat branch fitur: `git checkout -b feat/nama-fitur`.
3. Jalankan `npm run lint` dan `npm run build` sebelum membuka pull request.
4. Jelaskan perubahan, trade-off, dan cara mengujinya.
5. Hindari commit secret, credential, atau data pribadi.

## Lisensi dan status

Proyek ini merupakan personal project WarthaDev dan masih aktif dikembangkan. Detail lisensi dapat ditambahkan pada tahap berikutnya sesuai keputusan pemilik repository.

---

**WarthaDev — Engineering with passion.**
