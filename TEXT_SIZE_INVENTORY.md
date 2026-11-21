# BanuCV — Audit Responsivitas & Inventaris Ukuran Teks

UI ditinjau lintas route untuk desktop, tablet, dan mobile berdasarkan struktur React/TypeScript, stylesheet, breakpoint, serta alur overlay. Ukuran teks tidak diubah; file ini mencatat seluruh nilai `font-size` CSS per stylesheet yang relevan (termasuk override media query) dan ukuran literal `fontSize` inline yang ditemukan.

## Perbaikan responsif dan desain global

- Menyatukan fondasi CSS menjadi `global-root.css`, `global-style.css`, `global-color.css`, dan `global-ui.css`; halaman memakai root `.global-page`, dan kelas bersama tersedia untuk wrapper, section, card, modal, popover, controls, serta variasi glass. Token warna, radius, spacing, shadow, overlay, dan blur memakai prefiks `--global-*`.
- Menambahkan kelas global ke root route, card, section, modal, dan popover; padding card serta spacing section memakai modifier bersama. Glass Dashboard kini menggunakan token surface/border/shadow/blur global, dengan transparansi dan blur tetap dipertahankan.
- Memperbaiki risiko clipping yang teridentifikasi: Login dan Barcode kini dapat scroll vertikal pada layar pendek; panel detail Cloud Manager menyesuaikan lebar pane tablet; action bar GitHub Editor dapat membungkus tombol pada mobile. Modal/popup global diberi batas tinggi berbasis `dvh` dan overflow internal.
- Pemeriksaan TypeScript dan lint dilakukan ulang setelah pembaruan.

## Cara membaca inventaris

Nilai di bawah adalah ukuran yang dideklarasikan, bukan klaim bahwa semua nilai tampil bersamaan. Selector tertentu hanya aktif pada state/modal atau breakpoint tertentu. Ukuran `inherit` mewarisi ukuran induk. CSS global menetapkan font family Inter dan tidak menetapkan font-size, jadi ukuran browser/inherited tetap mungkin muncul bila tidak ada deklarasi route.

### UI bersama (ketika komponennya tampil)

- `nav.css` — `1.5rem`, `0.85rem`, `1.3rem`, `10px`
- `quick.css` — `10px`, `13px`, `12px`, `9px`, `11px`, `8px`
- `playerfloatmusic.css` — `14px`, `8px`
- `mediarender.css` — `13px`, `10px`, `12px`, `18px`, `11px`, `14px`, `16px`, `15px`

Navbar dan Quick tampil pada route selain Login (Dashboard hanya setelah status kunjungan mengizinkan UI global). Floating music/media controls hanya tampil pada sebagian route atau saat media aktif. Nilai mereka tetap dipisahkan di atas agar dapat ditambahkan saat meninjau computed UI.

## Inventaris tiap halaman

### `/` — Beranda
- `home.css` — `clamp(2.5rem, 8vw, 4rem)`, `1.1rem`, `1.8rem`, `1.2rem`, `0.9rem`, `0.8rem`, `1.3rem`, `0.75rem`, `0.7rem`, `1rem`
- Ukuran `fontSize` inline literal pada komponen route utama: tidak ditemukan.

### `/dashboard` — Dashboard
- `dash.css` — `32px`, `16px`, `11px`, `28px`, `15px`, `22px`, `14px`, `13.5px`, `13px`, `12px`, `24px`, `20px`
- `dashvisitshow.css` — `56px`, `1.5rem`, `0.9rem`, `0.8rem`, `1.3rem`, `44px`, `0.85rem`, `0.75rem`, `30px`, `1.1rem`, `0.78rem`, `36px`
- Ukuran `fontSize` inline literal pada komponen route utama: tidak ditemukan.

### `/login` — Login
- `login.css` — `1.8rem`, `0.95rem`
- Ukuran `fontSize` inline literal pada komponen route utama: tidak ditemukan.

### `/ai-check` — AI Checking
- `home.css` — `clamp(2.5rem, 8vw, 4rem)`, `1.1rem`, `1.8rem`, `1.2rem`, `0.9rem`, `0.8rem`, `1.3rem`, `0.75rem`, `0.7rem`, `1rem`
- `apiaichecking.css` — `14px`, `10px`, `12px`, `13px`
- Ukuran `fontSize` inline literal pada komponen route utama: tidak ditemukan.

### `/ai-agent` — AI Agent
- `aiagent.css` — `1.55rem`, `0.9rem`, `0.72rem`, `0.7rem`, `0.68rem`, `0.925rem`, `0.82em`, `0.85em`, `11px`, `0.85rem`, `0.75rem`, `0.78rem`, `0.95rem`, `0.96rem`, `0.73rem`, `0.76rem`, `0.69rem`, `0.875rem`, `1.25rem`, `0.6rem`, `13px`, `12px`
- Inline `feature/aiagent.tsx` — `12`
- Inline `feature/routerauthmodal.tsx` — `1.5rem`, `0.85rem`

### `/downloader` — Downloader
- `downloader.css` — `14px`, `12px`, `11px`
- `cloudview.css` — `13px`, `11px`, `12px`, `10px`, `1.15rem`, `14px`, `inherit`, `56px`, `17px`, `1.5rem`, `0.85rem`, `18px`, `16px`, `1.3rem`, `0.8rem`, `1.1rem`, `0.75rem`, `1rem`, `0.7rem`, `0.9rem`, `20px`, `48px`, `1.2rem`, `14px !important`, `0.95rem`
- Ukuran `fontSize` inline literal pada komponen route utama: tidak ditemukan.

### `/setting` — Settings
- `setting.css` — `1.2rem`, `0.75rem`, `1rem`, `0.85rem`, `14px`, `12px`, `1.1rem`, `13px`, `11px`, `10px`, `0.8rem`, `0.65rem`, `0.9rem`, `0.7rem`, `var(--settings-font-large)`, `var(--settings-font-medium)`, `var(--settings-font-small)`
- Inline `default/settingaudio.tsx` — `14px`

### `/github-editor` — GitHub Editor
- `githubeditor.css` — `1rem`, `10px`, `14px`, `13px`, `1.2rem`, `13.5px`, `32px`, `0.75rem`, `12px`, `11px`, `10px !important`, `1.1rem`, `10.5px`, `0.7rem`, `0.95rem`, `11.5px`, `0.65rem`, `15px`, `1.15rem`, `14.5px`, `12.5px`
- Inline `feature/githubeditormodal.tsx` — `1.5rem`, `0.85rem`

### `/barcode` — Barcode
- `barcode.css` — `1.5rem`, `0.8rem`, `0.9rem`, `1.2rem`, `0.7rem`, `0.85rem`, `0.6rem`
- Ukuran `fontSize` inline literal pada komponen route utama: tidak ditemukan.

### `/loading` — Loading
- `loading.css` — `1rem`
- Ukuran `fontSize` inline literal pada komponen route utama: tidak ditemukan.

### `/collect-photo` — Collect Photo
- `collectphoto.css` — `2.5rem`, `0.95rem`, `0.9rem`, `0.85rem`, `1.15rem`, `0.8rem`, `0.7rem`, `1.1rem`, `1.4rem`, `1.8rem`, `1.2rem`, `0.6rem`
- Ukuran `fontSize` inline literal pada komponen route utama: tidak ditemukan.

### `/cloudview` — Cloud Manager
- `cloudview.css` — `13px`, `11px`, `12px`, `10px`, `1.15rem`, `14px`, `inherit`, `56px`, `17px`, `1.5rem`, `0.85rem`, `18px`, `16px`, `1.3rem`, `0.8rem`, `1.1rem`, `0.75rem`, `1rem`, `0.7rem`, `0.9rem`, `20px`, `48px`, `1.2rem`, `14px !important`, `0.95rem`
- Inline `feature/cloudroot.tsx` — `16px`
- Inline `feature/cloudview.tsx` — `0.85rem`, `1rem`
- Inline `feature/cloudviewuipack.tsx` — `12px`
- Inline `feature/cloudviewuipanel.tsx` — `18px`, `12px`
- Inline `feature/cloudviewuimodal.tsx` — `12`
- Inline `feature/cloudviewuisidebar.tsx` — `16px`, `17px`
- Inline `feature/cloudmodalhf.tsx` — `13px`
- Inline `feature/cloudmodalhfsrch.tsx` — `14px`, `11px`, `13px`

## Catatan audit lintas halaman

Pemeriksaan route mencakup Beranda, Dashboard, Login, AI Checking, AI Agent, Downloader, Settings, GitHub Editor, Barcode, Loading, Collect Photo, dan Cloud Manager. Beberapa komponen masih memakai breakpoint khusus route; perubahan breakpoint global menyeluruh berisiko mengubah state/layout yang berbeda, sehingga audit menandai area transisi untuk validasi visual, bukan mengganti semua threshold secara membabi buta.

Risiko source yang tetap perlu diuji dengan data nyata meliputi identifier panjang (nama model/email/session ID/breadcrumb), grid dengan minimum track tetap pada viewport sangat sempit, dan panel fixed pada orientasi landscape. Audit ini source-based; route authenticated dan state data runtime tidak diuji dengan sesi produksi.

Inventaris tidak mengubah tipografi. Setelah meninjau daftar ini, ukuran teks dapat disetujui atau diminta revisi pada tahap terpisah.
