# Tombala Game Platform

This project offers a modern and interactive platform where users can play Tombala (Turkish Bingo) online. It is developed using Vite, React, Node.js, and Express technologies.

## Technology Stack

- **Frontend:** Vite, React (v18), React Router (v6), Material UI
- **Backend:** Node.js (v22), Express
- **Project Structure:** Lerna monorepo

## Project Structure

```
tombala/
├── packages/
│   ├── client/ (React user interface)
│   ├── server/ (Express API and game logic)
│   └── common/ (Shared types and utility functions)
├── lerna.json
└── package.json
```

## Features

- Multiplayer support
- Real-time game updates
- User accounts and profiles
- Game statistics and leaderboard
- Mobile-responsive interface

## Installation

Follow these steps to set up the project:

```bash
# Clone the repository
git clone https://github.com/username/tombala.git

# Navigate to project directory
cd tombala

# Install dependencies
npm install

# Bootstrap packages with Lerna
npx lerna bootstrap

# Start in development mode
npm run dev
```

## Development

To start the project in development mode:

```bash
npm run dev
```

This command launches both client and server applications in parallel.

## Core Libraries Used

- **Material UI:** Modern and responsive user interface components
- **React Router:** Page routing and navigation
- **Express:** API endpoints and game server
- **Socket.io:** Real-time communication

## Deployment (Build)

To build the project for production:

```bash
npm run build
```

## Contributing

1. Fork this repository
2. Create a feature branch (`git checkout -b new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin new-feature`)
5. Open a Pull Request