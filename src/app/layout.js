// app/layout.jsx
import './globals.css'; // Import global styles

// Metadata export remains similar, just no type annotation
export const metadata = {
    title: 'GhibliFlow Image Generator',
    description: 'Upload an image to get a Ghibli-styled version via ChatGPT',
};

// Remove type annotation from props
export default function RootLayout({ children }) {
    return (
        <html lang="en">
        <head>
            <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        </head>
        <body>{children}</body>
        </html>
    );
}