# WH-Question Explorer

A web application that provides comprehensive answers to WH-questions using Wikipedia and OpenAI APIs.

## Features

- Clean Apple-inspired design
- Real API integration (Wikipedia + OpenAI)
- 3x3 grid of WH-question answers
- Responsive layout
- Copy answers functionality

## Setup

1. Clone this repository
2. Add your OpenAI API key in `script.js`
3. Open `index.html` in a browser

## Deployment to GitHub Pages

1. Push the repository to GitHub
2. Go to Settings > Pages
3. Select "Deploy from branch" and choose your main branch
4. Select the `/root` folder
5. Click Save

## API Keys

You need:
- OpenAI API key (for fallback answers)
- Wikipedia API doesn't require a key

Add your OpenAI key in `script.js`:
```javascript
const CONFIG = {
    openai: {
        apiKey: 'sk-your-key-here'
    }
};