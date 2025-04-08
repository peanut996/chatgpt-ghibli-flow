<p align="center">
<br> 中文 ｜ <a href="README_EN.md">English</a>
</p>

# GhibliFlow Image Generator / 吉卜力风格图像生成器

## 描述

这是一个基于 Next.js 构建的 Web 应用程序。用户可以通过网页上传一张图片，后端服务会使用 Puppeteer 自动化操作真实的 ChatGPT 网页界面，应用特定的提示词（Prompt）将图片转换为吉卜力（Ghibli）动画风格，并将最终生成的图片 URL 或处理过程中的错误信息通过 Telegram Bot 发送给指定的用户或群组。

该项目使用 `p-queue` 库来确保同一时间只有一个图片处理任务在执行，避免了资源竞争和对 ChatGPT 账号的同时操作。

## 主要功能

- **网页上传界面:** 提供简单直观的界面供用户选择并上传 JPG/PNG 图片。
- **自动化 ChatGPT:** 使用 `puppeteer-extra` 和 `stealth` 插件模拟真人操作，登录并与 `chatgpt.com` 交互。
- **固定风格转换:** 对上传的图片应用预设的中文提示词，要求 ChatGPT 生成吉卜力风格的图像，并尝试去除水印、保持比例。
- **Telegram 结果通知:** 将成功生成的图片 URL 或任何处理错误发送到配置好的 Telegram 聊天。
- **任务队列:** 顺序处理上传请求，保证稳定性和资源合理利用。
- **环境配置:** 通过环境变量灵活配置关键参数（如 Cookies 路径、代理、Telegram Token 等）。

## 技术栈

- **前端:** Next.js (App Router), React, Tailwind CSS
- **后端 API:** Next.js API Routes
- **浏览器自动化:** Puppeteer-Extra, puppeteer-extra-plugin-stealth
- **通知:** node-telegram-bot-api, nodemailer
- **队列管理:** p-queue
- **包管理器:** pnpm
- **其他:** Chalk (控制台输出美化), dotenv (环境变量管理)

## 环境要求

- Node.js (建议版本 ^18.18.0 || ^19.8.0 || >= 20.0.0，根据 Next.js 要求)
- pnpm 包管理器
- 一个有效的 `cookies.json` 文件，包含用于登录 `chatgpt.com` 的 Cookies。
- 一个 Telegram Bot Token 和接收结果的 Chat ID。

## 安装与设置

1.  **克隆仓库:**

    ```bash
    git clone <your-repository-url>
    cd chatgpt-ghibli-flow
    ```

2.  **安装依赖:**

    ```bash
    pnpm install
    ```

3.  **配置环境变量:**
    创建一个名为 `.env.local` 的文件在项目根目录，并填入以下必要的环境变量：

    ```dotenv
    # --- 核心配置 ---
    # ChatGPT Cookies 文件路径 (相对于项目根目录)
    COOKIES_FILE_PATH=./cookies.json

    # Telegram Bot Token (从 BotFather 获取)
    TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN>

    # 接收结果的 Telegram Chat ID (用户 ID 或群组 ID)
    TELEGRAM_CHAT_ID=<YOUR_TELEGRAM_CHAT_ID>

    # --- 可选配置 ---
    # HTTP/HTTPS 代理 (例如: http://localhost:7890 or socks5://localhost:1080)
    # 用于 Telegram Bot 的网络请求
    # PROXY=http://your_proxy_address:port

    # Puppeteer 是否以 Headless 模式运行 (true 或 false, 默认 true)
    # 设置为 false 可以在本地调试时看到浏览器界面
    HEADLESS=true

    # --- 超时设置 (毫秒) ---
    # 等待文件上传到 ChatGPT 界面的超时时间 (默认 20000ms)
    UPLOAD_TIMEOUT=20000
    # 等待 Prompt 输入完成的超时时间 (默认 5000ms)
    INPUT_TIMEOUT=5000
    # 等待 ChatGPT 生成图片的总超时时间 (默认 240000ms)
    GENERATION_TIMEOUT=240000

    # (可选) ChatGPT 使用的提示词
    # PROMPT="请将这张图片转换为吉卜力风格的图像。去除右下角文字，保持原来图像的长宽比"
    ```

4.  **放置 Cookies 文件:**
    获取您登录 `chatgpt.com` 后的 Cookies，并将其保存为 JSON 数组格式的文件。将该文件放置在 `.env.local` 中 `COOKIES_FILE_PATH` 指定的路径（默认为项目根目录下的 `cookies.json`）。
    - **重要提示:** Cookies 是有时效性的，需要定期更新。您可以使用浏览器开发者工具或相关扩展程序 (如 EditThisCookie) 来导出 Cookies。确保导出的格式是 JSON 数组。

## 运行项目

- **开发模式:**

  ```bash
  pnpm dev
  ```

  在浏览器中打开 `http://localhost:3000`。

- **构建生产版本:**

  ```bash
  pnpm build
  ```

- **运行生产版本:**
  ```bash
  pnpm start
  ```
  或者使用 PM2 进行管理（推荐用于服务器部署）：
  ```bash
  pm2 start ecosystem.config.cjs
  ```

## 工作原理

1.  用户在 `http://localhost:3000` (或其他部署地址) 上传图片。
2.  前端将图片 POST 到 `/api/process-image` API 路由。
3.  API 路由接收文件，保存为临时文件，并将处理任务（临时文件路径和原始文件名）添加到 `p-queue` 队列中。
4.  队列按顺序执行任务：
    - 启动或复用 Puppeteer 浏览器实例。
    - 加载 `cookies.json` 文件以模拟登录状态访问 `chatgpt.com`。
    - 在 ChatGPT 界面上传临时图片文件。
    - 输入预设的 Prompt (`请将这张图片转换为吉卜力风格...`) 并提交。
    - 等待 ChatGPT 处理并生成结果图片。
    - 提取生成的图片 URL。
    - 使用 Telegram Bot 将图片 URL 发送到指定的 Chat ID。
    - 如果在任何步骤发生错误，将错误信息发送到 Telegram。
    - 处理完成后关闭 Puppeteer 页面并删除临时文件。

## 部署注意事项

- **Puppeteer 环境:** 在 Vercel 等 Serverless 平台部署可能会遇到困难，因为 Puppeteer 需要一个完整的浏览器环境。推荐在 VPS 或支持 Docker 的平台上自行部署。
- **资源消耗:** Puppeteer 运行浏览器实例会消耗较多的 CPU 和内存资源。
- **Cookies 时效:** `cookies.json` 需要定期手动更新，否则自动化流程会因未登录而失败。
- **PM2:** 项目提供了 `ecosystem.config.cjs` 文件，方便使用 PM2 在服务器上进行进程管理和守护。
