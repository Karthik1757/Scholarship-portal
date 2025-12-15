<p align="center">
  <img src="https://dummyimage.com/900x200/000/fff&text=Scholarship+Portal" alt="Project Banner"/>
</p>

<h1 align="center">🎓 Scholarship Portal — Intelligent Application, Eligibility & Notification System</h1>

<p align="center">
  A modern, automated scholarship management platform with eligibility parsing, document uploads, notifications, and multi-language support.
</p>

<p align="center">
  <img alt="Build" src="https://img.shields.io/badge/build-passing-brightgreen">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Tech" src="https://img.shields.io/badge/tech-React%20%7C%20Supabase%20%7C%20Vite-orange">
  <img alt="Status" src="https://img.shields.io/badge/status-active-success">
</p>

---

# 📚 Table of Contents

- [🔌 Overview](#-overview)
- [🎬 Demo](#-demo)
- [⚡ What Makes Our System Different](#-what-makes-our-system-different)
- [🛠️ Technologies Used](#️-technologies-used)
- [🔎 Architecture \& Workflow](#-architecture--workflow)
---

# 🔌 Overview

This project provides a full scholarship workflow system where:

- Students explore scholarships, check eligibility, upload documents, and apply.
- Admins manage applications via RBAC (Role-Based Access Control).
- Email notifications are automated for apply, withdraw, and reminders.
- Supabase Storage handles secure file uploads + cleanup.
- Deadline reminder system automatically contacts eligible students.
- Dynamic internationalization supports multiple languages.
- Built-in chatbot assists users within the application.


# ⚡ What Makes Our System Different

| Feature | Existing Systems | Our System |
|--------|-----------------|------------|
| Eligibility Transparency | Generic eligibility text | Parsed rules + exact match reasons |
| Notifications | Only email or only in-app | Email + In-app + Automated reminders |
| Document Handling | Manual | Supabase Storage + auto-cleanup |
| Workflow | Static | Full apply → withdraw → cleanup automation |
| Multi-language | Limited | Full i18n with dynamic switch |
| Support | FAQ only | Integrated chatbot |

---

# 🛠️ Technologies Used

### **Frontend**
- React + TypeScript + Vite  
- React Router  
- Tailwind CSS + PostCSS  
- shadcn/ui components  
- lucide-react icons  
- LanguageContext + useTranslation (i18n)

### **Backend / Platform (Supabase)**
- Supabase Auth  
- Supabase Database  
- Storage bucket `documents`  
- Edge Functions (Deno) for Brevo Email API  
- Scheduled deadline-reminder job  

### **Deployment**
- Netlify  
- Vite build pipeline  

---

# 🔎 Architecture & Workflow

### **1. Authentication**
- Signup/Login (student/admin)  
- Role-based redirects  
- AuthContext manages session + bootstrap  
- Loading guards  

### **2. Scholarship Details**
- Eligibility parsing + match reasons  
- Deadline indicator  
- Document upload to Supabase Storage  
- Apply triggers:
  - DB insert  
  - Storage upload  
  - Email notification  
  - In-app notification  
- Similar scholarships suggestions  

### **3. My Applications**
- List with status badges  
- Access documents  
- Withdraw + hard delete  
- Storage cleanup  
- Withdraw email notification  

### **4. Deadline Reminder Job**
- Runs automatically  
- Finds near-deadline scholarships  
- Filters eligible profiles  
- Sends Brevo emails  
- Creates in-app notifications  

### **5. Internationalization**
- LanguageContext  
- useTranslation  
- Language toggle across UI  

### **6. Chatbot Assistant**
- Located in `/components/Chatbot.tsx`  
- Provides real-time help  

---


Multi-step application forms

Push notifications (FCM)

