"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const promptOptionsUI = [
  { type: 'ghibli', label: '吉卜力风格 (Ghibli Style)' },
  { type: 'cat-human', label: '猫咪拟人化 (Cats as Humans)' },
  { type: 'irasutoya', label: 'いらすとや风格 (Irasutoya Style)' },
  { type: 'custom', label: '自定义 Prompt (Custom)' }
];

const DEFAULT_PROMPT_TYPE = 'ghibli'; // Default selection type

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [selectedPromptType, setSelectedPromptType] = useState(DEFAULT_PROMPT_TYPE);

  const [customPromptText, setCustomPromptText] = useState('');
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
    } catch (err) { // Remove : any
      console.error("上传错误:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`❌ 错误: ${errorMessage}`);
      setIsLoading(false);
    }
  };


  const isSubmitDisabled = !selectedFile || isLoading || (selectedPromptType === 'custom' && !customPromptText.trim());

  return (
      <main className="container mx-auto px-4 py-8 flex flex-col items-center min-h-screen bg-gray-50">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-gray-700">
          🎨 图像风格转换与处理 🎨
        </h1>
        <form onSubmit={handleSubmit} className="w-full max-w-lg bg-white p-6 md:p-8 rounded-xl shadow-lg mb-8 border border-gray-200">
          {/* File Input */}
          <div className="mb-6">
            <label htmlFor="imageUpload" className="block text-gray-700 text-sm font-bold mb-2">
              选择图片 (JPG/PNG):
            </label>
            <input
                type="file"
                id="imageUpload"
                accept=".jpg, .jpeg, .png"
                onChange={handleFileChange}
                disabled={isLoading}
                className={`block w-full text-sm text-gray-500 border border-gray-300 rounded-lg cursor-pointer
              file:mr-4 file:py-2 file:px-4
              file:rounded-l-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-violet-700
              hover:file:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="promptTypeSelect" className="block text-gray-700 text-sm font-bold mb-2">
              选择处理类型:
            </label>
            <select
                id="promptTypeSelect"
                value={selectedPromptType}
                onChange={handlePromptTypeChange}
                disabled={isLoading}
                className={`block w-full px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {promptOptionsUI.map((option) => (
                  <option key={option.type} value={option.type}>
                    {option.label}
                  </option>
              ))}
            </select>
          </div>


          {selectedPromptType === 'custom' && (
              <div className="mb-6">
                <label htmlFor="customPromptText" className="block text-gray-700 text-sm font-bold mb-2">
                  输入自定义 Prompt:
                </label>
                <textarea
                    id="customPromptText"
                    rows={3}
                    value={customPromptText}
                    onChange={(e) => setCustomPromptText(e.target.value)}
                    disabled={isLoading}
                    placeholder="在此处输入你希望使用的 Prompt..."
                    className={`block w-full px-3 py-2 text-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                />
              </div>
          )}


          {previewUrl && !isLoading && (
              <div className="mb-6 border rounded-md p-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-600 mb-2 text-center">预览:</p>
                <img src={previewUrl} alt="已选图片预览" className="max-w-full h-auto max-h-48 mx-auto rounded shadow-sm"/>
              </div>
          )}


          <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`w-full px-4 py-3 font-bold text-white rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200 ease-in-out
            ${isSubmitDisabled
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {isLoading ? '正在处理...' : '上传并开始处理'}
          </button>
        </form>

        {/* Status Area */}
        <div className="w-full max-w-lg text-center mt-4">
          {/* Error Message */}
          {error && (
              <div className="text-base md:text-lg mb-4 p-4 rounded-lg shadow-sm border text-red-800 bg-red-100 border-red-300">
                <p>{error}</p>
              </div>
          )}
          {/* Loading Indicator */}
          {isLoading && (
              <div className="flex justify-center items-center space-x-2 mt-6">
                <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-600 text-lg">正在处理，请稍候...</span>
              </div>
          )}
        </div>
      </main>
  );
}