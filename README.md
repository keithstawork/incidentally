# Incidentally

Claims management for Workers' Compensation and Occupational Accident.

## Getting started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up the database** (PostgreSQL) and ensure `.env` has `DATABASE_URL` and optionally `PORT` (default 5000; this project uses 3001 in `.env`).

3. **Start the dev server**
   ```bash
   npm run dev
   ```
   The server listens on the port in `.env` (e.g. **http://localhost:3001**). Keep this terminal open.

4. **Open the app** in your browser at **http://localhost:3001** (or the port shown in the terminal).

If you see “Safari can't connect to the server” or “This site can't be reached”, the dev server is not running. Start it with `npm run dev` in the project folder, then reload the page.
