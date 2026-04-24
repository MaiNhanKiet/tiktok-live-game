# TikTok Live Game

A full-stack application that integrates with TikTok Live to create interactive real-time games for viewers. Viewers can interact with the games through TikTok Live comments, likes, and gifts.

## Features

- **TikTok Live Integration**: Connects to any TikTok Live stream to listen for events (comments, gifts, likes).
- **Multiple Game Modes**:
  - Balloon Game
  - Block Click Game
  - Car Race Game
- **Real-time Gameplay**: Powered by Socket.io for immediate updates between the server and the frontend.
- **Admin Dashboard**: Manage games, users, and TikTok connections.
- **User Authentication**: Secure JWT-based login and registration.

## Tech Stack

### Backend
- **Node.js & Express.js**
- **MongoDB** (with Mongoose)
- **Socket.io** (Real-time communication)
- **TikTok-Live-Connector** (TikTok integration)
- **JWT & bcryptjs** (Authentication)

### Frontend
- **React 19 & TypeScript**
- **Vite**
- **Tailwind CSS v4** & **shadcn/ui**
- **React Router v7**
- **Socket.io-client**

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB running locally or a MongoDB Atlas URI

### Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd tiktok-live-game-backend
   ```

2. **Install Backend Dependencies**:
   ```bash
   npm install
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Environment Setup**:
   Copy `.env.example` to `.env` in the root directory and update the values.
   ```bash
   cp .env.example .env
   ```

### Running the Application

**Start the Backend (Development)**
```bash
npm run dev
```

**Start the Frontend (Development)**
```bash
cd frontend
npm run dev
```

The backend server will run on `http://localhost:3000` (or your configured port).
The frontend will typically run on `http://localhost:5173`.
