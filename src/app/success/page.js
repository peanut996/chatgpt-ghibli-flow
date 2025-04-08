// app/success/page.jsx
import Link from 'next/link';

// Metadata remains the same
export const metadata = {
  title: '上传已提交 - GhibliFlow',
};

const SuccessPage = () => {
  return (
    // Center the content vertically and horizontally
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-8 text-center">
      {' '}
      {/* Match main page bg */}
      {/* Enhanced card styling */}
      <div className="w-full max-w-lg rounded-2xl border border-gray-200/80 bg-white p-10 shadow-xl md:p-12">
        {' '}
        {/* Increased size and padding */}
        {/* Larger, more prominent icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto mb-6 h-20 w-20 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {' '}
          {/* Increased size and margin */}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {/* Enhanced text styling */}
        <h1 className="mb-4 text-3xl font-semibold text-gray-800">
          {' '}
          {/* Increased size and margin */}✅ 上传成功！任务已提交
        </h1>
        <Link href="/">
          <span className="focus:ring-opacity-50 inline-block transform cursor-pointer rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white transition-all duration-300 ease-in-out hover:scale-105 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500 focus:outline-none">
            {' '}
            {/* Consistent styling */}
            返回上传新图片
          </span>
        </Link>
      </div>
    </main>
  );
};

export default SuccessPage;
