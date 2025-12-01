## Running the Project with Docker

This project is containerized using Docker and Docker Compose for easy setup and deployment.

### Project-Specific Requirements
- **Node.js Version:** Uses Node.js `22.13.1-slim` (as specified in the Dockerfile).
- **Dependencies:** Installed via `npm ci --production` using `package.json` and `package-lock.json`.

### Environment Variables
- The application supports environment configuration via `.env`, `.env.example`, `.env.local`, and `.env.production` files.
- **Required:** If your application needs environment variables, ensure you provide a `.env` file in the project root. Uncomment the `env_file: ./.env` line in `docker-compose.yml` to enable this.

### Build and Run Instructions
1. **Build and start the application:**
   ```sh
   docker compose up --build
   ```
   This will build the image using the provided Dockerfile and start the service.

2. **Environment Configuration:**
   - Copy `.env.example` to `.env` and update values as needed for your environment.
   - If using a custom environment file, ensure the `env_file` line in `docker-compose.yml` is uncommented.

### Special Configuration
- The application runs as a non-root user (`appuser`) for improved security.
- Uses a custom Docker build cache and bind mounts for deterministic builds.
- If you need to add additional services (e.g., databases), extend the `docker-compose.yml` and set `depends_on` accordingly.

### Ports
- **js-app service:** Exposes port `3000` (mapped to host port `3000`).

---
_Keep your environment variables up to date and review the Dockerfile and compose file for any changes before deploying._