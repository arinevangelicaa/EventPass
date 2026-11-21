# EventPass
## Event Registration & Ticketing System

**Proyek Individual Komputasi Awan**  
**AWS Cloud Project — Track B: Containers**

| Identitas | Keterangan |
|---|---|
| Nama | Arin Evangelica Patabang |
| NIM | 24/534030/TK/59182 |
| Mata Kuliah | Komputasi Awan |
| Platform | Amazon Web Services |
| Track | B — Containers |
| Arsitektur | Microservices |
| Lingkungan Implementasi | AWS Academy, lab CI/CD |

## Tentang Proyek

EventPass adalah aplikasi berbasis REST API untuk mengelola acara dan
pendaftaran peserta pada seminar, workshop, serta kegiatan kampus.

Proyek ini dikembangkan untuk tugas individual mata kuliah Komputasi
Awan. Fokus Week 12 adalah perancangan arsitektur, konfigurasi awal
infrastruktur AWS, dan pembuktian konektivitas melalui pengujian.

Implementasi menggunakan dua microservices, yaitu Event Service dan
Registration Service. Keduanya dikemas menggunakan Docker dan
dijalankan pada Amazon EC2. Amazon Elastic Container Registry (ECR)
digunakan untuk menyimpan serta mendistribusikan image Event Service.

## Arsitektur Sistem

![Arsitektur AWS EventPass](docs/eventpass-architecture.png)

| Service | Tanggung Jawab | Port Container |
|---|---|---|
| Event Service | Mengelola informasi dan CRUD acara | 3000 |
| Registration Service | Memeriksa acara dan mencatat pendaftaran | 3001 |

Alur pendaftaran peserta:

1. Penyelenggara membuat acara melalui Event Service.
2. Acara diberi status open agar dapat menerima pendaftaran.
3. Peserta mengirim data ke Registration Service.
4. Registration Service memanggil GET /events/{id} pada Event Service.
5. Jika acara ditemukan dan berstatus open, pendaftaran disimpan.
6. Sistem mengembalikan HTTP 201 Created beserta data pendaftaran.

Setiap service memiliki database SQLite dan Docker volume sendiri.
Komunikasi antarcontainer menggunakan jaringan eventpass-network.

## Teknologi

| Komponen | Teknologi |
|---|---|
| Runtime | Node.js 24 |
| HTTP API | Modul HTTP bawaan Node.js |
| Format Data | JSON |
| Database | SQLite bawaan Node.js |
| Container | Docker |
| Container Registry | Amazon ECR |
| Host | Amazon EC2 Cloud9 MicroservicesIDE |
| Version Control | Git dan GitHub |
| Pengujian | curl dan PowerShell |

## Struktur Proyek

```text
.
├── docs/
│   ├── architecture.md
│   ├── eventpass-architecture.drawio
│   └── eventpass-architecture.png
├── services/
│   ├── events/
│   │   ├── Dockerfile
│   │   └── server.js
│   └── registrations/
│       ├── Dockerfile
│       └── server.js
├── src/
│   ├── database.js
│   └── http.js
├── .dockerignore
├── .gitignore
├── package.json
└── README.md
```

Folder data dibuat otomatis saat aplikasi berjalan secara lokal.
Screenshot pengujian disertakan dalam folder evidence pada paket
pengumpulan.

## Menjalankan Secara Lokal

### Prasyarat

- Node.js 24.
- Git untuk mengambil source code.

Aplikasi menggunakan modul bawaan Node.js sehingga dapat dijalankan
langsung tanpa instalasi dependency tambahan.

### Mengambil Source Code

```bash
git clone https://github.com/arinevangelicaa/EventPass.git
cd EventPass
```

### Menjalankan Event Service

Pada terminal pertama:

```bash
npm run start:events
```

### Menjalankan Registration Service

Pada terminal kedua, dari folder repository yang sama:

```bash
npm run start:registrations
```

Secara default, Registration Service menghubungi Event Service
melalui http://127.0.0.1:3000.

### Menguji Kesehatan Service

Pada terminal ketiga:

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3001/health
```

Untuk PowerShell Windows, gunakan curl.exe jika diperlukan:

```powershell
curl.exe -i http://127.0.0.1:3000/health
curl.exe -i http://127.0.0.1:3001/health
```

Respons sukses berstatus HTTP 200 OK dan memuat nama service
serta status ok.

## Data dan API

### Entitas Event

| Atribut | Keterangan |
|---|---|
| event_id | UUID yang dibuat server |
| title | Judul acara, 1–120 karakter |
| description | Deskripsi opsional, maksimal 2.000 karakter |
| location | Lokasi acara, 1–200 karakter |
| date | Waktu RFC 3339 dengan zona waktu, disimpan sebagai UTC |
| capacity | Bilangan bulat positif |
| status | draft, open, atau closed |
| deleted_at | Penanda internal untuk penghapusan logis |

Kapasitas disimpan sebagai informasi acara. Pembatasan kuota
pendaftaran otomatis menjadi pengembangan berikutnya.

### Endpoint Event Service

| Method | Endpoint | Fungsi | Respons Sukses |
|---|---|---|---|
| POST | /events | Membuat acara | 201 Created |
| GET | /events | Membaca daftar acara | 200 OK |
| GET | /events/{id} | Membaca detail acara | 200 OK |
| PUT | /events/{id} | Mengganti data acara yang dapat diedit | 200 OK |
| DELETE | /events/{id} | Menghapus acara secara logis | 204 No Content |
| GET | /health | Memeriksa proses dan akses database | 200 OK |

POST menggunakan status draft jika status tidak dikirim.
PUT memerlukan title, location, date, capacity, dan status.
Description yang tidak dikirim akan menjadi string kosong.

Acara yang dihapus tidak muncul pada endpoint daftar maupun detail.
Riwayat pendaftaran tetap tersimpan pada database Registration Service.

### Contoh Payload Acara

```json
{
  "title": "Workshop Cloud Computing",
  "description": "Workshop pengenalan AWS dan Docker",
  "location": "SGLC UGM",
  "date": "2026-11-25T14:00:00+07:00",
  "capacity": 30,
  "status": "open"
}
```

### Entitas Registration

| Atribut | Keterangan |
|---|---|
| registration_id | UUID pendaftaran yang dibuat server |
| event_id | Referensi ID acara |
| participant_name | Nama peserta |
| participant_email | Alamat email peserta |
| status | registered atau cancelled |
| created_at | Waktu pendaftaran |

### Endpoint Registration Service

| Method | Endpoint | Fungsi | Respons Sukses |
|---|---|---|---|
| POST | /registrations | Mendaftarkan peserta | 201 Created |
| GET | /registrations | Membaca daftar pendaftaran | 200 OK |
| GET | /registrations/{id} | Membaca detail pendaftaran | 200 OK |
| DELETE | /registrations/{id} | Mengubah status menjadi cancelled | 204 No Content |
| GET | /health | Memeriksa proses dan akses database | 200 OK |

### Contoh Payload Pendaftaran

Ganti nilai event_id dengan ID acara yang berstatus open.

```json
{
  "event_id": "GANTI_DENGAN_UUID_ACARA",
  "participant_name": "Peserta Demo",
  "participant_email": "peserta@example.com"
}
```

### Respons Error

| Status | Kondisi |
|---|---|
| 400 Bad Request | Input atau JSON tidak valid |
| 404 Not Found | Resource atau endpoint tidak ditemukan |
| 409 Conflict | Acara belum terbuka atau sudah ditutup |
| 413 Payload Too Large | Request body melebihi 64 KiB |
| 415 Unsupported Media Type | Request body menggunakan tipe selain application/json |
| 503 Service Unavailable | Event Service tidak dapat dihubungi atau database health check gagal |
| 500 Internal Server Error | Terjadi kesalahan internal |

Contoh format error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "capacity must be a positive integer."
  }
}
```

## Menjalankan dengan Docker

### Prasyarat

Docker harus terpasang dan daemon Docker berjalan.

Perintah berikut ditujukan untuk deployment baru pada host yang
belum memiliki container dan jaringan dengan nama yang sama.

### Build Image

Jalankan dari folder utama repository:

```bash
docker build \
  -f services/events/Dockerfile \
  -t eventpass-event-service:week12 .

docker build \
  -f services/registrations/Dockerfile \
  -t eventpass-registration-service:week12 .
```

### Membuat Jaringan

```bash
docker network create eventpass-network
```

### Menjalankan Event Service

```bash
docker run -d \
  --name eventpass-events \
  --network eventpass-network \
  -p 127.0.0.1:3000:3000 \
  -v eventpass-events-data:/app/data \
  eventpass-event-service:week12
```

### Menjalankan Registration Service

```bash
docker run -d \
  --name eventpass-registrations \
  --network eventpass-network \
  -p 127.0.0.1:3001:3001 \
  -e EVENT_SERVICE_URL=http://eventpass-events:3000 \
  -v eventpass-registrations-data:/app/data \
  eventpass-registration-service:week12
```

### Memeriksa Container

```bash
docker ps --filter name=eventpass

curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3001/health
```

### Membaca Log

```bash
docker logs eventpass-events
docker logs eventpass-registrations
```

## Konfigurasi Lingkungan

| Variabel | Fungsi |
|---|---|
| HOST | Alamat interface tempat service mendengarkan request |
| PORT | Port service |
| DB_PATH | Lokasi file SQLite |
| EVENT_SERVICE_URL | Alamat Event Service yang digunakan Registration Service |

Saat berjalan lokal, HOST secara default adalah 127.0.0.1.
Dockerfile mengatur HOST menjadi 0.0.0.0 di dalam container.
Pemetaan port pada host tetap dibatasi ke 127.0.0.1.

## Deployment AWS

### Infrastruktur yang Digunakan

| Komponen | Konfigurasi |
|---|---|
| Region | us-east-1, N. Virginia |
| VPC | LabVPC |
| Subnet | Public Subnet1 |
| Availability Zone | us-east-1a |
| EC2 | Cloud9 MicroservicesIDE |
| Instance Type | t3.small |
| ECR Repository | eventpass-event-service |
| Image Tag | week12 |
| Identitas AWS | Kredensial sementara lab, assumed role voclabs |

EC2 tidak memiliki IAM instance role terpasang berdasarkan halaman
Security di AWS Console. AWS CLI menggunakan identitas sementara
yang tersedia dalam environment lab.

### Alur Deployment

1. Ambil source code dari GitHub ke EC2 Cloud9.
2. Bangun image Event Service dan Registration Service.
3. Autentikasi Docker ke Amazon ECR melalui AWS CLI.
4. Beri tag image Event Service menggunakan URI repository ECR.
5. Push image ke ECR.
6. Uji pull dan jalankan image dari ECR.
7. Jalankan kedua service pada jaringan Docker yang sama.
8. Uji health, pendaftaran antarservice, dan data setelah restart.
9. Simpan screenshot serta output pengujian.

### Push dan Pull ECR

Repository ECR harus sudah tersedia dan identitas AWS harus memiliki
izin yang diperlukan. Jalankan pada terminal Bash yang sama:

```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE="$REGISTRY/eventpass-event-service:week12"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

docker tag eventpass-event-service:week12 "$IMAGE"
docker push "$IMAGE"
docker pull "$IMAGE"
```

Image Event Service telah diuji dari ECR melalui container
eventpass-ecr-test pada localhost port 3002.

Registration Service dibangun dan dijalankan pada host EC2 yang sama.
Dockerfile masing-masing service tersedia dalam repository.

## Hasil Pengujian

| Pengujian | Hasil yang Telah Diverifikasi |
|---|---|
| CRUD acara secara lokal | Pembuatan, pembacaan, perubahan, dan penghapusan berhasil |
| Integrasi lokal | Pendaftaran menghasilkan HTTP 201 Created |
| Build image Event Service | Image week12 berhasil dibuat |
| Container Event Service di EC2 | Berjalan dan health check menghasilkan HTTP 200 OK |
| Data setelah restart | Acara tetap tersedia setelah container dimulai ulang |
| Push ECR | Berhasil dan menghasilkan digest image |
| Pull ECR | Berhasil |
| Health image dari ECR | HTTP 200 OK pada localhost port 3002 |
| Integrasi container di AWS | Pendaftaran menghasilkan HTTP 201 Created |

Bukti pengujian dan konfigurasi AWS dikumpulkan dalam folder evidence
pada paket pengumpulan tugas.

## Keamanan dan Batasan

- Port aplikasi pada host diikat ke 127.0.0.1.
- Pengujian dilakukan melalui terminal Cloud9.
- Antarservice berkomunikasi melalui jaringan Docker.
- Setiap service memiliki database dan volume tersendiri.
- Container berjalan menggunakan pengguna node.
- Kredensial AWS dan private key disimpan di luar repository.
- Kedua service berbagi satu host EC2.
- Ketersediaan aplikasi bergantung pada host tersebut.

Autentikasi pengguna, otorisasi penyelenggara, tiket QR, check-in,
pencegahan pendaftaran ganda, dan pembatasan kuota otomatis menjadi
pengembangan berikutnya.

## Lingkungan AWS Academy

Implementasi menggunakan lab CI/CD AWS Academy yang tersedia.
Instruksi tugas menyebut AWS Learner Lab. Kesesuaian lingkungan
tersebut untuk penilaian masih perlu dikonfirmasi kepada dosen.

Pemakaian resource perlu mengikuti batas izin dan anggaran lab.
Host Cloud9 dapat dihentikan setelah pengujian dan pengambilan bukti
selesai, dengan mempertimbangkan penggunaannya untuk proyek lain.

## Dokumentasi

- [Penjelasan arsitektur](docs/architecture.md)
- [Diagram arsitektur AWS](docs/eventpass-architecture.png)
- [Diagram yang dapat diedit](docs/eventpass-architecture.drawio)

## Pengembang

**Arin Evangelica Patabang**  
**NIM 24/534030/TK/59182**  
Proyek Individual Komputasi Awan