<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Express-5-000?style=flat-square&logo=express" />
  <img src="https://img.shields.io/badge/Socket.io-4.8-010101?style=flat-square&logo=socket.io" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
</p>

<h1 align="center">💬 Realtime Chat App</h1>

<p align="center">
  A modern real-time messaging platform built with MERN stack & WebSockets
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#️-tech-stack">Tech Stack</a> •
  <a href="#-key-highlights">Key Highlights</a>
</p>

---

## ✨ Features

| Category | Highlights |
|----------|------------|
| 🔐 **Auth** | JWT authentication, bcrypt hashing, protected routes |
| 💬 **Messaging** | Real-time delivery, online status, image sharing |
| 🎨 **UI/UX** | 32+ themes, responsive design, skeleton loading |
| ⚡ **Performance** | Zustand (2KB), Vite builds, WebSocket efficiency |

---

## 🚀 Quick Start

```bash
# Clone & install
git clone https://github.com/omkarhole/Realtime-Chatapp.git
cd Realtime-Chatapp
cd backend && npm install
cd ../frontend && npm install

# Copy .env.example to .env and fill values. Use .local.env for local overrides (gitignored).
# Configure backend/.env or backend/.local.env
PORT=5001
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# Run
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2
```

---

## 🛠️ Tech Stack

**Frontend:** React 19 • Vite • TailwindCSS • DaisyUI • Zustand • Socket.io-client

**Backend:** Node.js • Express 5 • Socket.io • MongoDB • Mongoose • JWT • Cloudinary

---

## 🎯 Key Highlights

- **Real-time Architecture** — WebSocket-based bidirectional communication for instant messaging
- **Scalable Design** — Modular MVC pattern with separation of concerns
- **Modern Auth Flow** — JWT tokens with HTTP-only cookies for security
- **Cloud Integration** — Cloudinary CDN for optimized image delivery
- **State Management** — Zustand for minimal bundle size (2KB vs Redux 42KB)
- **Production Ready** — Serves static frontend from Express in production mode

---

## 📁 Structure

```
├── backend/src/
│   ├── controllers/    # Auth & message logic
│   ├── models/         # User & message schemas
│   ├── routes/         # API endpoints
│   ├── lib/            # Socket.io, DB, utils
│   └── middleware/     # JWT protection
│
├── frontend/src/
│   ├── components/     # Chat UI components
│   ├── pages/          # Route pages
│   ├── store/          # Zustand stores
│   └── lib/            # Axios, utilities
```

---

## 🔮 Roadmap

- [ ] Group chat & typing indicators
- [ ] Voice messages & video calls
- [ ] End-to-end encryption
- [ ] Push notifications

---

## 🤝 Contributing

Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started.

1. Fork → 2. Branch → 3. Commit → 4. PR

---

<p align="center">
  <b>⭐ Star this repo if helpful!</b><br>
  Made with ❤️ by <a href="https://github.com/omkarhole">Omkar Hole</a> 
</p>
