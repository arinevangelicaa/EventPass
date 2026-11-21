# Arsitektur EventPass

EventPass menggunakan Track B dengan Amazon EC2, Docker, dan Amazon ECR.
Dua microservices berjalan pada EC2 Cloud9 MicroservicesIDE dalam
LabVPC dan Public Subnet1 di region us-east-1.

![Diagram arsitektur AWS EventPass](eventpass-architecture.png)

[Unduh diagram yang dapat diedit](eventpass-architecture.drawio)

## Alur aplikasi

Pengujian dilakukan melalui terminal Cloud9. Event Service mengelola
CRUD acara pada localhost port 3000. Registration Service menerima
pendaftaran pada localhost port 3001 dan memeriksa acara melalui
API Event Service di jaringan Docker eventpass-network.

Setiap service menyimpan data SQLite pada Docker volume tersendiri.

## Distribusi image dan keamanan

Source code diambil dari GitHub dan dibangun menjadi Docker image
pada EC2 Cloud9. Image Event Service dengan tag week12 disimpan
dalam repository privat Amazon ECR. Push, pull, dan health check
image tersebut telah diuji.

Akses ECR menggunakan kredensial sementara lab dengan assumed role
voclabs. EC2 menggunakan security group Cloud9. Port host aplikasi
diikat ke 127.0.0.1.

## Lingkungan pengerjaan

Implementasi menggunakan lab CI/CD AWS Academy yang tersedia.
Instruksi tugas menyebut AWS Learner Lab, sehingga kesesuaian
lingkungan untuk penilaian masih perlu dikonfirmasi kepada dosen.