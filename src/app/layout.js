import './globals.css';

export const metadata = {
  title: 'GhibliFlow Image Generator',
  description: 'Upload an image to get a Ghibli-styled version via ChatGPT',
};

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
