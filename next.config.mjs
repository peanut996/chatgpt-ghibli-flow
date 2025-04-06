/** @type {import('next').NextConfig} */
const nextConfig = {
        serverExternalPackages: [
            "puppeteer-extra",
            "puppeteer-extra-plugin-stealth",
            "puppeteer-extra-plugin-recaptcha",
        ],
};

export default nextConfig;
