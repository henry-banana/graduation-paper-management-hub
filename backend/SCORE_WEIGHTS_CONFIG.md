# Score Weights Configuration

## Overview

Điểm tổng kết KLTN được tính từ 3 thành phần với trọng số có thể cấu hình:

```
finalScore = (gvhdScore × weightGvhd) + (gvpbScore × weightGvpb) + (councilAvgScore × weightCouncil)
```

**Trọng số mặc định**: GVHD = **60%**, GVPB = **20%**, Council = **20%**

## Quick Setup

### Option 1: Run Setup Script (Recommended)

```bash
cd backend
npm run build
node scripts/init-score-weights.js
```

Script sẽ tự động tạo config keys với giá trị mặc định trong sheet SystemConfig.

### Option 2: Manual Setup

Thêm các keys sau vào sheet **SystemConfig**:

| Key | Default Value | Description |
|-----|---------------|-------------|
| `score.weight.gvhd` | `0.6` | Trọng số điểm GVHD (60%) |
| `score.weight.gvpb` | `0.2` | Trọng số điểm GVPB (20%) |
| `score.weight.council` | `0.2` | Trọng số điểm trung bình Hội đồng (20%) |

## SystemConfig Sheet Format

```
| key                    | value | description                                      | updatedAt            |
|------------------------|-------|--------------------------------------------------|----------------------|
| score.weight.gvhd      | 0.6   | Trọng số điểm GVHD (60%)                         | 2026-04-06T02:30:00Z |
| score.weight.gvpb      | 0.2   | Trọng số điểm GVPB (20%)                         | 2026-04-06T02:30:00Z |
| score.weight.council   | 0.2   | Trọng số điểm trung bình HĐ (20%)                | 2026-04-06T02:30:00Z |
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
// Defaults: GVHD=60%, GVPB=20%, Council=20%
const weightGvhd = await systemConfigRepository.getNumber('score.weight.gvhd', 0.6);
const weightGvpb = await systemConfigRepository.getNumber('score.weight.gvpb', 0.2);
const weightCouncil = await systemConfigRepository.getNumber('score.weight.council', 0.2);

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

**After (configurable with new defaults)**:
```typescript
finalScore = 
  gvhd * 0.6 +      // GVHD: 60% (default)
  gvpb * 0.2 +      // GVPB: 20% (default)
  council * 0.2;    // Council: 20% (default)
```

**Rationale**: GVHD (supervisor) có trọng số cao hơn vì họ theo dõi sát quá trình nghiên cứu của sinh viên.

## Validation

Tổng trọng số **nên bằng 1.0** (100%):

```
weightGvhd + weightGvpb + weightCouncil = 1.0
```

⚠️ **Lưu ý**: Hiện tại hệ thống không enforce constraint này. Admin cần đảm bảo tổng trọng số = 1.0.

## Changelog

- **2026-04-06**: Update default weights to 60-20-20 (GVHD-GVPB-Council)
- **2026-04-06**: Add setup script `scripts/init-score-weights.js`
- **2026-04-06**: Chuyển từ hardcoded 33-33-33% sang configurable weights
- **2026-04-06**: Fix council validation - chỉ require TV_HD scores (not CT_HD/TK_HD)
