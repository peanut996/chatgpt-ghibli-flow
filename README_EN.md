<p style="text-align: center">
<a href="README.md">中文</a> ｜ English
</p>

# GhibliFlow Image Generator

## Description

This is a web application built with Next.js. Users can upload an image via a web page. The backend service then uses Puppeteer to automate the real ChatGPT web interface, applying a specific prompt to convert the image into the Ghibli animation style. Finally, it sends the generated image URL or any processing errors to a specified user or group via a Telegram Bot.

The project utilizes the `p-queue` library to ensure that only one image processing task runs at a time, preventing resource contention and simultaneous operations on the ChatGPT account.

## Key Features

*   **Web Upload Interface:** Provides a simple and intuitive interface for users to select and upload JPG/PNG images.
*   **ChatGPT Automation:** Uses `puppeteer-extra` with the `stealth` plugin to mimic human interaction, log in, and interact with `chatgpt.com`.
*   **Fixed Style Conversion:** Applies a preset Chinese prompt to the uploaded image, asking ChatGPT to generate a Ghibli-style image, attempting to remove watermarks and maintain the aspect ratio.
*   **Telegram Result Notification:** Sends the successfully generated image URL or any processing errors to the configured Telegram chat.
*   **Task Queue:** Processes upload requests sequentially, ensuring stability and efficient resource usage.
*   **Environment Configuration:** Flexibly configure key parameters (like Cookies path, proxy, Telegram Token, etc.) via environment variables.

## Technology Stack

*   **Frontend:** Next.js (App Router), React, Tailwind CSS
*   **Backend API:** Next.js API Routes
*   **Browser Automation:** Puppeteer-Extra, puppeteer-extra-plugin-stealth
*   **Notifications:** node-telegram-bot-api
*   **Queue Management:** p-queue
*   **Package Manager:** pnpm
*   **Others:** Chalk (console output styling), dotenv (environment variable management)

## Prerequisites

*   Node.js (Recommended version ^18.18.0 || ^19.8.0 || >= 20.0.0, based on Next.js requirements)
*   pnpm package manager
*   A valid `cookies.json` file containing cookies for logging into `chatgpt.com`.
*   A Telegram Bot Token and the Chat ID to receive results.

## Installation and Setup

1.  **Clone the repository:**
```bash
git clone <your-repository-url>
cd chatgpt-ghibli-flow
```

2.  **Install dependencies:**
```bash
pnpm install
```

3.  **Configure Environment Variables:**
Create a file named `.env.local` in the project root directory and fill in the necessary environment variables:

```dotenv
# --- Core Configuration ---
# Path to ChatGPT Cookies file (relative to project root)
COOKIES_FILE_PATH=./cookies.json

# Telegram Bot Token (Get from BotFather)
TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN>

# Telegram Chat ID to receive results (User ID or Group ID)
TELEGRAM_CHAT_ID=<YOUR_TELEGRAM_CHAT_ID>

# --- Optional Configuration ---
# HTTP/HTTPS Proxy (e.g., http://localhost:7890 or socks5://localhost:1080)
# Used for Puppeteer and Telegram Bot network requests
# PROXY=http://your_proxy_address:port

# Run Puppeteer in Headless mode (true or false, default true)
# Set to false to see the browser interface during local debugging
HEADLESS=true

# --- Timeout Settings (milliseconds) ---
# Timeout for waiting for file upload to ChatGPT interface (default 20000ms)
UPLOAD_TIMEOUT=20000
# Timeout for waiting for prompt input completion (default 5000ms)
INPUT_TIMEOUT=5000
# Total timeout for waiting for ChatGPT image generation (default 240000ms)
GENERATION_TIMEOUT=240000

# (Optional) Prompt used for ChatGPT
# PROMPT="请将这张图片转换为吉卜力风格的图像。去除右下角文字，保持原来图像的长宽比"
```

4.  **Place the Cookies File:**
Obtain the cookies after logging into `chatgpt.com` and save them as a JSON array in a file. Place this file at the path specified by `COOKIES_FILE_PATH` in `.env.local` (defaults to `cookies.json` in the project root).
*   **Important:** Cookies expire and need to be updated periodically. You can use browser developer tools or extensions (like EditThisCookie) to export cookies. Ensure the exported format is a JSON array.

## Running the Application

*   **Development Mode:**
```bash
pnpm dev
```
Open `http://localhost:3000` in your browser.

*   **Build for Production:**
```bash
pnpm build
```

*   **Run Production Build:**
```bash
pnpm start
```
Alternatively, use PM2 for process management (recommended for server deployment):
```bash
pm2 start ecosystem.config.cjs
```

## How It Works

1.  User uploads an image at `http://localhost:3000` (or the deployed address).
2.  The frontend POSTs the image to the `/api/process-image` API route.
3.  The API route receives the file, saves it temporarily, and adds a processing task (temporary file path and original filename) to the `p-queue`.
4.  The queue executes tasks sequentially:
*   Launches or reuses a Puppeteer browser instance.
*   Loads `cookies.json` to access `chatgpt.com` in a logged-in state.
*   Uploads the temporary image file within the ChatGPT interface.
*   Enters the predefined prompt (`请将这张图片转换为吉卜力风格...`) and submits it.
*   Waits for ChatGPT to process and generate the resulting image.
*   Extracts the URL of the generated image.
*   Uses the Telegram Bot to send the image URL to the specified Chat ID.
*   If an error occurs at any step, sends the error message to Telegram.
*   Closes the Puppeteer page and deletes the temporary file after processing.

## Deployment Notes

*   **Puppeteer Environment:** Deployment on Serverless platforms like Vercel can be challenging, as Puppeteer requires a full browser environment. Self-hosting on a VPS or a platform supporting Docker is recommended.
*   **Resource Consumption:** Running a browser instance with Puppeteer consumes significant CPU and memory resources.
*   **Cookie Expiration:** The `cookies.json` file needs to be updated manually on a regular basis; otherwise, the automation will fail due to being logged out.
*   **PM2:** The project includes an `ecosystem.config.cjs` file for easy process management and daemonization on a server using PM2.