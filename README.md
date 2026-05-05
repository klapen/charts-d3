# charts-d3

Klapen's gallery of D3.js data visualizations — [klapen.com.co](https://klapen.com.co).

## Stack

- **Vite** — dev server + static build
- **Tailwind CSS v4** — landing page styling
- Each visualization lives under `src/public/viz/<name>/` and is served as a static page (existing D3 v3 / Leaflet / C3 code keeps working unchanged)

## Develop

```sh
npm install
npm run dev
```

## Build & deploy

```sh
npm run build      # outputs to dist/
npm run deploy     # aws s3 cp dist/ s3://klapen.com.co/ --recursive
```

## Layout

```
charts-d3/
├── index.html              # Landing page (gallery)
├── src/
│   ├── styles/main.css     # Tailwind entry
│   ├── landing/main.js     # Landing page filter/search
│   └── public/             # Copied verbatim into the build
│       └── viz/<name>/     # One folder per visualization
└── vite.config.js
```
