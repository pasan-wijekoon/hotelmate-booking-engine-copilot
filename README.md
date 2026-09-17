# HotelMate Booking Engine Copilot


---

## Features

will be update soon

---

## Tech Stack

### Backend
- **Language**: Python 3.14+
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **ASGI Server**: [Uvicorn](https://www.uvicorn.org/)
- **Package Manager**: [uv](https://github.com/astral-sh/uv)

### Frontend
- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler / Dev Server**: [Vite](https://vitejs.dev/)
- **Markdown Rendering**: [react-markdown](https://github.com/remarkjs/react-markdown) & [remark-gfm](https://github.com/remarkjs/remark-gfm)
- **Syntax Highlighting**: [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter)
- **Linter**: [Oxlint](https://oxc.rs/)

---

## Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- **Python**: `3.14+` (or Astral's [uv](https://docs.astral.sh/uv/getting-started/installation/))
- **Node.js**: `18.x` or higher (Node 20+ recommended)
- **npm** or **pnpm** / **yarn**

---

### Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Set up the virtual environment and install dependencies**:
   Using `uv` (recommended):
   ```bash
   uv sync
   ```
   *Or with standard Python venv:*
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # Linux/macOS:
   source .venv/bin/activate

   pip install -e .
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the `backend/` directory if custom secrets or LLM keys are needed:
   ```env
   PORT=5000
   HOST=0.0.0.0
   ```

4. **Run the Backend Server**:
   ```bash
   uv run uvicorn backend.main:app --reload --port 8000
   ```
   The API documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Ensure `VITE_BACKEND_URL` points to your backend instance:
   ```env
   VITE_BACKEND_URL=http://localhost:8000
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser at the local address shown (typically [http://localhost:5173](http://localhost:5173)).

---

## Available Scripts

### Frontend Scripts
- `npm run dev` - Starts the Vite development server with Hot Module Replacement (HMR).
- `npm run build` - Runs type-checking with `tsc` and bundles for production into `dist/`.
- `npm run lint` - Runs Oxlint to quickly analyze and catch linting issues.
- `npm run preview` - Locally preview the production build.

---

## License

See the [LICENSE](LICENSE) file for details.

