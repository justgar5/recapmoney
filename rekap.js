/* Logika murni rekap keuangan (tanpa DOM) — bisa dites dengan Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Rekap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  // Mengubah "1500000", "Rp 1.500.000", "1.500.000,50", "1,500,000" menjadi angka.
  const angka = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.500.000,50
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); // 1,500,000.50
    else s = s.replace(',', '.'); // 1500,5
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };
  const jumlahkan = (arr) => arr.reduce((s, x) => s + angka(x.jumlah), 0);

  function hariIni() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function bulanKey(tanggal) {
    return String(tanggal || '').slice(0, 7);
  }

  function tambahBulan(key, n) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function labelBulan(key) {
    const [y, m] = key.split('-').map(Number);
    return NAMA_BULAN[m - 1] + ' ' + String(y).slice(2);
  }

  function urutkanDesc(peta) {
    return Object.keys(peta)
      .map((k) => ({ nama: k, jumlah: peta[k] }))
      .sort((a, b) => b.jumlah - a.jumlah);
  }

  /**
   * data: { pembayaran: [], paket: [], pengeluaran: [] }
   * bulan: 'YYYY-MM', today: 'YYYY-MM-DD'
   */
  function hitungRekap(data, bulan, today) {
    const pembayaran = data.pembayaran || [];
    const paket = data.paket || [];
    const pengeluaran = data.pengeluaran || [];
    const lunas = pembayaran.filter((p) => p.status === 'lunas');

    const masukDi = (key) => jumlahkan(lunas.filter((p) => bulanKey(p.tanggal) === key));
    const keluarDi = (key) => jumlahkan(pengeluaran.filter((p) => bulanKey(p.tanggal) === key));

    const masuk = masukDi(bulan);
    const keluar = keluarDi(bulan);
    const bulanLalu = tambahBulan(bulan, -1);
    const masukLalu = masukDi(bulanLalu);

    const perBulan = [];
    for (let i = -5; i <= 0; i++) {
      const k = tambahBulan(bulan, i);
      perBulan.push({ bulan: k, masuk: masukDi(k), keluar: keluarDi(k) });
    }

    const piutangList = pembayaran
      .filter((p) => p.status === 'belum')
      .map((p) => Object.assign({}, p, { terlambat: !!p.jatuhTempo && p.jatuhTempo < today }))
      .sort((a, b) => (a.jatuhTempo || '9999').localeCompare(b.jatuhTempo || '9999'));
    const piutangTotal = jumlahkan(piutangList);
    const piutangTerlambat = jumlahkan(piutangList.filter((p) => p.terlambat));

    // Klien aktif = punya paket dengan sisa sesi > 0.
    const petaKlien = {};
    const hampirHabis = [];
    paket.forEach((pk) => {
      const sisa = Math.max(0, angka(pk.totalSesi) - angka(pk.sesiTerpakai));
      const nama = pk.klien;
      if (!petaKlien[nama]) petaKlien[nama] = { klien: nama, sisa: 0 };
      petaKlien[nama].sisa += sisa;
      if (sisa >= 1 && sisa <= 2) hampirHabis.push({ klien: nama, paket: pk.paket, sisa: sisa });
    });
    const semuaKlien = Object.values(petaKlien).sort((a, b) => a.klien.localeCompare(b.klien));
    const klienAktif = semuaKlien.filter((k) => k.sisa > 0);
    const klienTidakAktif = semuaKlien.filter((k) => k.sisa === 0);
    hampirHabis.sort((a, b) => a.sisa - b.sisa || a.klien.localeCompare(b.klien));

    const petaKlienMasuk = {};
    const petaPaketMasuk = {};
    lunas
      .filter((p) => bulanKey(p.tanggal) === bulan)
      .forEach((p) => {
        const kl = p.klien || '(tanpa nama)';
        const pk = p.paket || '(tanpa paket)';
        petaKlienMasuk[kl] = (petaKlienMasuk[kl] || 0) + angka(p.jumlah);
        petaPaketMasuk[pk] = (petaPaketMasuk[pk] || 0) + angka(p.jumlah);
      });

    return {
      masuk,
      keluar,
      laba: masuk - keluar,
      masukBulanLalu: masukLalu,
      selisihMasukPersen: masukLalu > 0 ? ((masuk - masukLalu) / masukLalu) * 100 : null,
      perBulan,
      piutangList,
      piutangTotal,
      piutangTerlambat,
      klienAktif,
      klienTidakAktif,
      hampirHabis,
      perKlien: urutkanDesc(petaKlienMasuk),
      perPaket: urutkanDesc(petaPaketMasuk),
    };
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let q = false;
    const tutupBaris = () => {
      row.push(cur);
      cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
        } else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',' || c === ';') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        tutupBaris();
      } else cur += c;
    }
    tutupBaris();
    return rows;
  }

  function normalTanggal(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY
    if (m) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    return '';
  }

  const SKEMA_CSV = {
    pembayaran: ['tanggal', 'klien', 'paket', 'jumlah', 'status', 'jatuhTempo'],
    paket: ['klien', 'paket', 'totalSesi', 'sesiTerpakai'],
    pengeluaran: ['tanggal', 'kategori', 'keterangan', 'jumlah'],
  };

  function csvKeRecords(jenis, text) {
    const kolom = SKEMA_CSV[jenis];
    if (!kolom) throw new Error('Jenis data tidak dikenal: ' + jenis);
    const rows = parseCSV(text.replace(/^﻿/, ''));
    if (rows.length < 2) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_]/g, ''));
    const idx = {};
    kolom.forEach((k) => { idx[k] = header.indexOf(k.toLowerCase()); });
    const wajib = jenis === 'paket' ? ['klien', 'totalSesi'] : ['tanggal', 'jumlah'];
    wajib.forEach((k) => {
      if (idx[k] === -1) throw new Error('Kolom "' + k + '" tidak ditemukan di baris pertama CSV.');
    });
    const ambil = (r, k) => (idx[k] >= 0 && r[idx[k]] != null ? r[idx[k]].trim() : '');

    return rows.slice(1).map((r) => {
      const o = {};
      kolom.forEach((k) => {
        const v = ambil(r, k);
        if (k === 'tanggal' || k === 'jatuhTempo') o[k] = normalTanggal(v);
        else if (k === 'jumlah' || k === 'totalSesi' || k === 'sesiTerpakai') o[k] = angka(v);
        else if (k === 'status') o[k] = v.toLowerCase().startsWith('belum') ? 'belum' : 'lunas';
        else o[k] = v;
      });
      return o;
    }).filter((o) => (jenis === 'paket' ? o.klien : o.tanggal && o.jumlah));
  }

  return { hitungRekap, parseCSV, csvKeRecords, normalTanggal, bulanKey, tambahBulan, labelBulan, hariIni, angka, SKEMA_CSV };
});
