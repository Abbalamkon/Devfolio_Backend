# DevFolio Backend API

Complete backend API for DevFolio - A professional developer portfolio platform.

## 🚀 Features

- **Authentication**: JWT-based auth with email/password
- **User Management**: Profile creation, updates, skills, social links
- **Projects**: CRUD operations for project portfolios
- **Portfolio**: Professional portfolio builder with experience, education, skills
- **Messaging**: Direct messaging between users
- **Database**: PostgreSQL via Supabase with Row Level Security

## 📋 Prerequisites

- Node.js 18+ 
- Supabase account
- Netlify account (for deployment)

## 🛠️ Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the schema from `supabase_schema.sql`
3. Note your project credentials:
   - Project URL
   - Anon Key
   - Service Role Key
   - Database connection string

### 2. Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your Supabase credentials
# Then start the development server
npm run dev
```

Your API will be available at `http://localhost:3000`

### 3. Environment Variables

Create a `.env` file with the following:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
JWT_SECRET=your_super_secret_jwt_key_min_32_characters
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.netlify.app
```

### 4. Netlify Deployment

#### Option A: Using Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Set environment variables
netlify env:set SUPABASE_URL "your_value"
netlify env:set SUPABASE_ANON_KEY "your_value"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your_value"
netlify env:set DATABASE_URL "your_value"
netlify env:set JWT_SECRET "your_value"
netlify env:set ALLOWED_ORIGINS "your_value"

# Deploy
netlify deploy --prod
```

#### Option B: Using Netlify Dashboard

1. Connect your GitHub repository to Netlify
2. Set build settings:
   - **Build command**: `npm install`
   - **Functions directory**: `functions`
3. Add environment variables in **Site Settings > Environment Variables**
4. Deploy!

### 5. Frontend Integration

Update your frontend to use the Netlify API URL:

```javascript
const API_URL = 'https://your-backend.netlify.app/api';

// Example: Login
fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email, password })
});
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users` - Get all users (with search)
- `GET /api/users/:username` - Get user by username
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/skills` - Update skills
- `PUT /api/users/socials` - Update social links

### Projects
- `GET /api/projects` - Get all projects (feed)
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Portfolios
- `GET /api/portfolios/:username` - Get portfolio by username
- `GET /api/portfolios/me/details` - Get own portfolio
- `PUT /api/portfolios` - Update portfolio
- `POST /api/portfolios/featured/:projectId` - Toggle featured project

### Messages
- `GET /api/messages/conversations` - Get all conversations
- `GET /api/messages/:userId` - Get messages with user
- `POST /api/messages` - Send message
- `GET /api/messages/unread/count` - Get unread count

## 🔒 Authentication

All protected endpoints require a Bearer token:

```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

## 📁 Project Structure

```
devfolio-backend/
├── config/
│   └── database.js          # Supabase & PostgreSQL config
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── errorHandler.js      # Error handling
│   └── validation.js        # Input validation
├── routes/
│   ├── auth.js              # Auth routes
│   ├── users.js             # User routes
│   ├── projects.js          # Project routes
│   ├── portfolios.js        # Portfolio routes
│   └── messages.js          # Message routes
├── functions/
│   └── api.js               # Netlify serverless wrapper
├── .env.example             # Environment template
├── netlify.toml             # Netlify config
├── package.json
├── server.js                # Main server file
└── README.md
```

## 🧪 Testing

```bash
# Run tests
npm test

# Test API health
curl http://localhost:3000/health
```

## 🐛 Troubleshooting

### Database Connection Issues
- Verify your DATABASE_URL is correct
- Check Supabase project is active
- Ensure IP allowlisting in Supabase (if applicable)

### CORS Errors
- Add your frontend URL to `ALLOWED_ORIGINS`
- Check Netlify environment variables are set

### Authentication Failures
- Verify JWT_SECRET is at least 32 characters
- Check token is being sent in Authorization header
- Ensure user exists in database

## 📄 License

MIT License

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a PR.

## 📧 Support

For issues, please open a GitHub issue or contact support.