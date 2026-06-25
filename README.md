<div align="center">
  <h1>Bethesda Portal</h1>
  <p><b>Cloud-Based Visitor, Counseling, and Volunteer Management System</b></p>
</div>

## 1. Project Overview
The Bethesda Portal is a full-stack, enterprise-grade web application designed to streamline the management of visitors, counseling sessions, and volunteer assignments for large organizations. Built with a modern, reactive architecture, it delivers real-time situational awareness to administrative and operational staff.

## 2. Problem Statement
Many non-profits and community organizations rely on archaic, paper-based, or fragmented digital systems to track visitor influx, manage counseling queues, and assign volunteer workloads. This results in slow response times, unequal distribution of volunteer labor, lack of real-time oversight, and disjointed communication between receptionists, counselors, and volunteers.

## 3. Solution
The Bethesda Portal centralizes operations into a secure, role-based platform. By leveraging real-time WebSockets and an automated matching engine, the system immediately pairs incoming visitors with the most suitable, available volunteer based on workload and language competency. The portal provides unified command-center dashboards for administrative oversight, eliminating bottlenecks and improving visitor experience.

## 4. Key Features
- **Real-Time Queue Management:** Live tracking of visitor check-ins and session states using Socket.IO.
- **Automated Volunteer Assignment:** Intelligent, capacity-aware routing of tasks based on volunteer availability, language skills, and daily workload limits.
- **Role-Based Access Control (RBAC):** Granular security model ensuring strict data isolation and tailored dashboards for every role type.
- **Dynamic Analytics Command Center:** Interactive, data-driven KPI dashboards for administrators featuring live metrics, demographic breakdowns, and workload tracking.
- **Secure Authentication:** JWT-based stateless authentication with robust password hashing.

## 5. User Roles
The system strictly enforces the following permissions:
- **Admin:** Full system access. Can view all analytics, manage user accounts, and oversee volunteer profiles and workloads.
- **Employee / Receptionist:** Handles visitor intake. Can check in new visitors, view the active queue, and monitor initial assignment statuses.
- **Counselor:** Manages specialized counseling queues (e.g., Young Partner Plan, Business Blessing). Can view assigned cases and mark them as complete.
- **Volunteer:** Self-service portal to accept, start, and complete automated assignments. Can manage personal availability schedules and spoken languages.

## 6. Tech Stack
**Frontend:**
- React (Vite)
- TypeScript
- Tailwind CSS / Vanilla CSS (Dark Enterprise UI)

**Backend:**
- Node.js + Express
- Socket.IO (Real-Time Events)
- Drizzle ORM

**Database & Cloud (Microsoft Azure):**
- PostgreSQL (Azure Database for PostgreSQL)
- Azure App Service (Backend Hosting)
- Azure Static Web Apps (Frontend Hosting)

## 7. Architecture Diagram

```text
[ Client Browsers ]
       |
       | (HTTPS / WSS)
       v
+-------------------------------+      +-------------------------------+
|  Azure Static Web Apps        |      |  Azure App Service            |
|  (React + Vite)               | ===> |  (Node.js + Express)          |
|  - Role-Based Dashboards      | REST |  - JWT Auth Middleware        |
|  - Real-Time Socket.IO Client |      |  - Auto-Assignment Engine     |
+-------------------------------+      |  - Socket.IO Server           |
                                       +-------------------------------+
                                                      |
                                                      | (TCP/IP)
                                                      v
                                       +-------------------------------+
                                       | Azure Database for PostgreSQL |
                                       | (Drizzle ORM schema)          |
                                       +-------------------------------+
```

## 8. Database Tables
The PostgreSQL database is fully normalized and managed via Drizzle ORM:
- `users`: Core identity table for authentication and role definitions.
- `visitors`: Master record of all individuals visiting the facility (demographics, languages).
- `visits`: Transactional records of specific visits, linking visitors to purposes and plans.
- `volunteers`: Extended profiles for users with the VOLUNTEER role, tracking capacity and status.
- `volunteer_languages`: Junction table mapping volunteers to multiple spoken languages.
- `volunteer_availability`: Granular schedule blocks for volunteer working hours.
- `assignments`: The mapping table connecting a `visit` to a `volunteer` with state tracking (pending, accepted, in_progress, completed).

## 9. Environment Variables
The application requires the following environment variables to run. (See `.env.example`).

**Backend Configuration (`.env`):**
```env
DATABASE_URL=postgres://user:password@host:port/db
JWT_SECRET=your_secure_random_string
PORT=8080
FRONTEND_URL=https://your-frontend-url.azurestaticapps.net
```

**Frontend Configuration (`.env.local` or Azure Settings):**
```env
VITE_API_URL=https://your-backend-url.azurewebsites.net
```

## 10. Local Setup Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/azriel-gershom/bethesda-karunya.git
   cd bethesda-karunya
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure the environment:**
   Create a `.env` file in the root directory based on `.env.example` and supply your local PostgreSQL connection string.
4. **Push database schema:**
   ```bash
   npm run db:push
   ```
5. **Start the development server (Frontend + Backend concurrent):**
   ```bash
   npm run dev
   ```

## 11. Azure Deployment Steps
The project is configured for a split deployment architecture on Microsoft Azure.

**Frontend (Azure Static Web Apps):**
1. Connect your GitHub repository to a new Azure Static Web App.
2. The GitHub Actions workflow (`.github/workflows/`) is automatically provisioned.
3. Ensure `output_location` is set to `"dist"`.
4. Add the `VITE_API_URL` secret pointing to your backend in the GitHub repository settings.

**Backend (Azure App Service):**
1. Provision a Node.js Azure App Service instance.
2. Deploy the application (the backend entry point is `dist/server.cjs`).
3. The default start command is `npm run start`.
4. Navigate to **Environment Variables** in the Azure Portal and add `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URL`.
5. *Note: Azure handles the `PORT` variable automatically.*

## 12. Demo Credentials (Development Only)
> **WARNING:** The following credentials are hardcoded into the database seed script purely for local development and testing. **Do not use these in production.**

- **Admin:** `admin` / `admin123`
- **Employee/Reception:** `reception` / `reception123`
- **Counselor (Young Partner):** `counselor_yp` / `counselor123`
- **Counselor (Business):** `counselor_bb` / `counselor123`
- **Volunteer:** `volunteer` / `volunteer123`

## 13. Future Enhancements
To further scale and secure the Bethesda Portal, the following features are planned for future sprints:
- **Azure Key Vault Integration:** Centralize and secure management of database connection strings and JWT secrets.
- **AI Recommendations (Azure Functions):** Implement an AI model to predict queue wait times and suggest optimal volunteer-to-visitor matchings based on historical data.
- **Advanced Analytics & Exporting:** Introduce CSV/PDF export functionality and predictive trend analysis.
- **Automated Notifications:** Integrate SMS and Email alerts via Twilio/SendGrid to notify volunteers when new assignments hit their queue.
- **Volunteer Mobile App:** Develop a cross-platform React Native companion app for volunteers to manage tasks on the floor.
