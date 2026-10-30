// src/react/default/dashcontent.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bot,
  MessageSquareText,
  Download,
  QrCode,
  Cloud,
  Code2,
  Video,
  Music,
  Server,
  Layers,
  Radio,
  ShieldCheck,
  Cpu,
  Database,
  Workflow,
  Gauge,
  Boxes,
  GitBranch,
} from "lucide-react";
import { GithubIcon } from "@control/icon";

interface DashContentProps {
  ready?: boolean;
}

interface ProjectItem {
  name: string;
  path: string;
  category: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  description: string;
}

interface BrandItem {
  name: string;
  field: string;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

interface TechItem {
  category: string;
  items: string[];
}

interface FeatureItem {
  name: string;
  category: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  description: string;
}

interface ProfileRow {
  label: string;
  value: string;
}

interface SkillGroup {
  category: string;
  items: string[];
}

const profileIntro =
  "Hi, I'm Herbanu Warthakusma, a developer and an emerging content creator from Indonesia. I build web platforms, explore AI tooling, and craft content across multiple formats, from code to camera to sound. Below is a quick look at who I am and what I work with.";

const profileRows: ProfileRow[] = [
  { label: "Full Name", value: "Herbanu Warthakusma" },
  { label: "Email", value: "warthadev@gmail.com" },
  { label: "Place & Date of Birth", value: "Bogor, July 28, 1997" },
  { label: "Gender", value: "Male" },
  { label: "Nationality", value: "Indonesia" },
  { label: "Location", value: "Indonesia" },
];

const educationRows: ProfileRow[] = [
  { label: "Degree", value: "Bachelor of Computer Science (S.Kom.)" },
  { label: "University", value: "Universitas Indraprasta PGRI (UNINDRA)" },
  { label: "Faculty", value: "Engineering and Computer Sciences" },
  { label: "Study Program", value: "Informatics (S1)" },
  { label: "Student Number", value: "201543501858" },
  { label: "Graduation Date", value: "August 7, 2019" },
  { label: "GPA", value: "3.05 / 4.00" },
  { label: "Predicate", value: "Very Good (Sangat Memuaskan)" },
  { label: "Total Credits", value: "146 SKS / 59 Courses" },
];

const skillGroups: SkillGroup[] = [
  {
    category: "Languages",
    items: ["English", "Indonesian"],
  },
  {
    category: "Programming",
    items: ["Java", "Python", "JavaScript", "TypeScript", "Dart"],
  },
  {
    category: "Operating Systems",
    items: ["Windows", "Linux", "Terminal / CLI"],
  },
  {
    category: "Creative Tools",
    items: [
      "Adobe Premiere Pro",
      "Adobe After Effects",
      "Adobe Illustrator",
    ],
  },
  {
    category: "Content Production",
    items: [
      "Scriptwriting",
      "Videography",
      "Recording",
      "Editing",
      "Publishing",
    ],
  },
];

const brandItems: BrandItem[] = [
  {
    name: "WarthaDev",
    field: "Developer / Technology",
    description:
      "The primary identity for software development, web engineering, AI exploration, automation, and cloud-based workflows. Focused on building tools and systems that solve real problems.",
    icon: Code2,
  },
  {
    name: "Wartha Sensei",
    field: "YouTube / Content Creation",
    description:
      "The creative side expressed through YouTube content creation. From ideation and recording to editing and publishing, built independently across multiple content formats.",
    icon: Video,
  },
  {
    name: "Hewartsu",
    field: "Music / Creative Expression",
    description:
      "A music brand representing the musical and creative journey. Where sound, rhythm, and expression take the lead as part of the broader personal identity.",
    icon: Music,
  },
];

const techItems: TechItem[] = [
  {
    category: "AI & Intelligence",
    items: [
      "Google Generative AI",
      "Gemini API",
      "Pollinations",
      "OpenSubtitles Extractor",
      "Video Metadata Extractor",
    ],
  },
  {
    category: "Frontend Core",
    items: [
      "React 19",
      "TypeScript 6",
      "Vite 8",
      "React DOM 19",
      "React Router 7",
    ],
  },
  {
    category: "UI & Animation",
    items: [
      "Framer Motion",
      "Lucide React",
      "React Icons",
      "React Markdown",
      "PrismJS",
      "React Syntax Highlighter",
      "React Responsive Carousel",
      "Sonner",
    ],
  },
  {
    category: "State & Data",
    items: [
      "Redux Toolkit",
      "React Redux",
      "Qrcode.react",
      "JSZip",
    ],
  },
  {
    category: "Backend Core",
    items: [
      "FastAPI",
      "Uvicorn",
      "Pydantic",
      "Starlette",
      "Python Multipart",
      "HTTPX",
      "Aiohttp",
      "Cachetools",
    ],
  },
  {
    category: "Cloud & Storage",
    items: [
      "Firebase",
      "Firebase Admin",
      "Firestore",
      "Firebase Auth",
      "Firebase Storage",
      "Telethon",
      "Hugging Face Hub",
      "IndexedDB",
    ],
  },
  {
    category: "Media Processing",
    items: [
      "yt-dlp",
      "FFmpeg",
      "FFprobe",
      "JASSUB",
      "Movi Player",
      "Dash.js",
      "HLS.js",
      "Shaka Player",
      "MP4Box",
      "Web Speech API",
    ],
  },
  {
    category: "External Services",
    items: [
      "Cobalt API",
      "YouTube IFrame API",
      "ip-api.com",
      "Nominatim",
      "Hugging Face API",
      "Telegram API",
    ],
  },
  {
    category: "Platform & Infrastructure",
    items: [
      "Firebase Hosting",
      "Hugging Face Spaces",
      "UptimeRobot",
      "Docker",
      "Node.js",
      "Python 3.11",
      "WebAssembly",
    ],
  },
  {
    category: "Developer Tools",
    items: [
      "Git",
      "Octokit",
      "curl",
      "p7zip-full",
      "unrar-free",
    ],
  },
  {
    category: "Build & Bundling",
    items: [
      "Rolldown",
      "LightningCSS",
      "PostCSS",
      "esbuild",
      "WASM Runtime",
    ],
  },
  {
    category: "Type & Lint",
    items: [
      "ESLint",
      "TypeScript ESLint",
      "eslint-plugin-react-hooks",
      "eslint-plugin-react-refresh",
      "@types/node",
      "@types/react",
      "@types/prismjs",
    ],
  },
];

const thanksItems: string[] = [
  "Google Colab",
  "DeepSeek",
  "Claude",
  "Google Gemini",
  "Stack Overflow",
  "GitHub",
  "Hugging Face",
  "Firebase",
  "UptimeRobot",
  "Termux",
];

const projectItems: ProjectItem[] = [
  {
    name: "AI Check",
    path: "/ai-check",
    category: "AI Tools",
    icon: Bot,
    description:
      "Analyze system status and API connectivity in real time. Verify available models, monitor token usage, and ensure your AI services are running as expected without interruption.",
  },
  {
    name: "AI Chat",
    path: "/ai-chat",
    category: "AI Tools",
    icon: MessageSquareText,
    description:
      "Interact with a powerful AI assistant powered by Gemini. Upload images, files, or folders, generate visuals, and get contextual responses tailored to your needs in a seamless conversational interface.",
  },
  {
    name: "Downloader",
    path: "/downloader",
    category: "Media",
    icon: Download,
    description:
      "Extract video and audio content from multiple platforms with ease. Choose from a wide range of formats and quality options to match your requirements and download them directly to your device.",
  },
  {
    name: "GitHub Repo",
    path: "/github-editor",
    category: "Developer",
    icon: GithubIcon,
    description:
      "Manage and edit your GitHub repositories directly from the browser. Create, rename, or delete files and folders, and commit changes without leaving the application environment.",
  },
  {
    name: "Barcode",
    path: "/barcode",
    category: "Utilities",
    icon: QrCode,
    description:
      "Generate high-quality QR codes for links, WhatsApp messages, and WiFi credentials. Download them in HD resolution for print or digital distribution across any channel.",
  },
  {
    name: "Cloud Manager",
    path: "/cloudview",
    category: "Storage",
    icon: Cloud,
    description:
      "Access and organize files from Telegram and Hugging Face in one unified workspace. Stream media, preview documents, and manage multiple cloud sources securely from a single dashboard.",
  },
];

const featureItems: FeatureItem[] = [
  {
    name: "Artificial Intelligence Layer",
    category: "Intelligence",
    icon: Cpu,
    description:
      "Google Gemini embedded directly in the browser with image upload, folder context, web search grounding, image generation, and voice narration. Automatic model failover rotates to the next available model when the current one is rate limited, keeping conversations uninterrupted.",
  },
  {
    name: "Full-Stack Integration",
    category: "Architecture",
    icon: Server,
    description:
      "A complete client-server system where a React and Vite frontend communicates with an independently deployed FastAPI backend. Authentication, file metadata, and user preferences live in Firebase, while heavy lifting such as media extraction, cloud file operations, and subtitle processing runs on a containerized Python service.",
  },
  {
    name: "Multi-Cloud Orchestration",
    category: "Cloud Infrastructure",
    icon: Cloud,
    description:
      "A unified layer that speaks to Telegram through Telethon and to Hugging Face through its Python SDK at the same time. Browse, stream, rename, move, delete, and transfer files across providers without leaving one interface, with automatic fallback when a provider rejects a request.",
  },
  {
    name: "Cross-Account Data Transfer",
    category: "Cloud Infrastructure",
    icon: Workflow,
    description:
      "Move files from one Hugging Face account or repository to another in a single operation. The backend copies content into the destination, verifies every path landed successfully, and only then removes the source, so partial failures never destroy the original data.",
  },
  {
    name: "Real-Time Media Streaming",
    category: "Media Pipeline",
    icon: Radio,
    description:
      "Video and audio streamed directly from Telegram and Hugging Face with HTTP range support, so the player can seek instantly without downloading the full file. A custom media renderer detects unsupported codecs, offers subtitle track selection, and hands off playback to native apps like VLC or MX Player when the browser cannot decode a file.",
  },
  {
    name: "Media Extraction and Muxing",
    category: "Media Pipeline",
    icon: Download,
    description:
      "A backend pipeline that pulls video and audio from YouTube and other platforms via yt-dlp, and from Instagram, TikTok, and Twitter via the Cobalt API. When a source ships separated video and audio streams, FFmpeg merges them on demand before returning a single downloadable file.",
  },
  {
    name: "Developer Tooling in the Browser",
    category: "Developer Experience",
    icon: GitBranch,
    description:
      "A GitHub editor built on Octokit that performs full repository operations from a single page. File and folder CRUD, recursive folder rename, bulk upload from local disk, and optimistic UI updates that appear before the server confirms each change.",
  },
  {
    name: "State Management Architecture",
    category: "Frontend Engineering",
    icon: Database,
    description:
      "Redux Toolkit slices for audio, authentication, cloud sources, theme, visit tracking, and UI visibility, combined with local component state, session storage for per-session UI preferences, and IndexedDB for cached thumbnails. Each layer of state lives where it belongs.",
  },
  {
    name: "Layered Security Model",
    category: "Security",
    icon: ShieldCheck,
    description:
      "Firebase Authentication with Google, GitHub, and Yahoo providers, role-based access gated through a Firestore admin list, per-user credential storage, optional selfie capture on first sign-in, and geolocation plus device fingerprint tracking for every session.",
  },
  {
    name: "Performance Engineering",
    category: "Performance",
    icon: Gauge,
    description:
      "Route-level code splitting with React lazy, IndexedDB thumbnail caching with time-based eviction, canvas-rendered scroll animation instead of video, request coalescing on the media player, and HTTP connection pooling on the backend proxy.",
  },
  {
    name: "Cross-Origin Isolation",
    category: "Platform Engineering",
    icon: Boxes,
    description:
      "Custom Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers configured at the Vite and Firebase hosting level so WebAssembly modules like the video metadata extractor can run safely alongside cross-origin media streams.",
  },
  {
    name: "Design Token System",
    category: "Frontend Engineering",
    icon: Layers,
    description:
      "A CSS custom property layer that defines every color, radius, and shadow in one place. Eleven theme modes and twenty-four accent palettes compose from these tokens, so the entire interface shifts appearance without any component knowing which theme is active.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.19, 1, 0.22, 1] },
  },
};

const titleVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.19, 1, 0.22, 1] },
  },
};

const subtitleVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.15, ease: [0.19, 1, 0.22, 1] },
  },
};

const DashContent: React.FC<DashContentProps> = ({ ready = false }) => {
  const navigate = useNavigate();

  const animationState = ready ? "visible" : "hidden";

  return (
    <motion.div
      className="dash-content-list"
      variants={containerVariants}
      initial="hidden"
      animate={animationState}
    >
      <motion.section
        className="dash-ecosystem"
        variants={itemVariants}
      >
        <header className="dash-ecosystem-header">
          <motion.h2
            className="dash-ecosystem-title"
            variants={titleVariants}
          >
            One journey, three expressions.
          </motion.h2>
          <motion.p
            className="dash-ecosystem-subtitle"
            variants={subtitleVariants}
          >
            Three branches of the same personal identity, each with its own
            field, purpose, and expression.
          </motion.p>
        </header>

        <div className="dash-ecosystem-list">
          {brandItems.map((brand) => {
            const Icon = brand.icon;
            return (
              <article key={brand.name} className="dash-ecosystem-item">
                <div className="dash-ecosystem-item-header">
                  <div className="dash-ecosystem-item-icon">
                    <Icon size={30} strokeWidth={1.75} />
                  </div>
                  <div className="dash-ecosystem-item-header-text">
                    <h3 className="dash-ecosystem-item-name">{brand.name}</h3>
                    <span className="dash-ecosystem-item-field">
                      {brand.field}
                    </span>
                  </div>
                </div>
                <p className="dash-ecosystem-item-desc">
                  {brand.description}
                </p>
              </article>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        className="dash-tech"
        variants={itemVariants}
      >
        <header className="dash-projects-header">
          <motion.h2
            className="dash-projects-title"
            variants={titleVariants}
          >
            My Profile
          </motion.h2>
        </header>
        <div className="dash-profile-sections">
          <motion.section
            variants={itemVariants}
            className="dash-content-section"
          >
            <div className="dash-content-section-body">
              <p className="dash-content-desc">{profileIntro}</p>

              <p className="dash-content-desc">
                {profileRows.map((row) => `${row.label}: ${row.value}`).join(" · ")}
              </p>

              <p className="dash-content-desc">
                {educationRows.map((row) => `${row.label}: ${row.value}`).join(" · ")}
              </p>

              <p className="dash-content-desc">
                {skillGroups
                  .map((group) => `${group.category}: ${group.items.join(", ")}`)
                  .join(" · ")}
              </p>
            </div>
          </motion.section>
        </div>
      </motion.section>

      <motion.section
        className="dash-projects"
        variants={itemVariants}
      >
        <header className="dash-projects-header">
          <motion.h2
            className="dash-projects-title"
            variants={titleVariants}
          >
            My Project
          </motion.h2>
          <motion.p
            className="dash-projects-subtitle"
            variants={subtitleVariants}
          >
            A collection of tools and modules built as part of the journey,
            each one solving a real problem with a focus on utility and
            clarity.
          </motion.p>
        </header>
        <div className="dash-content-sections">
          {projectItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.section
                key={item.name}
                variants={itemVariants}
                className="dash-content-section"
              >
                <div className="dash-content-section-icon">
                  <Icon size={30} strokeWidth={1.75} />
                </div>

                <div className="dash-content-section-body">
                  <h3 className="dash-content-title">{item.name}</h3>

                  <span className="dash-content-category">
                    {item.category}
                  </span>

                  <p className="dash-content-desc">{item.description}</p>

                  <button
                    type="button"
                    className="dash-content-btn"
                    onClick={() => navigate(item.path)}
                    aria-label={`Open ${item.name}`}
                  >
                    <span>Open</span>
                  </button>
                </div>
              </motion.section>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        className="dash-tech"
        variants={itemVariants}
      >
        <header className="dash-projects-header">
          <motion.h2
            className="dash-projects-title"
            variants={titleVariants}
          >
            Features
          </motion.h2>
          <motion.p
            className="dash-projects-subtitle"
            variants={subtitleVariants}
          >
            Engineering capabilities built into this platform, from
            full-stack integration and multi-cloud orchestration to
            real-time media streaming and layered security.
          </motion.p>
        </header>
        <div className="dash-content-sections">
          {featureItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.section
                key={item.name}
                variants={itemVariants}
                className="dash-content-section"
              >
                <div className="dash-content-section-icon">
                  <Icon size={30} strokeWidth={1.75} />
                </div>

                <div className="dash-content-section-body">
                  <h3 className="dash-content-title">{item.name}</h3>

                  <span className="dash-content-category">
                    {item.category}
                  </span>

                  <p className="dash-content-desc">{item.description}</p>
                </div>
              </motion.section>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        className="dash-tech"
        variants={itemVariants}
      >
        <header className="dash-projects-header">
          <motion.h2
            className="dash-projects-title"
            variants={titleVariants}
          >
            Tech Stack
          </motion.h2>
          <motion.p
            className="dash-projects-subtitle"
            variants={subtitleVariants}
          >
            The languages, frameworks, and platforms behind every project
            built here.
          </motion.p>
        </header>
        <div className="dash-tech-grid">
          {techItems.map((tech) => (
            <div key={tech.category} className="dash-tech-card">
              <h3 className="dash-tech-category">{tech.category}</h3>
              <ul className="dash-tech-list">
                {tech.items.map((item) => (
                  <li key={item} className="dash-tech-item">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="dash-tech"
        variants={itemVariants}
      >
        <header className="dash-projects-header">
          <motion.h2
            className="dash-projects-title"
            variants={titleVariants}
          >
            Special Thanks
          </motion.h2>
          <motion.p
            className="dash-projects-subtitle"
            variants={subtitleVariants}
          >
            To every service that made this journey possible.
          </motion.p>
        </header>
        <div className="dash-tech-list">
          {thanksItems.map((item) => (
            <span key={item} className="dash-tech-item">
              {item}
            </span>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default DashContent;