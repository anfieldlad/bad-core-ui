# BAD CORE UI
**Business Automated Docs - Character Optical Recognition Engine**

This is a modern Next.js-based frontend for document extraction, designed to work seamlessly with the BAD CORE API.

## Features
- **Next.js 15+** with App Router for optimal performance.
- **Tailwind CSS** for a sleek, responsive, and glassmorphic UI.
- **Real-time Extraction**: Interface for uploading documents and viewing extracted data.
- **Source Attribution**: Displays the AI model source (e.g., Gemini 2.0 Flash).
- **Indonesian KTP Support**: Tailored UI for Indonesian identity card data fields.

## Prerequisites
- Node.js 18+
- [BAD CORE API](https://github.com/anfieldlad/bad-core-backend) (Backend) running.

## Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/anfieldlad/bad-core-ui.git
   cd bad-core-ui
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure environment variables**:
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
   ```

## Running the UI
```bash
npm run dev
```
The UI will be available at `http://localhost:3000`.

## Integration
The UI connects to the following Backend endpoints:
- `GET /`: Health check connectivity.
- `POST /extract`: Sends multipart file data for extraction.

## ⚠️ Privacy Warning
This environment is for **testing purposes only**. Do not upload real identity documents or sensitive data during development.

---
&copy; 2025 BAD CORE System.
