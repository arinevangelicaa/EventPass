# Arsitektur EventPass

EventPass menggunakan Track B, yaitu EC2, Docker, dan Amazon ECR.
Deployment menggunakan EC2 milik environment Cloud9 MicroservicesIDE
dalam lab CI/CD AWS Academy.

## Alur aplikasi dan penyimpanan

```mermaid
flowchart LR
    user["Penguji melalui AWS Cloud9"]

    subgraph aws["AWS us-east-1"]
        subgraph vpc["LabVPC"]
            subgraph subnet["Public Subnet1"]
                subgraph ec2["EC2 Cloud9 · t3.small"]
                    terminal["Terminal Cloud9 · curl"]

                    subgraph network["Docker network · eventpass-network"]
                        registration["Registration Service · port 3001"]
                        event["Event Service · port 3000"]
                    end

                    registrationdb[("SQLite registrations · Docker volume")]
                    eventdb[("SQLite events · Docker volume")]
                end
            end
        end
    end

    user --> terminal
    terminal -->|"HTTP localhost:3001 · pendaftaran"| registration
    terminal -->|"HTTP localhost:3000 · CRUD acara"| event
    registration -->|"GET /events/{id} · validasi acara open"| event
    registration --> registrationdb
    event --> eventdb
```

Setiap service memiliki database dan volume sendiri pada penyimpanan
EC2. Registration Service mengakses informasi acara melalui HTTP API.

Port host 3000 dan 3001 diikat ke 127.0.0.1. Pengujian dilakukan melalui
terminal Cloud9. Kedua container berkomunikasi melalui jaringan Docker.

## Distribusi image dan IAM

```mermaid
flowchart TD
    github["GitHub · EventPasss"]
    build["EC2 Cloud9 · Docker build"]
    identity["Identitas sementara lab · assumed role voclabs"]
    ecr["Amazon ECR private · eventpass-event-service:week12"]
    runtime["EC2 Cloud9 · Docker container"]

    github -->|"git clone"| build
    identity -->|"Otorisasi AWS CLI untuk ECR"| build
    build -->|"Login dan push melalui HTTPS"| ecr
    ecr -->|"Pull melalui HTTPS"| runtime
```

EC2 tidak memiliki IAM instance role yang terpasang. Akses ECR
menggunakan identitas sementara lab yang tersedia di Cloud9.
Login, push, dan pull image Event Service telah diuji.

Security group EC2 memiliki aturan SSH port 22 dari dua rentang IP
yang terlihat pada konfigurasi lab. Aturan lama port 8080 dan 8081
dibatasi ke satu alamat IP /32. Aplikasi EventPass menggunakan
localhost port 3000 dan 3001.

Event Service dan Registration Service berjalan sebagai container
terpisah pada satu EC2. Pengujian tambahan image ECR menggunakan
container eventpass-ecr-test pada localhost port 3002.

Satu host memudahkan deployment dan penghematan resource untuk demo.
Ketersediaan kedua service bergantung pada host yang sama.

## Catatan lingkungan

Instruksi tugas menyebut AWS Learner Lab. Implementasi ini menggunakan
lab CI/CD yang tersedia. Kesesuaian lingkungan tersebut untuk penilaian
perlu dikonfirmasi kepada dosen.