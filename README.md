# Hospital Patient Education Workspace

医院患者宣教内容编辑、审核与发送工作台。

## Run

```bash
docker compose up --build
```

## Build

```bash
docker run --rm -v "$PWD":/app -w /app node:24-bookworm-slim sh -lc "npm ci && npm run build"
```
