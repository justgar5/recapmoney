const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../rekap.js');

const data = {
  pembayaran: [
    { tanggal: '2026-10-05', klien: 'Andi', paket: 'P12', jumlah: 1000000, status: 'lunas' },
    { tanggal: '2026-11-02', klien: 'Andi', paket: 'P12', jumlah: 1200000, status: 'lunas' },
    { tanggal: '2026-11-03', klien: 'Budi', paket: 'P8', jumlah: 800000, status: 'lunas' },
    { tanggal: '2026-11-04', klien: 'Dewi', paket: 'P4', jumlah: 500000, status: 'belum', jatuhTempo: '2026-11-01' },
    { tanggal: '2026-11-04', klien: 'Eko', paket: 'P4', jumlah: 300000, status: 'belum', jatuhTempo: '2026-12-01' },
  ],
  paket: [
    { klien: 'Andi', paket: 'P12', totalSesi: 12, sesiTerpakai: 10 },
    { klien: 'Budi', paket: 'P8', totalSesi: 8, sesiTerpakai: 8 },
    { klien: 'Citra', paket: 'P12', totalSesi: 12, sesiTerpakai: 3 },
    { klien: 'Dewi', paket: 'P4', totalSesi: 4, sesiTerpakai: 3 },
  ],
  pengeluaran: [
    { tanggal: '2026-11-01', kategori: 'Sewa', jumlah: 500000 },
    { tanggal: '2026-10-01', kategori: 'Sewa', jumlah: 400000 },
  ],
};

test('pemasukan, pengeluaran, dan laba bulan terpilih', () => {
  const h = R.hitungRekap(data, '2026-11', '2026-11-04');
  assert.equal(h.masuk, 2000000); // hanya yang lunas
  assert.equal(h.keluar, 500000);
  assert.equal(h.laba, 1500000);
  assert.equal(h.masukBulanLalu, 1000000);
  assert.equal(h.selisihMasukPersen, 100);
});

test('perbandingan 6 bulan berakhir di bulan terpilih', () => {
  const h = R.hitungRekap(data, '2026-11', '2026-11-04');
  assert.equal(h.perBulan.length, 6);
  assert.equal(h.perBulan[0].bulan, '2026-06');
  assert.equal(h.perBulan[5].bulan, '2026-11');
  assert.equal(h.perBulan[4].keluar, 400000);
});

test('piutang dan penanda terlambat', () => {
  const h = R.hitungRekap(data, '2026-11', '2026-11-04');
  assert.equal(h.piutangTotal, 800000);
  assert.equal(h.piutangTerlambat, 500000);
  assert.equal(h.piutangList[0].klien, 'Dewi'); // jatuh tempo paling awal di atas
  assert.equal(h.piutangList[0].terlambat, true);
  assert.equal(h.piutangList[1].terlambat, false);
});

test('klien aktif, tidak aktif, dan paket hampir habis', () => {
  const h = R.hitungRekap(data, '2026-11', '2026-11-04');
  assert.deepEqual(h.klienAktif.map((k) => k.klien), ['Andi', 'Citra', 'Dewi']);
  assert.deepEqual(h.klienTidakAktif.map((k) => k.klien), ['Budi']);
  assert.deepEqual(h.hampirHabis.map((x) => [x.klien, x.sisa]), [['Dewi', 1], ['Andi', 2]]);
});

test('pemasukan per klien dan per paket', () => {
  const h = R.hitungRekap(data, '2026-11', '2026-11-04');
  assert.deepEqual(h.perKlien, [{ nama: 'Andi', jumlah: 1200000 }, { nama: 'Budi', jumlah: 800000 }]);
  assert.equal(h.perPaket.length, 2);
});

test('data kosong tidak error', () => {
  const h = R.hitungRekap({ pembayaran: [], paket: [], pengeluaran: [] }, '2026-11', '2026-11-04');
  assert.equal(h.masuk, 0);
  assert.equal(h.selisihMasukPersen, null);
  assert.equal(h.klienAktif.length, 0);
});

test('tambahBulan melewati pergantian tahun', () => {
  assert.equal(R.tambahBulan('2026-01', -1), '2025-12');
  assert.equal(R.tambahBulan('2026-11', 2), '2027-01');
});

test('parseCSV: kutip, koma di dalam sel, dan titik koma', () => {
  assert.deepEqual(R.parseCSV('a,b\n"x, y",2\n'), [['a', 'b'], ['x, y', '2']]);
  assert.deepEqual(R.parseCSV('a;b\r\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('impor CSV pembayaran: format tanggal & rupiah Indonesia', () => {
  const csv = 'Tanggal,Klien,Paket,Jumlah,Status,Jatuh Tempo\n05/11/2026,Andi,P12,"Rp 1.500.000",Belum Lunas,10/11/2026\n2026-11-06,Budi,P8,800000,lunas,';
  const r = R.csvKeRecords('pembayaran', csv);
  assert.equal(r.length, 2);
  assert.equal(r[0].tanggal, '2026-11-05');
  assert.equal(r[0].jumlah, 1500000);
  assert.equal(r[0].status, 'belum');
  assert.equal(r[0].jatuhTempo, '2026-11-10');
  assert.equal(r[1].status, 'lunas');
});

test('angka(): berbagai format penulisan rupiah', () => {
  assert.equal(R.angka('Rp 1.500.000'), 1500000);
  assert.equal(R.angka('1.500.000,50'), 1500000.5);
  assert.equal(R.angka('1,500,000'), 1500000);
  assert.equal(R.angka('800000'), 800000);
  assert.equal(R.angka(250000), 250000);
  assert.equal(R.angka(''), 0);
  assert.equal(R.angka('abc'), 0);
});

test('impor CSV: kolom wajib hilang memberi error jelas', () => {
  assert.throws(() => R.csvKeRecords('paket', 'nama,sesi\nA,1'), /klien/);
});
