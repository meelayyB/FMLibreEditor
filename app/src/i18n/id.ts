// The Indonesian text of the UI: the same shape as `en.ts` (a missing or extra key fails the build), worded the way the
// Bahasa Indonesia edition of Football Manager words things, and speaking to the user as it does ("kamu"). The comments
// in `en.ts` say what each string is for.
//
// The tactical roles (`scouting.roles`) stay in English, as Indonesian football writing keeps them ("inverted
// fullback", "sweeper-keeper", "box-to-box"); the plain positions and lines are Indonesian (kiper, bek tengah,
// gelandang).
//
// Indonesian has no plural after a number ("3 perubahan", "1 pemain"), so the counts need no forms of their own.

import type { Entity, GraphicsCounts, MassPreview } from "../types";
import type { ErrorTexts, Strings } from "./en";
import { fieldName } from "./fieldNames";

const numbers = new Intl.NumberFormat("id-ID");
const percents = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** A count or an amount with the thousands separators of the language: "12.345". */
const format = (value: number) => numbers.format(value);

/** "Tidak ada perubahan", "3 perubahan". */
const changeCount = (count: number) => (count === 0 ? "Tidak ada perubahan" : `${format(count)} perubahan`);

/** "1 pemain", "12 pemain". */
const playerCount = (count: number) => `${format(count)} pemain`;

/** "12 nilai dibiarkan". */
const valuesLeftAlone = (count: number) => `${format(count)} nilai dibiarkan`;

/** What each list holds. */
const nouns: Record<Entity, string> = { player: "pemain", staff: "staf", club: "klub" };

/** "237 pemain", "1 staf", "12 klub". */
const entityCount = (entity: Entity, count: number) => `${format(count)} ${nouns[entity]}`;

const SQUAD_STATUSES: Partial<Record<number, string>> = {
  1: "Pemain bintang",
  2: "Pemain penting",
  3: "Pemain reguler",
  4: "Pemain skuad",
  5: "Pemain cadangan utama",
  7: "Pemain pelapis",
  9: "Cadangan darurat",
  10: "Prospek terobosan",
  11: "Prospek masa depan",
  13: "Pemain muda",
  14: "Pemain reguler tim B",
  15: "Kiper utama",
  16: "Kiper piala",
  17: "Kiper piala domestik",
  20: "Cadangan",
  21: "Cadangan darurat (kiper)",
  22: "Tidak lagi dibutuhkan",
};

const CONTRACT_TYPES: Partial<Record<number, string>> = {
  0: "Kontrak paruh waktu",
  1: "Kontrak penuh waktu",
  2: "Kontrak amatir",
  3: "Kontrak junior",
  4: "Tanpa kontrak",
  10: "Kontrak gaji minimum senior",
  11: "Kontrak senior",
};

const field = (key: string | undefined) => fieldName(id, key ?? "");

/** The noun of the kind of record a failure names, or "data" when it names none. */
const recordNoun = (entity: string | undefined) =>
  entity === "player" || entity === "staff" || entity === "club" ? nouns[entity] : "data";

/** The reasons the Rust side gives for a field that cannot be changed some way. */
const UNSUPPORTED: Partial<Record<string, string>> = {
  "a date can only be set": "tanggal hanya bisa diatur langsung",
  "it is changed one person at a time": "kolom ini diubah satu per satu orang",
  "the new value is not one of the game's own records of that kind":
    "nilai baru bukan salah satu data milik game untuk jenis itu",
  "the in-game date is not known": "tanggal dalam game tidak diketahui",
};

/** What a failure asks the user to do when the game's data moved under it. */
const reload = "baca ulang data lalu coba lagi";

/** The departments of a club's staff, as `staff.noRoom` names them. */
const STAFF_DEPARTMENTS: Partial<Record<string, string>> = {
  medical: "medis",
  coaching: "kepelatihan",
  scouting: "pemanduan bakat",
};

/** What a check is about, from the key a failure gives, with a capital. */
const checkName = (key: string | undefined) => {
  const name = (id.checks as Partial<Record<string, string>>)[key ?? ""] ?? key ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** The name of a job code a failure gives, as `jobs` below has it. */
const jobName = (code: string | undefined) => (id.jobs as Partial<Record<number, string>>)[Number(code)] ?? code;

const errors: ErrorTexts = {
  "edit.unknownField": (p) => `Tidak ada kolom “${p.field}” yang bisa diedit di sini.`,
  "edit.outOfRange": (p) => `${p.value} bukan nilai ${field(p.field)} yang valid: harus dari ${p.min} sampai ${p.max}.`,
  "edit.notADate": (p) => `${p.value} bukan tanggal yang valid untuk ${field(p.field)}.`,
  "edit.notAChoice": (p) => `${p.value} bukan salah satu nilai yang bisa dipakai ${field(p.field)}.`,
  "edit.taken": (p) => `Nomor punggung ${p.value} sudah dipakai oleh ${p.name ?? `pemain dengan UID ${p.uid}`}.`,
  "edit.unsupported": (p) => `${field(p.field)} tidak bisa diubah dengan cara itu: ${UNSUPPORTED[p.reason] ?? p.reason}.`,
  "edit.moved": (p) => `${recordNoun(p.entity)} ini sudah berpindah tempat di memori game; ${reload}.`,
  "edit.noRecord": (p) => `${field(p.field)} tidak bisa diubah di sini: datanya tidak ada atau tidak lolos pemeriksaan.`,
  "edit.unset": (p) => `${field(p.field)} belum diatur di game, jadi dibiarkan.`,
  "edit.implausible": (p) =>
    `${field(p.field)} terbaca ${p.value}, nilai yang tidak mungkin dimilikinya; demi keamanan nilainya dibiarkan.`,
  "edit.notApplied": (p) => `${field(p.field)}: ditulis ${p.wrote} tetapi terbaca kembali ${p.read}.`,
  "edit.conflict": (p) => `${field(p.field)} sekarang ${p.found}, bukan ${p.expected}: game sudah mengubahnya sejak itu.`,
  "move.moved": () => `Pemain sudah berpindah tempat di memori game; ${reload}.`,
  "move.notAClub": () => "Klub ini tidak punya tim senior yang bisa dimasuki pemain.",
  "move.freeAgent": () => "Pemain ini agen bebas: tidak punya klub untuk ditinggalkan atau untuk bertukar.",
  "move.sameClub": () => "Pemain sudah berada di klub ini.",
  "move.onLoan": () =>
    "Pemain sedang dipinjamkan: tarik dulu dari pinjaman, atau permanenkan pinjamannya, lewat bagian Pinjaman di profilnya.",
  "move.notOnLoan": () => "Pemain tidak sedang dipinjamkan.",
  "move.playerCoach": () => "Pemain/pelatih belum bisa dipindahkan: mereka juga bekerja sebagai staf.",
  "move.unusualContract": () => "Kontrak pemain ini bukan kontrak pemain yang biasa.",
  "move.humanClub": () =>
    "Pemain ada di klub yang dikelola manajer manusia. Di versi game ini editor belum bisa menemukan pilihan " +
    "starter dan cadangan klub itu, jadi pemain hanya bisa meninggalkannya dari dalam game.",
  "move.menAndWomen": () => "Satu klub adalah klub pria dan yang lain klub wanita.",
  "move.notListed": () => "Daftar skuad tidak menyimpan pemain di tempat yang seharusnya.",
  "move.noRoom": (p) =>
    `Daftar skuad klub tidak punya tempat untuk satu pemain lagi (sekarang ${p.players} pemain), dan editor tidak bisa memperbesar daftarnya di sistem ini.`,
  "sign.noPool": () =>
    "Di versi game ini editor tidak bisa menemukan tempat game menyimpan kontrak, jadi tidak bisa memberi kontrak kepada agen bebas.",
  "sign.poolFull": () =>
    "Game tidak punya tempat untuk kontrak lain; tempat akan terbuka saat game membuat kontraknya sendiri seiring berjalannya hari. Lanjutkan satu hari di game lalu coba lagi.",
  "sign.noModel": () => "Tim senior klub tidak punya pemain dengan kontrak biasa untuk dijadikan contoh kontrak baru.",
  "sign.noDate": () => "Editor tidak bisa membaca tanggal dalam game; kontrak baru dimulai pada tanggal itu.",
  "move.outOfRange": (p) => `${p.value} bukan nilai ${field(p.field)} yang valid: harus dari ${p.min} sampai ${p.max}.`,
  "move.changed": () => `Game sudah mengubah memori ini sejak itu; ${reload}.`,
  "move.notApplied": () => "Sudah ditulis ke memori, tetapi yang terbaca kembali berbeda.",
  "heal.notInjured": () => "Pemain tidak punya cedera untuk disembuhkan.",
  "ban.notBanned": () => "Pemain tidak punya larangan bermain untuk dicabut.",
  "retirement.unknown": () => "Di versi game ini editor tidak bisa menemukan rencana pensiun.",
  "retirement.none": () => "Game tidak merencanakan pensiun pemain ini, dan dia sudah ingin terus bermain.",
  "guard.unknownBuild": () =>
    "FMLibreEditor belum diperiksa dengan versi game ini, jadi tidak menulis ke game. Tombol Tetap edit, di " +
    "pemberitahuan paling atas, menyalakan pengeditan.",
  "guard.failed": (p) =>
    `${checkName(p.check)} tidak lolos pemeriksaan di versi game ini, jadi FMLibreEditor tidak mengubahnya.`,
  "guard.saveChanged": () =>
    "Game sudah memuat save, atau kembali ke menu utamanya, sejak FMLibreEditor membacanya, jadi FMLibreEditor tidak " +
    "mengubah apa pun sampai kamu memuat ulang data.",
  "clause.noContract": () => "Pemain tidak punya kontrak.",
  "clause.missing": () => `Klausul ini sudah tidak ada di kontrak; ${reload}.`,
  "clause.notInClause": (p) => `Klausul ini tidak punya ${p.field === "clause.amount" ? "jumlah" : "syarat"} untuk diubah.`,
  "clause.same": () => "Kontrak sudah memilikinya.",
  "clause.noRoom": () =>
    "Daftar klausul kontrak sudah penuh dan editor tidak bisa memperbesarnya; ubah salah satu klausul sebagai gantinya.",
  "relation.missing": () => `Kewarganegaraan atau tempat latihan ini sudah tidak ada di daftar pemain; ${reload}.`,
  "relation.noRoom": () =>
    "Daftar pemain sudah penuh dan editor tidak bisa memperbesarnya; ubah salah satu isinya sebagai gantinya.",
  "relation.target": () => "Ini bukan negara atau klub di game yang bisa dipakai untuk data ini.",
  "relation.same": () => "Pemain sudah memilikinya.",
  "relation.rule": (p) => `Aturan pemain binaan ${p.rule} bukan salah satu aturan yang ditulis editor.`,
  "staff.you": () => "Ini kamu, manajer yang kamu kendalikan.",
  "staff.unemployed": () => "Staf ini tidak punya klub.",
  "staff.role": () =>
    "Klub atau salah satu timnya menunjuk langsung ke staf ini (misalnya manajer yang juga menjadi direktur sepak " +
    "bola, atau presiden yang melatih tim); game sendiri yang memindahkannya.",
  "staff.notListed": () => "Daftar staf klub tidak menyimpannya di tempat yang seharusnya.",
  "staff.noRoom": (p) =>
    `Daftar staf ${STAFF_DEPARTMENTS[p.department] ?? p.department} klub tidak punya tempat untuk satu orang lagi (sekarang ${p.staff}), dan editor tidak bisa memperbesar daftarnya di sistem ini.`,
  "staff.job": (p) => `Editor belum bisa memindahkan staf dengan pekerjaan ${jobName(p.job)}, atau memberi pekerjaan itu.`,
  "staff.directorTaken": (p) =>
    `${p.name ?? "Orang lain"} sudah menjadi direktur sepak bola klub ini. Beri staf ini pekerjaan lain di sana, atau ` +
    `pindahkan ${p.name ?? "orang itu"} lebih dulu.`,
  "staff.managerTaken": (p) =>
    `${p.name ?? "Orang lain"} sudah menjadi manajer klub ini. Beri staf ini pekerjaan lain di sana, atau ` +
    `pindahkan ${p.name ?? "orang itu"} lebih dulu.`,
  "staff.yourClub": () =>
    "Kamu mengelola klub ini. Beri staf ini pekerjaan lain di sana: FMLibreEditor tidak pernah mengambil posisimu.",
  "staff.noJob": () => "Pilih pekerjaan yang akan diambilnya di klub.",
  "staff.noModel": (p) =>
    p.staff === "0"
      ? "Klub ini sama sekali tidak punya staf: game tidak menyimpan staf di klub dari liga yang tidak bisa dimainkan di save ini."
      : "Tidak ada staf klub ini yang punya kontrak penuh sendiri untuk dijadikan contoh kontrak baru.",
  "stadium.none": () => "Stadion tempat tim senior klub bermain tidak bisa dibaca.",
  "stadium.shared": (p) => `${p.holders} hal di game memakai nama ini, jadi tidak bisa diubah hanya untuk stadion ini.`,
  "stadium.nameLength": (p) =>
    `Nama baru stadion ini harus ${p.min} sampai ${p.max} byte agar muat di tempat game menyimpannya; nama ini ${p.bytes} byte.`,
  "stadium.badName": () =>
    "Nama stadion tidak boleh kosong, diawali atau diakhiri spasi, atau berisi karakter kontrol.",
  "squad.noTeam": () => `Klub tidak punya tim seperti itu, atau tim itu tidak lolos pemeriksaan; ${reload}.`,
  "captain.notInTeam": () => "Pemain tidak bermain di tim ini; kapten hanya bisa dipilih dari pemain tim itu sendiri.",
  "captain.unchanged": () => "Pemain sudah memegang peran ini.",
  "session.notRunning": () => "Football Manager 27 tidak berjalan. Jalankan game dan muat save, lalu coba lagi.",
  "session.noSuchProcess": (p) => `Tidak ada ${p.exe ?? "fm.exe"} dengan nomor proses ${p.pid}.`,
  "session.severalRunning": (p) => `${p.count} salinan ${p.exe ?? "fm.exe"} sedang berjalan (${p.pids}); pilih salah satu.`,
  "session.pluginNotLoaded": () => "Data game belum dimuat; tunggu menu utama lalu coba lagi.",
  "session.unsupportedEdition": (p) => `FM${p.edition} belum didukung.`,
  "session.unknownEdition": () => "Tidak bisa diketahui Football Manager yang mana ini.",
  "session.playersNotFound": () =>
    "Daftar pemain tidak ditemukan; muat save (menu utama saja tidak cukup) lalu coba lagi.",
  "memory.win32": (p) => `Windows menolak sebuah operasi (${p.operation}, galat ${p.code}).`,
  "memory.read": (p) => `Memori game tidak bisa dibaca (galat sistem ${p.code}).`,
  "memory.write": (p) => `Tidak bisa menulis ke memori game (galat sistem ${p.code}).`,
  "memory.readOnly": () => "Game dibuka hanya untuk dibaca; Windows tidak mengizinkan penulisan.",
  "memory.notWritable": () => "Alamat ini tidak ada di memori data game yang bisa ditulis, jadi tidak ditulis.",
  "memory.invalidPe": () => "Modul game tidak bisa dibaca.",
  "memory.invalidMachO": () => "Modul game tidak bisa dibaca.",
  "memory.mach": (p) => `macOS menolak sebuah operasi (${p.operation}, galat ${p.code}).`,
  "memory.posix": (p) => `macOS menolak sebuah operasi (${p.operation}, errno ${p.code}).`,
  "memory.noBridge": () =>
    "macOS tidak mengizinkan FMLibreEditor masuk ke game: game dijalankan tanpa jembatan FMLibreEditor. Pasang " +
    "jembatannya, lalu jalankan lagi game dari Steam.",
  "memory.bridge": (p) => `Jembatan FMLibreEditor di dalam game tidak memberikan memorinya (${p.reason}).`,
  "scout.noClub": () => "Kamu tidak mengelola klub di save ini, jadi tidak ada yang perlu dipantau.",
  "scout.noTactic": (p) => `Taktik ${p.club} tidak bisa dibaca dari game.`,
  "scout.notPlaced": () => "Pemain tidak ada di posisi mana pun dalam taktik.",
  "scout.unknownRole": (p) => `Editor tidak mengenal peran ${p.role}.`,
  "setup.steamRunning": () =>
    "Steam sedang berjalan, jadi opsi peluncuran FM27 dibiarkan; jembatannya sendiri sudah terpasang. Tutup Steam " +
    "lalu coba lagi, atau masukkan sendiri opsi peluncurannya di Steam.",
  "setup.noSteamAccount": () => "Tidak ada akun Steam di Mac ini; buka Steam sekali dan masuk.",
  "setup.noLibrary": (p) => `Pustaka jembatan tidak ada di aplikasi: ${p.path}`,
  "setup.unknownConfig": (p) => `${p.path} tidak dalam bentuk yang dikenal FMLibreEditor, jadi dibiarkan.`,
  "setup.io": (p) => `${p.path}: ${p.error}`,
  "app.internal": () => "Terjadi galat tak terduga di aplikasi.",
  "app.notConnected": () => "Tidak terhubung ke game.",
  "app.notFound": (p) => `Tidak ada ${recordNoun(p.entity)} dengan UID ${p.uid} di daftar; baca ulang data.`,
  "app.dataChanged": () => `Data ini sudah berubah di game; ${reload}.`,
  "app.noChange": (p) => `Tidak ada perubahan nomor ${p.id}.`,
  "app.alreadyUndone": () => "Perubahan ini sudah diurungkan.",
  "export.failed": (p) => `Berkas tidak bisa ditulis: ${p.reason}`,
  "export.notAllowed": (p) =>
    `FMLibreEditor tidak boleh menulis ke ${p.folder}. Jika macOS bertanya apakah aplikasi ini boleh memakai folder ` +
    "Dokumen, izinkan di Pengaturan Sistem › Privasi & Keamanan › File & Folder, lalu ekspor lagi.",
  "export.noFolder": () => "Tidak ada folder untuk tempat ekspor.",
  "export.notExported": () => "Ini bukan berkas yang diekspor FMLibreEditor.",
  "export.openFailed": (p) => `Tidak bisa dibuka: ${p.reason}`,
  "mass.noOperations": () => "Pilih setidaknya satu kolom untuk diubah.",
  "mass.tooMany": (p) =>
    `Ada ${p.count} hasil. Persempit pencarian atau filter hingga paling banyak ${p.limit} untuk edit massal.`,
  "mass.outOfDate": () => "Pratinjau ini sudah usang. Buat ulang pratinjau edit massal.",
};

const CLAUSE_NAMES_ID: Partial<Record<number, string>> = {
  0: "Klausul pelepasan biaya minimum",
  1: "Klausul pelepasan saat degradasi",
  2: "Klausul pelepasan jika tidak promosi",
  3: "Kenaikan gaji tahunan",
  4: "Kenaikan gaji saat promosi",
  5: "Penurunan gaji saat degradasi",
  6: "Klausul pelepasan untuk peran staf",
  8: "Persentase bayaran penjualan lanjutan",
  9: "Persentase laba bayaran penjualan lanjutan",
  10: "Bonus gol pencapaian musim",
  11: "Perpanjangan satu tahun setelah laga liga (musim terakhir)",
  12: "Klausul menyamai pemain bergaji tertinggi",
  13: "Gaji setelah mencapai jumlah laga liga klub",
  14: "Kenaikan gaji saat promosi ke divisi teratas",
  15: "Penurunan gaji saat degradasi dari divisi teratas",
  16: "Klausul pelepasan biaya minimum (klub asing)",
  17: "Klausul pelepasan biaya minimum (klub domestik di divisi lebih tinggi)",
  18: "Klausul pelepasan biaya minimum (klub domestik)",
  19: "Gaji setelah mencapai penampilan internasional",
  20: "Persentase gaji yang dibayar sponsor",
  21: "Persentase penerimaan tiket yang dibayarkan kepada pemain",
  22: "Perpanjangan kontrak opsional oleh klub",
  23: "Batalkan kompensasi klub untuk peran manajerial",
  25: "Perpanjangan satu tahun setelah laga liga (musim terakhir promosi)",
  26: "Perpanjangan satu tahun setelah laga liga (hindari degradasi musim terakhir)",
  27: "Klausul pelepasan biaya minimum (klub di Liga Champions UEFA)",
  28: "Klausul kontrak terjamin MLS",
  29: "Perpanjangan kontrak setelah promosi",
  30: "Klausul pelepasan karena cedera",
  31: "Klausul pelepasan biaya minimum (klub yang bermain di kompetisi kontinental)",
  32: "Bayaran penampilan",
  33: "Bonus gol",
  34: "Bonus nirbobol",
  37: "Bonus penampilan internasional",
  38: "Bayaran pemain cadangan tak terpakai",
  39: "Bonus assist",
  40: "Bonus assist pencapaian musim",
  41: "Bonus gabungan gol dan assist pencapaian musim",
  54: "Tidak ditampilkan di game (54)",
  55: "Klausul pelepasan aktif saat degradasi",
  56: "Klausul pelepasan aktif jika gagal promosi",
  58: "Tidak ditampilkan di game (58)",
  63: "Tidak ditampilkan di game (63)",
};

const CONCERN_MOTIVES_ID: Partial<Record<number, string>> = {
  596: "Tidak dimasukkan ke skuad kompetisi",
  808: "Merasa rekan setimnya diperlakukan tidak adil",
  926: "Merasa rekan setimnya tidak pantas mendapat waktu bermain yang diinginkannya",
};

const TRAIT_NAMES_ID: readonly string[] = [
  "Menggiring bola dari sisi kiri",
  "Menggiring bola di sayap kanan",
  "Menggiring bola melalui area tengah",
  "Masuk ke area lawan",
  "Bergerak ke celah",
  "Selalu maju jika memungkinkan",
  "Melakukan umpan pendek sederhana",
  "Sering mencoba operan terobosan",
  "Menembak dari jarak jauh",
  "Menembak kencang",
  "Menempatkan tembakan",
  "Melengkungkan bola",
  "Suka mengecoh kiper",
  "Suka mencoba mengalahkan jebakan offside",
  "Menggunakan kaki bagian luar",
  "Menjaga lawan dengan ketat",
  "Memancing emosi lawan",
  "Berdebat dengan ofisial",
  "Bermain membelakangi gawang",
  "Turun menjemput bola",
  "Main satu-dua",
  "Suka mencungkil kiper",
  "Mengatur tempo",
  "Mencoba tendangan salto",
  "Lebih memilih mengoper daripada mencoba mencetak gol",
  "Tidak pernah mengirim through ball",
  "Menghentikan permainan",
  "Menyodorkan bola melewati lawan",
  "Memindahkan bola ke kaki kanan sebelum mencoba dribel",
  "Memindahkan bola ke kaki kiri sebelum mencoba dribel",
  "Terlalu lama menguasai bola",
  "Datang terlambat ke area lawan",
  "Berusaha keluar dari tekanan dengan menguasai bola",
  "Selalu bertahan",
  "Menghindari menggunakan kaki lemah",
  "Mencoba trik",
  "Mencoba tendangan bebas jarak jauh",
  "Sering melakukan tekel keras",
  "Tidak sembarangan melakukan tekel",
  "Memotong ke dalam",
  "Bermain melebar",
  "Membangkitkan semangat suporter",
  "Mencoba tembakan sekali sentuh",
  "Mencoba umpan jauh",
  "Suka menerima bola ke kaki",
  "Menendang tendangan bebas dengan kuat",
  "Suka melewati lawan berulang kali",
  "Suka memindahkan bola ke sisi lapangan lain",
  "Akan pensiun di puncak karier",
  "Bermain sepak bola selama mungkin",
  "Memiliki lemparan jauh mendatar",
  "Sering membawa bola",
  "Jarang membawa bola",
  "Berusaha mengembangkan kaki lemah",
  "Target man statis",
  "Memakai lemparan jauh untuk memulai serangan balik",
  "Menghindari tembakan jarak jauh",
  "Memotong ke dalam dari sayap kiri",
  "Memotong ke dalam dari sayap kanan",
  "Umpan silang cepat",
  "Membawa bola keluar dari pertahanan",
  "Bermain bola dengan kaki",
];

export const id: Strings = {
  attributes: {
    corners: "Sepak Pojok",
    crossing: "Umpan Silang",
    dribbling: "Dribel",
    finishing: "Penyelesaian",
    first_touch: "Sentuhan Pertama",
    free_kicks: "Tendangan Bebas",
    heading: "Sundulan",
    long_shots: "Tembakan Jauh",
    long_throws: "Lemparan Jauh",
    marking: "Penjagaan",
    passing: "Operan",
    penalty_taking: "Tendangan Penalti",
    tackling: "Tekel",
    technique: "Teknik",
    aggression: "Agresivitas",
    anticipation: "Antisipasi",
    bravery: "Keberanian",
    composure: "Ketenangan",
    concentration: "Konsentrasi",
    decisions: "Pengambilan Keputusan",
    determination: "Tekad",
    flair: "Kreativitas",
    leadership: "Kepemimpinan",
    off_the_ball: "Tanpa Bola",
    positioning: "Posisi",
    teamwork: "Kerja Sama Tim",
    vision: "Visi",
    work_rate: "Tingkat Kerja",
    acceleration: "Akselerasi",
    agility: "Kelincahan",
    balance: "Keseimbangan",
    jumping_reach: "Jangkauan Lompat",
    natural_fitness: "Kebugaran Natural",
    pace: "Laju",
    stamina: "Stamina",
    strength: "Kekuatan",
    aerial_reach: "Jangkauan Udara",
    command_of_area: "Penguasaan Area",
    communication: "Komunikasi",
    eccentricity: "Eksentrisitas",
    handling: "Penguasaan",
    kicking: "Tendangan",
    one_on_ones: "Satu Lawan Satu",
    punching: "Menepis (Kecenderungan)",
    reflexes: "Refleks",
    rushing_out: "Keluar dari Gawang (Kecenderungan)",
    throwing: "Lemparan",
    consistency: "Konsistensi",
    dirtiness: "Kekasaran",
    important_matches: "Laga Penting",
    injury_proneness: "Kerentanan Cedera",
    versatility: "Keserbabisaan",
    left_foot: "Kaki Kiri",
    right_foot: "Kaki Kanan",
  },

  staffAttributes: {
    attacking: "Menyerang",
    defending: "Bertahan",
    fitness: "Kebugaran",
    goalkeeping: "Kemampuan Jaga Gawang",
    possession: "Penguasaan Bola",
    set_pieces: "Bola Mati",
    tactical: "Taktis",
    technical: "Teknis",
    working_with_youngsters: "Bekerja dengan Pemain Muda",
    authority: "Otoritas",
    determination: "Tekad",
    motivating: "Memotivasi",
    people_management: "Manajemen SDM",
    data_analysis: "Analisis Data",
    judging_ability: "Menilai Kemampuan Pemain",
    judging_potential: "Menilai Potensi Pemain",
    judging_staff: "Menilai Kemampuan Staf",
    negotiating: "Negosiasi",
    tactical_knowledge: "Pengetahuan Taktik",
    physiotherapy: "Fisioterapi",
    sports_science: "Ilmu Olahraga",
  },

  personality: {
    adaptability: "Adaptabilitas",
    ambition: "Ambisi",
    loyalty: "Loyalitas",
    pressure: "Tekanan",
    professionalism: "Profesionalisme",
    sportsmanship: "Sportivitas",
    temperament: "Temperamen",
    controversy: "Kontroversi",
  },

  positions: {
    gk: "GK",
    sw: "SW",
    dl: "DL",
    dc: "DC",
    dr: "DR",
    dm: "DM",
    ml: "ML",
    mc: "MC",
    mr: "MR",
    aml: "AML",
    amc: "AMC",
    amr: "AMR",
    st: "ST",
    wbl: "WBL",
    wbr: "WBR",
  },

  clubFacilities: {
    training: "Latihan",
    youth_facilities: "Fasilitas Pemain Muda",
    youth_coaching: "Kepelatihan Pemain Muda",
    youth_recruitment: "Rekrutmen Pemain Muda",
    corporate: "Korporat",
  },

  supporterTraits: {
    loyalty: "Loyalitas",
    passion: "Semangat",
    patience: "Kesabaran",
    affluence: "Kemakmuran",
    temperament: "Temperamen",
    expectations: "Ekspektasi",
  },

  supporterMix: {
    hardcore: "Fanatik",
    core: "Inti",
    family: "Keluarga",
    fair_weather: "Musiman",
    corporate: "Korporat",
    casual: "Kasual",
  },

  jobs: {
    1: "Pemain",
    2: "Pelatih",
    4: "Ketua Dewan",
    6: "Direktur",
    10: "Direktur Sepak Bola",
    12: "Fisioterapis",
    14: "Pemandu Bakat",
    16: "Manajer",
    20: "Asisten Pelatih",
    22: "Pelatih Bola Mati",
    26: "Pelatih Kebugaran",
    34: "Pelatih Kiper",
    38: "Dokter Kepala",
    40: "Kepala Ilmu Olahraga",
    44: "Pemandu Bakat Utama",
    46: "Dokter",
    48: "Ilmuwan Olahraga",
    50: "Kepala Fisioterapis",
    58: "Analis Rekrutmen",
    60: "Analis Performa",
    62: "Kepala Analis Performa",
    64: "Kepala Pengembangan Pemain Muda",
    66: "Pemilik",
    70: "Presiden",
    86: "Manajer Peminjaman",
    88: "Direktur Teknis",
  },

  fields: {
    current_ability: "Kemampuan saat ini",
    potential_ability: "Kemampuan potensial",
    height: "Tinggi (cm)",
    date_of_birth: "Tanggal lahir",
    asking_price: "Harga yang diminta",
    nation: "Kewarganegaraan",
    "reputation.home": "Reputasi kandang",
    "reputation.current": "Reputasi saat ini",
    "reputation.world": "Reputasi dunia",
    "international.caps": "Penampilan",
    "international.goals": "Gol internasional",
    "international.u21_caps": "Penampilan U21",
    "international.u21_goals": "Gol U21",
    condition: "Energi",
    match_sharpness: "Ketajaman bertanding",
    jadedness: "Keletihan",
    morale: "Moral",
    "contract.wage": "Gaji per minggu",
    "contract.loyalty_bonus": "Bonus loyalitas per minggu",
    "contract.happiness": "Kebahagiaan",
    "contract.playing_time_happiness": "Kebahagiaan waktu bermain",
    "contract.unhappiness": "Alasan tidak senang",
    "contract.expires": "Kontrak berakhir",
    "contract.squad_number": "Nomor punggung",
    "contract.squad_status": "Status skuad",
    "contract.transfer_listed": "Masuk daftar transfer",
    "contract.loan_listed": "Masuk daftar pinjaman",
    "loan.expires": "Pinjaman berakhir",
    "loan.option_fee": "Opsi beli",
    "contract.job": "Pekerjaan",
    "tie.nationality": "Kewarganegaraan sekunder",
    "tie.trainedInNation": "Dilatih di negara",
    "tie.trainedAtClub": "Dilatih di klub",
    "tie.workPermit": "Tanpa izin kerja di",
    club: "Klub",
    injuries: "Cedera",
    cohesion: "Kekompakan",
    bans: "Larangan bermain",
    retirement: "Pensiun",
    clause: "Klausul kontrak",
    "clause.amount": "Jumlah klausul",
    "clause.condition": "Syarat klausul",
    captain: "Kapten",
    vice_captain: "Wakil kapten",
    reputation: "Reputasi",
    "facilities.training": "Fasilitas latihan",
    "facilities.youth_facilities": "Fasilitas pemain muda",
    "facilities.youth_coaching": "Kepelatihan pemain muda",
    "facilities.youth_recruitment": "Rekrutmen pemain muda",
    "facilities.corporate": "Fasilitas korporat",
    "finance.balance": "Saldo",
    "finance.transfer_budget": "Anggaran transfer",
    "finance.wage_budget": "Anggaran gaji",
    "finance.total_wage_budget": "Total anggaran gaji",
    "stadium.capacity": "Kapasitas stadion",
    "stadium.name": "Nama stadion",
    "stadium.seating": "Kapasitas tempat duduk",
    "stadium.used": "Kapasitas terpakai",
    "stadium.expansion": "Kapasitas ekspansi",
  },

  profile: {
    close: "Tutup profil",
    loading: "Memuat profil…",
    resize: "Ubah ukuran panel profil",
    resizeHint: "Seret untuk melebarkan atau menyempitkan panel; klik dua kali untuk mengembalikannya",
    none: "—",

    freeAgent: "Agen bebas",
    born: "Lahir",
    height: (cm: number) => `${cm} cm`,
    heightUnit: "cm",
    uid: "UID",
    currentAbility: "Kemampuan saat ini",
    currentAbilityShort: "CA",
    potentialAbility: "Kemampuan potensial",
    potentialAbilityShort: "PA",
    potentialRange: "Potensi diatur sebagai rentang",

    technical: "Teknis",
    goalkeeping: "Kemampuan Jaga Gawang",
    mental: "Mental",
    physical: "Fisik",
    hidden: "Tersembunyi",
    feet: "Kaki",
    personality: "Kepribadian",
    raw: (raw: number, scale = 100) => `mentah ${raw} / ${scale}`,
    lowerIsBetter: "makin rendah makin baik",
    age: (age: number) => `usia ${age}`,

    positions: "Posisi",
    positionsSummary: (best: string) => `Rating posisi: ${best}`,
    positionRatings: "Rating posisi",
    positionTiers: {
      natural: "Natural",
      accomplished: "Mahir",
      competent: "Kompeten",
      unconvincing: "Kurang meyakinkan",
      ineffective: "Tidak efektif",
    },
    positionTooltip: (position: string, rating: number, tier: string) => `${position} · ${rating} · ${tier}`,

    contract: "Kontrak",
    wage: "Gaji per minggu",
    wageNote: (converted: boolean): string =>
      converted
        ? "game menyimpan pound; ditampilkan dengan kurs FM sendiri"
        : "game menyimpan pound; mata uang lain bisa dipilih di pengaturan",
    signed: "Ditandatangani",
    expires: "Berakhir",
    joined: "Bergabung",
    squadStatus: "Status skuad",
    squadStatusName: (status: number) => SQUAD_STATUSES[status] ?? `Status ${status}`,
    contractType: "Jenis kontrak",
    contractTypeName: (code: number) => CONTRACT_TYPES[code] ?? `Jenis ${code}`,
    squadNumber: "Nomor punggung",
    transferListed: "Masuk daftar transfer",
    loanListed: "Masuk daftar pinjaman",

    career: "Karier",
    internationalCaps: "Penampilan internasional",
    internationalGoals: "Gol internasional",
    u21Caps: "Penampilan U21",
    u21Goals: "Gol U21",
    askingPrice: "Harga yang diminta",
    notSet: "Belum diatur",
    reputation: "Reputasi",
    reputationHome: "Kandang",
    reputationCurrent: "Saat ini",
    reputationWorld: "Dunia",
    retirement: "Pensiun",
    retires: "Berencana pensiun",
    noRetirement: "Game belum merencanakan pensiunnya",
    keepPlaying: "Cegah pensiun",
    keepingPlaying: "Mencegah…",
    keepPlayingTitle:
      "Hapus pensiunnya dari rencana game dan beri dia sifat “Bermain sepak bola selama mungkin” sebagai ganti “Akan pensiun di puncak karier”; Perubahan bisa mengurungkannya",

    morale: (value: number) => `${value} / 20`,
    traits: "Sifat",
    noTraits: "Tidak punya sifat",
    traitName: (bit: number) => TRAIT_NAMES_ID[bit] ?? `Sifat ${bit}`,
    unhappiness: "Ketidakpuasan",
    noUnhappiness: "Tidak ada yang membuatnya tidak senang",
    removeUnhappiness: "Hapus semua",
    removingUnhappiness: "Menghapus…",
    removeUnhappinessTitle:
      "Hapus setiap alasan tidak senang dari daftarnya, seperti Remove all di FMRTE; Perubahan bisa mengurungkannya",
    concernSince: (date: string) => `sejak ${date}`,
    concernKind: (kind: number) => (kind === 1 ? "Khawatir" : kind === 2 ? "Internal" : `Jenis ${kind}`),
    concernMotive: (motive: number) => CONCERN_MOTIVES_ID[motive] ?? `Alasan ${motive}`,
    clauses: "Bonus dan klausul",
    noClauses: "Tidak ada bonus atau klausul",
    loyaltyBonus: "Bonus loyalitas",
    happiness: "Kebahagiaan",
    playingTimeHappiness: "Kebahagiaan waktu bermain",
    moodTitle: "Seperti yang ditampilkan FMRTE, dari -100 sampai 100; game menampilkannya dengan kata-kata",
    clauseName: (kind: number) => CLAUSE_NAMES_ID[kind] ?? `Klausul ${kind}`,
    loan: "Pinjaman",
    loanAt: "Dipinjamkan ke",
    loanParent: "Milik",
    loanFrom: "Dari",
    loanUntil: "Sampai",
    loanNumber: "Nomor di sana",
    recall: "Tarik dari pinjaman",
    recallTitle: "Kembalikan dia ke klubnya: pinjaman berakhir hari ini. Ditanyakan dulu sebelum ada yang berubah",
    recallAgain: "Tarik lagi",
    makePermanent: "Permanenkan",
    makePermanentTitle:
      "Pertahankan dia di klub yang meminjamnya, dengan kontrak di klub itu. Ditanyakan dulu sebelum ada yang berubah",
    recalledWaiting: "Ditarik · menunggu kembali",
    endsTodayWaiting: "Berakhir hari ini · menunggu kembali",
    pendingTitle: (parent: string) =>
      `Hari ini hari terakhir pinjaman: lanjutkan satu hari di game dan dia kembali ke ${parent}.`,
    endPassed: (date: string) =>
      `Pinjaman seharusnya berakhir pada ${date}, tetapi game belum mengembalikannya. Tarik lagi, lalu lanjutkan satu hari.`,
    loanCanRecall: "Bisa dipanggil kembali",
    loanCanRecallTitle: "Apakah klubnya boleh menariknya kembali di game. Tarik dari pinjaman di sini tetap berfungsi",
    loanCanTerminate: "Bisa diakhiri lebih awal",
    loanCupMatches: "Bermain di laga piala",
    loanAgainstClub: "Bisa bermain melawan klub induk",
    loanOptionFee: "Opsi beli",
    loanOptionFeeTitle: "Biaya yang bisa dibayar klub peminjam untuk merekrutnya secara permanen",
    loanMonthlyFee: "Biaya bulanan",
    loanMonthlyFeeTitle: "Yang dibayar klub peminjam kepada klubnya untuk setiap bulan dia bermain",
    loanUnusedFee: "Biaya bulanan jika tidak dimainkan",
    loanUnusedFeeTitle: "Yang dibayar klub peminjam kepada klubnya untuk setiap bulan dia tidak dimainkan",
    clauseCondition: (kind: number, value: number) => {
      switch (kind) {
        case 10:
          return `${value} gol`;
        case 40:
          return `${value} assist`;
        case 41:
          return `${value} gol dan assist`;
        case 19:
          return `${value} penampilan internasional`;
        case 11:
        case 13:
        case 25:
        case 26:
          return `${value} laga liga`;
        case 22:
        case 29:
          return `${value} tahun`;
        case 3:
        case 4:
        case 5:
        case 8:
        case 9:
        case 14:
        case 15:
        case 20:
        case 21:
          return `${value}%`;
        default:
          return String(value);
      }
    },
    clauseExpires: (date: string) => `berakhir ${date}`,
    clauseExpiresAfter: (days: number) => `berakhir ${format(days)} hari setelah tanda tangan`,
    clauseProfitShare: (percent: string, amount: string) => `${percent} dari laba di atas ${amount}`,
    clauseWage: (amount: string) => `${amount} per minggu`,
    moraleTitle:
      "Game menampilkan moral sebagai kebahagiaan pemain secara keseluruhan: puas di 10, sedikit senang di 11, sangat senang di 15 dan 20",
    jadednessTitle:
      "Seberapa letih pemain karena bermain, yang hilang dengan istirahat: -500 berarti sepenuhnya segar, dan makin tinggi, makin dia butuh istirahat",
    noInjuries: "Tidak cedera",
    unknownInjury: "Cedera tak dikenal",
    injuryStarted: (date: string) => `Mulai ${date}`,
    injuryBack: (dates: string) => `Perkiraan kembali ${dates}`,
    heal: "Sembuhkan",
    healTitle: "Sembuhkan setiap cedera pemain ini di game",
    noBans: "Tidak ada larangan bermain",
    banMatches: (matches: number) => `${format(matches)} pertandingan`,
    banStarted: (date: string) => `Sejak ${date}`,
    liftBans: "Cabut",
    liftBansTitle: "Cabut setiap larangan bermain pemain ini di game",

    maxAttributes: "Maksimalkan atribut",
    maxAttributesTitle:
      "Atur setiap atribut pemain ini ke nilai terbaiknya: 20, dan 1 untuk kerentanan cedera dan kekasaran",
    maxAttributesDone: (count: number) =>
      count === 0 ? "Semua atribut sudah di nilai terbaiknya" : `${changeCount(count)} ditulis`,
    maxAttributesUndone: (count: number) =>
      count === 0 ? "Tidak ada yang diurungkan" : `${changeCount(count)} diurungkan`,
    undoMax: "Urungkan",
    undoMaxTitle: "Tulis kembali atribut lamanya ke game",
    freezeAttributes: "Bekukan atribut",
    freezeAttributesNote:
      "Selama aplikasi terbuka dan terhubung, atributnya tidak menurun: yang diambil game dikembalikan, dan " +
      "peningkatan tetap dihitung. Aplikasi mengingat ini untuk save ini, dan membekukannya lagi saat terhubung ke save itu.",
    maxStaffAttributesTitle: "Atur setiap atribut staf ini ke nilai terbaiknya: 20",
    undoMaxStaffTitle: "Tulis kembali atribut lama ke game",
    freezeStaffAttributesNote:
      "Selama aplikasi terbuka dan terhubung, atributnya tidak menurun: yang diambil game dikembalikan, dan " +
      "peningkatan tetap dihitung. Aplikasi mengingat ini untuk save ini, dan membekukannya lagi saat terhubung ke save itu.",
    freezeFitness: "Bekukan energi dan ketajaman",
    freezeFitnessNote:
      "Selama aplikasi terbuka dan terhubung, energi dan ketajaman bertandingnya tidak turun: yang diambil game " +
      "dikembalikan, dan kenaikan tetap dihitung, jadi di 100% dia tetap di sana. Aplikasi mengingat ini untuk save ini.",
    freezePositions: "Bekukan",
    freezePositionsInfo: "Apa fungsi membekukan posisi?",
    freezePositionsNote:
      "Selama aplikasi terbuka dan terhubung, rating posisinya tetap seperti sekarang: dia tidak mempelajari posisi " +
      "baru, dan ratingnya tidak naik maupun turun. Aplikasi mengingat ini untuk save ini.",

    you: "Kamu",
    youTitle: "Manajer yang kamu kendalikan di save ini",
    id: "ID",
    job: "Pekerjaan",
    changeJob: "Ganti pekerjaan",
    changeJobTitle: "Beri staf ini pekerjaan lain di klubnya di game",
    newJob: "Pekerjaan baru",
    applyJob: "Terapkan",
    cancelJob: "Batal",
    unemployed: "Menganggur",
    coaching: "Kepelatihan",
    knowledge: "Pengetahuan",
    medical: "Medis",
    playerCoach: (job: string) => `${job} (pemain/pelatih)`,
    unknownJob: (code: number) => `Pekerjaan ${code}`,
  },

  playerList: {
    nav: "Pemain",
    count: (total: number) => `${format(total)} pemain`,
    search: "Cari pemain berdasarkan nama atau UID",
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} pemain`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · ${shown} teratas menurut kemampuan saat ini`
        : `${count} · ${shown} pertama menurut ${sorted.by}, ${sorted.ascending ? "naik" : "turun"}`;
    },
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Tidak ada pemain yang cocok dengan filter ini." : "Tidak ada pemain.";
      }
      return filtered
        ? `Tidak ada pemain yang cocok dengan “${query}” dengan filter ini.`
        : `Tidak ada pemain yang cocok dengan “${query}”.`;
    },
    columns: {
      name: "Nama",
      age: "Usia",
      positions: "Posisi",
      nation: "Negara",
      club: "Klub",
      contractExpires: "Kontrak",
      born: "Lahir",
      currentAbility: "CA",
      potentialAbility: "PA",
      uid: "UID",
    },
    sortBy: (by: string) => `Urutkan berdasarkan ${by}`,
    sortNames: {
      currentAbility: "kemampuan saat ini",
      potentialAbility: "kemampuan potensial",
      age: "usia",
      name: "nama",
      nation: "negara",
      club: "klub",
      contractExpires: "akhir kontrak",
    },
    filters: {
      toggle: "Filter",
      toggleActive: (count: number) => `Filter, ${count} aktif`,
      clear: "Hapus",
      any: "Apa pun",
      position: "Posisi",
      gender: "Jenis kelamin",
      men: "Pria",
      women: "Wanita",
      age: "Usia",
      minAge: "Usia minimum",
      maxAge: "Usia maksimum",
      minPlaceholder: "Min",
      maxPlaceholder: "Maks",
      minCurrentAbility: "CA min",
      minCurrentAbilityTitle: "Kemampuan saat ini minimum",
      minPotentialAbility: "PA min",
      minPotentialAbilityTitle: "Kemampuan potensial minimum",
      abilityPlaceholder: "1–200",
      nation: "Negara",
      club: "Klub",
      freeAgentsOnly: "Hanya agen bebas",
      contractEndsBy: "Kontrak berakhir sebelum",
      transferListedOnly: "Hanya yang masuk daftar transfer",
      loanListedOnly: "Hanya yang masuk daftar pinjaman",
      attributes: {
        heading: "Atribut",
        attribute: "Atribut",
        pick: "Pilih atribut",
        min: (name: string) => (name ? `${name} minimal` : "Minimal"),
        max: (name: string) => (name ? `${name} maksimal` : "Maksimal"),
        add: "Tambah atribut",
        remove: (name: string) => (name ? `Hapus ${name}` : "Hapus baris ini"),
      },
      saved: {
        save: "Simpan",
        saveTitle: "Simpan filter dan urutan yang berlaku dengan sebuah nama",
        name: "Nama filter tersimpan",
        namePlaceholder: "Nama filter",
        ok: "OK",
        cancel: "Batal",
        select: "Filter tersimpan",
        delete: "Hapus",
        deleteTitle: (name: string) => `Hapus filter tersimpan: ${name}`,
        replaceQuestion: (name: string) => `Filter tersimpan bernama “${name}” sudah ada. Ganti?`,
        replace: "Ganti",
        full: (max: number) =>
          `Paling banyak ${max} filter bisa disimpan. Hapus satu dulu, atau pakai nama filter tersimpan untuk menggantinya.`,
      },
    },
  },

  staffList: {
    nav: "Staf",
    count: (total: number) => `${format(total)} staf`,
    search: "Cari staf berdasarkan nama atau ID",
    summary: (total: number, shown: number, sorted: { by: string; ascending: boolean } | null) => {
      const count = `${format(total)} staf`;
      if (total <= shown) {
        return count;
      }
      return sorted === null
        ? `${count} · ${shown} teratas menurut kemampuan saat ini`
        : `${count} · ${shown} pertama menurut ${sorted.by}, ${sorted.ascending ? "naik" : "turun"}`;
    },
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Tidak ada staf yang cocok dengan filter ini." : "Tidak ada staf.";
      }
      return filtered
        ? `Tidak ada staf yang cocok dengan “${query}” dengan filter ini.`
        : `Tidak ada staf yang cocok dengan “${query}”.`;
    },
    columns: {
      name: "Nama",
      age: "Usia",
      job: "Pekerjaan",
      club: "Klub",
      nation: "Negara",
      born: "Lahir",
      currentAbility: "CA",
      potentialAbility: "PA",
      id: "ID",
    },
    sortBy: (by: string) => `Urutkan berdasarkan ${by}`,
    sortNames: {
      currentAbility: "kemampuan saat ini",
      potentialAbility: "kemampuan potensial",
      age: "usia",
      name: "nama",
      nation: "negara",
      club: "klub",
    },
    filters: {
      job: "Pekerjaan",
      anyJob: "Apa pun",
      unemployedOnly: "Hanya yang menganggur",
    },
  },

  clubProfile: {
    womensClub: "Klub wanita",
    founded: (year: number) => `Didirikan ${year}`,
    reputationShort: "REP",
    reputationTitle: "Reputasi",

    tabsLabel: "Bagian klub",
    tabs: { overview: "Ringkasan", squad: "Skuad", stadium: "Stadion" },
    squadLocked: "Selesaikan pengeditan untuk membuka skuad",

    facilities: "Fasilitas",

    supporters: "Suporter",
    supporterMix: "Komposisi suporter",
    percent: (value: number) => `${percents.format(value)}%`,
    mixTooltip: (kind: string, percent: string) => `${kind} · ${percent}`,

    finances: "Keuangan",
    balance: "Saldo",
    transferBudget: "Anggaran transfer",
    wageBudget: "Anggaran gaji (pengeluaran)",
    totalWageBudget: "Total anggaran gaji",
    ticketPrice: "Rerata harga tiket",
    perWeek: "per minggu",
    noFinances: "FM hanya menyimpan keuangan klub di liga yang dimainkan.",
    freeze: "Bekukan uang",
    freezeNote:
      "Selama aplikasi terbuka dan terhubung, saldo tidak turun: yang diambil game dikembalikan, dan pemasukan " +
      "tetap dihitung. Aplikasi mengingat ini untuk save ini, dan membekukannya lagi saat terhubung ke save itu.",

    stadium: "Stadion",
    capacity: "Kapasitas",
    seating: "Tempat duduk",
    used: "Terpakai",
    usedAll: "Seluruhnya",
    usedTitle:
      "Bagian kapasitas yang diizinkan game, saat game membatasinya (misalnya saat kursi ditutup); 0 berarti seluruhnya",
    expansion: "Bisa diperluas hingga",
    noStadium: "Stadion klub ini tidak bisa dibaca.",
    stadiumName: "Nama",
    rename: "Ganti nama",
    renameTitle: "Beri stadion nama lain; langsung ditulis, dan Perubahan bisa mengurungkannya",
    renameInfoLabel: "Bagaimana ganti nama bekerja?",
    renameInfo:
      "Game tidak menyimpan nama stadion di save-nya: game mengambilnya dari database setiap kali memuat save. Jadi " +
      "FMLibreEditor mengingat nama baru untuk save ini, dan memasangnya lagi dalam hitungan detik setiap kali game " +
      "memuatnya, selama aplikasi terbuka dan terhubung. Jika game memuat save saat aplikasi tertutup, game " +
      "menampilkan namanya sendiri sampai aplikasi terhubung lagi. Untuk kembali ke nama lama, urungkan penggantian " +
      "nama di Perubahan, atau ganti lagi nama stadionnya.",
    saveName: "Simpan",
    renaming: "Menyimpan…",
    cancelRename: "Batal",
    nameLength: (bytes: number, min: number, max: number) =>
      min <= 1
        ? `${bytes} dari paling banyak ${max} karakter (huruf beraksen dihitung dua)`
        : `${bytes} karakter: dari ${min} sampai ${max}, agar muat di tempat game menyimpan nama (huruf beraksen dihitung dua)`,
    nameShared: (holders: number) =>
      `${holders} hal di game memakai nama ini, jadi tidak bisa diubah hanya untuk stadion ini`,

    info: "Info klub",
    seasonTickets: "Tiket musiman",
    socialMedia: "Pengikut media sosial",
  },

  clubList: {
    nav: "Klub",
    count: (total: number) => `${format(total)} klub`,
    search: "Cari klub berdasarkan nama atau UID",
    summary: (total: number, shown: number) =>
      total > shown
        ? `${format(total)} klub · ${shown} teratas menurut reputasi`
        : `${format(total)} klub`,
    empty: (query: string, filtered: boolean) => {
      if (query === "") {
        return filtered ? "Tidak ada klub yang cocok dengan filter ini." : "Tidak ada klub.";
      }
      return filtered
        ? `Tidak ada klub yang cocok dengan “${query}” dengan filter ini.`
        : `Tidak ada klub yang cocok dengan “${query}”.`;
    },
    women: "Wanita",
    columns: {
      name: "Nama",
      reputation: "Reputasi",
      founded: "Didirikan",
      uid: "UID",
    },
    filters: {
      kind: "Klub yang ditampilkan",
      all: "Semua klub",
      men: "Klub pria",
      women: "Klub wanita",
    },
  },

  app: {
    stage: "beta",
    settingsLabel: "Pengaturan",
    languageLabel: "Bahasa",
    currencyLabel: "Mata uang",

    noteEditable: "Editan baru sampai ke game saat kamu menerapkannya. Cadangkan save-mu lebih dulu.",
    noteReadOnly: "Hanya baca: Windows tidak mengizinkan FMLibreEditor menulis ke game.",
    noteUnknownBuild: "Hanya baca: versi game ini masih baru bagi FMLibreEditor.",
    noteNotConnected: "Tidak ada yang berubah di game sampai kamu mengedit dan menerapkannya.",

    notConnected: "Tidak terhubung",
    previewTag: "pratinjau browser · data contoh",
    noDate: "Tanpa tanggal dalam game",
    noDateTitle:
      "FMLibreEditor tidak bisa membaca tanggal dalam game di versi game ini, jadi usia tidak ditampilkan dan filter " +
      "usia tidak menemukan siapa pun. Periksa pembaruan.",
    reload: "Muat ulang data",
    refresh: "Segarkan",
    detecting: "Mencari Football Manager…",
    connecting: "Membaca pemain, staf, dan klub…",
    reloading: "Memuat ulang pemain, staf, dan klub…",

    saveChanged: {
      title: "Save di game sudah berganti",
      text:
        "Game sudah memuat save, atau kembali ke menu utamanya, sejak FMLibreEditor membacanya. Sampai kamu memuat ulang " +
        "data, FMLibreEditor tidak mengubah apa pun di game dan tidak menahan yang dibekukan: yang ditampilkannya " +
        "mungkin milik save lain.",
    },

    refrozen: {
      title: "Dibekukan lagi dari sesi sebelumnya",
      waitingTitle: "Yang dibekukan menunggu untuk saat ini",
      players: (names: string) => `Atribut: ${names}`,
      staff: (names: string) => `Atribut staf: ${names}`,
      clubs: (names: string) => `Uang: ${names}`,
      fitness: (names: string) => `Energi dan ketajaman: ${names}`,
      positions: (names: string) => `Posisi: ${names}`,
      stadiums: (names: string) => `Nama stadion: ${names}`,
      more: (count: number) => `dan ${format(count)} lainnya`,
      waiting: (count: number) =>
        `${format(count)} diingat tetapi tidak dibekukan sekarang: FMLibreEditor belum bisa menulis ke versi game ini.`,
      dismiss: "Tutup",
    },

    freezeInfo: {
      label: "Bagaimana pembekuan bekerja?",
      note:
        "Membekukan tidak mengubah game secara permanen: setiap 2 detik, FMLibreEditor mengembalikan yang diambil game. " +
        "Jadi ini hanya bekerja selama aplikasi terbuka dan terhubung; tutup aplikasinya, dan game mengubahnya lagi. " +
        "Aplikasi mengingat apa yang dibekukan di save ini, dan membekukannya lagi saat berikutnya terhubung ke save itu.",
    },

    connect: {
      title: "Hubungkan ke Football Manager 27",
      intro: "FMLibreEditor membaca memori game selagi game berjalan. Jalankan game dan muat save, lalu hubungkan.",
      notRunning: "Football Manager 27 tidak berjalan.",
      openFailed: (error: string) => `Game tidak bisa dibuka: ${error}`,
      game: "Game",
      gameData: "Data game",
      loaded: "Dimuat",
      stillLoading: "Masih memuat; tunggu menu utama",
      process: "Proses",
      pid: (pid: number) => `pid ${pid}`,
      several: "Beberapa salinan game sedang berjalan; yang pertama dipakai.",
      button: "Hubungkan dan baca pemain, staf, dan klub",

      bridge: {
        title: "Jembatan (macOS)",
        intro:
          "macOS tidak mengizinkan aplikasi masuk ke memori aplikasi lain, jadi FM27 harus menyerahkan memorinya sendiri. " +
          "Ini terjadi setelah FM27 memuat jembatan FMLibreEditor: pustaka kecil yang tidak mengait atau mengubah apa " +
          "pun di game dan hanya memberikan memorinya ke aplikasi ini. Opsi peluncuran di Steam membuat FM27 memuatnya.",
        library: "Jembatan",
        installed: "Terpasang",
        missing: "Belum terpasang",
        launchOption: "Opsi peluncuran",
        set: "Diatur di Steam",
        notSet: "Belum diatur",
        ready:
          "Sudah siap. Jalankan FM27 dari Steam (tutup lalu jalankan lagi jika sedang berjalan), muat save, lalu hubungkan.",
        steamRunning:
          "Steam sedang berjalan, dan menahan opsi peluncuran selama itu. Tutup Steam agar opsi peluncuran diatur " +
          "untukmu, atau masukkan sendiri di Steam.",
        setUp: "Pasang jembatan",
        remove: "Lepas jembatan",
        manual: "Atau, di Steam, klik kanan Football Manager 27 › Properties › General › Launch Options, lalu masukkan:",
        copy: "Salin",
        copied: "Disalin",
      },
    },
  },

  graphics: {
    reading: "Membaca paket grafis…",
    summary: ({ clubLogos, flags, faces }: Pick<GraphicsCounts, "clubLogos" | "flags" | "faces">) =>
      `Grafis: ${format(clubLogos)} logo klub · ${format(flags)} bendera · ${format(faces)} wajah`,
    none: "Tidak ada paket grafis",
    noneHint: "Paket logo dan wajah diletakkan di folder graphics FM27.",
  },

  compatibility: {
    unknownBuild: (game: string) => `FMLibreEditor belum diperiksa dengan ${game}`,
    unknownBuildText:
      "Game kemungkinan baru diperbarui. FMLibreEditor menemukan data game dan memeriksanya, tetapi tidak menulis ke " +
      "versi yang belum diuji sampai kamu mengizinkannya. FMLibreEditor versi baru biasanya menyusul dalam beberapa hari.",
    allowedText: "Pengeditan menyala untuk sesi ini, sejauh pemeriksaan mengizinkan. Simpan cadangan save-mu.",
    failedTitle: "Sebagian data game tidak lolos pemeriksaan",
    reloadHint: "Jika save masih dimuat, Muat ulang data akan memeriksanya lagi.",
    noDate: "Tanggal dalam game tidak lolos pemeriksaan, jadi usia tidak ditampilkan.",
    failed: (names: string) => `Dibiarkan hanya baca: ${names}.`,
    failedCheck: (name, fit, sampled) => `${name} (${format(fit)} dari ${format(sampled)} cocok)`,
    join: (names: string[]) =>
      names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}`,
    allow: "Tetap edit",
    allowTitle: "Nyalakan pengeditan sampai FMLibreEditor ditutup atau terhubung lagi. Cadangkan save-mu lebih dulu.",
  },

  diagnostics: {
    copy: "Salin diagnostik",
    copyTitle:
      "Menyalin apa yang ditemukan FMLibreEditor di dalam game, untuk ditempel ke laporan bug. Tidak memuat nama " +
      "atau path.",
    copied: "Disalin",
    failed: (reason) => `Diagnostik tidak bisa disalin: ${reason}`,
  },

  checks: {
    gameDate: "tanggal dalam game",
    players: "detail pemain",
    abilities: "kemampuan saat ini dan potensi",
    positions: "posisi",
    attributes: "atribut",
    personality: "kepribadian",
    liveValues: "energi, ketajaman bertanding, keletihan, dan moral",
    contracts: "kontrak",
    teams: "tim",
    staff: "staf",
    clubs: "klub",
    cohesion: "kekompakan dengan klub",
  },

  update: {
    available: (version: string) => `FMLibreEditor ${version} tersedia`,
    youHave: (version: string) => `Versimu ${version}.`,
    download: "Unduh",
    install: "Perbarui",
    installTitle: "Unduh dan pasang versi baru; FMLibreEditor akan ditutup dan dibuka lagi dengan versi itu",
    preparing: "Menyiapkan…",
    downloading: (percent: number | null) => (percent === null ? "Mengunduh…" : `Mengunduh… ${percent}%`),
    installing: "Memasang: FMLibreEditor akan ditutup dan dibuka lagi dengan versi baru.",
    installFailed: (reason: string) => `Tidak bisa memperbarui: ${reason}. Unduh dari halamannya saja.`,
    notInstallable: "Versi ini tidak bisa dipasang dari sini. Unduh dari halamannya saja.",
    later: "Nanti",
    check: "Periksa pembaruan",
    checking: "Memeriksa pembaruan…",
    upToDate: "Kamu sudah memakai versi terbaru.",
    failed: "Tidak bisa memeriksa pembaruan.",
  },

  edit: {
    unknownNation: "Negara tak dikenal",
    edit: "Edit",
    editTitle: "Ubah nilai profil ini di game",
    startFailed: (reason: string) => `Tidak bisa mulai mengedit: ${reason}`,
    positionRating: (position: string) => `Rating ${position}`,
    was: (value: string) => `sebelumnya ${value}`,
    invalid: (min: number, max: number) => `Masukkan bilangan bulat dari ${min} sampai ${max}`,
    invalidDate: (from: string, to: string) => `Masukkan tanggal dari ${from} sampai ${to}`,
    invalidMoney: (from: string, to: string) => `Masukkan jumlah bulat dari ${from} sampai ${to}`,
    invalidPercentage: (from: string, to: string) => `Masukkan persentase bulat dari ${from} sampai ${to}`,
    percent: "%",
    yes: "Ya",
    no: "Tidak",
    none: "tidak ada",

    footer: "Mengedit",
    changes: changeCount,
    invalidCount: (count: number) => `${count} tidak valid`,
    review: "Tinjau",
    reviewList: "Perubahan yang akan diterapkan",
    discard: "Buang",
    apply: "Terapkan",
    applying: "Menerapkan…",
    applyBlocked: "Perbaiki dulu nilai yang tidak valid",
    done: "Selesai",
    confirmDiscard: (count: number) => `Buang ${changeCount(count)}?`,
    keepEditing: "Lanjut mengedit",

    applied: (count: number) => `${changeCount(count)} diterapkan`,
    nothingToChange: "Tidak ada yang diubah: game sudah punya nilai-nilai ini.",
    refused: (label: string, reason: string) => `${label}: ${reason}`,
    rereadFailed: (reason: string) => `Tidak bisa membaca kembali nilainya: ${reason}`,
    dismiss: "Tutup",
  },

  changes: {
    nav: "Perubahan",
    title: "Perubahan sesi ini",
    hint: "Terbaru di atas. Perubahan hanya bisa diurungkan selama game masih menyimpan nilai yang ditulisnya.",
    continueHint: "Game menampilkan perubahan setelah waktu berjalan: tekan Lanjutkan di game.",
    swappedWith: (name: string) => `Ditukar dengan ${name}`,
    released: (name: string) => `${name} dilepas`,
    fee: (amount: string) => `Biaya ${amount}`,
    optionRemoved: (amount: string) => `Opsi beli (${amount}) dihapus`,
    healed: (count: number) => `${format(count)} cedera disembuhkan`,
    lifted: (count: number) => `${format(count)} larangan bermain dicabut`,
    keptPlaying: (date: string | null) => (date === null ? "Akan terus bermain" : `Pensiun pada ${date} dicegah`),
    count: (total: number, undone: number) => {
      const count = changeCount(total);
      return undone === 0 ? count : `${count} · ${undone} diurungkan`;
    },
    empty:
      "Belum ada perubahan. Buka pemain, staf, atau klub lalu pilih Edit, atau pakai Edit massal di sebuah daftar.",
    columns: {
      time: "Waktu",
      name: "Nama",
      field: "Kolom",
      change: "Perubahan",
      status: "Status",
    },
    kinds: { player: "Pemain", staff: "Staf", club: "Klub" },
    stored: (change: string) => `tersimpan ${change}`,
    undone: (time: string) => `Diurungkan pada ${time}`,
    undo: "Urungkan",
    undoTitle: (label: string) => `Tulis kembali nilai lama ${label} ke game`,
    batch: "Edit massal",
    batchCount: (total: number, remaining: number) =>
      remaining === 0
        ? `${changeCount(total)} · semua diurungkan`
        : `${changeCount(total)} · ${format(remaining)} belum diurungkan`,
    showChanges: "Tampilkan perubahan",
    hideChanges: "Sembunyikan perubahan",
    undoBatch: "Urungkan edit massal",
    undoBatchTitle: (remaining: number) =>
      `Tulis kembali nilai lama edit massal ini ke game (${format(remaining)} masih berlaku)`,

    pages: "Halaman daftar",
    batchPages: "Halaman perubahan edit massal ini",
    previous: "Sebelumnya",
    next: "Berikutnya",
    range: (first: number, last: number, total: number) =>
      `${format(first)}–${format(last)} dari ${format(total)}`,
  },

  export: {
    button: "Ekspor",
    buttonTitle: {
      player: "Tulis pemain yang ditampilkan daftar ke berkas CSV atau JSON, untuk spreadsheet atau skrip",
      staff: "Tulis staf yang ditampilkan daftar ke berkas CSV atau JSON, untuk spreadsheet atau skrip",
      club: "Tulis klub yang ditampilkan daftar ke berkas CSV atau JSON, untuk spreadsheet atau skrip",
    },
    title: { player: "Ekspor pemain", staff: "Ekspor staf", club: "Ekspor klub" },
    scope: (entity, count) =>
      count === 0
        ? `Tidak ada ${nouns[entity]} yang cocok dengan pencarian dan filter.`
        : `${entityCount(entity, count)}: yang dipilih pencarian dan filter daftar, dengan urutannya.`,
    formatLabel: "Format",
    formats: {
      csv: "CSV, dipisah koma",
      csvSemicolon: "CSV, dipisah titik koma",
      json: "JSON",
    },
    formatHints: {
      csv: "Untuk sebagian besar spreadsheet dan skrip",
      csvSemicolon:
        "Untuk Excel yang menulis desimal dengan koma: misalnya dalam bahasa Indonesia, Turki, Spanyol, atau Jerman",
      json: {
        player: "Untuk skrip: posisi, atribut, dan kepribadian sebagai objek tersendiri",
        staff: "Untuk skrip: atribut, kepribadian, dan kontrak sebagai objek tersendiri",
        club: "Untuk skrip: suporter, fasilitas, stadion, dan keuangan sebagai objek tersendiri",
      },
    },
    contents: {
      player:
        "Kemampuan, posisi dan rating posisi setiap pemain, atribut dalam skala 1–20 (termasuk yang tersembunyi), " +
        "kepribadian, reputasi, penampilan, dan kontrak beserta klausulnya, dengan tanggal dalam game. Uang dalam " +
        "pound, seperti yang disimpan game. Tidak ada yang berubah di game.",
      staff:
        "Jabatan dan klub setiap staf, kemampuan, atribut dalam skala 1–20, kepribadian, reputasi, dan kontrak " +
        "(gaji dan tanggal), dengan tanggal dalam game. Uang dalam pound, seperti yang disimpan game. Tidak ada yang " +
        "berubah di game.",
      club:
        "Reputasi setiap klub, tahun berdiri, tiket musiman, pengikut media sosial, komposisi dan sifat suporter, " +
        "fasilitas, stadion, dan keuangan: saldo, anggaran transfer, pengeluaran dan anggaran gaji mingguan, serta " +
        "harga tiket, dengan tanggal dalam game. FM hanya menyimpan keuangan klub di liga yang dimainkan. Uang dalam " +
        "pound, seperti yang disimpan game. Tidak ada yang berubah di game.",
    },
    export: "Ekspor",
    exporting: "Mengekspor…",
    done: (entity, count, file) => `${entityCount(entity, count)} diekspor ke ${file}`,
    folder: (folder) => `di ${folder}`,
    skipped: (entity, count) =>
      `${entityCount(entity, count)} berubah di game saat sedang dibaca, dan tidak disertakan.`,
    open: "Buka",
    openTitle: "Buka berkas dengan aplikasi yang biasa dipakai sistemmu",
    show: "Tampilkan di folder",
    showTitle: "Tampilkan berkas di foldernya",
    close: "Tutup",
  },

  massEdit: {
    button: "Edit massal",
    buttonTitle: "Ubah nilai semua yang ditampilkan daftar, dengan pratinjau lebih dulu",
    title: {
      player: "Edit massal pemain",
      staff: "Edit massal staf",
      club: "Edit massal klub",
    },

    scope: (entity: Entity, total: number) =>
      `${entityCount(entity, total)} yang ditampilkan daftar sekarang (pencarian dan filter)`,
    scopeAll: (shown: number) => `Itu semua yang cocok, bukan hanya ${format(shown)} baris pertama di layar.`,
    scopeNone: (entity: Entity) =>
      `Tidak ada ${nouns[entity]} yang cocok dengan pencarian dan filter, jadi tidak ada yang bisa diubah.`,
    scopeTooMany: (entity: Entity, total: number, limit: number) =>
      `${entityCount(entity, total)} yang ditampilkan daftar melebihi batas satu edit massal (${format(limit)}). ` +
      "Persempit dulu pencarian atau filternya.",
    loadingFields: "Membaca kolom…",
    fieldsFailed: (reason: string) => `Kolom tidak bisa dibaca: ${reason}`,

    groups: {
      ability: "Kemampuan",
      technical: "Atribut teknik",
      mental: "Atribut mental",
      physical: "Atribut fisik",
      goalkeeping: "Atribut kiper",
      hidden: "Atribut tersembunyi",
      feet: "Kaki",
      coaching: "Atribut kepelatihan",
      knowledge: "Atribut pengetahuan",
      medical: "Atribut medis",
      positions: "Posisi",
      personality: "Kepribadian",
      reputation: "Reputasi",
      international: "Internasional",
      contract: "Kontrak",
      facilities: "Fasilitas",
      finances: "Keuangan",
      stadium: "Stadion",
      traits: "Sifat",
      health: "Medis",
      other: "Lainnya",
    },
    fieldsLabel: "Kolom yang diubah",
    row: (position: number) => `Perubahan ${position}`,
    field: "Kolom",
    operation: "Operasi",
    operations: { set: "Atur ke", add: "Tambah", scale: "Skala ke %" },
    values: { set: "Nilai", add: "Jumlah", scale: "Persen" },
    addTitle: "Ditambahkan ke setiap nilai seperti yang ditampilkan; angka negatif mengurangi",
    addPointsTitle: "Poin persentase yang ditambahkan ke setiap nilai (70% tambah 10 jadi 80%); angka negatif mengurangi",
    rangeHint: (min: number, max: number) => `${format(min)}–${format(max)}`,
    amountHint: (max: number) => `±${format(max)}`,
    ofCurrent: "% dari nilai sekarang",
    percentTitle: "Persentase dari nilai sekarang: 100 mempertahankannya, 110 menaikkannya sepersepuluh, 50 membaginya dua",
    invalidAdd: (min: number, max: number) => `Masukkan bilangan bulat dari ${format(min)} sampai ${format(max)}`,
    invalidPercent: (min: number, max: number) => `Masukkan persen bulat dari ${min} sampai ${max}`,
    dateSetOnly: "Tanggal hanya bisa diatur",
    addField: "Tambah kolom",
    addFieldFull: (max: number) => `Satu edit massal mengubah paling banyak ${max} kolom`,
    remove: "Hapus kolom ini",
    removeLast: "Edit massal butuh setidaknya satu kolom",

    preview: "Pratinjau",
    previewing: "Membuat pratinjau…",
    previewBlocked: "Isi setiap kolom dengan nilai yang valid untuk melihat pratinjau",
    summary: (entity: Entity, preview: MassPreview) =>
      [
        preview.changes === 0
          ? "Tidak ada perubahan"
          : `${changeCount(preview.changes)} untuk ${format(preview.targets - preview.unchanged)} dari ` +
            entityCount(entity, preview.targets),
        preview.unchanged > 0 && `${format(preview.unchanged)} sudah punya nilai-nilai ini`,
        preview.skippedCount > 0 && valuesLeftAlone(preview.skippedCount),
      ]
        .filter(Boolean)
        .join(" · "),
    tableLabel: "Perubahan yang akan dibuat edit massal",
    columns: { name: "Nama", field: "Kolom", change: "Perubahan", reason: "Alasan" },
    more: (count: number) => `dan ${format(count)} lainnya`,
    skippedHeading: valuesLeftAlone,
    skippedLabel: "Nilai yang dibiarkan edit massal",

    apply: "Terapkan",
    applying: "Menerapkan…",
    applyTitle: (changes: number) => `Tulis ${changeCount(changes)} ke game`,
    applyFirst: "Buat pratinjau edit massal lebih dulu",
    applyNothing: "Pratinjau tidak berisi perubahan untuk ditulis",
    hint: "Tidak ada yang berubah di game sampai kamu menerapkannya.",
    applied: (count: number) => (count === 0 ? "Tidak ada perubahan yang ditulis" : `${changeCount(count)} diterapkan`),
    failure: (name: string, label: string, reason: string) => `${name} · ${label}: ${reason}`,
    undo: "Urungkan edit massal ini",
    undoing: "Mengurungkan…",
    undoTitle: "Tulis kembali nilai lama edit massal ini ke game",
    undone: (count: number) => (count === 0 ? "Tidak ada yang diurungkan" : `${changeCount(count)} diurungkan`),
    undoFailure: (who: string, reason: string) => `${who}: ${reason}`,
    changeNumber: (id: number) => `Perubahan ${id}`,
    close: "Tutup",
  },

  comparison: {
    compare: "Bandingkan",
    add: "Tambahkan ke perbandingan",
    remove: "Hapus dari perbandingan",
    full: (max: number) => `Perbandingan menampung paling banyak ${max} pemain. Hapus satu untuk menambahkan pemain ini.`,

    trayLabel: "Pemain yang dibandingkan",
    removePlayer: (name: string) => `Hapus dari perbandingan: ${name}`,
    clear: "Hapus",
    open: (count: number) => `Bandingkan (${count})`,

    title: "Perbandingan",
    hint: "Nilai terbaik di setiap baris disorot: yang tertinggi, atau yang terendah jika makin rendah makin baik.",
    tooFew: "Tambahkan setidaknya dua pemain untuk membandingkannya.",
    loading: "Memuat pemain…",
    tableLabel: "Nilai pemain yang dibandingkan",
    highest: "tertinggi",
    lowest: "terendah",
    profile: "Profil",
    close: "Tutup",
  },

  move: {
    button: "Transfer",
    buttonTitle: "Transfer pemain ini ke klub lain di game, dengan biaya jika kamu mau",

    title: "Transfer",
    from: "Dari",
    to: "Ke",

    modeLabel: "Transfer atau tukar",
    modeMove: "Transfer ke klub",
    modeSwap: "Tukar dengan pemain",

    searchLabel: "Cari klub tujuan transfer",
    resultsLabel: "Klub yang ditemukan",
    searching: "Mencari klub…",
    searchFailed: (reason: string) => `Klub tidak bisa dicari: ${reason}`,
    more: (count: number) => `dan ${format(count)} lainnya; ketik untuk mempersempit pencarian`,
    change: "Pilih klub lain",

    feeHeading: "Biaya",
    fee: "Biaya transfer",
    feeHint: "Kosongkan untuk transfer bebas biaya",
    feeInvalid: (max: string) => `Masukkan jumlah bulat, dari 0 sampai ${max}`,
    pays: (club: string, fee: string, balance: string, budget: string | null) =>
      `${club} membayar ${fee}: saldo ${balance}${budget === null ? "" : `, anggaran transfer ${budget}`}`,
    receives: (club: string, fee: string, balance: string) => `${club} menerima ${fee}: saldo ${balance}`,
    noFinances: (club: string) => `${club} tidak punya data keuangan di game: uangnya tetap seperti sekarang`,

    wageInvalid: "Masukkan jumlah bulat, 0 atau lebih",
    expiresInvalid: "Masukkan tanggal",

    chooseClub: "Pilih klub tujuan transfer pemain.",
    fixTerms: "Perbaiki dulu biaya atau nilai kontraknya.",
    checking: "Memeriksa transfer…",
    route: (from: string, to: string) => `${from} → ${to}`,
    doesHeading: "Yang dilakukan transfer",
    does: [
      "Bergabung dengan tim senior klub baru",
      "Kontrak bertanggal sejak tanggal game; nomor punggung dikosongkan",
      "Keluar dari daftar transfer dan daftar pinjaman",
      "Gaji dan akhir kontrak hanya berubah jika kamu mengatur yang baru",
      "Biaya diambil dari saldo dan anggaran transfer klub pembeli, dan masuk ke saldo klub penjual",
      "Jabatan kapten di klub lama dikosongkan",
      "Riwayat transfer game belum mencantumkannya",
      "Tercantum di Perubahan, tempat satu kali urungkan membatalkan transfer dan biayanya",
    ],

    noRoom: (club: string) => `${club} tidak punya tempat di skuadnya.`,
    noRoomInfoLabel: "Kenapa?",
    noRoomInfo:
      "Editor memperbesar daftar skuad yang penuh jika bisa, tetapi yang ini tidak bisa diperbesar: harus ada pemain " +
      "yang pergi untuk memberi tempat.",
    noRoomNeed: (player: string, club: string) => `Agar ${player} bisa bergabung, satu pemain harus meninggalkan ${club}.`,
    releaseChoice: "Lepas:",
    releasePickLabel: "Pemain yang dilepas",
    releaseOutcome: "→ menjadi agen bebas",
    injuredTag: "cedera",
    captainTag: "kapten",
    swapChoice: "Jadikan pertukaran:",
    swapChoiceOutcome: (club: string) => `pemain ini pergi ke ${club}`,
    moveAndRelease: (name: string) => `Transfer dan lepas ${name}`,
    makeRoomDoes: [
      "Bergabung dengan tim senior klub baru, menggantikan pemain yang dilepas",
      "Pemain yang dilepas meninggalkan setiap tim klub itu, dan kontraknya berakhir: menjadi agen bebas",
      "Kontrak bertanggal sejak tanggal game; nomor punggung dikosongkan",
      "Keluar dari daftar transfer dan daftar pinjaman",
      "Gaji dan akhir kontrak hanya berubah jika kamu mengatur yang baru",
      "Biaya diambil dari saldo dan anggaran transfer klub pembeli, dan masuk ke saldo klub penjual",
      "Jabatan kapten yang dipegang salah satu dari mereka di klub yang ditinggalkan dikosongkan",
      "Riwayat transfer game belum mencantumkannya",
      "Tercantum di Perubahan sebagai satu perubahan, tempat satu kali urungkan membatalkan transfer, pelepasan, dan biayanya",
    ],

    swapTitle: "Tukar dengan pemain",
    swapWith: "Tukar dengan",
    playerSearchLabel: "Cari pemain untuk ditukar",
    playerSearch: "Cari pemain klub ini berdasarkan nama",
    playersLabel: "Pemain yang ditemukan",
    playersSearching: "Mencari pemain…",
    playersSearchFailed: (reason: string) => `Pemain tidak bisa dicari: ${reason}`,
    playersEmpty: (query: string) =>
      query === "" ? "Klub ini tidak punya pemain." : `Tidak ada pemain klub ini yang cocok dengan “${query}”.`,
    changePlayer: "Pilih pemain lain",

    swapContract: "Setiap pemain mempertahankan kontraknya sendiri; gaji dan akhir kontrak tidak berubah.",
    staffButtonTitle: "Pindahkan staf ini ke klub lain di game",
    staffChooseClub: "Pilih klub tujuan staf ini.",
    staffContract:
      "Mempertahankan pekerjaan, gaji, dan akhir kontrak; kontrak bertanggal sejak tanggal game.",
    staffJob: "Pekerjaan",
    staffJobChoose: "Pilih pekerjaan…",
    staffJobKept: (job: string) => `${job} (tetap)`,
    staffNewJob:
      "Mengambil pekerjaan baru, dan mempertahankan gaji dan akhir kontrak; kontrak bertanggal sejak tanggal game.",
    staffDoes: [
      "Bergabung dengan klub baru di tempat pekerjaannya berada: departemen medis, kepelatihan, atau pemanduan bakat, " +
        "atau sebagai direktur sepak bola atau manajer, yang tidak diterima klub yang sudah memilikinya",
      "Gaji dan akhir kontrak sama; kontrak bertanggal sejak tanggal game",
      "Manajer yang meninggalkan tim mengosongkan posisinya, untuk diisi klub; urusan dewan diserahkan ke game",
      "Tercantum di Perubahan, tempat ini bisa diurungkan",
    ],
    staffSignButtonTitle: "Rekrut staf tanpa klub ini untuk sebuah klub di game",
    staffSignTitle: "Rekrut staf",
    staffSignChooseClub: "Pilih klub yang merekrutnya.",
    staffSignChooseJob: "Pilih pekerjaan yang akan diambilnya di klub.",
    staffSignTerms:
      "Kosongkan untuk memakai gaji staf klub yang pekerjaannya paling mirip, dan kontrak sampai akhir musim depan.",
    staffSignRoute: (to: string) => `Tanpa klub → ${to}`,
    staffSignContract: (wage: string, expires: string) => `Kontrak baru: ${wage} per minggu sampai ${expires}`,
    staffSignDoes: [
      "Bergabung dengan klub di tempat pekerjaannya berada: departemennya, diperbesar jika penuh, atau sebagai " +
        "direktur sepak bola atau manajer, jika klub belum punya",
      "Kontrak baru sejak tanggal game, di salah satu slot kontrak kosong milik game, seperti game membuatnya",
      "Mencontoh kontrak staf klub dengan pekerjaan yang sama (atau di departemen yang sama, atau siapa pun) yang " +
        "kemampuannya paling dekat",
      "Gaji dan akhir kontrak darimu, atau gaji kontrak itu dan akhir musim depan; tanpa klausul atau bonus",
      "Tercantum di Perubahan, tempat satu kali urungkan membatalkan semuanya",
    ],
    swapChooseClub: "Pilih klub pemain yang akan ditukar.",
    swapChoosePlayer: "Pilih pemain yang akan ditukar.",
    swapChecking: "Memeriksa pertukaran…",
    swapRoute: (player: string, from: string, to: string, other: string) =>
      `${player}: ${from} → ${to}\n${other}: ${to} → ${from}`,
    swapDoesHeading: "Yang dilakukan pertukaran",
    swapDoes: [
      "Masing-masing bergabung dengan tim senior klub pemain lainnya",
      "Kontrak bertanggal sejak tanggal game; nomor punggung dikosongkan",
      "Keduanya keluar dari daftar transfer dan daftar pinjaman",
      "Jabatan kapten di klub lama mereka dikosongkan",
      "Tidak ada biaya yang dibayar; riwayat karier tidak diperbarui",
      "Tercantum di Perubahan sebagai satu perubahan, yang mengurungkan kedua perpindahan",
    ],

    signButtonTitle: "Rekrut agen bebas ini untuk sebuah klub di game",
    signTitle: "Rekrut agen bebas",
    signChooseClub: "Pilih klub yang merekrut pemain.",
    signChecking: "Memeriksa perekrutan…",
    signTerms:
      "Kosongkan untuk memakai gaji pemain klub yang kemampuannya paling dekat, dan kontrak sampai akhir musim depan.",
    signRoute: (to: string) => `Agen bebas → ${to}`,
    signContract: (wage: string, expires: string, status: string) =>
      `Kontrak baru: ${wage} per minggu sampai ${expires}, ${status}`,
    signDoesHeading: "Yang dilakukan perekrutan",
    signDoes: [
      "Bergabung dengan tim senior klub; daftar skuad yang penuh diperbesar",
      "Kontrak baru sejak tanggal game, di salah satu slot kontrak kosong milik game, seperti game membuatnya",
      "Mencontoh kontrak pemain klub yang kemampuannya paling dekat: jenis kontrak dan status skuad yang sama",
      "Gaji dan akhir kontrak darimu, atau gaji pemain itu dan akhir musim depan",
      "Tanpa nomor punggung, bonus loyalitas, klausul, atau bonus",
      "Riwayat transfer game belum mencantumkannya",
      "Tercantum di Perubahan, tempat satu kali urungkan membatalkan semuanya",
    ],
    signHint: "Tidak ada yang berubah di game sampai kamu menekan Rekrut.",
    sign: "Rekrut",
    signing: "Merekrut…",

    hint: "Tidak ada yang berubah di game sampai kamu menekan Transfer.",
    move: "Transfer",
    moving: "Mentransfer…",
    cancel: "Batal",
    swapHint: "Tidak ada yang berubah di game sampai kamu menekan Tukar.",
    swap: "Tukar",
    swapping: "Menukar…",
  },

  ties: {
    heading: "Kewarganegaraan dan pemain binaan",
    nationalities: "Kewarganegaraan sekunder",
    trainedInNation: "Dilatih di negara",
    trainedAtClub: "Dilatih di klub",
    workPermit: "Tanpa izin kerja di",
    none: "Tidak ada",
    rules: {
      1: "Binaan 15-21",
      2: "Binaan 0-21",
      5: "Binaan 15-21 (tidak termasuk pinjaman)",
      10: "Binaan 0-19 (1 tahun)",
    } as Readonly<Record<number, string>>,
    rule: (code: number) => `Aturan pemain binaan ${format(code)}`,

    change: "Ubah",
    changeTitle: "Ubah kewarganegaraan sekunder dan status binaan pemain ini di game",
    title: "Kewarganegaraan dan pemain binaan",
    hint: "Setiap perubahan langsung ditulis ke game, dan tercantum di Perubahan, tempat ini bisa diurungkan.",
    full:
      "Game membuat daftar pemain ini pas untuk isinya saja: kewarganegaraan atau tempat latihan bisa diubah atau " +
      "dihapus, tetapi tidak bisa ditambah.",
    nationOf: (name: string) => `Negara pengganti ${name}`,
    ruleOf: (name: string) => `Aturan pemain binaan untuk ${name}`,
    remove: "Hapus",
    removeTitle: (name: string) => `Hapus ${name}`,
    addNationality: "Tambah kewarganegaraan…",
    addNation: "Tambah negara…",
    addPermit: "Tambah negara tanpa izin kerja…",
    daysLeft: (days: number) => `sisa ${format(days)} hari`,
    permitInfoLabel: "Apa fungsinya?",
    permitInfo:
      "Game mengizinkan pemain Uni Eropa yang sudah berada di Inggris atau Skotlandia sebelum Brexit bermain di sana " +
      "tanpa izin kerja, selama sejumlah hari. Pemain yang diberi ini juga tidak butuh izin kerja untuk bermain di " +
      "negara itu, selama sisa hari mereka (sepuluh tahun jika tidak ada yang memilikinya di save ini).",
    newRule: "Aturan pemain binaan untuk negara baru",
    add: "Tambah",
    changeClub: "Ganti klub",
    changeClubTitle: (name: string) => `Jadikan dia dilatih di klub lain sebagai ganti ${name}`,
    clubInsteadOf: (name: string) => `Klub pengganti ${name}`,
    addClub: "Tambah klub…",
    addClubTitle: "Jadikan dia dilatih di satu klub lagi",
    newClub: "Klub baru",
    pickAnother: "Pilih yang lain",
    newClubRule: "Aturan pemain binaan untuk klub baru",
    cancel: "Batal",
    working: "Menulis ke game…",
    close: "Tutup",
  },

  clauses: {
    change: "Ubah",
    changeTitle: "Ubah bonus dan klausul pemain ini di game",
    title: "Bonus dan klausul",
    hint: "Setiap perubahan langsung ditulis ke game, dan tercantum di Perubahan, tempat ini bisa diurungkan.",
    full:
      "Game membuat daftar kontrak ini pas untuk isinya saja: bonus atau klausul bisa diubah atau dihapus, tetapi " +
      "klausul pelepasan tidak bisa ditambah.",
    amountOf: (name: string) => `Jumlah ${name}`,
    conditionOf: (name: string) => `Syarat ${name}`,
    save: "Simpan",
    remove: "Hapus",
    removeTitle: (name: string) => `Hapus ${name}`,
    addRelease: "Tambah klausul pelepasan",
    releaseAmount: "Jumlah klausul pelepasan baru",
    add: "Tambah",
    outOfRange: (max: string) => `Masukkan bilangan bulat dari 0 sampai ${max}.`,
    working: "Menulis ke game…",
    close: "Tutup",
  },

  release: {
    button: "Lepas",
    buttonTitle: "Lepas pemain ini dari klubnya di game: dia menjadi agen bebas",

    title: "Lepas",
    from: "Meninggalkan",
    checking: "Memeriksa pelepasan…",
    ready: (club: string) => `${club} → agen bebas`,
    doesHeading: "Yang dilakukan pelepasan",
    does: [
      "Meninggalkan setiap tim klub, dan kontraknya berakhir: agen bebas yang bisa direkrut klub mana pun",
      "Tidak ada yang dibayar apa pun",
      "Jabatan kapten di klub dikosongkan",
      "Riwayat transfer game tidak mencantumkannya",
      "Tercantum di Perubahan, tempat satu kali urungkan mengembalikan pemain dengan kontrak yang sama",
    ],

    hint: "Tidak ada yang berubah di game sampai kamu menekan Lepas.",
    release: "Lepas",
    releasing: "Melepas…",
    cancel: "Batal",
  },

  permanent: {
    title: "Permanenkan pinjaman",
    stays: "Tetap di",
    leaves: "Meninggalkan",
    checking: "Memeriksa…",
    doesHeading: "Yang dilakukan",
    does: [
      "Dia tetap di tempatnya bermain, kini dengan kontrak di klub itu sejak hari ini, dengan ketentuan di atas",
      "Dia mempertahankan nomor punggung dan status skuadnya di sana",
      "Dia meninggalkan setiap tim klubnya sendiri, dan pinjamannya berakhir",
      "Riwayat transfer game tidak mencantumkannya",
      "Tercantum di Perubahan sebagai transfer, tempat satu kali urungkan mengembalikan pinjamannya",
    ],
    optionFee: (money: string) => `Diisi dari opsi beli pinjaman: ${money}`,
    hint: "Tidak ada yang berubah di game sampai kamu menekan Permanenkan.",
    confirm: "Permanenkan",
    confirming: "Mempermanenkan…",
    cancel: "Batal",
  },

  recall: {
    title: "Tarik dari pinjaman",
    from: "Dipinjamkan ke",
    to: "Kembali ke",
    doesHeading: "Yang dilakukan penarikan",
    does: (parent: string) => [
      "Hari ini menjadi hari terakhir pinjaman: setelah hari berakhir, game sendiri yang mengakhiri pinjamannya",
      `Lanjutkan satu hari di game dan dia kembali ke ${parent}`,
      "Sampai saat itu ini tercantum di Perubahan, tempat urungkan mengembalikan akhir pinjaman yang lama",
    ],
    termsHeading: "Di game",
    notRecallable: (parent: string) => `Pinjaman ini tidak mengizinkan ${parent} menariknya kembali`,
    notTerminable: "Pinjaman ini tidak bisa diakhiri lebih awal",
    worksAnyway:
      "Penarikan di sini tetap berfungsi: tidak lewat penarikan game, melainkan memindahkan hari terakhir pinjaman",
    dropsOption: (club: string, amount: string) =>
      `Opsi beli ${club} untuknya seharga ${amount} dihapus: kalau tidak, saat pinjaman berakhir game bisa menjualnya ke ${club}`,
    hint: "Tidak ada yang berubah di game sampai kamu menekan Tarik.",
    confirm: "Tarik",
    confirming: "Menarik…",
    cancel: "Batal",
  },

  squad: {
    teamsLabel: "Tim",
    teams: {
      first: "Tim utama",
      b: "Tim B",
      age: (limit: number) => `U${limit}`,
      other: (place: number) => `Tim ${place}`,
    },
    noTeams: "Klub ini tidak punya tim.",
    loading: "Membaca skuad…",
    empty: "Tidak ada pemain di tim ini.",

    players: (count: number) => `${format(count)} pemain`,
    averageAge: (age: string) => `rata-rata usia ${age}`,
    captains: (captain: string, viceCaptain: string) => `Kapten: ${captain} · Wakil kapten: ${viceCaptain}`,

    actionsLabel: "Tindakan untuk seluruh tim",
    healAll: (injured: number) => (injured === 0 ? "Sembuhkan semua" : `Sembuhkan semua (${format(injured)} cedera)`),
    healAllTitle: "Sembuhkan setiap cedera setiap pemain di tim ini",
    healNone: "Tidak ada yang cedera di tim ini",
    liftAll: (banned: number) =>
      banned === 0 ? "Cabut larangan" : `Cabut larangan (${format(banned)} dilarang bermain)`,
    liftAllTitle: "Cabut setiap larangan bermain setiap pemain di tim ini",
    liftNone: "Tidak ada yang dilarang bermain di tim ini",
    inspireAll: "Inspirasi semua",
    inspireAllTitle:
      "Atur moral setiap pemain di tim ini ke 20, yang tertinggi, dan hapus alasan mereka untuk tidak senang",
    maxCohesion: "Kekompakan maksimal",
    maxCohesionTitle:
      "Atur kekompakan dengan klub setiap pemain di tim ini ke 100, yang tertinggi. Game menampilkan kekompakan tim di halaman Dinamika setelah waktu berjalan: tekan Lanjutkan di game",
    cohesionNone:
      "Editor tidak dapat membaca kekompakan tim ini: versi game ini belum diperiksa untuk itu, atau tidak ada pemainnya yang memiliki kekompakan dengan klub",
    cohesionWithout: (count: number) => `${format(count)} pemain belum memiliki kekompakan dengan klub`,
    refreshAll: "Segarkan semua",
    refreshAllTitle:
      "Atur energi dan ketajaman bertanding setiap pemain di tim ini ke 100%, dan istirahatkan sepenuhnya (keletihan -500)",
    maxAll: "Maksimalkan atribut",
    maxAllTitle:
      "Atur setiap atribut setiap pemain di tim ini ke nilai terbaiknya: 20, dan 1 untuk kerentanan cedera dan kekasaran",
    hint: "Tindakan ini mencakup setiap pemain di daftar, termasuk yang sedang dipinjamkan. Urungkan juga ada di tampilan Perubahan.",

    freezeLabel: "Bekukan seluruh tim",
    freezeAttributes: "Bekukan atribut",
    freezeAttributesTitle:
      "Selama aplikasi terbuka dan terhubung, atribut setiap pemain di tim ini tidak menurun: yang diambil game " +
      "dikembalikan, dan peningkatan tetap dihitung",
    freezeFitness: "Bekukan energi dan ketajaman",
    freezeFitnessTitle:
      "Selama aplikasi terbuka dan terhubung, energi dan ketajaman bertanding setiap pemain di tim ini tidak turun: " +
      "yang diambil game dikembalikan. Segarkan semua lebih dulu agar tetap di 100%",
    freezePositions: "Bekukan posisi",
    freezePositionsTitle:
      "Selama aplikasi terbuka dan terhubung, rating posisi setiap pemain di tim ini tetap seperti sekarang: " +
      "rating yang dinaikkan atau diturunkan game dikembalikan",
    frozenCount: (frozen: number, total: number) => `${format(frozen)} dari ${format(total)}`,
    freezeHint:
      "Pembekuan mencakup setiap pemain di daftar dan ikut dengan masing-masing ke mana pun dia pergi. Aplikasi " +
      "mengingatnya untuk save ini.",
    frozeAttributes: (count: number) =>
      count === 0 ? "Atribut mereka sudah dibekukan" : `Atribut ${playerCount(count)} dibekukan`,
    unfrozeAttributes: (count: number) => `Pembekuan atribut ${playerCount(count)} dilepas`,
    frozeFitness: (count: number) =>
      count === 0
        ? "Energi dan ketajaman mereka sudah dibekukan"
        : `Energi dan ketajaman ${playerCount(count)} dibekukan`,
    unfrozeFitness: (count: number) => `Pembekuan energi dan ketajaman ${playerCount(count)} dilepas`,
    frozePositions: (count: number) =>
      count === 0 ? "Posisi mereka sudah dibekukan" : `Posisi ${playerCount(count)} dibekukan`,
    unfrozePositions: (count: number) => `Pembekuan posisi ${playerCount(count)} dilepas`,

    written: (count: number) => `${changeCount(count)} ditulis`,
    refused: (name: string, reason: string) => `${name}: ${reason}`,
    undo: "Urungkan",
    undoTitle: "Tulis kembali nilai lama perubahan ini ke game",

    captainShort: "K",
    viceCaptainShort: "WK",
    menuLabel: (name: string) => `Kapten: ${name}`,
    menuTitle: "Kapten",
    makeCaptain: "Jadikan kapten",
    makeViceCaptain: "Jadikan wakil kapten",
    nowCaptain: (name: string) => `${name} sekarang kapten`,
    nowViceCaptain: (name: string) => `${name} sekarang wakil kapten`,
    noCaptain: "Sekarang tidak ada kapten",
    noViceCaptain: "Sekarang tidak ada wakil kapten",

    tableLabel: (team: string) => `Pemain ${team}`,
    openProfile: "Buka profil pemain",
    columns: {
      name: "Nama",
      position: "Pos",
      age: "Usia",
      currentAbility: "CA",
      potentialAbility: "PA",
      condition: "Energi",
      matchSharpness: "Ketajaman",
      jadedness: "Letih",
      morale: "Moral",
      cohesion: "Kekompakan",
      actions: "Kapten",
    },
    sortBy: (by: string) => `Urutkan berdasarkan ${by}`,
    sortNames: {
      name: "nama",
      position: "posisi",
      age: "usia",
      currentAbility: "kemampuan saat ini",
      potentialAbility: "kemampuan potensial",
      condition: "energi",
      matchSharpness: "ketajaman bertanding",
      jadedness: "keletihan",
      morale: "moral",
      cohesion: "kekompakan",
    },

    injured: "Cedera",
    injuredTitle: (count: number) => `${format(count)} cedera`,
    banned: "Dilarang",
    bannedTitle: (count: number) => `${format(count)} larangan bermain`,
    onLoan: "Dipinjamkan",
    onLoanTitle: "Sedang dipinjamkan ke klub lain",
    loanee: "Pemain pinjaman",
    loaneeTitle: "Di sini sebagai pinjaman dari klub lain",
    elsewhere: "Di tim lain",
    elsewhereTitle: "Bermain untuk tim lain di klub ini",
    frozen: "Dibekukan",
    frozenTitle: (attributes: boolean, fitness: boolean, positions: boolean): string => {
      const frozen = [
        ...(attributes ? ["atribut"] : []),
        ...(fitness ? ["energi", "ketajaman bertanding"] : []),
        ...(positions ? ["posisi"] : []),
      ];
      const last = frozen.pop() ?? "";
      const listed = frozen.length > 0 ? `${frozen.join(", ")} dan ${last}` : last;
      return `${listed.charAt(0).toUpperCase()}${listed.slice(1)}-nya dibekukan`;
    },
  },

  game: {
    name: "Football Manager",
    storefronts: {
      gamePass: "Game Pass",
      steam: "Steam",
      epic: "Epic Games",
      unknown: "Toko tak dikenal",
    },
    steamBuild: (id: string) => `build ${id}`,
  },

  scouting: {
    nav: "Pemanduan Bakat",
    reading: "Membaca klubmu…",
    refresh: "Segarkan",
    refreshTitle: "Baca lagi klub dari game",
    searching: "Mencari…",
    none: "—",
    perWeek: "/mgg",
    openProfile: "Buka profil",
    freeAgent: "Agen bebas",
    loan: "Pinjaman",
    header: {
      transferBudget: "Anggaran transfer",
      wageRoom: "Sisa ruang gaji",
      wageBudget: "Anggaran gaji",
      squad: "Skuad",
      averageAge: "Rata-rata usia",
      players: (count: number) => `${format(count)} pemain`,
    },
    tabs: {
      label: "Bagian pemanduan bakat",
      recommend: "Saran transfer",
      depth: "Kedalaman skuad",
      departures: "Pemain yang dilepas",
    },
    status: {
      missing: "Kosong",
      thin: "Tipis",
      fine: "Cukup",
      crowded: "Berlebih",
    },
    lines: {
      goalkeeper: "Kiper",
      centreBack: "Bek tengah",
      fullBack: "Bek sayap",
      wingBack: "Pemain sayap belakang",
      defensiveMidfield: "Gelandang bertahan",
      centralMidfield: "Gelandang tengah",
      attackingMidfield: "Gelandang serang",
      wide: "Sayap",
      striker: "Striker",
    },
    depthLines: {
      gk: "Kiper",
      dc: "Bek tengah",
      rightBack: "Bek kanan",
      leftBack: "Bek kiri",
      dm: "Gelandang bertahan",
      mc: "Gelandang tengah",
      rightWing: "Pemain sayap kanan",
      leftWing: "Pemain sayap kiri",
      amc: "Gelandang serang",
      st: "Striker",
    } as Record<string, string>,
    positionTip: (line: string, count: number, target: number, status: string) =>
      `${line}: ${format(count)} di skuad (biasanya ${format(target)}) — ${status}`,
    brief: {
      heading: "Apa yang kamu cari?",
      pitch: "Posisi",
      legend: "Titik-titik menunjukkan keadaan skuad di setiap lini.",
      inPossession: "Saat menguasai bola",
      outOfPossession: "Saat tidak menguasai bola",
      anyRole: "Apa pun — peran terbaik untuk tiap pemain",
      purpose: "Untuk",
      filters: "Filter",
      minAge: "Usia min.",
      maxAge: "Usia maks.",
      maxFee: "Biaya maks.",
      minProbability: "Peluang",
      anyProbability: "Apa pun",
      noFreeAgents: "Tanpa agen bebas",
    },
    purposes: {
      firstTeam: "Tim utama",
      rotation: "Rotasi",
      future: "Masa depan",
      any: "Semua",
    },
    purposeTips: {
      firstTeam: "Lebih baik dari pemain terbaikmu di posisi ini",
      rotation: "Sebagus pilihan keduamu, dengan harga yang masuk akal",
      future: "21 tahun atau lebih muda, dengan ruang untuk berkembang",
      any: "Semua yang cocok",
    },
    ask: {
      before: "Saran untuk ",
      after: "",
      anyRole: "peran terbaik per pemain",
    },
    own: {
      heading: "Di skuadmu",
      empty: "Tidak ada pemain di skuadmu yang bermain di sini.",
      position: "Posisi",
    },
    summary: (candidates: number, eligible: number, shown: number, purpose: string) =>
      `${format(candidates)} pemain bisa bermain di sini · ${format(eligible)} cocok untuk ${purpose} · ${format(shown)} direkomendasikan`,
    how: {
      label: "Bagaimana daftar ini dibuat?",
      note: (rule: string, count: string) =>
        `Pemandu bakat melihat setiap pemain yang bisa bermain di posisi ini (rating 10 atau lebih di sana), kecuali pemain klubmu sendiri dan pemain manajer manusia lain. Dari mereka dia menyimpan pemain yang ${rule}. Untuk 400 pemain yang paling cocok dia menghitung seberapa besar peluang masing-masing bergabung denganmu, lalu merekomendasikan ${count} terbaik berdasarkan kecocokan dan peluang sekaligus. Urutan rekomendasi: 70% kecocokan dan 30% peluang, sedikit kurang untuk pemain di atas 30 tahun; Rotasi menimbang keduanya sama rata dan Masa depan ikut menghitung potensi. Klik judul kolom untuk mengurutkan daftar; # adalah urutan pemandu bakat sendiri.`,
    },
    purposeRules: {
      firstTeam: "lebih cocok di posisi ini daripada pemain terbaikmu di sana",
      rotation: "setidaknya sama cocoknya dengan pilihan keduamu",
      future: "berusia 21 tahun atau lebih muda dengan ruang untuk berkembang (potensi setidaknya 15 di atas kemampuan)",
      any: "cocok sama sekali",
    },
    sortBy: (by: string) => `Urutkan berdasarkan ${by}`,
    sortNames: {
      rank: "urutan pemandu bakat",
      name: "nama",
      age: "usia",
      ca: "kemampuan saat ini",
      pa: "kemampuan potensial",
      fit: "kecocokan",
      probability: "peluang",
      fee: "biaya",
    },
    backToScoutOrder: "Kembali ke urutan pemandu bakat",
    showMore: (count: number) => `Tampilkan ${format(count)} lagi`,
    playsFor: (club: string) => `bermain untuk ${club}`,
    empty: "Tidak ada saran untuk posisi ini dengan pengaturan ini. Coba tujuan Semua atau filter yang lebih longgar.",
    columns: {
      rank: "#",
      ca: "CA",
      pa: "PA",
      player: "Pemain",
      age: "Usia",
      fit: "Cocok",
      role: "Peran",
      probability: "Peluang",
      fee: "Perk. biaya",
      wage: "Gaji",
      note: "Catatan pemandu",
      money: "Biaya",
      value: "Nilai",
    },
    probabilityInfo:
      "Seberapa besar peluang pemain bergabung dengan klubmu — perkiraan dari nilai, kontrak, klub, dan reputasinya.",
    probabilityInfoLabel: "Apa itu peluang?",
    fitTitle: (inPossession: string | null, outOfPossession: string | null, position: string) =>
      [
        inPossession !== null && `Saat menguasai bola: ${inPossession}`,
        outOfPossession !== null && `Saat tidak menguasai bola: ${outOfPossession}`,
        `Posisi: ${position}`,
      ]
        .filter(Boolean)
        .join("\n"),
    note: "Kecocokan memakai bobot atribut milik editor sendiri untuk setiap peran; biaya, gaji, dan peluang adalah perkiraan.",
    depth: {
      summary: (size: number, age: string | null, level: string) =>
        `${format(size)} pemain${age === null ? "" : ` · rata-rata usia ${age}`} · rata-rata kemampuan XI terbaik ${level}`,
      weak: "Di bawah level skuad",
      ageing: "Menua",
      cover: (names: string) => `Juga bisa bermain di sini: ${names}`,
      advice: "Minta saran",
      adviceTitle: "Saran transfer untuk lini ini",
      empty: "Tidak ada",
      ability: "Kemampuan saat ini",
      more: (count: number) => `+${format(count)} lagi`,
      columns: {
        line: "Lini",
        status: "Status",
        count: "Pemain",
        players: "Terbaik dulu (kemampuan)",
        cover: "Juga bisa bermain di sini",
        age: "Rata-rata usia",
      },
      countTitle: (count: number, target: number) =>
        `${format(count)} pemain yang posisi terbaiknya di lini ini; skuad biasanya memiliki ${format(target)}`,
      statusHelp: {
        missing: "Tidak ada yang bermain di sini.",
        thin: "Lebih sedikit dari yang biasa dimiliki skuad; pemain yang bisa menggantikan dihitung setengah.",
        fine: "Kurang lebih seperti yang biasa dimiliki skuad.",
        crowded: "Dua pemain atau lebih melebihi yang biasa dimiliki skuad.",
      },
      attention: "Perlu dilihat:",
      allFine: "Setiap lini terlihat seimbang.",
    },
    departures: {
      intro: "Pemain yang akan dilepas pemandu bakatmu, yang paling mendesak lebih dulu.",
      filter: "Saran",
      all: "Semua",
      empty: "Pemandu bakatmu tidak akan melepas siapa pun saat ini.",
      sortNames: {
        rank: "urutan pemandu bakat",
        name: "nama",
        age: "usia",
        ca: "kemampuan saat ini",
        pa: "kemampuan potensial",
        value: "nilai",
        wage: "gaji",
        contract: "akhir kontrak",
      },
      columns: {
        player: "Pemain",
        age: "Usia",
        ability: "Kemampuan",
        value: "Nilai",
        wage: "Gaji",
        contract: "Kontrak sampai",
        advice: "Saran",
        reasons: "Alasan",
      },
      actions: { sell: "Jual", loan: "Pinjamkan", release: "Lepas" },
      rank: (line: string, rank: number) => `${line} · ke-${rank}`,
    },
    // English on purpose, not left untranslated: Indonesian football writing keeps the role names in English, and
    // FM's own Indonesian names read oddly (it gives both holding backs as "Bek Sayap Penahan"). Please keep them.
    roles: {
      bgk: "Ball-Playing Goalkeeper",
      ngk: "No-Nonsense Goalkeeper",
      sk: "Sweeper Keeper",
      lhk: "Line-Holding Keeper",
      cb: "Centre-Back",
      bcb: "Ball-Playing Centre-Back",
      ncb: "No-Nonsense Centre-Back",
      acb: "Advanced Centre-Back",
      ocb: "Overlapping Centre-Back",
      scb: "Stopping Centre-Back",
      ccb: "Covering Centre-Back",
      wcb: "Wide Centre-Back",
      fb: "Full-Back",
      ifb: "Inverted Full-Back",
      pfb: "Pressing Full-Back",
      hfb: "Holding Full-Back",
      wb: "Wing-Back",
      iwb: "Inverted Wing-Back",
      pwb: "Playmaking Wing-Back",
      awb: "Advanced Wing-Back",
      hwb: "Holding Wing-Back",
      dm: "Defensive Midfielder",
      hb: "Half-Back",
      ddm: "Dropping Defensive Midfielder",
      pdm: "Pressing Defensive Midfielder",
      bbm: "Box-to-Box Midfielder",
      bbp: "Box-to-Box Playmaker",
      cm: "Central Midfielder",
      pcm: "Pressing Central Midfielder",
      scm: "Screening Central Midfielder",
      chm: "Channel Midfielder",
      wcm: "Wide Central Midfielder",
      ap: "Attacking Playmaker",
      am: "Attacking Midfielder",
      oam: "Outlet Attacking Midfielder",
      w: "Winger",
      if: "Inside Forward",
      pw: "Playmaking Winger",
      wfd: "Wide Forward",
      tw: "Tracking Winger",
      iow: "Inside Outlet Winger",
      cfd: "Centre Forward",
      dlf: "Deep-Lying Forward",
      p: "Poacher",
      tcf: "Tracking Centre Forward",
      ocf: "Outlet Centre Forward",
    } as Record<string, string>,
    reasons: {
      listed: () => "Masuk daftar transfer",
      freeAgent: () => "Agen bebas",
      expiring: (value: string) => `Kontrak berakhir dalam ${value} hari`,
      releaseClause: (value: string) => `Klausul pelepasan ${value}`,
      fringe: () => "Bukan pemain reguler di klubnya",
      keyPlayer: () => "Pemain kunci di klubnya",
      unwanted: () => "Tidak lagi dibutuhkan di klubnya",
      overBudget: (value: string) => `${value} di atas anggaranmu`,
      stretch: (value: string) => `Sedikit di atas anggaran (+${value})`,
      wageHigh: (value: string) => `Gaji ${value}/mgg di atas ruang gajimu`,
      biggerClub: () => "Bermain untuk klub yang lebih besar",
      smallerClub: () => "Bermain untuk klub yang lebih kecil",
      reputationGap: () => "Namanya terlalu besar untuk klubmu",
      ambitious: () => "Ambisius: akan menyambut langkah naik",
      notForSale: () => "Tidak dijual",
    } as Record<string, (value: string) => string>,
    departureReasons: {
      surplus: (value: string) => `Lini berlebih (${value} pemain)`,
      belowLevel: () => "Di bawah level skuad",
      ageing: (value: string) => `Menua (${value})`,
      expiring: (value: string) => `Kontrak berakhir dalam ${value} hari`,
      highWage: (value: string) => `Gaji tinggi untuk perannya (${value}/mgg)`,
      unhappy: () => "Tidak senang",
      lowMorale: () => "Moral rendah",
      blocked: () => "Butuh laga untuk berkembang",
      unwanted: () => "Status skuad: tidak lagi dibutuhkan",
      listed: () => "Sudah masuk daftar transfer",
    } as Record<string, (value: string) => string>,
  },

  errors,
};
