// Topic state translation and styling
export const TOPIC_STATE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:           { label: 'Nháp',             color: 'text-gray-700',   bg: 'bg-gray-100'  },
  PENDING_GV:      { label: 'Chờ GVHD duyệt',   color: 'text-amber-700',  bg: 'bg-amber-50'  },
  CONFIRMED:       { label: 'Đã xác nhận',      color: 'text-blue-700',   bg: 'bg-blue-50'   },
  PENDING_TBM:     { label: 'Chờ Bộ môn duyệt', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  IN_PROGRESS:     { label: 'Đang thực hiện',   color: 'text-green-700',  bg: 'bg-green-50'  },
  PENDING_CONFIRM: { label: 'Chờ chốt hội đồng',color: 'text-orange-700', bg: 'bg-orange-50' },
  DEFENSE:         { label: 'Đang bảo vệ',      color: 'text-purple-700', bg: 'bg-purple-50' },
  GRADING:         { label: 'Đang chấm điểm',   color: 'text-pink-700',   bg: 'bg-pink-50'   },
  SCORING:         { label: 'Đang chấm điểm',   color: 'text-pink-700',   bg: 'bg-pink-50'   },
  COMPLETED:       { label: 'Hoàn thành',       color: 'text-teal-700',   bg: 'bg-teal-50'   },
  REJECTED:        { label: 'Bị từ chối',       color: 'text-red-700',    bg: 'bg-red-50'    },
  CANCELLED:       { label: 'Đã huỷ',           color: 'text-gray-500',   bg: 'bg-gray-50'   },
};

export const TOPIC_TYPE_LABELS: Record<string, string> = {
  BCTT: 'Báo cáo thực tập',
  KLTN: 'Khoá luận tốt nghiệp',
};

export const TOPIC_DOMAIN_OPTIONS = [
  'Trí tuệ nhân tạo',
  'Khoa học dữ liệu',
  'Kỹ thuật phần mềm',
  'Phát triển Web',
  'Phát triển di động',
  'Mạng máy tính',
  'An toàn thông tin',
  'IoT và hệ nhúng',
  'Điện toán đám mây',
  'Khác',
];

export const FILE_TYPE_LABELS: Record<string, string> = {
  REPORT:                  'Báo cáo',
  TURNITIN:                'Kiểm tra đạo văn',
  REVISION:                'Bản chỉnh sửa',
  INTERNSHIP_CONFIRMATION: 'Phiếu xác nhận thực tập',
};

export const PERIOD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN:   { label: 'Đang mở',  color: 'text-green-700' },
  CLOSED: { label: 'Đã đóng', color: 'text-gray-600'  },
  DRAFT:  { label: 'Nháp',    color: 'text-amber-700' },
};

export const SCORE_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Đã chấm',
  PENDING:   'Chưa chấm',
};

export const KLTN_ELIGIBILITY_REASONS: Record<string, string> = {
  OK:                    'Đủ điều kiện đăng ký KLTN',
  BCTT_INCOMPLETE:       'Chưa hoàn thành Báo cáo thực tập',
  BCTT_SCORE_TOO_LOW:    'Điểm BCTT phải lớn hơn 5.0',
  KLTN_COMPLETED_EXISTS: 'Bạn đã có đề tài KLTN COMPLETED',
};

// Smart deadline display helper
export function formatDeadlineStatus(endAt?: string): {
  label: string;
  urgency: 'overdue' | 'urgent' | 'normal' | 'none';
  display: string;
} {
  if (!endAt) return { label: 'Chưa thiết lập', urgency: 'none', display: '-' };
  
  const now = Date.now();
  const end = new Date(endAt).getTime();
  const diffMs = end - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    return { 
      label: 'Đã quá hạn', 
      urgency: 'overdue', 
      display: new Date(endAt).toLocaleDateString('vi-VN') 
    };
  }
  
  if (diffDays <= 1) {
    return { 
      label: `Hôm nay lúc ${new Date(endAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`, 
      urgency: 'urgent', 
      display: 'Còn < 24 giờ' 
    };
  }
  
  if (diffDays <= 3) {
    return { 
      label: `Còn ${diffDays} ngày`, 
      urgency: 'urgent', 
      display: new Date(endAt).toLocaleDateString('vi-VN') 
    };
  }
  
  return { 
    label: `Còn ${diffDays} ngày`, 
    urgency: 'normal', 
    display: new Date(endAt).toLocaleDateString('vi-VN') 
  };
}
