# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

---

## Branding, Icons & Splash Screens (added)

I added a scalable SVG logo and an icon generator script to produce PNG assets for the site and mobile devices.

Files added:

- `public/curiocity-logo.svg` — a scalable SVG logo (edit this file if you want different colors or typography).
- `scripts/generate-icons.js` — Node script using `sharp` to generate PNG icons and a splash placeholder in `public/icons/`.

How to generate icons locally:

1. Install dev dependencies (already added to `package.json`):

```powershell
npm install
```

2. Run the generator:

```powershell
npm run generate-icons
```

This creates:

- `public/icons/icon-16x16.png`, `icon-32x32.png`, ..., `icon-512x512.png`
- `public/icons/apple-touch-icon.png`
- `public/icons/splash-2048x2732.png`

What I changed in the project:

- `public/manifest.json` updated to reference generated icons and set app name to `curiocity`.
- `public/index.html` updated with `apple-touch-icon`, `apple-touch-startup-image` and theme color.

Deployment tip (Netlify):

- Run `npm run build` and deploy the `build` folder to Netlify. The manifest and icons will be included in the build.

If you'd like, I can also:

- Add fine-grained Apple startup images per device using media queries,
- Produce a high-quality PNG pack from the original Illustrator source (requires the original assets), or
- Replace the simple gradient in the SVG with an embedded raster/logo artwork if you provide a PNG.


## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
