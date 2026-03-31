# Deploy TimTro To Azure (No CLI)

This guide uses only Azure Portal + GitHub integration.

## Architecture
- Backend: Azure App Service (Java 21)
- Frontend: Azure Static Web Apps
- Database: Aiven MySQL (already created)

## 1) Deploy backend (App Service)
1. Azure Portal -> Create resource -> Web App.
2. Publish: Code.
3. Runtime stack: Java 21.
4. Region: same or close to your users.
5. App Service Plan: choose a paid tier for stable production usage.
6. Deployment: connect to your GitHub repository.

After Web App is created, go to:
- Settings -> Environment variables -> Add these keys:

- SPRING_PROFILES_ACTIVE=prod
- DB_URL=jdbc:mysql://<AIVEN_HOST>:<AIVEN_PORT>/<AIVEN_DB>?sslMode=REQUIRED&serverTimezone=UTC
- DB_USERNAME=<AIVEN_USERNAME>
- DB_PASSWORD=<AIVEN_PASSWORD>
- JWT_SECRET_KEY=<base64-secret-min-32-bytes>
- CLOUDINARY_CLOUD_NAME=<your-cloudinary-name>
- CLOUDINARY_API_KEY=<your-cloudinary-key>
- CLOUDINARY_API_SECRET=<your-cloudinary-secret>
- MAIL_HOST=smtp.gmail.com
- MAIL_PORT=587
- MAIL_USERNAME=<your-email>
- MAIL_PASSWORD=<your-email-app-password>
- APP_CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>

Save and restart app.

## 2) Deploy frontend (Static Web Apps)
1. Azure Portal -> Create resource -> Static Web App.
2. Connect to GitHub repository.
3. Build details:
   - App location: frontend
   - Build command: npm run build
   - Output location: dist
4. Add build env variable:
   - VITE_API_BASE_URL=https://<your-backend-app-service>.azurewebsites.net

Deploy and wait for success.

## 3) Verify after deployment
- Backend health: https://<backend-app>.azurewebsites.net/actuator/health
- Frontend loads and can call API.
- Login/register works.
- Room list and chat endpoints respond.

## 4) Important security notes
- Rotate any secrets that were ever exposed in screenshots or chat.
- Keep all real secrets only in Azure App Settings.
- Do not commit real credentials into source files.
