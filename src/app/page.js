'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // 处理剪贴板粘贴的事件监听
  useEffect(() => {
    const handlePaste = (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          processFile(file);
          event.preventDefault();
          return;
        }
      }

      // 如果不是图片，显示错误
      if (items.length > 0 && !isLoading) {
        setError('请粘贴图片文件，不支持其他类型的文件。');
      }
    };

    window.addEventListener('paste', handlePaste);

    // 点击外部关闭下拉菜单
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('paste', handlePaste);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLoading]);

  // 处理文件验证和预览
  const processFile = (file) => {
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl('');
      setError('');
      return;
    }

    // 验证文件是否为图片
    if (!file.type.match('image.*')) {
      setError('只支持上传图片文件 (.jpg, .jpeg, .png)');
      return;
    }

    setSelectedFile(file);
    setError('');

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    processFile(file);
  };

  const resetFileSelection = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    // 重置文件输入以允许选择相同的文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePromptTypeChange = (value) => {
    setSelectedPromptType(value);
    setDropdownOpen(false);
    if (value !== 'custom' && error.includes('自定义 Prompt')) {
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const isSubmitDisabled =
    !selectedFile ||
    isLoading ||
    (selectedPromptType === 'custom' && !customPromptText.trim()) ||
    (email && !isValidEmail(email));

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    // 高级质感背景 - 精致的渐变和纹理
    <main className="flex min-h-screen w-full flex-col items-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12 md:py-16">
      {/* GitHub 按钮（右上角浮动） */}
      <a
        href="https://github.com/peanut996/chatgpt-ghibli-flow"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 text-gray-600 transition-colors hover:text-gray-900 md:top-8 md:right-8"
        aria-label="GitHub Repository"
      >
        <svg
          className="h-8 w-8 md:h-10 md:w-10"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
      </a>

      <h1 className="mb-10 text-center text-4xl font-bold tracking-tight text-gray-800 md:text-5xl">
        <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          GhibliFlow Studio
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
        {/* --- 第1部分: 图片上传 (高级嵌入式面板) 支持拖放和粘贴 --- */}
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

          {/* 隐藏原始文件输入 */}
          <input
            type="file"
            id="imageUpload"
            ref={fileInputRef}
            accept="image/jpeg, image/jpg, image/png"
            onChange={handleFileChange}
            disabled={isLoading}
            className="hidden"
          />

          {/* 自定义上传区域 - 未选择文件时显示上传区域，选择文件后显示预览和文件信息 */}
          {!selectedFile ? (
            <div
              onClick={triggerFileInput}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isLoading) {
                  const file = e.dataTransfer.files[0];
                  processFile(file);
                }
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-gray-50 p-6 text-center transition-all duration-300 hover:border-indigo-300 hover:bg-gray-100 ${
                isLoading ? 'cursor-not-allowed opacity-60' : ''
              }`}
              style={{
                boxShadow:
                  'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
                minHeight: '120px',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mb-2 h-10 w-10 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="mb-1 text-sm font-medium text-gray-700">
                点击上传图片或拖放至此处
              </p>
              <p className="text-xs text-gray-500">支持 JPG, JPEG, PNG 格式</p>
              <p className="mt-2 text-xs font-medium text-indigo-500">
                也可以直接粘贴图片 (Cmd+V)
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-white p-4 shadow-md transition-all duration-300">
              <div className="flex flex-col sm:flex-row">
                {/* 预览图片 - 修复图片src为空的问题 */}
                <div className="mb-4 flex-shrink-0 overflow-hidden rounded-lg sm:mr-4 sm:mb-0 sm:w-1/3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="图片预览"
                      className="h-32 w-full object-cover object-center sm:h-full"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center bg-gray-100 sm:h-full">
                      <span className="text-sm text-gray-500">无预览</span>
                    </div>
                  )}
                </div>

                {/* 文件信息 */}
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <h3 className="mb-1 line-clamp-1 text-sm font-medium text-gray-900">
                      {selectedFile.name}
                    </h3>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">
                        类型: {selectedFile.type.split('/')[1].toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500">
                        大小: {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={resetFileSelection}
                      disabled={isLoading}
                      className={`flex items-center rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-300 focus:outline-none ${
                        isLoading ? 'cursor-not-allowed opacity-50' : ''
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="mr-1 h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      重新选择
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- 第2部分: Prompt配置 (高级嵌入式面板) --- */}
        <div
          className="mb-8 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-7 transition-all duration-300 ease-in-out"
          style={{
            boxShadow:
              '8px 8px 16px rgba(200, 204, 213, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.9)',
          }}
        >
          {/* Prompt类型选择 - 重新设计的下拉框 */}
          <div className={`${selectedPromptType === 'custom' ? 'mb-5' : ''}`}>
            <label
              htmlFor="promptTypeSelect"
              className="mb-3 block text-base font-medium text-gray-700"
            >
              处理类型
            </label>

            {/* 自定义下拉菜单 */}
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => !isLoading && setDropdownOpen(!dropdownOpen)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-xl border-none bg-gray-50 px-5 py-3.5 text-gray-800 transition-all duration-300 ease-in-out focus:outline-none ${
                  isLoading
                    ? 'cursor-not-allowed opacity-60'
                    : 'hover:bg-gray-100'
                }`}
                style={{
                  boxShadow:
                    'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
                }}
              >
                <span className="block truncate text-sm">
                  {
                    promptOptionsUI.find(
                      (option) => option.type === selectedPromptType,
                    )?.label
                  }
                </span>
                <svg
                  className={`h-5 w-5 text-gray-600 transition-transform duration-300 ${
                    dropdownOpen ? 'rotate-180 transform' : ''
                  }`}
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

              {/* 下拉选项列表 */}
              {dropdownOpen && (
                <div
                  className="ring-opacity-5 absolute z-10 mt-2 w-full origin-top-right rounded-xl bg-white py-2 shadow-lg ring-1 ring-black transition-all duration-300 ease-in-out"
                  style={{
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    animation: 'fadeIn 0.2s ease-out forwards',
                  }}
                >
                  {promptOptionsUI.map((option) => (
                    <div
                      key={option.type}
                      onClick={() => handlePromptTypeChange(option.type)}
                      className="block cursor-pointer px-5 py-2.5 text-sm text-gray-700 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      {option.label}
                    </div>
                  ))}
                </div>
              )}
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
                  resize: 'none',
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

        {/* 提交按钮 (高级浮雕效果) - 修复了scale-98问题 */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={`w-full transform rounded-xl border-none px-6 py-4 font-semibold text-white transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none ${
            isSubmitDisabled
              ? 'bg-opacity-70 cursor-not-allowed bg-gray-300 text-gray-500'
              : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 active:transform'
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

      {/* 添加CSS动画 */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </main>
  );
}
