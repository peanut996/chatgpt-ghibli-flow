'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';

const promptOptionsUI = [
  { type: 'ghibli', label: '吉卜力风格 (Ghibli Style)' },
  { type: 'cat-human', label: '猫咪拟人化 (Cats as Humans)' },
  { type: 'irasutoya', label: 'いらすとや风格 (Irasutoya Style)' },
  { type: 'sticker', label: '贴纸风格 (Sticker Set)' },
  { type: 'custom', label: '自定义 Prompt (Custom)' },
];
const DEFAULT_PROMPT_TYPE = 'ghibli';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => !email || EMAIL_REGEX.test(email);

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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  const { data: session, status } = useSession();
  const isLoadingSession = status === 'loading';

  useEffect(() => {
    const handlePaste = (event) => {
      if (!session || isLoading || isLoadingSession) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            event.preventDefault();
            return;
          }
        }
      }

      if (items.length > 0 && !isLoading) {
        setError('请粘贴图片文件，不支持其他类型的文件。');
      }
    };

    window.addEventListener('paste', handlePaste);

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setShowLoginModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('paste', handlePaste);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLoading, session, isLoadingSession]);

  const processFile = (file) => {
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl('');
      setError('');
      return;
    }
    if (!file.type.match('image.*')) {
      setError('只支持上传图片文件 (.jpg, .jpeg, .png)');
      setSelectedFile(null);
      setPreviewUrl('');
      return;
    }

    setSelectedFile(file);
    setError('');

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.onerror = () => {
      setError('读取文件预览失败');
      setPreviewUrl('');
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
    setError('');
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

    if (!session) {
      setShowLoginModal(true);
      return;
    }

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
    formData.append('promptType', selectedPromptType);
    if (selectedPromptType === 'custom') {
      formData.append('customPromptText', customPromptText);
    }
    if (email) {
      formData.append('email', email);
    }
    formData.append('image', selectedFile);

    try {
      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(result.error || '未授权或会话已过期，请重新登录。');
        }
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
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    if (!isProcessingOrNotLoggedIn) {
      fileInputRef.current?.click();
    }
  };

  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  const isProcessingOrNotLoggedIn = isLoading || isLoadingSession;
  const isSubmitTrulyDisabled =
    isProcessingOrNotLoggedIn ||
    !selectedFile ||
    (selectedPromptType === 'custom' && !customPromptText.trim()) ||
    (email && !isValidEmail(email));

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-16 md:py-20">
      <a
        href="https://github.com/peanut996/chatgpt-ghibli-flow"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 text-gray-600 transition-colors hover:text-gray-900 md:top-6 md:right-6"
        aria-label="GitHub Repository"
      >
        <svg
          className="h-8 w-8 md:h-9 md:w-9"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
      </a>

      {/* 用户头像和登录状态区域 */}
      {/* 用户头像和登录状态区域 */}
      <div className="absolute top-4 left-4 z-20 md:top-6 md:left-6">
        {isLoadingSession ? (
          <span className="animate-pulse rounded-md bg-gray-200 px-3 py-1.5 text-sm text-gray-500 shadow-sm">
            加载中...
          </span>
        ) : session ? (
          <div className="group relative">
            {/* 默认只显示头像和在线状态 */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/80 p-1 shadow-md backdrop-blur-sm transition-all duration-300">
              <img
                src={session.user.image}
                alt="用户头像"
                className="h-8 w-8 rounded-full border border-gray-200 object-cover"
              />
              <div className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-400"></div>
            </div>

            {/* 悬停时显示的扩展信息 */}
            <div className="invisible absolute top-0 left-0 opacity-0 transition-all duration-300 group-hover:visible group-hover:opacity-100">
              {/* 使用精确定位和尺寸，确保头像完全重合 */}
              <div className="flex items-center rounded-lg bg-white/90 shadow-md backdrop-blur-sm">
                {/* 头像容器 - 与原始头像完全重合 */}
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full p-1">
                  <img
                    src={session.user.image}
                    alt="用户头像"
                    className="h-8 w-8 rounded-full border border-gray-200 object-cover"
                  />
                </div>

                {/* 用户名和退出按钮 */}
                <div className="flex items-center space-x-3 px-3 py-2">
                  <span
                    className="max-w-[120px] truncate text-sm font-medium text-gray-700"
                    title={session.user.name || session.user.email}
                  >
                    {session.user.name || session.user.email}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium whitespace-nowrap text-red-700 shadow-sm transition-colors hover:bg-red-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
                  >
                    退出
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleLoginClick}
            className="flex items-center space-x-1 rounded-full bg-white/80 p-2 shadow-md backdrop-blur-sm transition-all hover:bg-white focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </button>
        )}
      </div>

      <h1 className="mb-8 text-center text-4xl font-bold tracking-tight text-gray-800 md:text-5xl">
        <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          GhibliFlow Studio
        </span>
      </h1>

      <div className="w-full max-w-xl">
        {isLoadingSession ? (
          <div className="mt-10 text-center">
            <p className="text-lg text-gray-500">正在加载会话信息...</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-gray-200/20 bg-gradient-to-b from-gray-50 to-gray-100 p-6 shadow-xl backdrop-blur-sm transition-all duration-300 ease-in-out md:p-8"
            style={{
              boxShadow:
                '15px 15px 30px rgba(200, 204, 213, 0.3), -15px -15px 30px rgba(255, 255, 255, 0.8)',
            }}
          >
            <div
              className="mb-6 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-6 transition-all duration-300 ease-in-out"
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
                ref={fileInputRef}
                accept="image/jpeg, image/jpg, image/png"
                onChange={handleFileChange}
                disabled={isProcessingOrNotLoggedIn}
                className="hidden"
              />
              {!selectedFile ? (
                <div
                  onClick={triggerFileInput}
                  onDragOver={(e) => {
                    if (!isProcessingOrNotLoggedIn) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onDragEnter={(e) => {
                    if (!isProcessingOrNotLoggedIn) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onDrop={(e) => {
                    if (!isProcessingOrNotLoggedIn) {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files[0];
                      processFile(file);
                    }
                  }}
                  className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-gray-50 p-6 text-center transition-all duration-300 ${
                    isProcessingOrNotLoggedIn
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer hover:border-indigo-300 hover:bg-gray-100'
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
                    点击或拖放图片
                  </p>
                  <p className="text-xs text-gray-500">支持 JPG, JPEG, PNG</p>
                  <p className="mt-2 text-xs font-medium text-indigo-500">
                    或直接粘贴 (Ctrl/Cmd+V)
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-white p-4 shadow-md transition-all duration-300">
                  <div className="flex flex-col sm:flex-row">
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
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h3 className="mb-1 line-clamp-1 text-sm font-medium text-gray-900">
                          {selectedFile.name}
                        </h3>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">
                            类型:{' '}
                            {selectedFile.type.split('/')[1]?.toUpperCase() ||
                              '未知'}
                          </p>
                          <p className="text-xs text-gray-500">
                            大小: {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={resetFileSelection}
                          disabled={isProcessingOrNotLoggedIn}
                          className={`flex items-center rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-300 focus:outline-none ${
                            isProcessingOrNotLoggedIn
                              ? 'cursor-not-allowed opacity-50'
                              : ''
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

            <div
              className="mb-6 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-6 transition-all duration-300 ease-in-out"
              style={{
                boxShadow:
                  '8px 8px 16px rgba(200, 204, 213, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.9)',
              }}
            >
              <div
                className={`${selectedPromptType === 'custom' ? 'mb-5' : ''}`}
              >
                <label
                  htmlFor="promptTypeSelect"
                  className="mb-3 block text-base font-medium text-gray-700"
                >
                  处理类型
                </label>
                <div className="relative" ref={dropdownRef}>
                  <div
                    onClick={() =>
                      !isProcessingOrNotLoggedIn &&
                      setDropdownOpen(!dropdownOpen)
                    }
                    className={`flex w-full items-center justify-between rounded-xl border-none bg-gray-50 px-5 py-3.5 text-gray-800 transition-all duration-300 ease-in-out focus:outline-none ${
                      isProcessingOrNotLoggedIn
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer hover:bg-gray-100'
                    }`}
                    style={{
                      boxShadow:
                        'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={dropdownOpen}
                  >
                    <span className="block truncate text-sm">
                      {
                        promptOptionsUI.find(
                          (option) => option.type === selectedPromptType,
                        )?.label
                      }
                    </span>
                    <svg
                      className={`h-5 w-5 text-gray-600 transition-transform duration-300 ${dropdownOpen ? 'rotate-180 transform' : ''}`}
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
                  {dropdownOpen && (
                    <div
                      className="ring-opacity-5 absolute z-10 mt-2 w-full origin-top-right rounded-xl bg-white py-2 shadow-lg ring-1 ring-black transition-all duration-300 ease-in-out"
                      style={{
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                        animation: 'fadeIn 0.2s ease-out forwards',
                      }}
                      role="listbox"
                    >
                      {promptOptionsUI.map((option) => (
                        <div
                          key={option.type}
                          onClick={() => handlePromptTypeChange(option.type)}
                          className="block cursor-pointer px-5 py-2.5 text-sm text-gray-700 transition-colors duration-200 hover:bg-indigo-50 hover:text-indigo-700"
                          role="option"
                          aria-selected={selectedPromptType === option.type}
                        >
                          {option.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                    rows={3}
                    value={customPromptText}
                    onChange={(e) => setCustomPromptText(e.target.value)}
                    disabled={isProcessingOrNotLoggedIn}
                    placeholder="在此处输入你希望使用的 Prompt..."
                    className={`block w-full rounded-xl border-none bg-gray-50 px-5 py-3 text-gray-800 placeholder-gray-400 transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none sm:text-sm ${
                      isProcessingOrNotLoggedIn
                        ? 'cursor-not-allowed bg-gray-100 opacity-60'
                        : ''
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

            <div
              className="mb-8 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-6 transition-all duration-300 ease-in-out"
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
                <span className="text-xs font-normal text-gray-500">
                  (可选)
                </span>
              </label>
              <input
                type="email"
                id="emailInput"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isProcessingOrNotLoggedIn}
                placeholder="your.email@example.com"
                className={`block w-full rounded-xl border-none bg-gray-50 px-5 py-3 text-gray-800 placeholder-gray-400 transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none sm:text-sm ${
                  isProcessingOrNotLoggedIn
                    ? 'cursor-not-allowed bg-gray-100 opacity-60'
                    : ''
                } ${email && !isValidEmail(email) ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-gray-50' : ''}`}
                style={{
                  boxShadow:
                    'inset 3px 3px 6px rgba(200, 204, 213, 0.5), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
                }}
              />
              {email && !isValidEmail(email) && (
                <p className="mt-2 text-xs text-red-600">
                  请输入有效的邮箱格式。
                </p>
              )}
            </div>

            {session ? (
              <button
                type="submit"
                disabled={isSubmitTrulyDisabled}
                className={`w-full transform rounded-xl border-none px-6 py-4 font-semibold text-white transition-all duration-300 ease-in-out focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none ${
                  isSubmitTrulyDisabled
                    ? 'bg-opacity-70 cursor-not-allowed bg-gray-300 text-gray-500'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 active:transform'
                }`}
                style={{
                  boxShadow: isSubmitTrulyDisabled
                    ? 'none'
                    : '6px 6px 12px rgba(200, 204, 213, 0.5), -6px -6px 12px rgba(255, 255, 255, 0.8)',
                }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
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
            ) : (
              <button
                type="button"
                onClick={handleLoginClick}
                className="w-full transform rounded-xl border-none bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 font-semibold text-white transition-all duration-300 ease-in-out hover:from-indigo-600 hover:to-purple-700 focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-2 focus:ring-offset-gray-50 focus:outline-none active:scale-95 active:transform"
                style={{
                  boxShadow:
                    '6px 6px 12px rgba(200, 204, 213, 0.5), -6px -6px 12px rgba(255, 255, 255, 0.8)',
                }}
              >
                登录以开始使用 ✨
              </button>
            )}
          </form>
        )}

        <div className="mt-6 w-full text-center">
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
              <p className="flex-1">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* 登录模态框 */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 ease-in-out sm:p-8"
            style={{
              boxShadow:
                '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 8px 24px -8px rgba(0, 0, 0, 0.15)',
              animation: 'fadeInUp 0.3s ease-out forwards',
            }}
          >
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="text-center">
              <h3 className="mb-6 text-2xl font-bold text-gray-800">
                登录 GhibliFlow Studio
              </h3>
              <p className="mb-8 text-gray-600">
                请选择以下方式登录以开始使用我们的服务
              </p>
              <div className="space-y-4">
                <button
                  onClick={() => signIn('github')}
                  className="flex w-full items-center justify-center space-x-3 rounded-xl bg-gray-800 px-4 py-3 text-white shadow-md transition-all duration-200 hover:bg-gray-900 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
                >
                  <svg
                    className="h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>使用 GitHub 登录</span>
                </button>
                <button
                  onClick={() => signIn('google')}
                  className="flex w-full items-center justify-center space-x-3 rounded-xl bg-white px-4 py-3 text-gray-700 shadow-md ring-1 ring-gray-300 transition-all duration-200 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
                >
                  <svg
                    className="h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  <span>使用 Google 登录</span>
                </button>
              </div>
              <p className="mt-6 text-xs text-gray-500">
                登录即表示您同意我们的服务条款和隐私政策
              </p>
            </div>
          </div>
        </div>
      )}

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
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
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
