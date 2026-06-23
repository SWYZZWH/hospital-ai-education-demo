# Hospital AI Education Workspace

医院 AI 宣教内容生成、语音宣教与视频合成工作台。

## Run

```bash
docker compose up --build
```

## Build

```bash
docker run --rm -v "$PWD":/app -w /app node:24-bookworm-slim sh -lc "npm ci && npm run build"
```
