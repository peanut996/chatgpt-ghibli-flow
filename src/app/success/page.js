// app/success/page.jsx
import Link from 'next/link';
// Remove Head if not needed or import from 'next/document' if necessary for specific tags
// import Head from 'next/head'; // Usually not needed in App Router pages directly

// Metadata can be exported directly in App Router
export const metadata = { // Remove type annotation
  title: '上传已提交 - GhibliFlow',
};

const SuccessPage = () => {
  return (
      // <Head> is typically not used directly here, use metadata export
      <main className="container mx-auto px-4 py-8 flex flex-col items-center min-h-screen justify-center text-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-md w-full">
          {/* SVG Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-2xl font-semibold text-gray-800 mb-3">
            ✅ 上传已提交！
          </h1>
          <p className="text-gray-600 mb-6">
            你的图片正在后台处理中。请稍后在你的 Telegram 频道查看生成结果。
          </p>
          <Link href="/">
            {/* Link component usage is the same */}
            <span className="inline-block px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 cursor-pointer">
            上传另一张图片
          </span>
          </Link>
        </div>
      </main>
  );
};

export default SuccessPage;