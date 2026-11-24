# INAPROC Helper

**INAPROC Helper** adalah ekstensi Google Chrome berbasis Side Panel (**100% Gratis / Free to Use & Share**) yang dirancang untuk mempercepat dan mempermudah proses input produk di portal penyedia Katalog Elektronik INAPROC.

> **Credits & Lisensi:**  
> Ekstensi ini **100% Free** tanpa biaya berlangganan. Seluruh arsitektur dan kode ekstensi ini **100% ditulis oleh Gemini AI** berdasarkan inisiatif dan kebutuhan alur kerja pengguna INAPROC.

---

## Fitur Utama

* **Reference Grabber (`katalog.inaproc.id`)**  
  Memindai halaman detail produk referensi secara otomatis untuk mengambil nama produk, harga (Include & Exclude PPN 11%), deskripsi, spesifikasi teknis, berat, dimensi, kode KBKI, nomor permohonan merek PDKI, hingga foto produk resolusi penuh (maksimal 5 foto, otomatis melewati thumbnail video).
* **AI Auto-Fill & Spec Generator**  
  Mengisi formulir penambahan produk secara otomatis menggunakan dukungan **Google Gemini API** maupun endpoint lokal/custom **9Router** (OpenAI-compatible), termasuk dropdown React-Select, pencarian KBKI, validasi merek PDKI, serta konversi angka/harga.
* **Master Product & Multi-Variant Editor**  
  Mendeteksi produk Master maupun Non-Master, memindai tabel varian (1 maupun 2+ tipe varian), serta memungkinkan penyesuaian stok, harga, dan status aktif varian sebelum diterapkan ke halaman.
* **Auto-Upload Foto Produk**  
  Mengunduh foto dari halaman referensi dan mengunggahnya langsung ke kolom foto produk formulir INAPROC tanpa perlu menyimpan file secara manual ke komputer.
* **Quick Varian Toggle (Shortcut & Klik)**  
  Menonaktifkan seluruh varian selain varian pertama secara instan melalui tombol Side Panel maupun pintasan keyboard.

---

## Cara Instalasi (Developer Mode)

1. Unduh atau *clone* repository ini ke komputer Anda.
2. Buka Google Chrome dan akses `chrome://extensions`.
3. Aktifkan **Developer mode** di pojok kanan atas.
4. Klik **Load unpacked** dan pilih folder proyek **INAPROC Helper**.
5. Klik ikon ekstensi **INAPROC Helper** di toolbar Chrome untuk membuka Side Panel.

---

## Lisensi & Penggunaan

Bebas digunakan, dimodifikasi, dan dibagikan secara gratis (**100% Free**). Dilarang memperjualbelikan ekstensi ini dalam bentuk apa pun.
