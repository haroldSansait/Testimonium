# Cloudflare R2 Storage & Image Pipeline Documentation

This document covers the configuration, permissions, object hierarchy, CORS policies, and image optimization pipeline for Cloudflare R2 storage in TESTIMONIUM.

---

## 1. Cloudflare R2 Overview

Cloudflare R2 provides zero-egress-fee, S3-compatible object storage for:
- Parish cover images & logos (`parishes/parish_{id}/...`)
- Supporting document uploads (`documents/req_{id}/...`)
- Payment receipt upload evidence (`documents/req_{id}/receipts/...`)

---

## 2. Bucket Provisioning & Environment Credentials

### Step-by-Step Creation

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **R2 Object Storage** → **Create Bucket**.
3. Name the bucket (e.g. `testimonium-documents`).
4. Under **Settings** → **Public Access**, enable **Custom Domain** or **R2.dev Subdomain**:
   - Example Public URL: `https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev`
5. Go to **Manage R2 API Tokens** → **Create API Token**:
   - Permissions: **Object Read & Write**
   - Apply to specific bucket: `testimonium-documents`
6. Copy credentials to backend `.env`:
   ```ini
   R2_ACCOUNT_ID=b6ab36a02c914579977dd08c3959e2f7
   R2_ACCESS_KEY_ID=your_access_key_id
   R2_SECRET_ACCESS_KEY=your_secret_access_key
   R2_BUCKET_NAME=testimonium-documents
   R2_PUBLIC_URL=https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev
   ```

---

## 3. CORS Configuration

To allow direct file uploads or preview rendering from web browsers (Admin Portal & Parishioner Portal), apply the following CORS policy in R2 Bucket Settings:

```json
[
  {
    "AllowedOrigins": [
      "https://admin.testimonium.org",
      "https://app.testimonium.org",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 4. Object Key Structure & Permissions

| Path Hierarchy | Content Type | Access Pattern | Lifecycle |
| :--- | :--- | :--- | :--- |
| `parishes/parish_{id}/cover/{uuid}_{filename}` | Parish Cover Photo | Public Read via CDN | Persistent (Overwritten/Replaced) |
| `parishes/parish_{id}/logo/{uuid}_{filename}` | Parish Logo Image | Public Read via CDN | Persistent (Overwritten/Replaced) |
| `parishes/parish_{id}/gallery/{uuid}_{filename}` | Parish Gallery Image | Public Read via CDN | Persistent |
| `documents/req_{id}/supporting/{timestamp}_{filename}` | Requirement File | Authenticated / Signed URL | Retained during request lifecycle |
| `documents/req_{id}/receipts/{timestamp}_{filename}` | Payment Proof | Authenticated / Signed URL | Audit-locked evidence |

---

## 5. Image Compression & OCR Pipeline

```
┌─────────────────────────┐
│ Uploaded Receipt Buffer │
└────────────┬────────────┘
             │
             ├───► [R2 Storage] Upload ORIGINAL buffer (Unchanged evidence)
             │
             └───► [Sharp Service] Image Pre-processing for OCR:
                      1. Auto-rotate via EXIF
                      2. Resize to max width 1200px
                      3. Stretch contrast & sharpen
                      4. Compress to JPEG (Quality 80)
                      5. Submit compressed buffer to OCR API
```

---

## 6. Troubleshooting & Diagnostics

### Error 403 Forbidden (R2 Upload/Download Failure)
- **Cause**: Invalid `R2_ACCESS_KEY_ID` or `R2_SECRET_ACCESS_KEY`, or token lacks Read & Write permissions.
- **Fix**: Re-generate R2 API Token with Object Read & Write permissions scope.

### Error 404 Not Found (Public Image Fails to Load)
- **Cause**: `R2_PUBLIC_URL` mismatch or R2.dev public domain disabled.
- **Fix**: Verify domain in Cloudflare R2 Bucket Settings → Public Access.

### CORS Error in Browser Console (`No 'Access-Control-Allow-Origin' header`)
- **Cause**: Origin of request is missing from R2 bucket CORS settings.
- **Fix**: Add exact domain protocol + host (including port for local dev) to AllowedOrigins array.
