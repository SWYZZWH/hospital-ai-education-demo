# Hospital AI Education Demo

医院 AI 宣教内容生成与患者端展示科研 Demo。

## Run

```bash
docker run --rm -it -p 5173:5173 -v "$PWD":/app -w /app node:24-alpine sh -lc "npm install && npm run dev"
```

## Build

```bash
docker run --rm -v "$PWD":/app -w /app node:24-alpine sh -lc "npm ci && npm run build"
```
