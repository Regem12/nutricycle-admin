# NutriCycle Admin Dashboard

Standalone admin dashboard for NutriCycle - an IoT-Based Waste-to-Value Machine for Converting Vegetable Waste into Poultry Feed Meal and Compost.

## Setup

### Prerequisites

- Node.js 18+ and npm
- Account with admin privileges in the shared Firebase project

### Installation

```bash
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Add your Firebase credentials (use the **same Firebase project** as the main NutriCycle site)
3. Set `VITE_API_URL` to your backend server URL

```bash
cp .env.example .env
# Edit .env with your credentials
```

### Development

```bash
npm run dev
```

The admin dashboard will be available at `http://localhost:5173` (or the next available port).

### Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

## Project Structure

```
src/
├── pages/              # Page components
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── UsersPage.jsx
│   ├── MachinesPage.jsx
│   └── BatchesPage.jsx
├── components/
│   └── admin/         # Admin-specific components
│       ├── DashboardHeader.jsx
│       ├── Sidebar.jsx
│       └── StatCard.jsx
├── layouts/
│   └── AdminLayout.jsx
├── contexts/
│   └── AuthContext.jsx  # Shared with main site
├── services/
│   └── api.js           # Shared with main site
├── config/
│   └── firebase.js      # Shared Firebase config
└── App.jsx             # Admin routing
```

## Deployment

This admin dashboard can be deployed to:

- **Vercel** (recommended) - Same project as main site or separate
- **Netlify**
- **GitHub Pages**
- **Any Node.js hosting**

### Vercel Deployment

```bash
vercel
```

Make sure to set environment variables in Vercel project settings (same `VITE_*` variables from `.env.local`)

## Sharing Code with Main Site

The following files are shared between this admin dashboard and the main NutriCycle site:

- `src/contexts/AuthContext.jsx` - Authentication logic
- `src/services/api.js` - API client
- `src/config/firebase.js` - Firebase configuration

When updating these files, remember to sync changes across both repositories.

## Features

- **Dashboard** - Overview of system metrics and activity
- **Users Management** - Create, edit, and manage admin users
- **Machines** - Monitor and manage IoT devices
- **Batches** - Track batch processing status and outputs
- **Authentication** - Firebase-based admin-only access

## Technologies

- React 19
- Vite
- Tailwind CSS
- Firebase
- React Router
- Recharts (for data visualization)
- Lucide React (icons)
- React Hot Toast (notifications)
