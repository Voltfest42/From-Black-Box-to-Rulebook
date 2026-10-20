# From Black Box to Rulebook

An interactive story about **rule extraction**: how researchers have turned what machine-learning models learn into IF–THEN rules people can read, from the neural networks of 1988 to the language models of 2026. Every idea comes with a live demo that trains real models and runs the real extraction methods in your browser.

- [docs/research.md](docs/research.md): the research behind the story, with sources
- [docs/plan.md](docs/plan.md): the project plan, the stages and the architecture

## Development

Requires Node 20.19 or later (developed on Node 24).

```bash
npm install
npm run dev        # local dev server at http://localhost:5173
npm test           # unit + property tests (Vitest)
npm run e2e        # end-to-end + accessibility tests on the production build (Playwright + axe)
                   # first time only: npx playwright install chromium
npm run lint
npm run build      # type-check and build to dist/
```

## Layout

```
src/core/      models, datasets and extraction algorithms (pure TypeScript, no UI)
src/viz/       reusable visual pieces: figure frame, step player, maps, rule and tree views
src/figures/   the interactive figures used in the chapters
src/site/      site shell: routing, sidebar, pages, glossary, reading progress
src/content/   chapter text (MDX)
tests/         unit and property tests
e2e/           Playwright smoke tests and WCAG 2.1 AA checks
infra/         AWS CDK app: private S3 bucket + CloudFront
docs/          research notes and plan
```

## Deploying

The site is static. It is served from a private S3 bucket through CloudFront (Origin Access Control), defined in `infra/` with AWS CDK.

```bash
npm install --prefix infra   # once
npm run deploy               # build, upload, invalidate the CloudFront cache
```

`npm run deploy` uses the active AWS CLI profile. To remove everything, run `npm --prefix infra run destroy`.
