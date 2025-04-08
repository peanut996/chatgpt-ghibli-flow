// app/success/page.jsx
import Link from 'next/link';

// Metadata remains the same
export const metadata = {
  title: '上传已提交 - GhibliFlow',
};

const SuccessPage = () => {
  return (
    // 高级质感背景 - 与主页保持一致的渐变和纹理
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8 text-center">
      {/* 拟态风格成功卡片 */}
      <div
        className="w-full max-w-lg rounded-3xl border border-gray-200/20 bg-gradient-to-b from-gray-50 to-gray-100 p-10 backdrop-blur-sm transition-all duration-300 ease-in-out md:p-12"
        style={{
          boxShadow:
            '15px 15px 30px rgba(200, 204, 213, 0.3), -15px -15px 30px rgba(255, 255, 255, 0.8)',
        }}
      >
        {/* 成功图标容器 - 拟态风格圆形 */}
        <div
          className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-gray-50 to-gray-100 p-2"
          style={{
            boxShadow:
              '6px 6px 12px rgba(200, 204, 213, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.9)',
          }}
        >
          {/* 成功图标 */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-14 w-14 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* 标题文本 - 渐变效果 */}
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-gray-800">
          <span className="bg-gradient-to-r from-green-500 to-teal-600 bg-clip-text text-transparent">
            上传成功！任务已提交
          </span>
        </h1>

        {/* 拟态风格按钮 */}
        <div
          className="mx-auto inline-block rounded-xl p-0.5 transition-all duration-300"
          style={{
            boxShadow:
              '6px 6px 12px rgba(200, 204, 213, 0.5), -6px -6px 12px rgba(255, 255, 255, 0.8)',
          }}
        >
          <Link href="/">
            <span className="inline-block w-full transform rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-3.5 font-semibold text-white transition-all duration-300 ease-in-out hover:from-indigo-600 hover:to-purple-700 focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none active:scale-98">
              返回上传新图片
            </span>
          </Link>
        </div>

        {/* 额外信息部分 - 拟态内嵌面板 */}
        <div
          className="mt-10 rounded-xl bg-gray-50 p-5 text-sm text-gray-600"
          style={{
            boxShadow:
              'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
          }}
        >
          <p>我们将尽快处理您的图片</p>
          <p className="mt-2 text-xs text-gray-500">这通常在5-30分钟内完成</p>
        </div>
      </div>
    </main>
  );
};

export default SuccessPage;
