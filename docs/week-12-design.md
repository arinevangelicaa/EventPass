# Rancangan EventPass · Week 12

EventPass membantu penyelenggara seminar atau workshop kampus mengelola acara dan mencatat pendaftaran peserta. Penyelenggara membuat acara, peserta melihat acara yang dibuka, lalu mengirim pendaftaran. Event Service memiliki data acara. Registration Service memiliki data peserta yang mendaftar dan memeriksa status acara melalui API Event Service sebelum menulis pendaftaran.

Track B mendemonstrasikan build, distribusi, dan eksekusi image menggunakan Docker, Amazon ECR, dan Amazon EC2. Satu EC2 cukup untuk demo. Dua service tetap berjalan sebagai container terpisah dengan kontrak API dan penyimpanan masing-masing. Keduanya berbagi kapasitas dan ketersediaan satu host.

## Alur request, data, dan jaringan

~~~mermaid
flowchart TD
    client["Penguji di Windows · curl atau Postman"]
    subgraph aws["AWS · us-east-1"]
        subgraph vpc["VPC · public subnet dengan rute ke Internet Gateway"]
            subgraph host["EC2 Amazon Linux 2023 · SG hanya SSH dari IP penguji"]
                tunnel["SSH tunnel · API bind ke localhost host"]
                subgraph docker["Docker Compose · jaringan bridge"]
                    event["Event Service · HTTP 3000"]
                    reg["Registration Service · HTTP 3001"]
                end
                events[("events.db · volume Event pada EBS")]
                registrations[("registrations.db · volume Registration pada EBS")]
            end
        end
    end
    client -->|"TCP 22 · IP penguji /32"| tunnel
    tunnel -->|"CRUD acara"| event
    tunnel -.->|"Demo registrasi saat container kedua tersedia"| reg
    reg -->|"GET /events/{id} · HTTP internal"| event
    event --> events
    reg --> registrations
~~~

Di dalam container, API mendengarkan pada semua interface container agar dapat diakses dari jaringan Compose. Di host EC2, pemetaan port untuk demo dibatasi ke `127.0.0.1`. Security group khusus EventPass membuka TCP 22 dari IP penguji. Request dari Windows diteruskan melalui SSH. Port 3000 dan 3001 tidak memerlukan inbound rule. Gunakan data peserta fiktif selama demo.

## Alur image dan IAM

~~~mermaid
flowchart TD
    source["GitHub · source code dan Dockerfile"]
    build["Docker build · Linux amd64"]
    registry["Amazon ECR private · us-east-1"]
    host["EC2 EventPass · Docker Compose"]
    source --> build
    build -->|"Push · identitas AWS yang diizinkan lab"| registry
    host -->|"Pull · IAM instance profile yang diizinkan lab"| registry
~~~

Gunakan ECR privat `eventpass-event-service` untuk image pertama. Rencanakan `eventpass-registration-service` untuk image kedua. Setiap image diberi tag berdasarkan SHA commit sehingga versi yang diuji dapat dilacak.

Identitas build memerlukan izin push pada repo EventPass dan `ecr:GetAuthorizationToken`. Instance profile EC2 untuk runtime memerlukan izin pull pada repo EventPass dan izin mendapatkan token ECR. Verifikasi dukungan IAM di lab sebelum provisioning. Jika lab hanya menyediakan profile bawaan, verifikasi hak aksesnya dan gunakan sesuai batas lab. Simpan kredensial sementara di luar Git dan di luar image.

## Data dan kontrak API

| Field Event | Tipe | Aturan |
|---|---|---|
| `event_id` | UUID, string | Dibuat server dan menjadi primary key SQLite. |
| `title` | String | Wajib diisi dan berisi 1–120 karakter setelah dirapikan. |
| `description` | String | Opsional, default string kosong, maksimum 2.000 karakter. |
| `location` | String | Wajib diisi dan berisi 1–200 karakter setelah dirapikan. |
| `date` | String | Tanggal dan waktu RFC 3339 dengan zona waktu, tersimpan sebagai UTC. |
| `capacity` | Integer | Minimal 1. Batas kuota otomatis berada di luar target awal. |
| `status` | Enum | `draft`, `open`, atau `closed`. Default `draft` pada POST. |
| `deleted_at` | String atau null | Field internal untuk soft delete. |

| Method | Endpoint | Perilaku | Respons sukses |
|---|---|---|---|
| POST | `/events` | Buat acara dari payload JSON yang valid. | `201 Created` dan data acara. |
| GET | `/events` | Tampilkan daftar acara yang belum dihapus. | `200 OK` dan array. |
| PUT | `/events/{id}` | Ganti data acara yang dapat diedit. Field wajib dan status harus dikirim. | `200 OK` dan data terbaru. |
| DELETE | `/events/{id}` | Tandai acara terhapus tanpa menghapus riwayat pendaftaran. | `204 No Content`. |

`GET /events/{id}` mendukung validasi oleh Registration Service. `GET /health` pada masing-masing service melaporkan kesiapan proses dan akses SQLite. Respons `400` berlaku untuk input tidak valid. Respons `404` berlaku untuk ID yang tidak ditemukan atau sudah dihapus. Data yang dihapus tidak muncul pada daftar atau permintaan detail. Format error JSON direncanakan sebagai `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`.

Registration Service memiliki tabel `registrations` dengan `registration_id`, `event_id`, `participant_name`, `participant_email`, `status`, dan `created_at`. Saat menerima `POST /registrations`, service membaca `GET /events/{id}` melalui jaringan Docker. Pendaftaran hanya disimpan saat status acara `open`. Acara yang tidak ditemukan menghasilkan `404`, acara yang belum terbuka atau sudah ditutup menghasilkan `409`, dan gangguan koneksi ke Event Service menghasilkan `503`. ID acara adalah referensi API tanpa foreign key lintas database dan tanpa cascade. Daftar pendaftaran dan pembatalan dapat dikembangkan setelah alur utama lolos uji.

## Langkah implementasi dan deployment

1. Buat Event Service dengan Node.js 24, Express, SQLite bawaan Node.js, dan Dockerfile. Uji health, CRUD, dan persistensi data setelah service dimulai ulang.
2. Bangun image Linux amd64 Event Service. Siapkan rancangan, struktur awal, dan health endpoint Registration Service. Jika waktu cukup, uji registrasi menggunakan Docker Compose dan volume terpisah.
3. Setelah rancangan disepakati, temukan AWS Learner Lab untuk tugas individual atau dapatkan konfirmasi dosen sebelum memakai lingkungan CI/CD untuk EventPass. Periksa saldo dan izin ECR, EC2, serta IAM yang tersedia. Jika Docker lokal belum siap, build pada EC2 yang sama hanya setelah penggunaan lab dan jalur autentikasi ECR dipastikan.
4. Siapkan repo ECR privat dan satu EC2 `eventpass-ec2` dengan Amazon Linux 2023, `t3.micro` x86_64, serta volume gp3 8 GiB. Gunakan public subnet yang tersedia dan security group khusus EventPass. Beri tag `Project=EventPass` pada resource baru yang mendukungnya.
5. Push image Event Service ke ECR, pull kembali berdasarkan tag commit, jalankan container, lalu uji `/health` dan satu siklus CRUD melalui SSH tunnel. Ambil bukti build, image ECR, EC2 dan security group, container berjalan, serta output API. Hentikan EC2 EventPass setelah pengambilan bukti.
6. Finalisasi design brief 1–2 halaman, diagram, tautan GitHub dengan commit bertahap, dan bukti AWS. Kumpulkan dalam format `NIU_NamaLengkap_CC.pdf` atau `.zip` paling lambat 26 November 2026 pukul 23.59 WIB.

Resource lama seperti ECS, RDS, ALB, ECR, dan pipeline CI/CD tetap digunakan hanya untuk proyek sebelumnya. Gunakan hanya nama, image, dan security group milik EventPass saat deployment.

## Perkiraan biaya EventPass

Untuk `us-east-1`, asumsi modelnya satu Linux `t3.micro` ($0,0104/jam), satu IPv4 publik otomatis saat instance aktif ($0,005/jam), gp3 8 GiB ($0,08/GiB-bulan), dan total image ECR 1 GB ($0,10/GB-bulan), dengan 30 hari per bulan untuk prorata. Untuk horizon 10 hari, biayanya sekitar **US$0,43** bila EC2 berjalan total 12 jam. Jika berjalan 240 jam, perkiraannya **US$3,94**. EBS dan penyimpanan image ECR tetap tercatat ketika EC2 dihentikan. Angka ini khusus EventPass dan di luar biaya resource proyek CI/CD lama, transfer data, serta biaya tambahan yang mungkin muncul. Angka saldo US$15 di brief proyek adalah catatan terakhir yang perlu diperiksa kembali sebelum provisioning.

Tarif rujukan. [EC2 T3](https://aws.amazon.com/ec2/instance-types/t3/) · [IPv4 publik](https://aws.amazon.com/vpc/pricing/) · [EBS](https://aws.amazon.com/ebs/pricing/) · [ECR](https://aws.amazon.com/ecr/pricing/)

Izin dan autentikasi image. [Push ke ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-push-iam.html) · [Pull dari ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-pull-ecr-image.html)
