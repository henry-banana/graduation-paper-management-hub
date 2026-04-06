import { AlertTriangle, CheckCircle2, Info, ListChecks } from "lucide-react";
import { TOPIC_STATE_LABELS } from "@/lib/constants/vi-labels";

type TopicType = "BCTT" | "KLTN";
type RoleGuide = "STUDENT" | "GVHD" | "GVPB" | "COUNCIL" | "TBM";

type TopicState =
  | "DRAFT"
  | "PENDING_GV"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "PENDING_CONFIRM"
  | "DEFENSE"
  | "GRADING"
  | "SCORING"
  | "COMPLETED"
  | "CANCELLED"
  | string;

interface GuideContent {
  meaning: string;
  nextSteps: string[];
  warning?: string;
}

interface TopicStateGuideProps {
  role: RoleGuide;
  topicType: TopicType;
  topicState: TopicState;
  className?: string;
}

const FLOW_BY_TYPE: Record<TopicType, TopicState[]> = {
  BCTT: ["DRAFT", "PENDING_GV", "CONFIRMED", "IN_PROGRESS", "GRADING", "COMPLETED"],
  KLTN: [
    "DRAFT",
    "PENDING_GV",
    "CONFIRMED",
    "IN_PROGRESS",
    "PENDING_CONFIRM",
    "DEFENSE",
    "SCORING",
    "COMPLETED",
  ],
};

function getStateLabel(state: TopicState): string {
  return TOPIC_STATE_LABELS[state]?.label ?? state;
}

function buildGuide(role: RoleGuide, topicType: TopicType, topicState: TopicState): GuideContent {
  const fallback: GuideContent = {
    meaning: "Theo dõi đúng trạng thái hiện tại để thao tác bước tiếp theo.",
    nextSteps: ["Kiểm tra lại mục Thao tác của vai trò hiện tại.", "Không chuyển state nếu chưa đủ hồ sơ."],
  };

  if (role === "STUDENT") {
    switch (topicState) {
      case "DRAFT":
        return {
          meaning: "Đề tài đang ở dạng nháp.",
          nextSteps: ["Hoàn thiện thông tin đề tài.", "Bấm gửi để chuyển sang chờ GVHD duyệt."],
        };
      case "PENDING_GV":
        return {
          meaning: "Đang chờ GVHD duyệt đề tài.",
          nextSteps: ["Theo dõi thông báo duyệt/từ chối.", "Nếu bị từ chối, chỉnh sửa và gửi lại."],
        };
      case "CONFIRMED":
        return {
          meaning: "Đề tài đã được xác nhận và chuẩn bị vào giai đoạn thực hiện.",
          nextSteps: ["Theo dõi hướng dẫn từ GVHD.", "Chuẩn bị tài liệu để nộp trong giai đoạn thực hiện."],
        };
      case "IN_PROGRESS":
        return {
          meaning: "Đang trong giai đoạn thực hiện đề tài.",
          nextSteps:
            topicType === "BCTT"
              ? ["Nộp báo cáo (và phiếu xác nhận thực tập nếu có).", "Đảm bảo nộp trước hạn."]
              : ["Nộp báo cáo KLTN đúng hạn.", "Chờ GVHD chuyển sang bước phản biện."],
        };
      case "PENDING_CONFIRM":
        return {
          meaning: "Đang chờ phân công phản biện/hội đồng.",
          nextSteps: ["Theo dõi lịch bảo vệ.", "Chuẩn bị nội dung bảo vệ."],
          warning: "Trạng thái này CHƯA phải bước chấm điểm.",
        };
      case "DEFENSE":
        return {
          meaning: "Đề tài đang ở phiên bảo vệ.",
          nextSteps: ["Tham gia bảo vệ đúng lịch.", "Trả lời câu hỏi từ GVPB/Hội đồng."],
        };
      case "GRADING":
      case "SCORING":
        return {
          meaning: "Giảng viên/Hội đồng đang chấm điểm.",
          nextSteps:
            topicType === "KLTN"
              ? ["Chờ kết quả chấm.", "Nộp bản chỉnh sửa nếu được mở vòng chỉnh sửa."]
              : ["Chờ GVHD công bố kết quả BCTT."],
        };
      case "COMPLETED":
        return {
          meaning: "Đề tài đã hoàn tất quy trình.",
          nextSteps: ["Kiểm tra điểm tổng kết.", "Theo dõi các yêu cầu bổ sung (nếu có)."],
        };
      default:
        return fallback;
    }
  }

  if (role === "GVHD") {
    switch (topicState) {
      case "PENDING_GV":
        return {
          meaning: "Đang chờ bạn duyệt đề tài.",
          nextSteps: ["Kiểm tra nội dung đề tài.", "Duyệt hoặc từ chối có lý do."],
        };
      case "CONFIRMED":
        return {
          meaning: "Đề tài đã được xác nhận, sẵn sàng bắt đầu thực hiện.",
          nextSteps: ["Kích hoạt trạng thái thực hiện khi sinh viên bắt đầu làm.", "Nhắc sinh viên về hạn nộp."],
        };
      case "IN_PROGRESS":
        return {
          meaning: "Sinh viên đang thực hiện đề tài.",
          nextSteps:
            topicType === "BCTT"
              ? ["Kiểm tra bài nộp.", "Đủ điều kiện thì chuyển sang GRADING."]
              : ["Kiểm tra báo cáo + turnitin.", "Đủ điều kiện thì chuyển sang PENDING_CONFIRM."],
        };
      case "PENDING_CONFIRM":
        return {
          meaning: "Đề tài đang chờ phân công phản biện/hội đồng.",
          nextSteps: ["Theo dõi TBM phân công GVPB và hội đồng.", "Phối hợp chốt lịch bảo vệ."],
          warning: "Bước này CHƯA chấm điểm.",
        };
      case "DEFENSE":
        return {
          meaning: "Đang tới giai đoạn bảo vệ.",
          nextSteps: ["Có thể nộp điểm ngay sau/buổi bảo vệ.", "Lần nộp điểm đầu sẽ tự chuyển SCORING."],
        };
      case "GRADING":
      case "SCORING":
        return {
          meaning: "Đang trong giai đoạn chấm điểm.",
          nextSteps: ["Hoàn tất phiếu chấm.", "Kiểm tra xác nhận cuối trước khi khóa điểm."],
        };
      case "COMPLETED":
        return {
          meaning: "Đề tài đã hoàn tất.",
          nextSteps: ["Lưu hồ sơ chấm và biên bản.", "Không còn thao tác chuyển trạng thái."],
        };
      default:
        return fallback;
    }
  }

  if (role === "GVPB") {
    switch (topicState) {
      case "PENDING_CONFIRM":
        return {
          meaning: "Bạn đã được phân công phản biện nhưng chưa vào bước chấm điểm.",
          nextSteps: ["Đọc báo cáo và chuẩn bị câu hỏi phản biện.", "Phối hợp xác nhận lịch bảo vệ."],
          warning: "Chưa thể chấm điểm ở trạng thái này.",
        };
      case "DEFENSE":
        return {
          meaning: "Đang diễn ra/chuẩn bị bảo vệ.",
          nextSteps: ["Mở trang phản biện để nộp phiếu điểm.", "Nêu câu hỏi phản biện trong phiên bảo vệ."],
        };
      case "SCORING":
        return {
          meaning: "Hệ thống đang ở giai đoạn chấm điểm.",
          nextSteps: ["Kiểm tra lại phiếu phản biện đã nộp.", "Cập nhật điểm nếu chính sách còn cho phép."],
        };
      case "COMPLETED":
        return {
          meaning: "Đề tài đã kết thúc quy trình.",
          nextSteps: ["Xem lại biên bản/kết quả cuối.", "Không cần thao tác thêm."],
        };
      default:
        return fallback;
    }
  }

  if (role === "COUNCIL") {
    switch (topicState) {
      case "DEFENSE":
        return {
          meaning: "Đang ở phiên bảo vệ, hội đồng có thể nhập điểm.",
          nextSteps: ["Nộp phiếu điểm hội đồng.", "Lần nộp đầu tiên sẽ tự chuyển sang SCORING."],
        };
      case "SCORING":
        return {
          meaning: "Đang tổng hợp điểm hội đồng.",
          nextSteps: ["Hoàn tất các phiếu điểm còn thiếu.", "Thư ký/chủ tịch kiểm tra xác nhận cuối."],
        };
      case "COMPLETED":
        return {
          meaning: "Đề tài đã chốt điểm và hoàn tất.",
          nextSteps: ["Xem tổng hợp điểm cuối.", "Không thao tác chỉnh sửa điểm."],
        };
      default:
        return fallback;
    }
  }

  if (role === "TBM") {
    switch (topicState) {
      case "IN_PROGRESS":
        return {
          meaning: "Đề tài đang trong giai đoạn thực hiện.",
          nextSteps: ["Theo dõi tiến độ chung.", "Hỗ trợ xử lý nếu phát sinh vấn đề phân công."],
        };
      case "PENDING_CONFIRM":
        return {
          meaning: "Điểm nghẽn vận hành: cần chốt phản biện/hội đồng.",
          nextSteps: [
            "Phân công GVPB.",
            "Phân công hội đồng và lịch bảo vệ.",
            "Đảm bảo đề tài chuyển sang DEFENSE đúng thời điểm.",
          ],
          warning: "Nếu để lâu ở trạng thái này, các bên sẽ hiểu nhầm là đã vào chấm điểm.",
        };
      case "DEFENSE":
        return {
          meaning: "Đang vào giai đoạn bảo vệ.",
          nextSteps: ["Theo dõi đủ thành phần buổi bảo vệ.", "Nhắc giảng viên/hội đồng nộp phiếu điểm."],
        };
      case "SCORING":
      case "GRADING":
        return {
          meaning: "Đang tổng hợp và chốt điểm.",
          nextSteps: ["Theo dõi phiếu điểm còn thiếu.", "Xử lý vòng chỉnh sửa (nếu có)."],
        };
      case "COMPLETED":
        return {
          meaning: "Đề tài đã hoàn tất hồ sơ.",
          nextSteps: ["Kiểm tra xuất báo cáo tổng hợp.", "Đảm bảo dữ liệu lưu trữ đầy đủ."],
        };
      default:
        return fallback;
    }
  }

  return fallback;
}

export function TopicStateGuide({
  role,
  topicType,
  topicState,
  className,
}: TopicStateGuideProps) {
  const guide = buildGuide(role, topicType, topicState);
  const flow = FLOW_BY_TYPE[topicType];
  const currentIndex = flow.indexOf(topicState);

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3 ${className ?? ""}`}>
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">
            Hướng dẫn bước tiếp theo ({role})
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            Trạng thái hiện tại: <span className="font-semibold">{getStateLabel(topicState)}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {flow.map((state) => {
          const idx = flow.indexOf(state);
          const isActive = idx === currentIndex;
          const isDone = currentIndex >= 0 && idx < currentIndex;
          return (
            <span
              key={state}
              className={`text-[11px] px-2 py-1 rounded-full border ${
                isActive
                  ? "bg-blue-700 text-white border-blue-700"
                  : isDone
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {getStateLabel(state)}
            </span>
          );
        })}
      </div>

      <div className="bg-white/70 border border-blue-100 rounded-xl p-3">
        <p className="text-xs font-semibold text-slate-700 mb-1">Ý nghĩa trạng thái</p>
        <p className="text-sm text-slate-700">{guide.meaning}</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" />
          Việc cần làm tiếp theo
        </p>
        {guide.nextSteps.map((step, index) => (
          <div key={index} className="flex items-start gap-2 text-sm text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
            <span>{step}</span>
          </div>
        ))}
      </div>

      {guide.warning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">{guide.warning}</p>
        </div>
      )}
    </div>
  );
}
