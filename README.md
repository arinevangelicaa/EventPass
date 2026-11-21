# EventPass

**Event Registration & Ticketing System**  
Proyek Individual Komputasi Awan · AWS Lab Project · Track B (Containers)

**Arin Evangelica Patabang** · NIM **24/534030/TK/59182**

EventPass menyediakan REST API untuk mengelola acara dan pendaftaran peserta seminar, workshop, serta kegiatan kampus. Proyek ini menggunakan Node.js 24 dan SQLite, dengan dua layanan yang berjalan di Docker.

| Layanan | Fungsi | Port |
|---|---|---|
| Event Service | Membuat, membaca, memperbarui, dan menghapus acara | `3000` |
| Registration Service | Memeriksa status acara dan mencatat pendaftaran peserta | `3001` |

Registration Service memanggil `GET /events/{id}` sebelum menerima pendaftaran. Peserta hanya dapat mendaftar jika acara berstatus `open`. Setiap layanan menyimpan data di database SQLite tersendiri.

![Diagram arsitektur AWS EventPass](docs/eventpass-architecture.png)

[Dokumentasi arsitektur](docs/architecture.md) · [Diagram yang bisa diedit](docs/eventpass-architecture.drawio)

## Menjalankan di Laptop

Gunakan **Node.js 24**. Proyek ini memakai modul bawaan Node.js sehingga bisa langsung dijalankan setelah kode diunduh.

```bash
git clone https://github.com/arinevangelicaa/EventPass.git
cd EventPass
```

Jalankan Event Service dan Registration Service di **dua terminal terpisah** dari folder proyek.

```bash
npm run start:events
```

```bash
npm run start:registrations
```

Untuk mengecek kedua layanan, buka `http://127.0.0.1:3000/health` dan `http://127.0.0.1:3001/health`. Masing-masing mengembalikan `200 OK` saat siap digunakan.

## Endpoint API

| Layanan | Method dan endpoint | Fungsi |
|---|---|---|
| Event | `POST /events` | Membuat acara |
| Event | `GET /events` | Melihat daftar acara |
| Event | `GET /events/{id}` | Melihat detail acara |
| Event | `PUT /events/{id}` | Memperbarui acara |
| Event | `DELETE /events/{id}` | Menghapus acara dari daftar dan halaman detail |
| Registration | `POST /registrations` | Mendaftarkan peserta |
| Registration | `GET /registrations` | Melihat daftar pendaftaran |
| Registration | `GET /registrations/{id}` | Melihat detail pendaftaran |
| Registration | `DELETE /registrations/{id}` | Membatalkan pendaftaran |

## Rencana Deployment di AWS

Amazon EC2 Cloud9 menjalankan kedua container. Amazon ECR menyimpan image Event Service dengan tag `week12`.

1. Ambil kode dari GitHub ke EC2, lalu buat image untuk kedua layanan dengan Dockerfile masing-masing.
2. Masuk ke registry ECR melalui AWS CLI. Beri tag image Event Service sesuai alamat repository ECR, lalu unggah dengan `docker push`.
3. Ambil kembali image Event Service dengan `docker pull` untuk menguji akses ke ECR.
4. Jalankan kedua container di jaringan Docker `eventpass-network`. Setiap layanan menggunakan volume terpisah untuk database SQLite.
5. Uji API melalui terminal Cloud9. Gunakan `localhost:3000` untuk Event Service dan `localhost:3001` untuk Registration Service.

### Menjalankan Container

Jalankan perintah berikut dari folder proyek pada host baru yang sudah memiliki Docker.

```bash
docker build -f services/events/Dockerfile -t eventpass-event-service:week12 .
docker build -f services/registrations/Dockerfile -t eventpass-registration-service:week12 .

docker network create eventpass-network

docker run -d \
  --name eventpass-events \
  --network eventpass-network \
  -p 127.0.0.1:3000:3000 \
  -v eventpass-events-data:/app/data \
  eventpass-event-service:week12

docker run -d \
  --name eventpass-registrations \
  --network eventpass-network \
  -p 127.0.0.1:3001:3001 \
  -e EVENT_SERVICE_URL=http://eventpass-events:3000 \
  -v eventpass-registrations-data:/app/data \
  eventpass-registration-service:week12
```

### Hasil Pengujian di AWS

| Pengujian | Hasil |
|---|---|
| Health check kedua layanan | `200 OK` |
| CRUD acara | `POST 201`, `GET 200`, `PUT 200`, `DELETE 204` |
| Pendaftaran antarcontainer | `201 Created` |
| Restart container Event Service | Data acara tetap tersedia |
| Push dan pull image melalui ECR | Berhasil. Container uji mengembalikan `200 OK` pada `/health`. |