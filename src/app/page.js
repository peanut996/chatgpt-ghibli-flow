'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Keep prompt options definition
const promptOptionsUI = [
  { type: 'ghibli', label: '吉卜力风格 (Ghibli Style)' },
  { type: 'cat-human', label: '猫咪拟人化 (Cats as Humans)' },
  { type: 'irasutoya', label: 'いらすとや风格 (Irasutoya Style)' },
  { type: 'custom', label: '自定义 Prompt (Custom)' },
];
const DEFAULT_PROMPT_TYPE = 'ghibli';

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedPromptType, setSelectedPromptType] =
    useState(DEFAULT_PROMPT_TYPE);
  const [customPromptText, setCustomPromptText] = useState('');
  const router = useRouter();

  // Keep existing handler functions (handleFileChange, handlePromptTypeChange, handleSubmit)
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
    if (!selectedFile) {
      setError('请先选择一个图片文件。');
      return;
    }
    if (selectedPromptType === 'custom' && !customPromptText.trim()) {
      setError('选择自定义 Prompt 时，请输入内容。');
      return;
    }
    setIsLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('promptType', selectedPromptType);
    if (selectedPromptType === 'custom') {
      formData.append('customPromptText', customPromptText);
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
      setError(`❌ 处理时发生错误: ${errorMessage}`); // Slightly improved error prefix
      setIsLoading(false);
    }
  };

  const isSubmitDisabled =
    !selectedFile ||
    isLoading ||
    (selectedPromptType === 'custom' && !customPromptText.trim());

  return (
    // Use flex to center content vertically and ensure min height
    <main className="container mx-auto flex min-h-screen flex-col items-center px-4 py-12 md:py-16">
      {/* Enhanced Title */}
      <h1 className="mb-10 text-center text-4xl font-bold tracking-tight text-gray-800 md:text-5xl">
        🎨 GhibliFlow Studio 🎨
      </h1>

      {/* Enhanced Form Styling */}
      <form
        onSubmit={handleSubmit}
        className="mb-10 w-full max-w-xl rounded-2xl border border-gray-200/80 bg-white p-8 shadow-xl md:p-10"
      >
        {/* File Input Section */}
        <div className="mb-6">
          <label
            htmlFor="imageUpload"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            1. 选择图片 (JPG/PNG)
          </label>
          <input
            type="file"
            id="imageUpload"
            accept=".jpg, .jpeg, .png"
            onChange={handleFileChange}
            disabled={isLoading}
            // Enhanced file input styling
            className={`block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-600 transition-colors duration-200 file:mr-4 file:rounded-l-md file:border-0 file:bg-indigo-50 file:px-5 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none ${isLoading ? 'cursor-not-allowed opacity-60' : ''}`}
          />
        </div>

        {/* Prompt Type Selection */}
        <div className="mb-6">
          <label
            htmlFor="promptTypeSelect"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            2. 选择处理类型
          </label>
          <select
            id="promptTypeSelect"
            value={selectedPromptType}
            onChange={handlePromptTypeChange}
            disabled={isLoading}
            // Enhanced select styling
            className={`block w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-800 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:text-sm ${
              isLoading
                ? 'cursor-not-allowed bg-gray-100 opacity-60'
                : 'hover:border-gray-400'
            }`}
          >
            {promptOptionsUI.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Prompt Textarea (Conditional) */}
        {selectedPromptType === 'custom' && (
          <div className="mb-6 transition-all duration-300 ease-in-out">
            {' '}
            {/* Added transition */}
            <label
              htmlFor="customPromptText"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              3. 输入自定义 Prompt
            </label>
            <textarea
              id="customPromptText"
              rows={4} // Slightly taller
              value={customPromptText}
              onChange={(e) => setCustomPromptText(e.target.value)}
              disabled={isLoading}
              placeholder="在此处输入你希望使用的 Prompt..."
              // Enhanced textarea styling
              className={`block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-800 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none sm:text-sm ${
                isLoading
                  ? 'cursor-not-allowed bg-gray-100 opacity-60'
                  : 'hover:border-gray-400'
              }`}
            />
          </div>
        )}

        {/* Image Preview */}
        {previewUrl && !isLoading && (
          <div className="mt-4 mb-8 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 transition-all duration-300 ease-in-out">
            {' '}
            {/* Added transition */}
            <p className="mb-3 text-center text-sm font-semibold text-gray-700">
              图片预览:
            </p>
            <img
              src={previewUrl}
              alt="已选图片预览"
              // Enhanced preview image style
              className="mx-auto h-auto max-h-48 max-w-full rounded-md object-contain shadow-md md:max-h-60"
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          // Enhanced button styling
          className={`focus:ring-opacity-50 w-full transform rounded-lg px-6 py-3 font-semibold text-white transition-all duration-300 ease-in-out hover:scale-[1.02] focus:ring-4 focus:ring-indigo-500 focus:outline-none ${
            isSubmitDisabled
              ? 'cursor-not-allowed bg-gray-400'
              : 'bg-indigo-600 shadow-md hover:bg-indigo-700 hover:shadow-lg'
          }`}
        >
          {/* Conditional text based on loading state */}
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
          )}{' '}
          {/* Added emoji */}
        </button>
      </form>

      {/* Status Area - Below form for better flow */}
      <div className="mt-0 w-full max-w-xl text-center">
        {' '}
        {/* Reduced top margin */}
        {/* Error Message */}
        {error && (
          // Enhanced error message styling
          <div className="mb-6 flex items-center justify-center space-x-2 rounded-lg border border-red-300 bg-red-100 p-4 text-sm text-red-800 shadow md:text-base">
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
            <p>{error}</p>
          </div>
        )}
        {/* Loading Indicator - Now inside the button, so this separate one might be redundant unless showing queue status */}
        {/* {isLoading && (
              <div className="flex justify-center items-center space-x-2 mt-6">
                <svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-700 text-lg font-medium">正在处理，请稍候...</span>
              </div>
          )} */}
      </div>
    </main>
  );
}
