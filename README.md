# MoodMeals Backend API

A Node.js/Express API for the **MoodMeals** recipe discovery platform with JWT authentication and comprehensive recipe management.

---

## 📁 Project Structure

```
moodmeals-backend/
├── db.js                    # PostgreSQL connection and pool configuration
├── server.js               # Main application entry point and server setup
├── package.json            # Dependencies and npm scripts
├── .env                    # Environment variables (not in repo)
├── middleware/
│   └── auth.js             # JWT authentication and authorization middleware
└── routes/
    ├── auth.js             # Authentication routes (login, signup, profile)
    ├── community.js        # Community recipe CRUD and admin approval
    ├── favorites.js        # User favorites management
    ├── notes.js            # Personal recipe notes
    ├── ratings.js          # Recipe rating system
    └── users.js            # User profile and preference management
```

---

## Core Features

### Authentication System

- User Registration & Login with secure JWT tokens  
- Role-based Access Control (Admin/User)  
- Password Security with bcrypt (10 rounds)  
- Token Management with 7-day expiration and automatic refresh  

### Recipe Management

- Community Recipe System - Users can submit, edit, and share recipes  
- Admin Approval Workflow - Recipes require admin approval  
- Image Upload Support - Recipe photos with 5MB limit  
- Mood Categories - Happy, Cozy, Relaxed, Energetic  
- Ingredient & Instructions - Structured components  

### User Features

- Profiles with allergy and dietary preferences  
- Save API and community recipes as favorites  
- Add personal notes  
- Rate community recipes  
- Auto-filter recipes based on user allergies  

### Admin Dashboard

- Approve/reject community recipes  
- Manage user accounts  
- View analytics and activity logs  

---

## Authentication Flow

### JWT Token System

1. User Login/Register → JWT Token Generated  
2. Token Stored in `localStorage` (frontend)  
3. Token Sent in `Authorization` Header  
4. Backend Verifies Token → Access Granted  

### Authentication Middleware

```js
// Protected route example
app.use('/api/favorites', checkJwt, extractUser, favoritesRoutes);

// Admin-only route example
app.use('/api/community/admin/*', checkJwt, extractUser, requireAdmin);
```

### Security Features

- Parameterized SQL Queries to prevent SQL injection  
- Password Hashing via bcrypt  
- Token Expiration (7 days)  
- CORS configured for trusted frontend origin  

---

## API Endpoints

### Authentication (`/api/auth`)

| Endpoint   | Method | Description             | Auth |
|------------|--------|-------------------------|------|
| `/signup`  | POST   | Register new user       | ❌   |
| `/login`   | POST   | User login              | ❌   |
| `/me`      | GET    | Get current user info   | ✅   |

### Community Recipes (`/api/community`)

| Endpoint              | Method | Description                     | Auth       |
|-----------------------|--------|---------------------------------|------------|
| `/`                   | GET    | Get all approved recipes        | ❌         |
| `/`                   | POST   | Submit new recipe               | ✅         |
| `/:id`                | GET    | Get recipe details              | ❌         |
| `/:id`                | PUT    | Update own recipe               | ✅         |
| `/:id`                | DELETE | Delete own recipe               | ✅         |
| `/:id/image`          | GET    | Get recipe image                | ❌         |
| `/admin/pending`      | GET    | Get pending recipes             | ✅ Admin   |
| `/admin/:id/approval` | PATCH  | Approve/reject recipe           | ✅ Admin   |

### User Management (`/api/users`)

| Endpoint       | Method | Description                      | Auth |
|----------------|--------|----------------------------------|------|
| `/me`          | GET    | Get user profile                 | ✅   |
| `/me`          | PUT    | Update profile & allergies       | ✅   |
| `/my-recipes`  | GET    | Get user's submitted recipes     | ✅   |

### Favorites (`/api/favorites`)

| Endpoint | Method | Description                  | Auth |
|----------|--------|------------------------------|------|
| `/`      | GET    | Get user favorites           | ✅   |
| `/`      | POST   | Add recipe to favorites      | ✅   |
| `/`      | DELETE | Remove from favorites        | ✅   |

### Recipe Notes (`/api/notes`)

| Endpoint             | Method | Description                      | Auth |
|----------------------|--------|----------------------------------|------|
| `/recipe/:id`        | GET    | Get personal notes for recipe    | ✅   |
| `/`                  | POST   | Save or update recipe notes      | ✅   |

### Recipe Ratings (`/api/ratings`)

| Endpoint             | Method | Description                  | Auth |
|----------------------|--------|------------------------------|------|
| `/recipe/:id`        | GET    | Get ratings and average      | ✅   |
| `/`                  | POST   | Submit or update rating      | ✅   |

---

## Mood-Based Recipe System

### Mood Categories

- **Happy** – Bright, cheerful dishes  
- **Cozy** – Warm, comforting meals  
- **Relaxed** – Calm, soothing dishes  
- **Energetic** – Bold, spicy meals  

### Recipe Workflow

1. User submits recipe with selected mood  
2. Recipe stored as *pending*  
3. Admin reviews and approves  
4. Recipe becomes public  
5. Users can favorite, rate, and add notes  

---

## Security Implementation

### Password Hashing

```js
// Hash password during registration
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

// Verify password during login
const isValid = await bcrypt.compare(password, user.password);
```

### JWT Management

```js
// Token creation
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Token validation
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### Database Security

- Parameterized Queries  
- Foreign Key Constraints  
- Transactional Operations  
- Input Validation  

---

## File Overview

### `server.js`

- Express server setup  
- CORS and middleware configuration  
- Route imports and error handling  

### `db.js`

- PostgreSQL pool setup  
- Dynamic connection string via `.env`  
- Export connection for route use  

### `middleware/auth.js`

- JWT parsing and verification  
- Role-based access control  
- Token utility helpers  

### `routes/`

- `auth.js` – Login, signup, `/me`  
- `community.js` – CRUD + admin moderation  
- `users.js` – Profile and submitted recipes  
- `favorites.js` – Favorite handling  
- `notes.js` – Personal notes  
- `ratings.js` – Star ratings  

---

## 📄 License

MIT © 2025 MoodMeals Team
