import { RefreshCcw, AlertTriangle } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = "Đã xảy ra lỗi", 
  message = "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.", 
  onRetry 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px] bg-red-50/50 rounded-lg border border-red-100">
      <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Thử lại
        </button>
      )}
    </div>
  );
}
