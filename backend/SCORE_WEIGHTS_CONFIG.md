# Score Weights Configuration

## Overview

Điểm tổng kết KLTN được tính từ 3 thành phần với trọng số có thể cấu hình:

```
finalScore = (gvhdScore × weightGvhd) + (gvpbScore × weightGvpb) + (councilAvgScore × weightCouncil)
```

## SystemConfig Keys

Thêm các keys sau vào sheet **SystemConfig** (hoặc cấu hình qua API):

| Key | Default Value | Description |
|-----|---------------|-------------|
| `score.weight.gvhd` | `0.3` | Trọng số điểm GVHD (30%) |
| `score.weight.gvpb` | `0.3` | Trọng số điểm GVPB (30%) |
| `score.weight.council` | `0.4` | Trọng số điểm trung bình Hội đồng (40%) |

## Example Setup

Trong Google Sheet **SystemConfig**, thêm các dòng:

```
| key                    | value | description                           | updatedAt            |
|------------------------|-------|---------------------------------------|----------------------|
| score.weight.gvhd      | 0.3   | Trọng số điểm GVHD (30%)              | 2026-04-06T01:30:00Z |
| score.weight.gvpb      | 0.3   | Trọng số điểm GVPB (30%)              | 2026-04-06T01:30:00Z |
| score.weight.council   | 0.4   | Trọng số điểm trung bình HĐ (40%)     | 2026-04-06T01:30:00Z |
```

## Council Member Roles

**Lưu ý quan trọng**: Chỉ thành viên **TV_HD** (Thành viên Hội đồng) mới chấm điểm.

Các roles sau **KHÔNG** chấm điểm:
- **CT_HD** (Chủ tịch Hội đồng) - vai trò điều phối
- **TK_HD** (Thư ký Hội đồng) - vai trò hành chính/tổng hợp

### Aggregation Requirements

Để TK_HD có thể aggregate (tổng hợp điểm), yêu cầu:

✅ **GVHD** đã submit điểm  
✅ **GVPB** đã submit điểm  
✅ **TẤT CẢ TV_HD** đã submit điểm

❌ CT_HD và TK_HD không cần submit (không tính vào validation)

## API Usage

### Via SystemConfigRepository

```typescript
const weightGvhd = await systemConfigRepository.getNumber('score.weight.gvhd', 0.3);
const weightGvpb = await systemConfigRepository.getNumber('score.weight.gvpb', 0.3);
const weightCouncil = await systemConfigRepository.getNumber('score.weight.council', 0.4);

const finalScore = 
  gvhdScore * weightGvhd +
  gvpbScore * weightGvpb +
  councilAvgScore * weightCouncil;
```

### Update Weights (Admin Only)

```http
PUT /api/v1/system-config/score.weight.gvhd
Content-Type: application/json

{
  "value": "0.35",
  "description": "Updated GVHD weight to 35%"
}
```

## Migration from Hardcoded Values

**Before (hardcoded)**:
```typescript
finalScore = (gvhd + gvpb + council) / 3;  // Always 33.33% each
```

**After (configurable)**:
```typescript
finalScore = 
  gvhd * weightGvhd +      // Default 30%
  gvpb * weightGvpb +      // Default 30%
  council * weightCouncil; // Default 40%
```

## Validation

Tổng trọng số **nên bằng 1.0** (100%):

```
weightGvhd + weightGvpb + weightCouncil = 1.0
```

⚠️ **Lưu ý**: Hiện tại hệ thống không enforce constraint này. Admin cần đảm bảo tổng trọng số = 1.0.

## Changelog

- **2026-04-06**: Chuyển từ hardcoded 30-30-40% sang configurable weights
- **2026-04-06**: Fix council validation - chỉ require TV_HD scores (not CT_HD/TK_HD)
