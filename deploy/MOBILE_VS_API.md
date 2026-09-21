# Production sync — API on server, mobile app local only

## Rule

| Part | Where it runs |
|------|----------------|
| **Backend API** | EC2 / https://ndclients.co.in/api/v1 |
| **Admin web** | EC2 / https://ndclients.co.in |
| **Mobile Flutter** | Your phone / PC only — **never copy to server** |

## On EC2 (API + admin only)

```bash
cd ~/NDMF
git pull origin main
chmod +x deploy/sync-api.sh
bash deploy/sync-api.sh
```

## On your PC (mobile app)

```bash
cd mobile-app
git pull
flutter pub get
flutter run
```

API base (already set): `https://ndclients.co.in/api/v1`  
Login: **9000000003** / **ndfa1234**
