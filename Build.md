# Building and Deploying to GitHub Pages

This project is set up to run directly in the browser without a separate build step, making deployment to static hosting services like GitHub Pages very straightforward.

## Deployment Steps

1.  **Create a GitHub Repository**:
    -   Go to [GitHub](https://github.com/new) and create a new public repository. Let's call it `harmonicizer-app`.

2.  **Push Your Code**:
    -   Add your GitHub repository as a remote and push your project files (including `index.html`, `index.tsx`, and all component/style files) to the `main` branch.
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/<your-username>/harmonicizer-app.git
    git push -u origin main
    ```

3.  **Configure GitHub Pages**:
    -   In your repository on GitHub, go to the **Settings** tab.
    -   In the left sidebar, click on **Pages**.
    -   Under the "Build and deployment" section, for the "Source", select **Deploy from a branch**.
    -   Choose your `main` branch and the `/(root)` directory.
    -   Click **Save**.

4.  **Done!**
    -   GitHub will start a deployment process. After a minute or two, your Harmonicizer application will be live at:
        `https://<your-username>.github.io/harmonicizer-app/`

## How It Works (No Build Step)

This project uses a modern "buildless" development setup for simplicity:

-   **`index.html`**: The main entry point.
-   **Import Maps**: The `<script type="importmap">` block in `index.html` tells the browser where to find dependencies like `react`, `react-dom`, and `tone`. It resolves bare module specifiers (e.g., `import React from 'react'`) to full CDN URLs.
-   **Babel Standalone**: The `<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>` line loads the Babel compiler directly in the browser.
-   **In-Browser Transpilation**: The main application script (`<script type="text/babel" ... src="./index.tsx">`) has `type="text/babel"`. This tells the Babel standalone script to find it, transpile the JSX and modern JavaScript/TypeScript features on the fly, and then execute the result.

Because all the necessary compilation happens in the user's browser, you don't need to run a build command like `npm run build` before deploying. You just need to serve the static files.
