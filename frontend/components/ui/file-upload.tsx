"use client";

import { useState, useCallback } from "react";
import { Upload, X, CheckCircle, File, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void> | void;
  accept?: string;
  maxSize?: number; // in MB
  requireConfirmation?: boolean;
  confirmButtonText?: string;
}

export function FileUpload({
  onUpload,
  accept = ".pdf,.docx,.zip",
  maxSize = 50,
  requireConfirmation = true,
  confirmButtonText = "Xác nhận nộp file",
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isReadyToUpload, setIsReadyToUpload] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const validateFile = (selectedFile: File) => {
    setError(null);
    const sizeInMB = selectedFile.size / (1024 * 1024);
    if (sizeInMB > maxSize) {
      setError(`File quá lớn. Tối đa là ${maxSize}MB.`);
      return false;
    }
    
    if (accept) {
      const extension = `.${selectedFile.name.split('.').pop()?.toLowerCase()}`;
      const acceptedExtensions = accept.split(',').map(ext => ext.trim());
      if (!acceptedExtensions.includes(extension)) {
         setError(`Định dạng không được hỗ trợ. Vui lòng chọn ${accept}.`);
         return false;
      }
    }

    return true;
  };

  const processFile = async (selectedFile: File) => {
    setIsUploading(true);
    setIsReadyToUpload(false);
    setIsUploaded(false);
    setProgress(20);
    setError(null);

    try {
      setProgress(55);
      await onUpload(selectedFile);
      setProgress(100);
      setIsUploaded(true);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Tải file thất bại. Vui lòng thử lại.";
      setError(message);
      setProgress(0);
      setIsReadyToUpload(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCandidateFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setProgress(0);
    setIsUploaded(false);

    if (requireConfirmation) {
      setIsReadyToUpload(true);
      return;
    }

    void processFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) {
      return;
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      if (validateFile(selectedFile)) {
        handleCandidateFile(selectedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) {
      return;
    }

    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        handleCandidateFile(selectedFile);
      }
    }
  };

  const confirmUpload = () => {
    if (!file || isUploading) {
      return;
    }

    void processFile(file);
  };

  const reset = () => {
    setFile(null);
    setError(null);
    setProgress(0);
    setIsUploading(false);
    setIsReadyToUpload(false);
    setIsUploaded(false);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-3xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-all duration-300 ${
              isDragging
                ? "border-primary bg-primary/10 shadow-[0_0_40px_-10px_rgba(var(--primary),0.3)] scale-[1.02]"
                : error 
                  ? "border-error/50 bg-error/5"
                  : "border-outline-variant/40 bg-surface-container-lowest hover:border-primary/50 hover:bg-primary/[0.02]"
            }`}
          >
            <motion.div
              animate={{ y: isDragging ? -10 : 0 }}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 ${
                isDragging ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-primary-container/30 text-primary"
              }`}
            >
              <Upload className="w-8 h-8" />
            </motion.div>
            
            <h3 className="text-lg font-bold font-headline text-on-surface mb-2">
              Kéo thả file vào đây
            </h3>
            
            <p className="text-sm text-outline max-w-sm font-body mb-6">
              Hỗ trợ: <span className="font-medium text-on-surface">{accept}</span> · Tối đa {maxSize}MB
            </p>
            
            <label className="cursor-pointer relative z-10">
              <input type="file" className="hidden" accept={accept} onChange={handleFileChange} />
              <span className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 text-sm">
                Chọn file từ thiết bị
              </span>
            </label>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-0 right-0 flex justify-center"
              >
                <div className="flex items-center gap-1.5 bg-error/10 text-error px-3 py-1.5 rounded-full text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="file-info"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 overflow-hidden relative shadow-sm"
          >
            {isUploading && (
              <div 
                className="absolute top-0 left-0 bottom-0 bg-primary/5 transition-all duration-300 ease-linear"
                style={{ width: `${progress}%` }}
              />
            )}
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isUploaded ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <File className="w-6 h-6" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-on-surface text-sm truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-outline">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  {isUploading ? (
                    <span className="text-xs font-medium text-primary">Đang tải lên... {progress}%</span>
                  ) : isUploaded ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                      <CheckCircle className="w-3.5 h-3.5" /> Thành công
                    </span>
                  ) : isReadyToUpload ? (
                    <span className="text-xs font-medium text-primary">Đã chọn file, chờ xác nhận nộp</span>
                  ) : (
                    <span className="text-xs font-medium text-outline">Sẵn sàng tải lên</span>
                  )}
                </div>
                {error && !isUploading && (
                  <p className="mt-1 text-xs text-error">{error}</p>
                )}
              </div>
            </div>

            {!isUploading && (
              <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
                {isReadyToUpload && !isUploaded && (
                  <button
                    type="button"
                    onClick={confirmUpload}
                    className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {confirmButtonText}
                  </button>
                )}

                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/20 text-sm font-semibold text-outline hover:text-error hover:border-error/30 hover:bg-error/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                  {isUploaded ? "Nộp file khác" : "Chọn file khác"}
                </button>
              </div>
            )}
            
            {isUploading && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-linear rounded-r-full"
                  style={{ width: `${progress}%` }} 
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
