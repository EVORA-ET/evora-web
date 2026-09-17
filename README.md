# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Run with Docker

The production build is served by Nginx inside a Docker container (port 80, mapped to host port 5173).

```bash
# Build the image
docker build -t evora-web .

# Run the container
docker run -d --name evora-web \
  --add-host=host.docker.internal:host-gateway \
  -p 5173:80 \
  --restart unless-stopped \
  evora-web
```

Then open http://localhost:5173/

The container proxies `/api/` to the backend. It defaults to `host.docker.internal:8000`, which matches the backend's `docker-compose.yaml` (host port 8000). If your backend listens on a different port, point the container at it without rebuilding:

```bash
docker run -d --name evora-web \
  --add-host=host.docker.internal:host-gateway \
  -e API_UPSTREAM=host.docker.internal:9000 \
  -p 5173:80 \
  evora-web
```

`--add-host=host.docker.internal:host-gateway` is required on Linux (Docker Desktop on macOS/Windows resolves it automatically).

### Stop the container

```bash
docker stop evora-web
```

### Remove the container

```bash
docker rm evora-web
```

### Rebuild after code changes

The image bakes in the build output, so after changing source code you must rebuild and rerun:

```bash
docker stop evora-web && docker rm evora-web
docker build -t evora-web .
docker run -d --name evora-web --add-host=host.docker.internal:host-gateway -p 5173:80 --restart unless-stopped evora-web
```

### Notes

- After a rebuild, the JS/CSS asset filenames get new hashes. If a change doesn't appear, the mounted image may be stale — rebuild and rerun as above.
- SPA routing (e.g. `/login`) works because Nginx falls back to `index.html` via `try_files $uri $uri/ /index.html;`.
- If the app shows "Could not load your profile. Please try again.", `/api/` is likely unreachable. Confirm the backend is up (`curl -i http://localhost:8000/api/me` should return `403`, not a connection error) and check `docker logs evora-web` for `connect() failed ... upstream`. The upstream is set by the `API_UPSTREAM` env var (default `host.docker.internal:8000`).

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
