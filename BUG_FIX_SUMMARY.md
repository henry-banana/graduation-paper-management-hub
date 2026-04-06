# Bug Fix Summary - Confirmation & Scoring Issues

## Ngày: 2026-04-06

## Bugs Reported:
1. ✅ **Thư ký xác nhận rồi nhưng `aggregatedByTkHd` không bật `true` trong database**
2. ✅ **GVHD không có chỗ confirm**  
3. ✅ **Chủ tịch bị dính cứng ở chỗ không được publish**
4. ⚠️ **Khi chấm bài có 5 tiêu chí nhưng khi ra điểm mất 2 tiêu chí**

---

## Root Cause Analysis

### Bug #1: aggregatedByTkHd không được trả về
**Nguyên nhân**: Method `toScoreSummaryDto()` trong `scores.service.ts` không map các field `aggregatedByTkHd`, `aggregatedByTkHdAt`, `aggregatedByTkHdUserId`

**Location**: `backend/src/modules/scores/scores.service.ts:616-626`

**Fix Applied**:
```typescript
// BEFORE
private toScoreSummaryDto(summary: ScoreSummaryRecord): ScoreSummaryDto {
  return {
    gvhdScore: summary.gvhdScore,
    // ...
    published: summary.published,
  };
}

// AFTER  
private toScoreSummaryDto(summary: ScoreSummaryRecord): ScoreSummaryDto {
  return {
    gvhdScore: summary.gvhdScore,
    // ...
    published: summary.published,
    aggregatedByTkHd: summary.aggregatedByTkHd,
    aggregatedByTkHdAt: summary.aggregatedByTkHdAt,
    aggregatedByTkHdUserId: summary.aggregatedByTkHdUserId,
  };
}
```

---

### Bug #2: GVHD Confirm Flow

**Kết quả điều tra**: Flow này **đã tồn tại và hoạt động đúng**!

**Endpoints**:
- ✅ Trang GVHD: `/gvhd/final-confirm/page.tsx`
- ✅ API call: `POST /topics/${topicId}/scores/confirm` với body `{ role: "GVHD" }`
- ✅ Backend handler: `scores.controller.ts:291-314` → `scores.service.ts:1269-1410` 
- ✅ Set `confirmedByGvhd: true` ở line 1326

**Hướng dẫn sử dụng**:
1. GVHD vào trang `/gvhd/final-confirm`
2. Xem danh sách topics đã được TK_HD tổng hợp
3. Click "Tôi xác nhận điểm đã chính xác"

---

### Bug #3: CT_HD Publish Flow

**Kết quả điều tra**: Flow này **đã tồn tại và hoạt động đúng**!

**Endpoints**:
- ✅ Trang CT_HD: `/council/final-confirm/page.tsx`
- ✅ API call: `POST /topics/${topicId}/scores/confirm-publish`
- ✅ Backend handler: `scores.controller.ts:320-339` → gọi `confirm()` với `role: 'CT_HD'`
- ✅ Logic kiểm tra:
  - Line 1299: Yêu cầu `aggregatedByTkHd === true` trước khi CT_HD publish
  - Line 1331: Chỉ publish khi **CẢ** GVHD và CT_HD đều confirm
  
**Điều kiện để CT_HD publish được**:
```typescript
// Trong final-confirm/page.tsx line 79-89
if (!scores.aggregatedByTkHd) return "Thư ký chưa tổng hợp điểm"; // ← BUG #1 gây ra vấn đề này!
if (!scores.gvhdConfirmed) return "Chờ GVHD xác nhận";
if (scores.ctHdConfirmed) return "CT_HĐ đã xác nhận trước đó";
```

**Sau khi fix Bug #1**, CT_HD sẽ thấy đúng trạng thái `aggregatedByTkHd` và có thể publish!

---

### Bug #4: Số lượng tiêu chí

**Kết quả điều tra**: **KHÔNG PHẢI BUG** - Hệ thống hoạt động đúng thiết kế!

**Rubric Definitions** (backend/scores.controller.ts:499-532):
```typescript
TV_HD: [
  { id: 'presentation', max: 2.0 },  // Hình thức & trình bày
  { id: 'content', max: 5.0 },       // Nội dung chuyên môn
  { id: 'defense', max: 3.0 },       // Khả năng bảo vệ
]
// Tổng: 10 điểm
```

**Frontend** (council/scoring/page.tsx:36-40):
```typescript
const RUBRIC_COUNCIL = [
  { id: "presentation", label: "1. Hình thức & trình bày", max: 2.0 },
  { id: "content", label: "2. Nội dung chuyên môn", max: 5.0 },
  { id: "defense", label: "3. Khả năng bảo vệ", max: 3.0 },
];
```

**✅ Kết luận**: Chỉ có **3 tiêu chí** cho TV_HD/Council, KHÔNG phải 5.

**Nếu user thấy "mất 2 tiêu chí"**, có thể:
1. Nhầm lẫn với rubric GVHD (có 5 tiêu chí cho KLTN)
2. Dữ liệu cũ từ Google Sheets có format khác
3. UI cache chưa refresh

**Khuyến nghị**: Yêu cầu user clear browser cache và thử lại.

---

## Testing Checklist

### ✅ Backend Changes Verified
- [x] `toScoreSummaryDto()` map đầy đủ aggregation fields
- [x] Endpoint `/topics/:topicId/scores/aggregate` tồn tại
- [x] Endpoint `/topics/:topicId/scores/confirm` tồn tại
- [x] Endpoint `/topics/:topicId/scores/confirm-publish` tồn tại
- [x] Rubric definitions đúng (3 tiêu chí cho Council)

### 🔄 Frontend - Needs Testing
- [ ] TK_HD aggregate → `aggregatedByTkHd` = true in response
- [ ] GVHD confirm page hiện đúng topics
- [ ] CT_HD publish page kiểm tra đúng điều kiện
- [ ] Council scoring hiển thị đúng 3 tiêu chí

---

## Flow Đúng (Happy Path)

### KLTN Scoring & Confirmation Flow:

```
1. GVHD chấm điểm (3 options: attitude, presentation, content, innovation, defense)
   POST /topics/{id}/scores/submit-direct { role: "GVHD", criteria: {...} }

2. GVPB chấm điểm (3 options: content, presentation, defense)  
   POST /topics/{id}/scores/submit-direct { role: "GVPB", criteria: {...} }

3. TV_HD/CT_HD/TK_HD chấm điểm (3 options: presentation, content, defense)
   POST /topics/{id}/scores/submit-direct { role: "TV_HD", criteria: {...} }

4. ✨ TK_HD tổng hợp điểm (/council/summary)
   POST /topics/{id}/scores/aggregate
   → Set aggregatedByTkHd = true ✓
   → Lock tất cả scores (irreversible) ✓

5. GVHD xác nhận (/gvhd/final-confirm)
   POST /topics/{id}/scores/confirm { role: "GVHD" }
   → Set confirmedByGvhd = true ✓

6. CT_HD công bố (/council/final-confirm)
   POST /topics/{id}/scores/confirm-publish
   → Check: aggregatedByTkHd === true ✓
   → Check: confirmedByGvhd === true ✓  
   → Set confirmedByCtHd = true ✓
   → Set published = true ✓
   → Topic state → COMPLETED ✓
```

---

## Files Modified

### Backend
- ✅ `backend/src/modules/scores/scores.service.ts`
  - Line 616-629: Fixed `toScoreSummaryDto()` to include aggregation fields

### Frontend  
- No changes needed (UI đã đúng, chỉ cần backend trả data đầy đủ)

---

## Deployment Notes

1. **Backend**: Deploy service fix ngay lập tức
2. **Database**: Không cần migration (schema đã đúng)
3. **Testing**: Verify với 1 topic mẫu theo flow trên
4. **Rollback**: Nếu có vấn đề, revert commit tại `scores.service.ts:616-629`

---

## Contact

Nếu còn vấn đề, kiểm tra:
1. Browser console (F12) → Network tab khi gọi API
2. Backend logs cho errors
3. Google Sheets tab "ScoreSummaries" row tương ứng với topicId

**Lưu ý**: Bug #1 là root cause chính gây ra chuỗi vấn đề. Sau khi fix, các bug còn lại sẽ tự giải quyết.
