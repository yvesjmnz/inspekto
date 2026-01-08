# Complaints Module - Phase 1: Core Complaint Submission

## Overview

Phase 1 implements basic complaint submission functionality. Users can submit complaints with business details, descriptions, and supporting files.

## Structure

```
src/complaints_module/
├── types.ts              # Type definitions
├── validation.ts         # Form validation logic
├── db.ts                 # Database operations
├── ComplaintForm.tsx     # Main form component
└── index.ts              # Module exports
```

## Features

✅ **Basic Form Fields**
- Business name
- Business address
- Complaint description
- Reporter email
- Image uploads (JPEG, PNG, WebP)
- Document uploads (PDF, Word)

✅ **Client-Side Validation**
- Required field checks
- Length constraints
- File type validation
- File size limits

✅ **File Upload**
- Images: max 50MB, 10 files
- Documents: max 100MB, 5 files
- Stored in Supabase Storage

✅ **Database Storage**
- Complaints saved with `authenticity_level = null`
- Tags initialized as empty array `[]`
- Submission timestamp recorded

## Usage

### Import the form component

```tsx
import { ComplaintForm } from '@/complaints_module';

export default function ComplaintsPage() {
  return <ComplaintForm />;
}
```

### Use database functions directly

```tsx
import { submitComplaint, getComplaint } from '@/complaints_module';

// Submit a complaint
const result = await submitComplaint(formData);

// Get complaint details
const complaint = await getComplaint(complaintId);
```

## Database Schema (Phase 1)

```sql
CREATE TABLE complaints (
  id UUID PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  business_address TEXT NOT NULL,
  complaint_description TEXT NOT NULL,
  reporter_email VARCHAR(255) NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  document_urls TEXT[] DEFAULT '{}',
  authenticity_level NULL,
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'Submitted',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Validation Rules

| Field | Min | Max | Required |
|-------|-----|-----|----------|
| Business Name | 2 | 255 | Yes |
| Business Address | 5 | 500 | Yes |
| Description | 20 | 5000 | Yes |
| Email | - | - | Yes |
| Images | - | 10 files, 50MB each | No |
| Documents | - | 5 files, 100MB each | No |

## Next Steps (Phase 2)

- [ ] Email verification workflow
- [ ] CAPTCHA protection
- [ ] Authenticity calculation
- [ ] Complaint tracking page
- [ ] Email notifications

## Notes

- Phase 1 focuses on **simplicity** and **core functionality**
- No authentication required for submission
- Authenticity scoring deferred to Phase 2
- Email verification deferred to Phase 2
