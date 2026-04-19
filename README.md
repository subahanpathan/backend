# Bug Tracker API

Professional Bug Tracking System API built with Node.js, Express, and Supabase.

## Features

- 🔐 JWT Authentication with bcrypt password hashing
- 🚀 RESTful API endpoints
- 📊 Project management
- 🐛 Bug/Issue tracking with priority and status
- 👥 User management and role-based access
- 💬 Comment system
- 📎 File attachments for bug reports
- 🛡️ Security features (Helmet, CORS, Rate Limiting)
- 📝 Comprehensive error handling

## Installation

1. Clone the repository and navigate to backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your Supabase credentials and other configurations

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Bugs
- `GET /api/bugs` - Get all bugs (with filters)
- `GET /api/bugs/:id` - Get single bug
- `POST /api/bugs` - Create bug
- `PUT /api/bugs/:id` - Update bug
- `DELETE /api/bugs/:id` - Delete bug

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Comments
- `GET /api/comments/bug/:bugId` - Get bug comments
- `POST /api/comments` - Add comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

### Attachments
- `POST /api/attachments` - Upload file
- `GET /api/attachments/bug/:bugId` - Get bug attachments
- `DELETE /api/attachments/:id` - Delete attachment

## Database Schema

Tables required in Supabase:
- `users` - User profiles and authentication data
- `projects` - Bug tracking projects
- `bugs` - Bug/issue records
- `comments` - Bug comments and discussions
- `attachments` - File attachments for bugs

## Security

- JWT tokens for authentication
- Password hashing with bcrypt
- CORS protection
- Rate limiting to prevent abuse
- Helmet for HTTP headers security
- Input validation
