/* Tampilan & penyimpanan. Logika hitungan ada di rekap.js */
(function () {
  'use strict';

  const R = window.Rekap;
  const STORAGE_KEY = 'pt-rekap-keuangan-v1';

  const rupiah = (n) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const $ = (sel) => document.querySelector(sel);

  // ---------- Penyimpanan ----------
  let state = muat();

  function kosong() {
    return { pembayaran: [], paket: [], pengeluaran: [] };
  }
  function muat() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return kosong();
      return Object.assign(kosong(), JSON.parse(raw));
    } catch (e) {
      return kosong();
    }
  }
  function simpan() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      pesan('Gagal menyimpan ke browser (penyimpanan penuh atau dinonaktifkan).');
    }
  }
  function pesan(teks) {
    $('#pesan').textContent = teks;
  }

  // ---------- Definisi form & tabel ----------
  const ENTITAS = {
    pembayaran: {
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', req: true },
        { k: 'klien', l: 'Klien', t: 'text', req: true, list: true },
        { k: 'paket', l: 'Paket', t: 'text' },
        { k: 'jumlah', l: 'Jumlah (Rp)', t: 'number', req: true },
        { k: 'status', l: 'Status', t: 'select', opts: ['lunas', 'belum'] },
        { k: 'jatuhTempo', l: 'Jatuh tempo', t: 'date' },
      ],
      urut: (a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''),
      aksi: [{ kode: 'lunas', label: 'Lunas', tampil: (r) => r.status === 'belum', jalan: (r) => { r.status = 'lunas'; } }],
    },
    paket: {
      fields: [
        { k: 'klien', l: 'Klien', t: 'text', req: true, list: true },
        { k: 'paket', l: 'Nama paket', t: 'text' },
        { k: 'totalSesi', l: 'Total sesi', t: 'number', req: true },
        { k: 'sesiTerpakai', l: 'Sesi terpakai', t: 'number' },
      ],
      urut: (a, b) => (a.klien || '').localeCompare(b.klien || ''),
      aksi: [{ kode: 'plus', label: '+1 sesi', tampil: (r) => r.sesiTerpakai < r.totalSesi, jalan: (r) => { r.sesiTerpakai += 1; } }],
    },
    pengeluaran: {
      fields: [
        { k: 'tanggal', l: 'Tanggal', t: 'date', req: true },
        { k: 'kategori', l: 'Kategori', t: 'text', list: true },
        { k: 'keterangan', l: 'Keterangan', t: 'text' },
        { k: 'jumlah', l: 'Jumlah (Rp)', t: 'number', req: true },
      ],
      urut: (a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''),
      aksi: [],
    },
  };
  const FIELD_ANGKA = ['jumlah', 'totalSesi', 'sesiTerpakai'];

  function daftarSaran(kunci) {
    const set = new Set();
    Object.keys(ENTITAS).forEach((n) => state[n].forEach((r) => { if (r[kunci]) set.add(r[kunci]); }));
    return Array.from(set).sort();
  }

  function buatForm(nama) {
    const cfg = ENTITAS[nama];
    const form = $('#form-' + nama);
    const html = cfg.fields.map((f) => {
      const id = nama + '-' + f.k;
      let input;
      if (f.t === 'select') {
        input = '<select id="' + id + '" name="' + f.k + '">' + f.opts.map((o) => '<option>' + o + '</option>').join('') + '</select>';
      } else {
        input =
          '<input id="' + id + '" name="' + f.k + '" type="' + f.t + '"' +
          (f.t === 'number' ? ' min="0" step="1" inputmode="numeric"' : '') +
          (f.req ? ' required' : '') +
          (f.list ? ' list="saran-' + f.k + '"' : '') +
          ' autocomplete="off">';
      }
      return '<label>' + esc(f.l) + input + '</label>';
    }).join('');
    form.innerHTML = html + '<button type="submit" class="primary">Tambah</button>';
    if (form.querySelector('[name="tanggal"]')) form.querySelector('[name="tanggal"]').value = R.hariIni();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const rec = { id: uid() };
      cfg.fields.forEach((f) => {
        const v = form.elements[f.k].value.trim();
        rec[f.k] = FIELD_ANGKA.indexOf(f.k) >= 0 ? R.angka(v) : v;
      });
      if (nama === 'paket' && rec.sesiTerpakai > rec.totalSesi) {
        pesan('Sesi terpakai tidak boleh lebih besar dari total sesi.');
        return;
      }
      state[nama].push(rec);
      simpan();
      form.reset();
      if (form.elements.tanggal) form.elements.tanggal.value = R.hariIni();
      renderSemua();
    });
  }

  function selSel(f, r) {
    const v = r[f.k];
    if (f.k === 'jumlah') return '<td class="num">' + rupiah(v) + '</td>';
    if (f.k === 'totalSesi' || f.k === 'sesiTerpakai') return '<td class="num">' + esc(v) + '</td>';
    if (f.k === 'status') return '<td><span class="badge ' + esc(v) + '">' + esc(v) + '</span></td>';
    return '<td>' + esc(v) + '</td>';
  }

  function renderTabel(nama) {
    const cfg = ENTITAS[nama];
    const rows = state[nama].slice().sort(cfg.urut);
    const box = $('#table-' + nama);
    if (!rows.length) {
      box.innerHTML = '<p class="empty">Belum ada data.</p>';
      return;
    }
    const head = cfg.fields
      .map((f) => '<th' + (FIELD_ANGKA.indexOf(f.k) >= 0 ? ' class="num"' : '') + '>' + esc(f.l) + '</th>')
      .join('') + '<th></th>';
    const body = rows.map((r) => {
      const tombol = cfg.aksi
        .filter((a) => a.tampil(r))
        .map((a) => '<button type="button" data-aksi="' + a.kode + '" data-id="' + esc(r.id) + '">' + a.label + '</button>')
        .join('');
      return '<tr>' + cfg.fields.map((f) => selSel(f, r)).join('') +
        '<td class="act">' + tombol + '<button type="button" class="danger" data-aksi="hapus" data-id="' + esc(r.id) + '">Hapus</button></td></tr>';
    }).join('');
    box.innerHTML = '<div class="tablewrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function pasangAksiTabel(nama) {
    $('#table-' + nama).addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-aksi]');
      if (!btn) return;
      const rec = state[nama].find((r) => r.id === btn.dataset.id);
      if (!rec) return;
      if (btn.dataset.aksi === 'hapus') {
        if (!confirm('Hapus data ini?')) return;
        state[nama] = state[nama].filter((r) => r.id !== rec.id);
      } else {
        const a = ENTITAS[nama].aksi.find((x) => x.kode === btn.dataset.aksi);
        if (a) a.jalan(rec);
      }
      simpan();
      renderSemua();
    });
  }

  // ---------- Rekap ----------
  function tabelSederhana(kolom, rows, kosongTeks) {
    if (!rows.length) return '<p class="empty">' + esc(kosongTeks) + '</p>';
    const head = kolom.map((k) => '<th' + (k.num ? ' class="num"' : '') + '>' + esc(k.l) + '</th>').join('');
    const body = rows.map((r) => '<tr>' + kolom.map((k) => '<td' + (k.num ? ' class="num"' : '') + '>' + k.v(r) + '</td>').join('') + '</tr>').join('');
    return '<div class="tablewrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function grafik(perBulan) {
    const W = 640, H = 240, padX = 10, padTop = 12, padBot = 28;
    const ih = H - padTop - padBot;
    const maks = Math.max(1, ...perBulan.map((b) => Math.max(b.masuk, b.keluar)));
    const gw = (W - padX * 2) / perBulan.length;
    const bw = Math.min(26, gw / 3);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik pemasukan dan pengeluaran 6 bulan terakhir">';
    [0, 0.5, 1].forEach((p) => {
      const y = padTop + ih - ih * p;
      svg += '<line class="grid" x1="' + padX + '" x2="' + (W - padX) + '" y1="' + y + '" y2="' + y + '"/>';
    });
    perBulan.forEach((b, i) => {
      const cx = padX + gw * i + gw / 2;
      const hm = (b.masuk / maks) * ih;
      const hk = (b.keluar / maks) * ih;
      svg += '<rect class="bar-masuk" x="' + (cx - bw - 2) + '" y="' + (padTop + ih - hm) + '" width="' + bw + '" height="' + hm + '" rx="3"><title>' + R.labelBulan(b.bulan) + ' pemasukan: ' + rupiah(b.masuk) + '</title></rect>';
      svg += '<rect class="bar-keluar" x="' + (cx + 2) + '" y="' + (padTop + ih - hk) + '" width="' + bw + '" height="' + hk + '" rx="3"><title>' + R.labelBulan(b.bulan) + ' pengeluaran: ' + rupiah(b.keluar) + '</title></rect>';
      svg += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + R.labelBulan(b.bulan) + '</text>';
    });
    svg += '</svg>';
    svg += '<div class="legend"><span><span class="dot" style="background:var(--masuk)"></span>Pemasukan</span><span><span class="dot" style="background:var(--keluar)"></span>Pengeluaran</span><span>Maks: ' + rupiah(maks) + '</span></div>';
    return svg;
  }

  function renderRekap() {
    const bulan = $('#bulan').value || R.hariIni().slice(0, 7);
    const h = R.hitungRekap(state, bulan, R.hariIni());

    let delta = '<div class="sub">Belum ada pembanding bulan lalu</div>';
    if (h.selisihMasukPersen !== null) {
      const naik = h.selisihMasukPersen >= 0;
      delta = '<div class="sub ' + (naik ? 'pos' : 'neg') + '">' + (naik ? '▲ ' : '▼ ') + Math.abs(h.selisihMasukPersen).toFixed(1) + '% dari bulan lalu (' + rupiah(h.masukBulanLalu) + ')</div>';
    }
    $('#cards').innerHTML =
      '<div class="card"><div class="lbl">Pemasukan</div><div class="val pos">' + rupiah(h.masuk) + '</div>' + delta + '</div>' +
      '<div class="card"><div class="lbl">Pengeluaran</div><div class="val neg">' + rupiah(h.keluar) + '</div></div>' +
      '<div class="card"><div class="lbl">Laba bersih</div><div class="val ' + (h.laba >= 0 ? 'pos' : 'neg') + '">' + rupiah(h.laba) + '</div></div>' +
      '<div class="card"><div class="lbl">Piutang</div><div class="val">' + rupiah(h.piutangTotal) + '</div><div class="sub">' + (h.piutangTerlambat ? rupiah(h.piutangTerlambat) + ' sudah lewat jatuh tempo' : 'Tidak ada yang terlambat') + '</div></div>' +
      '<div class="card"><div class="lbl">Klien aktif</div><div class="val">' + h.klienAktif.length + '</div><div class="sub">' + h.klienTidakAktif.length + ' tidak aktif (paket habis)</div></div>';

    $('#chart').innerHTML = grafik(h.perBulan);

    $('#piutang').innerHTML = tabelSederhana(
      [
        { l: 'Klien', v: (r) => esc(r.klien) },
        { l: 'Paket', v: (r) => esc(r.paket) },
        { l: 'Jatuh tempo', v: (r) => (r.jatuhTempo ? esc(r.jatuhTempo) : '-') },
        { l: 'Status', v: (r) => (r.terlambat ? '<span class="badge telat">terlambat</span>' : '<span class="badge belum">belum lunas</span>') },
        { l: 'Jumlah', num: true, v: (r) => rupiah(r.jumlah) },
      ],
      h.piutangList,
      'Tidak ada piutang.'
    );

    $('#hampirHabis').innerHTML = tabelSederhana(
      [
        { l: 'Klien', v: (r) => esc(r.klien) },
        { l: 'Paket', v: (r) => esc(r.paket) },
        { l: 'Sisa sesi', num: true, v: (r) => r.sisa },
      ],
      h.hampirHabis,
      'Tidak ada paket yang hampir habis.'
    );

    const aktif = h.klienAktif.map((k) => esc(k.klien) + ' (' + k.sisa + ' sesi)').join(', ') || '-';
    const tidak = h.klienTidakAktif.map((k) => esc(k.klien)).join(', ') || '-';
    $('#klien').innerHTML =
      '<p><b>Aktif (' + h.klienAktif.length + '):</b> ' + aktif + '</p>' +
      '<p><b>Tidak aktif (' + h.klienTidakAktif.length + '):</b> ' + tidak + '</p>';

    const kolomNama = (judul) => [
      { l: judul, v: (r) => esc(r.nama) },
      { l: 'Pemasukan', num: true, v: (r) => rupiah(r.jumlah) },
    ];
    $('#perKlien').innerHTML = tabelSederhana(kolomNama('Klien'), h.perKlien, 'Belum ada pemasukan di bulan ini.');
    $('#perPaket').innerHTML = tabelSederhana(kolomNama('Paket'), h.perPaket, 'Belum ada pemasukan di bulan ini.');
  }

  function renderSaran() {
    ['klien', 'paket', 'kategori'].forEach((k) => {
      let dl = document.getElementById('saran-' + k);
      if (!dl) {
        dl = document.createElement('datalist');
        dl.id = 'saran-' + k;
        document.body.appendChild(dl);
      }
      dl.innerHTML = daftarSaran(k).map((v) => '<option value="' + esc(v) + '">').join('');
    });
  }

  function renderSemua() {
    renderSaran();
    Object.keys(ENTITAS).forEach(renderTabel);
    renderRekap();
  }

  // ---------- Data: ekspor / impor ----------
  function unduh(nama, isi, tipe) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([isi], { type: tipe }));
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function bacaFile(file) {
    return new Promise((ok, gagal) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = () => gagal(fr.error);
      fr.readAsText(file);
    });
  }

  function pasangData() {
    $('#btn-ekspor').addEventListener('click', () => {
      unduh('rekap-keuangan-' + R.hariIni() + '.json', JSON.stringify(state, null, 2), 'application/json');
      pesan('Cadangan diunduh.');
    });

    $('#file-json').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await bacaFile(file));
        const baru = kosong();
        Object.keys(baru).forEach((k) => {
          if (Array.isArray(data[k])) baru[k] = data[k].map((r) => Object.assign({ id: uid() }, r));
        });
        if (!confirm('Semua data saat ini akan diganti dengan isi file. Lanjutkan?')) return;
        state = baru;
        simpan();
        renderSemua();
        pesan('Data berhasil dipulihkan.');
      } catch (err) {
        pesan('File JSON tidak valid: ' + err.message);
      }
    });

    $('#file-csv').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const jenis = $('#csv-jenis').value;
      try {
        const rows = R.csvKeRecords(jenis, await bacaFile(file));
        rows.forEach((r) => state[jenis].push(Object.assign({ id: uid() }, r)));
        simpan();
        renderSemua();
        pesan(rows.length + ' baris ' + jenis + ' berhasil diimpor.');
      } catch (err) {
        pesan('Gagal impor CSV: ' + err.message);
      }
    });

    $('#btn-hapus').addEventListener('click', () => {
      if (!confirm('Hapus SEMUA data? Tindakan ini tidak bisa dibatalkan. Pastikan sudah ekspor cadangan.')) return;
      state = kosong();
      simpan();
      renderSemua();
      pesan('Semua data dihapus.');
    });

    $('#btn-contoh').addEventListener('click', () => {
      if (state.pembayaran.length + state.paket.length + state.pengeluaran.length &&
          !confirm('Data contoh akan ditambahkan ke data yang ada. Lanjutkan?')) return;
      const bulanIni = R.hariIni().slice(0, 7);
      const tgl = (n, d) => R.tambahBulan(bulanIni, n) + '-' + String(d).padStart(2, '0');
      const p = (tanggal, klien, paket, jumlah, status, jt) => ({ id: uid(), tanggal, klien, paket, jumlah, status, jatuhTempo: jt || '' });
      state.pembayaran.push(
        p(tgl(-2, 5), 'Andi', 'Paket 12 sesi', 1800000, 'lunas'),
        p(tgl(-1, 3), 'Budi', 'Paket 8 sesi', 1300000, 'lunas'),
        p(tgl(-1, 20), 'Citra', 'Paket 12 sesi', 1800000, 'lunas'),
        p(tgl(0, 2), 'Andi', 'Paket 12 sesi', 1800000, 'lunas'),
        p(tgl(0, 4), 'Dewi', 'Paket 4 sesi', 700000, 'belum', tgl(0, 1)),
        p(tgl(0, 6), 'Budi', 'Paket 8 sesi', 1300000, 'belum', tgl(1, 10))
      );
      state.paket.push(
        { id: uid(), klien: 'Andi', paket: 'Paket 12 sesi', totalSesi: 12, sesiTerpakai: 10 },
        { id: uid(), klien: 'Budi', paket: 'Paket 8 sesi', totalSesi: 8, sesiTerpakai: 8 },
        { id: uid(), klien: 'Citra', paket: 'Paket 12 sesi', totalSesi: 12, sesiTerpakai: 4 },
        { id: uid(), klien: 'Dewi', paket: 'Paket 4 sesi', totalSesi: 4, sesiTerpakai: 3 }
      );
      state.pengeluaran.push(
        { id: uid(), tanggal: tgl(-1, 1), kategori: 'Sewa tempat', keterangan: 'Sewa gym bulanan', jumlah: 500000 },
        { id: uid(), tanggal: tgl(0, 1), kategori: 'Sewa tempat', keterangan: 'Sewa gym bulanan', jumlah: 500000 },
        { id: uid(), tanggal: tgl(0, 3), kategori: 'Transport', keterangan: 'Bensin', jumlah: 150000 }
      );
      simpan();
      renderSemua();
      pesan('Data contoh ditambahkan.');
    });
  }

  // ---------- Navigasi ----------
  function pasangNavigasi() {
    $('#nav').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== 'tab-' + btn.dataset.tab; });
    });
  }

  // ---------- Mulai ----------
  $('#bulan').value = R.hariIni().slice(0, 7);
  $('#bulan').addEventListener('change', renderRekap);
  Object.keys(ENTITAS).forEach((n) => { buatForm(n); pasangAksiTabel(n); });
  pasangNavigasi();
  pasangData();
  renderSemua();
})();
