<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bc53b40c-d388-45a1-b1dc-dac2076527bb

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

### Local free image analysis mode

This app now runs image analysis locally in-browser with TensorFlow + COCO-SSD.
No API key is required for local analysis.

## Team Workflow

- Use `main` as always-deployable branch
- Create feature branches: `feature/<short-topic>`
- Open a PR for each feature/fix
- Run checks before PR: `npm run lint`

See `CONTRIBUTING.md` for the full workflow.
