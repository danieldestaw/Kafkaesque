# Kafkaesque Documentation Site

Static documentation for the Kafkaesque (StreamForge) project. No backend required — deploy directly to Vercel or any static host.

## Local preview

```bash
cd docs-site
npx serve .
# Open http://localhost:3000
```

Or with Python:

```bash
cd docs-site
python3 -m http.server 8080
```

## Deploy to Vercel

### Option 1 — CLI

```bash
cd docs-site
npx vercel --prod
```

### Option 2 — Git integration

1. Push the repository to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Set **Root Directory** to `docs-site`
4. Deploy (no build command needed — static files only)

## Structure

```
docs-site/
├── index.html              Overview
├── getting-started.html    Quick start guide
├── installation.html       Docker & env config
├── architecture.html       System design
├── features.html           Feature list
├── dashboard.html          Dashboard guide
├── rbac.html               RBAC & IAM
├── banking-integration.html  banking-service setup
├── api-reference.html      REST API
├── deployment.html         Production deployment
├── development.html        Local dev setup
├── roadmap.html            Release roadmap
├── css/styles.css          Shared styles
├── js/app.js               Sidebar, theme, copy buttons
├── favicon.svg
└── vercel.json             Vercel config
```

## License

Apache License 2.0 — same as the Kafkaesque project.
