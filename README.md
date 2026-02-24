<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/React_Flow-11-FF0072?style=for-the-badge" alt="React Flow" />
</p>

<h1 align="center">⚡ DevFlow</h1>

<p align="center">
  <strong>Build workflows at the speed of thought.</strong>
</p>

<p align="center">
  A visual, AI-powered workflow automation platform.<br />
  Describe automations in plain English, watch node graphs generate instantly,<br />
  and execute them with full observability — all in your browser.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#license">License</a>
</p>

---

## ✨ Features

### 🧠 AI-Powered Workflow Generation
Describe your automation in natural language. DevFlow's **Groq-powered** engine compiles the full node graph instantly — no drag-and-drop required.

### 🎨 Visual Node Canvas
Powered by **React Flow**, the interactive canvas lets you build, edit, and connect nodes with a butter-smooth experience — zoom, pan, and wire up complex automations visually.

### ▶️ Real-Time Execution Engine
Execute workflows directly from the browser with a **streaming SSE-based execution engine**. Watch nodes light up in real-time as each step processes, with a full execution console showing logs, timing, and status.

### 🔐 Authentication
Secure sign-in and session management powered by **Better Auth** with full database-backed session persistence.

### 💾 Persistent Workflows
Save, load, rename, duplicate, export (JSON), and delete workflows. All data is persisted in **Neon PostgreSQL** via **Drizzle ORM**.

### 📊 Home Dashboard
A clean dashboard view showing workflow statistics, recent workflows, quick-start templates, and one-click actions to create or load workflows.

### 🌐 Stunning Landing Page
A premium, fully responsive landing page featuring:
- **Container scroll animation** with 3D perspective transforms
- **Infinite logo slider** with trusted-by branding
- **Testimonial marquee** with gradient masking
- **Three.js dotted surface** particle background
- **Framer Motion** animations throughout
- Dark, glassmorphic design with aurora gradients

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **UI** | React 19, Tailwind CSS 3.4 |
| **Canvas** | React Flow 11 |
| **AI** | Groq SDK (LLM-powered generation) |
| **Auth** | Better Auth |
| **Database** | Neon PostgreSQL + Drizzle ORM |
| **Animations** | Framer Motion, Three.js |
| **Icons** | Lucide React |
| **Deployment** | Vercel |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **pnpm**
- A **Neon** database (free tier works)
- A **Groq** API key

### Installation

```bash
# Clone the repository
git clone https://github.com/Drimdave/devflow.git
cd devflow

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Authentication (Better Auth)
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# AI (Groq)
GROQ_API_KEY=your-groq-api-key
```

### Run Locally

```bash
# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page. Sign in to access the full app.

### Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
devflow/
├── app/
│   ├── [[...slug]]/         # Dynamic catch-all route
│   │   └── page.tsx         # Server component entry
│   ├── api/
│   │   ├── auth/[...all]/   # Better Auth API routes
│   │   ├── chat/            # AI chat / workflow generation
│   │   ├── execute/         # SSE-based workflow execution
│   │   └── workflows/       # CRUD for saved workflows
│   ├── login/               # Auth login page
│   ├── ClientPage.tsx        # Main client app shell
│   ├── globals.css           # Global styles & design tokens
│   └── layout.tsx            # Root layout with fonts
│
├── components/
│   ├── canvas/              # Workflow editor
│   │   ├── WorkflowCanvas   # React Flow canvas
│   │   ├── ExecutionConsole  # Live execution logs
│   │   ├── NodeConfigPanel   # Node property editor
│   │   └── nodes/           # Custom node components
│   ├── chat/                # AI chat panel
│   ├── dashboard/           # Home dashboard
│   ├── landing/             # Landing page
│   ├── layout/              # Sidebar & Header
│   └── ui/                  # Shared UI primitives
│       ├── container-scroll-animation
│       ├── dotted-surface (Three.js)
│       ├── infinite-slider
│       ├── logo-cloud
│       └── Toast
│
├── lib/
│   ├── auth.ts              # Better Auth server config
│   ├── auth-client.ts       # Client-side auth helpers
│   ├── db/                  # Drizzle + Neon connection
│   └── utils.ts             # cn() utility
│
├── public/landing/          # Landing page images
│   ├── dashboard.png
│   ├── canvas.png
│   └── console.png
│
├── tailwind.config.ts       # Tailwind configuration
├── next.config.ts           # Next.js configuration
└── package.json
```

---

## 📸 Screenshots

### Landing Page
![DevFlow Landing Page](public/landing/dashboard.png)

### Visual Workflow Canvas
![Workflow Canvas](public/landing/canvas.png)

### Execution Console
![Execution Console](public/landing/console.png)

---

## 🔑 Key Concepts

### Workflow Structure
Each workflow consists of **nodes** and **edges**:
- **Nodes** — Individual steps (triggers, actions, logic gates)
- **Edges** — Connections defining execution flow

### Node Types
| Type | Description |
|---|---|
| `trigger` | Entry point (Webhook, Schedule, Form Submit, Manual) |
| `action` | Perform operations (HTTP Request, Send Email, AI Prompt) |
| `logic` | Control flow (If/Else, Filter, Switch, Delay) |

### Execution Model
Workflows execute via **topological sort** — trigger nodes fire first, then downstream nodes execute in dependency order. The execution engine streams events via **Server-Sent Events (SSE)**, providing real-time feedback on node status.

---

## 📝 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/workflows` | List all workflows |
| `POST` | `/api/workflows` | Create a new workflow |
| `GET` | `/api/workflows/:id` | Get a specific workflow |
| `PUT` | `/api/workflows/:id` | Update a workflow |
| `DELETE` | `/api/workflows/:id` | Delete a workflow |
| `POST` | `/api/chat` | Generate workflow from prompt |
| `POST` | `/api/execute` | Execute a workflow (SSE stream) |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ☕ and AI by <a href="https://github.com/Drimdave">@Drimdave</a>
</p>
