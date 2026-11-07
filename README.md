# Rekap Keuangan PT

Aplikasi web sederhana (JavaScript murni, tanpa framework dan tanpa server) untuk personal trainer:
mencatat pembayaran, paket klien, dan pengeluaran, lalu menampilkan rekap keuangannya.

## Fitur

- **Rekap bulanan**: pemasukan, pengeluaran, laba bersih, dan perbandingan dengan bulan lalu
- **Grafik** pemasukan vs pengeluaran 6 bulan terakhir
- **Piutang**: pembayaran belum lunas, dengan penanda yang lewat jatuh tempo
- **Paket hampir habis** (sisa 1-2 sesi) untuk ditawari perpanjangan
- **Klien aktif / tidak aktif** berdasarkan sisa sesi paket
- **Pemasukan per klien dan per paket**
- **Impor CSV** (dari Excel/Google Sheets) dan **ekspor/impor JSON** untuk cadangan

Data tersimpan di `localStorage` browser, jadi tidak ada data yang dikirim ke server.
Ekspor JSON secara berkala dari tab **Data** sebagai cadangan.

## Menjalankan

Buka `index.html` langsung di browser, atau:

```bash
npm start     # http://localhost:8080
npm test      # tes logika rekap (Node 18+)
```

## Memasang di GitHub Pages

1. Unggah semua file ini ke repo GitHub.
2. Buka **Settings → Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Alamat aplikasi: `https://<username>.github.io/<nama-repo>/`

Catatan: data tersimpan per browser dan per alamat. Kalau pindah perangkat, gunakan Ekspor JSON lalu Impor JSON.
Karena repo di GitHub bisa dibaca publik, **jangan unggah file ekspor data klien** ke repo.

## Format impor CSV

Baris pertama berisi nama kolom (huruf besar/kecil bebas). Pemisah koma atau titik koma.
Tanggal boleh `2026-11-05` atau `05/11/2026`. Jumlah boleh `1500000` atau `Rp 1.500.000`.

| Jenis | Kolom |
|---|---|
| Pembayaran | `tanggal, klien, paket, jumlah, status, jatuhTempo` (status: `lunas` / `belum`) |
| Paket | `klien, paket, totalSesi, sesiTerpakai` |
| Pengeluaran | `tanggal, kategori, keterangan, jumlah` |

## Struktur

```
index.html   halaman
style.css    tampilan (otomatis mengikuti mode gelap)
rekap.js     logika hitungan dan parser CSV (tanpa DOM, bisa dites)
app.js       form, tabel, grafik, penyimpanan
test/        tes unit
```

## Cara menghitung

- **Pemasukan** hanya dari pembayaran berstatus `lunas`, dihitung berdasarkan tanggal pembayaran.
- **Piutang** = pembayaran berstatus `belum`. Terlambat jika jatuh tempo sebelum hari ini.
- **Klien aktif** = punya minimal satu paket dengan sisa sesi lebih dari 0.
- **Laba bersih** = pemasukan dikurangi pengeluaran di bulan yang dipilih.
