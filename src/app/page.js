'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const promptOptionsUI = [
  { type: 'ghibli', label: '吉卜力风格 (Ghibli Style)' },
  { type: 'cat-human', label: '猫咪拟人化 (Cats as Humans)' },
  { type: 'irasutoya', label: 'いらすとや风格 (Irasutoya Style)' },
  { type: 'custom', label: '自定义 Prompt (Custom)' },
];
const DEFAULT_PROMPT_TYPE = 'ghibli';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => EMAIL_REGEX.test(email);

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedPromptType, setSelectedPromptType] =
    useState(DEFAULT_PROMPT_TYPE);
  const [customPromptText, setCustomPromptText] = useState('');
  const [email, setEmail] = useState('');
  const router = useRouter();

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setPreviewUrl('');
      setError('');
    }
  };

  const handlePromptTypeChange = (event) => {
    setSelectedPromptType(event.target.value);
    if (event.target.value !== 'custom' && error.includes('自定义 Prompt')) {
      setError('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!selectedFile) {
      setError('请先选择一个图片文件。');
      return;
    }
    if (selectedPromptType === 'custom' && !customPromptText.trim()) {
      setError('选择自定义 Prompt 时，请输入内容。');
      return;
    }
    if (email && !isValidEmail(email)) {
      setError('请输入有效的邮箱地址。');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('promptType', selectedPromptType);
    if (selectedPromptType === 'custom') {
      formData.append('customPromptText', customPromptText);
    }
    if (email) {
      formData.append('email', email);
    }

    try {
      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `HTTP 错误！状态: ${response.status}`);
      }
      if (result.success) {
        router.push('/success');
        return;
      } else {
        throw new Error(result.error || '上传请求失败，请重试。');
      }
    } catch (err) {
      console.error('上传错误:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`❌ 处理时发生错误: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled =
    !selectedFile ||
    isLoading ||
    (selectedPromptType === 'custom' && !customPromptText.trim()) ||
    (email && !isValidEmail(email));

  return (
    // 高级质感背景 - 精致的渐变和纹理
    <main className="container mx-auto flex min-h-screen flex-col items-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12 md:py-16">
      <h1 className="mb-10 text-center text-4xl font-bold tracking-tight text-gray-800 md:text-5xl">
        <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          🎨 GhibliFlow Studio 🎨
        </span>
      </h1>

      {/* 主表单容器 - 更精致的边框和阴影效果 */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-3xl border border-gray-200/20 bg-gradient-to-b from-gray-50 to-gray-100 p-6 shadow-xl backdrop-blur-sm transition-all duration-300 ease-in-out md:p-8"
        style={{
          boxShadow:
            '15px 15px 30px rgba(200, 204, 213, 0.3), -15px -15px 30px rgba(255, 255, 255, 0.8)',
        }}
      >
        {/* --- 第1部分: 图片上传 (高级嵌入式面板) --- */}
        <div
          className="mb-8 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-7 transition-all duration-300 ease-in-out"
          style={{
            boxShadow:
              '8px 8px 16px rgba(200, 204, 213, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.9)',
          }}
        >
          <label
            htmlFor="imageUpload"
            className="mb-3 block text-base font-medium text-gray-700"
          >
            选择图片
          </label>
          <input
            type="file"
            id="imageUpload"
            accept=".jpg, .jpeg, .png"
            onChange={handleFileChange}
            disabled={isLoading}
            className={`block w-full cursor-pointer rounded-xl border-none bg-gray-50 px-5 py-3.5 text-sm text-gray-700 transition-all duration-300 ease-in-out file:mr-4 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-indigo-100 file:to-indigo-200 file:px-5 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:from-indigo-200 hover:file:to-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none ${
              isLoading ? 'cursor-not-allowed opacity-60' : ''
            }`}
            style={{
              boxShadow:
                'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
            }}
          />
        </div>

        {/* --- 第2部分: Prompt配置 (高级嵌入式面板) --- */}
        <div
          className="mb-8 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-7 transition-all duration-300 ease-in-out"
          style={{
            boxShadow:
              '8px 8px 16px rgba(200, 204, 213, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.9)',
          }}
        >
          {/* Prompt类型选择 */}
          <div className={`${selectedPromptType === 'custom' ? 'mb-5' : ''}`}>
            <label
              htmlFor="promptTypeSelect"
              className="mb-3 block text-base font-medium text-gray-700"
            >
              处理类型
            </label>
            <div className="relative">
              <select
                id="promptTypeSelect"
                value={selectedPromptType}
                onChange={handlePromptTypeChange}
                disabled={isLoading}
                className={`block w-full appearance-none rounded-xl border-none bg-gray-50 px-5 py-3.5 text-gray-800 transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none sm:text-sm ${
                  isLoading ? 'cursor-not-allowed bg-gray-100 opacity-60' : ''
                }`}
                style={{
                  boxShadow:
                    'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
                }}
              >
                {promptOptionsUI.map((option) => (
                  <option key={option.type} value={option.type}>
                    {option.label}
                  </option>
                ))}
              </select>
              {/* 自定义下拉箭头 */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-600">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* 自定义Prompt文本区 (条件显示) */}
          {selectedPromptType === 'custom' && (
            <div className="transform transition-all duration-500 ease-in-out">
              <label
                htmlFor="customPromptText"
                className="mb-3 block text-base font-medium text-gray-700"
              >
                自定义 Prompt
              </label>
              <textarea
                id="customPromptText"
                rows={4}
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                disabled={isLoading}
                placeholder="在此处输入你希望使用的 Prompt..."
                className={`block w-full rounded-xl border-none bg-gray-50 px-5 py-3.5 text-gray-800 placeholder-gray-400 transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none sm:text-sm ${
                  isLoading ? 'cursor-not-allowed bg-gray-100 opacity-60' : ''
                }`}
                style={{
                  boxShadow:
                    'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
                }}
              />
            </div>
          )}
        </div>

        {/* --- 第3部分: 通知设置 (高级嵌入式面板) --- */}
        <div
          className="mb-8 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-7 transition-all duration-300 ease-in-out"
          style={{
            boxShadow:
              '8px 8px 16px rgba(200, 204, 213, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.9)',
          }}
        >
          <label
            htmlFor="emailInput"
            className="mb-3 block text-base font-medium text-gray-700"
          >
            接收邮箱{' '}
            <span className="text-xs font-normal text-gray-500">(可选)</span>
          </label>
          <input
            type="email"
            id="emailInput"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            placeholder="your.email@example.com"
            className={`block w-full rounded-xl border-none bg-gray-50 px-5 py-3.5 text-gray-800 placeholder-gray-400 transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none sm:text-sm ${
              isLoading ? 'cursor-not-allowed bg-gray-100 opacity-60' : ''
            } ${email && !isValidEmail(email) ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-gray-50' : ''}`}
            style={{
              boxShadow:
                'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
            }}
          />
          {email && !isValidEmail(email) && (
            <p className="mt-2 text-xs text-red-600">请输入有效的邮箱格式。</p>
          )}
        </div>

        {/* 图片预览 (精致的玻璃态效果) */}
        {previewUrl && !isLoading && (
          <div
            className="mb-8 overflow-hidden rounded-2xl border border-white/30 bg-white/20 p-5 backdrop-blur-sm transition-all duration-500 ease-in-out"
            style={{
              boxShadow:
                '8px 8px 16px rgba(200, 204, 213, 0.3), -8px -8px 16px rgba(255, 255, 255, 0.7)',
            }}
          >
            <p className="mb-3 text-center text-sm font-semibold text-gray-700">
              图片预览:
            </p>
            <div
              className="overflow-hidden rounded-xl"
              style={{
                boxShadow:
                  'inset 2px 2px 5px rgba(200, 204, 213, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.7)',
              }}
            >
              <img
                src={previewUrl}
                alt="已选图片预览"
                className="mx-auto h-auto max-h-48 max-w-full rounded-lg object-contain p-2 md:max-h-60"
              />
            </div>
          </div>
        )}

        {/* 提交按钮 (高级浮雕效果) */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={`w-full transform rounded-xl border-none px-6 py-4 font-semibold text-white transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none ${
            isSubmitDisabled
              ? 'bg-opacity-70 cursor-not-allowed bg-gray-300 text-gray-500'
              : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-98'
          }`}
          style={{
            boxShadow: isSubmitDisabled
              ? 'none'
              : '6px 6px 12px rgba(200, 204, 213, 0.5), -6px -6px 12px rgba(255, 255, 255, 0.8)',
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              {/* 精致的加载动画 */}
              <svg
                className="h-5 w-5 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>正在处理...</span>
            </div>
          ) : (
            '上传并开始处理 ✨'
          )}
        </button>
      </form>

      {/* 状态区域 (优雅的错误提示) */}
      <div className="mt-6 w-full max-w-xl text-center">
        {error && (
          <div
            className="mb-6 flex items-center rounded-xl bg-gradient-to-r from-red-50 to-red-100 p-4 text-sm text-red-800 transition-all duration-300 ease-in-out md:text-base"
            style={{
              boxShadow:
                '5px 5px 10px rgba(200, 204, 213, 0.4), -5px -5px 10px rgba(255, 255, 255, 0.8)',
            }}
          >
            <div className="mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-red-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p>{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
