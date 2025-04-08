// app/success/page.jsx
import Link from 'next/link';

// Metadata remains the same
export const metadata = {
  title: '上传已提交 - GhibliFlow',
};

const SuccessPage = () => {
  return (
      // Center the content vertically and horizontally
      <main className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen text-center bg-gray-100"> {/* Match main page bg */}
        {/* Enhanced card styling */}
        <div className="bg-white p-10 md:p-12 rounded-2xl shadow-xl border border-gray-200/80 max-w-lg w-full"> {/* Increased size and padding */}
          {/* Larger, more prominent icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-green-500 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> {/* Increased size and margin */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {/* Enhanced text styling */}
          <h1 className="text-3xl font-semibold text-gray-800 mb-4"> {/* Increased size and margin */}
            ✅ 上传成功！任务已提交
          </h1>
          <Link href="/">
            <span className="inline-block px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out cursor-pointer transform hover:scale-105"> {/* Consistent styling */}
              返回上传新图片
            </span>
          </Link>
        </div>
      </main>
  );
};

export default SuccessPage;