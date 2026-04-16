# CLBY Gym Management System - Features Guide

A complete guide to every feature in the **Admin Dashboard** and **Member Mobile App**, including what each feature does and the steps to use it.

---

## Table of Contents

### Admin Dashboard
1. [Dashboard Overview](#1-dashboard-overview)
2. [Members Management](#2-members-management)
3. [Subscription Plans](#3-subscription-plans)
4. [Payments & Billing](#4-payments--billing)
5. [Classes & Schedule](#5-classes--schedule)
6. [Attendance & Access Control](#6-attendance--access-control)
7. [Promotions & Discounts](#7-promotions--discounts)
8. [Services (Programs, Offers, Trainers, Packages)](#8-services)
9. [Guest Invitations](#9-guest-invitations)
10. [Content Management](#10-content-management)
11. [Analytics & Reporting](#11-analytics--reporting)
12. [Staff & Roles](#12-staff--roles)
13. [Branches & Studios](#13-branches--studios)
14. [Settings](#14-settings)

### Member Mobile App
15. [Authentication](#15-authentication)
16. [Home Screen](#16-home-screen)
17. [Schedule & Class Booking](#17-schedule--class-booking)
18. [Check-In & QR Code](#18-check-in--qr-code)
19. [Membership & Active Services](#19-membership--active-services)
20. [My Bookings](#20-my-bookings)
21. [Explore Section](#21-explore-section)
22. [Payment & Checkout](#22-payment--checkout)
23. [Billing & Invoices](#23-billing--invoices)
24. [Guest Invitations (Mobile)](#24-guest-invitations-mobile)
25. [Notifications](#25-notifications)
26. [Profile Management](#26-profile-management)
27. [Guest Mode](#27-guest-mode)

---

# Admin Dashboard

## 1. Dashboard Overview

**What it does:** Provides a high-level snapshot of your gym's key metrics at a glance.

**What you see:**
- Total Members count
- Active Staff count
- This Month's Revenue
- Total Revenue (all time)
- Recent Payments list with amounts, methods, and statuses

**How to use:**
1. Log in to the admin dashboard
2. The overview page loads automatically as your landing page
3. Review KPI cards for a quick health check of your gym
4. Scroll down to see the most recent payment activity

---

## 2. Members Management

### 2.1 Members List

**What it does:** View, search, and manage all gym members from a single table.

**What you see:**
- Member number, full name (with avatar), status, plan name, plan type, joined date, and notes

**How to use:**
1. Go to **Members** in the sidebar
2. Use the search bar to find members by name, number, or status
3. Sort by any column by clicking the column header
4. Click **Add Member** to create a new member

**Steps to add a member:**
1. Click **Add Member**
2. Fill in: Full Name (required), Email, Phone
3. Set Status (Active / Inactive / Suspended)
4. Add optional notes
5. Click **Add Member** to save

### 2.2 Member Detail Page

**What it does:** Shows a member's full profile, current membership, payment history, attendance, and service assignments.

**How to use:**
1. Click on any member row in the members list
2. Review the header: name, member number, status badge, join date
3. Browse tabs:
   - **Overview** -- Personal info, current plan, recent payments, attendance summary, membership history
   - **Attendance** -- Full check-in history with timestamps, method, and access point
   - **Payments** -- All payment records with amounts, status, and dates
   - **Services** -- Active service assignments (PT, Nutrition, Physiotherapy)

### 2.3 Member Actions

From the member detail page, you can perform the following actions:

#### Assign / Change Plan
1. Click **Assign Plan** (or **Change Plan** if a plan is active)
2. Select a plan from the dropdown
3. Set the start date
4. Optionally apply a promo code or plan promotion
5. Click **Assign** -- the system calculates the end date, cancels any existing active plan, and creates a payment record

#### Add Sessions (session-based plans only)
1. Click **Add Sessions**
2. Enter the number of sessions to add
3. Click **Confirm** -- sessions are added to the remaining balance

#### Extend Membership (time-based plans only)
1. Click **Extend**
2. Enter the number of days to add
3. Click **Confirm** -- the end date is pushed forward

#### Freeze Membership (if the plan supports freeze)
1. Click **Freeze**
2. Enter the number of freeze days
3. Click **Confirm** -- the membership is paused, end date is extended by the freeze duration
4. To unfreeze early, click **Unfreeze** -- unused freeze days are refunded by pulling back the end date

#### Transfer Membership
1. Click **Transfer**
2. Search and select the destination member
3. Click **Confirm** -- the active membership moves to the new member, the original member becomes inactive

#### Detach Plan
1. Click **Detach Plan**
2. Confirm the action -- the membership is cancelled and the member status is set to inactive

---

## 3. Subscription Plans

**What it does:** Create and manage the membership plans your gym offers.

**Plan types supported:**
- **Monthly** -- Recurring monthly access
- **Annual** -- Yearly access
- **Duration** -- Fixed number of days
- **Sessions** -- Fixed number of sessions with an expiry window
- **Duration + Sessions** -- Time-limited access with a session cap

**How to use:**
1. Go to **Plans** in the sidebar
2. Click **Add Plan** to create a new plan

**Steps to create a plan:**
1. Enter: Plan Name, Plan Type, Price, Currency, Duration (days), Session Count (if applicable)
2. Add description, facilities list, visits per week, and add-ons
3. Configure advanced options:
   - **Freeze settings** -- Enable/disable freeze, set max freeze days and max freeze count
   - **Guest Invitations** -- Enable invitations, set invitations per cycle, duration type (per-visit or time-based), and validity days
   - **Branch Access** -- Allow access to all branches or restrict to specific ones
4. Click **Save**

**To edit or delete a plan:**
1. Click the plan row in the table
2. Edit any field and save, or click **Delete** to soft-delete

---

## 4. Payments & Billing

**What it does:** Track all payments, record new transactions, send invoices, and process refunds.

**What you see:**
- Member name and number, amount, payment method, status (Paid / Pending / Overdue / Refunded), service type, dates

**How to use:**
1. Go to **Payments** in the sidebar
2. Use filters: search by member, filter by status, payment method, or date range

### Record a Payment
1. Click **Record Payment**
2. Select the member
3. Choose service type: Membership, Session Package, Program, Offer, or Service
4. Enter amount, payment method (Cash, Card, Bank Transfer), and optional notes
5. Optionally apply a promo code for automatic discount calculation
6. Click **Save**

### Send Payment Link
1. Find the payment in the table
2. Click the actions menu > **Send Payment Link**
3. The member receives an email with a payment link

### Send Payment Reminder
1. Click actions menu > **Send Reminder**
2. An email reminder is sent for the overdue/pending payment

### Send Invoice
1. Click actions menu > **Send Invoice**
2. A formatted invoice is emailed to the member

### Process a Refund
1. Click actions menu > **Refund**
2. Choose full or partial refund
3. Enter the refund amount (for partial)
4. Click **Confirm** -- the payment status updates to Refunded or Partial Refund

---

## 5. Classes & Schedule

**What it does:** Manage your gym's classes, create sessions (one-off or recurring), handle bookings, and track attendance.

### 5.1 Classes Tab

**Steps to create a class:**
1. Go to **Classes** in the sidebar
2. Click the **Classes** tab
3. Click **Add Class**
4. Enter: Class Name, Class Type, Instructor, Location, Color, optional image
5. Click **Save**

### 5.2 Sessions Tab

**Steps to create a session (one-off):**
1. Click the **Sessions** tab
2. Click **Add Session**
3. Select a class, set date, start time, end time, and capacity
4. Assign a studio/location and branch
5. Toggle **Walk-in Allowed** if non-registered members can attend
6. Click **Create**

**Steps to create recurring sessions:**
1. Click **Add Recurring**
2. Configure the class, days of the week, time, and capacity
3. Set the recurrence period
4. Click **Create** -- individual session instances are generated

**To view bookings for a session:**
1. Click on a session row
2. The bookings modal shows all registered members
3. You can remove a member's booking or check them in

**To cancel a session:**
1. Click the session's actions menu > **Cancel**
2. Enter a cancellation reason
3. Click **Confirm**

### 5.3 Schedule Tab
- Visual calendar view of all sessions
- Navigate by month
- Click a date to see that day's sessions or add a new one

### 5.4 Sessions Tracker Tab
- Monitor session consumption for members on session-based plans
- Shows: member name, plan name, sessions used / remaining, percentage used
- Search by member name

---

## 6. Attendance & Access Control

**What it does:** View and filter all gym check-in logs.

**What you see:**
- Member name and number, check-in date/time, method (QR, Manual, Mobile), access point, branch

**How to use:**
1. Go to **Attendance** in the sidebar
2. Filter by: date range, member, access point, check-in method, or branch
3. Logs load the most recent 50 entries by default

---

## 7. Promotions & Discounts

**What it does:** Create and manage discount promo codes that members can apply during checkout.

**Steps to create a promo code:**
1. Go to **Promotions** in the sidebar
2. Click **Add Promo Code**
3. Enter: Code (e.g. SUMMER20), Display Name, Discount Type (Percentage or Fixed), Discount Value
4. Set: Valid From, Valid Until, Max Uses (total), Max Uses Per Member
5. Click **Save**

**To view usage:**
- The table shows each code's usage count vs max uses
- Click a code to see redemption details

---

## 8. Services

**What it does:** Manage gym programs, promotional offers, trainer profiles, and service session packages across four tabs.

### 8.1 Gym Programs

**Steps to create a program:**
1. Go to **Services** > **Programs** tab
2. Click **Add Program**
3. Enter: Title, Description, Duration (weeks), Total Sessions, Session Duration, Level, Category, Trainer, Price
4. Upload a thumbnail image
5. Set status to Draft or Published
6. Click **Save**

### 8.2 Offers

**Steps to create an offer:**
1. Go to **Services** > **Offers** tab
2. Click **Add Offer**
3. Enter: Title, Short Description, Full Description, Tag Label, Tag Color, CTA Label
4. Upload a hero image
5. Set expiry date and terms
6. Click **Save**

### 8.3 Trainers

**Steps to add a trainer:**
1. Go to **Services** > **Trainers** tab (or **Trainers** in sidebar)
2. Click **Add Trainer**
3. Enter: Name, Bio, Specializations, Trainer Type (Personal Trainer / Physiotherapist / Nutritionist)
4. Upload a photo
5. Assign to branches
6. Click **Save**

### 8.4 Session Packages

**Steps to create a service package:**
1. Go to **Services** > **Session Packages** tab
2. Click **Add Package**
3. Enter: Package Name, Service Type (PT / Physio / Nutrition), Session Count, Price
4. Click **Save**

When a payment is recorded for one of these packages, a **Member Service Assignment** is automatically created to track session usage.

---

## 9. Guest Invitations

**What it does:** Manage guest passes that members send to friends. Controlled by each membership plan's invitation settings.

**What you see:**
- Guest name, email, phone, status (Pending / Accepted / Active / Expired / Invalidated), inviter info, visits used, expiry date

**How to use:**
1. Go to **Invitations** in the sidebar
2. View all invitations across members
3. To invalidate an invitation, click actions > **Invalidate**

---

## 10. Content Management

**What it does:** Manage all in-app content visible to members, organized into six tabs.

### 10.1 FAQs
1. Go to **Content** > **FAQs** tab
2. Click **Add FAQ**
3. Enter Question and Answer
4. Set display order and visibility toggle
5. Click **Save**

### 10.2 Announcements
1. Go to **Content** > **Announcements** tab
2. Click **Add Announcement**
3. Enter Title, Body, Visible From date, Visible Until date
4. Click **Save** -- auto-hides after the Visible Until date passes

### 10.3 Banners
1. Go to **Content** > **Banners** tab
2. Click **Add Banner**
3. Upload an image, set caption, description, tag, action type and value (link or app action)
4. Set sort order and mark as Featured if desired
5. Click **Save**

### 10.4 Popups
1. Go to **Content** > **Popups** tab
2. Click **Add Popup**
3. Enter Title, Subtitle, Image URL, CTA Label and Action, Priority
4. Click **Save** -- higher priority popups show first in the app

### 10.5 Partners
1. Go to **Content** > **Partners** tab
2. Click **Add Partner**
3. Enter Partner Name, Logo URL, display order
4. Click **Save**

### 10.6 Notifications (Broadcast)
1. Go to **Content** > **Notifications** tab
2. Click **Send Notification**
3. Enter Title and Body
4. Choose recipients: All Members, Specific Plans, or Specific Statuses
5. Choose: Send Now or Schedule for a specific date/time
6. Click **Send** -- delivered via push notification (FCM)

---

## 11. Analytics & Reporting

**What it does:** Visualize gym performance data across four tabs with interactive charts and exportable reports.

### 11.1 Dashboard Tab
- KPI cards: Active Members, New Members, Revenue, Check-ins, Sessions, Bookings
- Timeline charts: revenue trend, check-ins trend, new members trend
- Select period (30d / 90d / 6m / 12m) and granularity (day / week / month)

### 11.2 Members Tab
- New members vs cancellations per month
- Churn rate calculation
- Net growth visualization

### 11.3 Revenue Tab
- Total revenue, overdue, and pending amounts
- Revenue by plan type (pie chart)
- Payment status distribution
- Revenue timeline (monthly)

### 11.4 Classes Tab
- Total sessions and bookings
- Analytics by class: sessions count, bookings, average per session
- Peak times: by day of week and hour of day

### Export to Excel
1. Click **Export** on any analytics tab
2. An XLSX file downloads with separate sheets per metric type

---

## 12. Staff & Roles

**What it does:** Manage staff accounts, define custom roles with granular permissions, and track all staff activity.

### 12.1 Staff Accounts Tab

**Steps to add staff:**
1. Go to **Staff** > **Staff Accounts** tab
2. Click **Add Staff**
3. Enter: Full Name, Email, Phone
4. Assign a role
5. Click **Save** -- the staff member receives an invitation email

**Other actions:** Edit, Activate/Deactivate, Reset Password, Copy Invitation Link, Delete

### 12.2 Roles & Permissions Tab

**Steps to create a role:**
1. Go to **Staff** > **Roles & Permissions** tab
2. Click **Add Role**
3. Enter a Role Name
4. For each module (Members, Plans, Payments, Classes, Trainers, Promotions, Attendance, Content, Notifications, Analytics, Settings, Staff), check the allowed actions: View, Create, Edit, Delete
5. Click **Save**

### 12.3 Activity Log Tab
- View a chronological log of all staff actions
- Shows: staff name, action type (create / update / delete), module, description, timestamp
- Color-coded by action type

---

## 13. Branches & Studios

### 13.1 Branches

**Steps to add a branch:**
1. Go to **Settings** > **Branches** section (or **Branches** in sidebar)
2. Click **Add Branch**
3. Enter: Branch Name, Address, Google Maps URL
4. Upload a branch image
5. Click **Save**

**Generate QR for check-in:**
1. Open a branch
2. Click **Generate QR Token** -- produces a QR code that members scan at the entrance

### 13.2 Studios

**Steps to add a studio:**
1. Go to **Studios**
2. Click **Add Studio**
3. Select the Branch, enter Studio Name and Capacity
4. Click **Save**

Studios are assigned to class sessions for location tracking and capacity management.

---

## 14. Settings

**What it does:** Configure your gym's profile, branding, operating hours, and app behavior.

**Sections:**

### Logo
1. Click **Upload Logo**
2. Select an image file
3. The logo appears across the admin dashboard and member app

### Gym Profile
1. Edit: Gym Name, Email, Phone, Address, Description
2. Click **Save**

### Operating Hours
1. For each day (Monday-Sunday), toggle Open/Closed
2. Set Opening Time and Closing Time
3. Optionally set Lunch Break times
4. Click **Save**

### Mobile App Settings
1. Toggle **Enable Mobile Payments** to allow/disallow in-app purchases
2. Click **Save**

### Capacity Tracking
1. Toggle **Enable Capacity** on
2. Set **Max Capacity** (number)
3. The real-time capacity count shows: current active members vs max, with a color-coded percentage indicator

---

# Member Mobile App

## 15. Authentication

### 15.1 Registration

**Steps:**
1. Open the app and tap **Sign Up**
2. **Step 1:** Enter First Name, Last Name, Password (8+ characters), Confirm Password, Gender, and optional Date of Birth
3. **Step 2:** Enter Phone Number (Egyptian format) and Email
4. Tap **Register**
5. Check your email for a confirmation link and click it
6. Return to the app and log in

### 15.2 Login

**Steps:**
1. Enter your Email and Password
2. Tap **Sign In**
3. The app loads your profile, gym info, and membership data

### 15.3 Forgot Password

**Steps:**
1. On the login screen, tap **Forgot Password?**
2. Enter your email address
3. Tap **Send Reset Link** (60-second cooldown between resends)
4. Check your email (including spam folder) and click the reset link
5. The app opens the Reset Password screen
6. Enter a new password (8+ characters) and confirm
7. Tap **Reset Password** -- you're redirected to the home screen

---

## 16. Home Screen

**What you see:**
- **Banner Carousel:** Promotional banners (tap to view details)
- **Membership Card:** Current plan name, type, expiry date, freeze status, invitations balance, active services
- **Upcoming Sessions:** Next 3 booked or available classes with a quick Book button
- **Gym Capacity:** Real-time occupancy indicator (refreshes every 30 seconds)
- **Quick Actions:** Browse memberships, browse offers, view full schedule
- **Monthly Check-ins:** Your attendance count for the current month

**How to use:**
- Pull down to refresh all data
- Tap the membership card to open full membership details
- Tap a session card to view details or book
- Tap a banner to see the full promotion

---

## 17. Schedule & Class Booking

**What it does:** Browse all upcoming classes for the next 30 days, filter, and book sessions.

**Steps to book a class:**
1. Tap the **Schedule** tab (bottom navigation)
2. Swipe through the date carousel to select a day
3. Browse available classes for that date
4. Tap a class to view details (description, trainer info, capacity, time)
5. Tap **Book** to reserve your spot
6. A confirmation appears and the session is added to your bookings

**Steps to cancel a booking:**
1. Find the booked session (shown with a "Booked" badge)
2. Tap the session to open details
3. Tap **Cancel Booking**
4. Confirm the cancellation

**Filtering classes:**
- Tap the filter icon to filter by: Class Type, Instructor, Time of Day (Morning/Afternoon/Evening), Location, or Branch
- Use the search bar to find classes by name

---

## 18. Check-In & QR Code

**What it does:** Display your personal QR code for gym check-in, or scan a gym QR code.

### Displaying Your QR Code
1. Tap the **Check-in** tab (center of bottom navigation)
2. Your member number and a dynamic QR code are displayed
3. The QR refreshes automatically every ~30 seconds for security
4. Show this QR to the front desk scanner

### Scanning a Gym QR Code
1. On the check-in screen, tap the **Scan** button
2. Point your camera at the gym's QR code (entrance or studio)
3. The system validates your membership and logs your attendance
4. You see a success or denied message

### Attendance History
- Scroll down on the check-in screen to see your recent check-ins (last 10)
- Entries are grouped by: Today, Yesterday, Earlier
- Each entry shows: time, method (QR / Manual), and access point

---

## 19. Membership & Active Services

**What it does:** View your current membership details, freeze/unfreeze your plan, and see active service assignments.

**Steps to view membership:**
1. Tap the Membership Card on the home screen, or go to **Profile** > **Active Services**
2. You see: Plan Name, Plan Type, Billing Cycle, Start Date, Expiry Date, Status

**Freeze your membership (if your plan supports it):**
1. Open the Membership screen
2. Tap **Freeze Plan**
3. Select the number of freeze days (1-30)
4. Tap **Confirm** -- your membership pauses and the end date extends by the freeze duration

**Unfreeze early:**
1. Open the Membership screen (shows "Frozen until [date]")
2. Tap **Unfreeze**
3. Unused freeze days are refunded by adjusting the end date

**Active Services section shows:**
- Personal Training: trainer name, sessions used / total
- Nutrition: specialist name, sessions used / total
- Physiotherapy: specialist name, sessions used / total

---

## 20. My Bookings

**What it does:** View all your class bookings in one place.

**How to use:**
1. Navigate to **My Bookings** (from home screen or profile)
2. Two tabs:
   - **Upcoming:** Future sessions you've booked (sorted by date)
   - **Past:** Previous bookings with attendance status (Attended / Missed / Cancelled)
3. Tap any booking to view session details or cancel

---

## 21. Explore Section

**What it does:** Browse everything your gym offers -- memberships, offers, trainers, programs, and services.

**How to use:**
1. Tap the **Explore** tab (bottom navigation)
2. Browse sections:
   - **Memberships:** All available plans with prices and features
   - **Offers:** Time-limited promotions and deals
   - **Trainers:** Trainer profiles with photos, specialties, and ratings
   - **Programs:** Training programs with descriptions and schedules
   - **Session Packages:** Class bundles
   - **Services:** PT, Nutrition, Physiotherapy packages
   - **Partners:** Affiliated facilities
3. Tap any item to view full details
4. Tap **Purchase** or **Claim** to proceed to checkout

**Search:**
- Use the search bar at the top to search across all content types

---

## 22. Payment & Checkout

**What it does:** Complete purchases for memberships, offers, programs, and service packages.

**Steps to complete a purchase:**
1. From any item detail screen (membership, offer, program, package), tap **Purchase**
2. The Payment Summary screen shows:
   - Item name and description
   - Original price
   - Member discount (auto-applied from your active plan, if applicable)
   - Promo code field
3. To apply a promo code:
   - Enter the code and tap **Apply**
   - The discount is calculated and shown
   - Tap the X to remove the code
4. Review the final amount
5. Tap **Complete Payment**
6. Enter your card details on the Paymob payment screen
7. On success:
   - Your membership or service is activated immediately
   - A confirmation is shown
   - The app refreshes your membership and payment data

---

## 23. Billing & Invoices

**What it does:** View all your transaction history and invoice details.

**How to use:**
1. Navigate to **Billing** (from profile or home)
2. See a list of all invoices sorted by date
3. Each entry shows: date, item name, amount, status badge (Paid / Pending / Cancelled)
4. Tap an invoice to see the full breakdown:
   - Item name and description
   - Original price, discounts applied, final amount
   - Payment method
   - Status with timestamp
   - Order number

---

## 24. Guest Invitations (Mobile)

**What it does:** Invite friends to visit your gym using guest passes included in your membership plan.

**Steps to invite a guest:**
1. Go to **Profile** > **Invite a Guest** (appears only if your plan has invitations enabled)
2. See your invitation balance: remaining / total
3. Tap the **+** button to create a new invitation
4. Enter: Guest Email, Guest Phone, Guest Name (optional), Max Visits
5. Tap **Send**
6. Your guest receives an email with an invitation link
7. Track the invitation status in the list: Pending > Accepted > Active > Expired

**How guests use the invitation:**
1. Guest receives the email and clicks the invitation link
2. Guest registers with the same email and phone
3. The guest pass auto-activates
4. Guest can check in via QR until the pass expires or max visits are reached

---

## 25. Notifications

**What it does:** Receive and view push notifications from your gym.

**How to use:**
1. Tap the bell icon on the home screen (badge shows unread count)
2. See all notifications grouped by: Today, Yesterday, Earlier
3. Filter by: All / Unread / Read
4. Tap a notification to mark it as read and view the full message

**Types of notifications you may receive:**
- Gym announcements and promotions
- Booking confirmations
- Membership expiry warnings (7 days and 1 day before)
- Payment reminders
- Custom broadcasts from gym staff

---

## 26. Profile Management

**What it does:** View and edit your personal information, change your password, sign out, or delete your account.

**Steps to edit your profile:**
1. Tap the **Profile** tab (bottom navigation)
2. Tap **Edit** in the top right
3. Update: Full Name, Phone, Date of Birth
4. Tap **Save**

**Change profile photo:**
1. Tap the camera icon on your avatar
2. Choose **Take a photo** or **Choose from gallery**
3. Crop the image to a square
4. The photo uploads automatically

**Change password:**
1. Scroll to the **Account** section
2. Tap **Change Password**
3. Enter New Password (6+ characters) and Confirm Password
4. Tap **Save**

**Sign out:**
1. Tap **Sign Out**
2. Confirm in the dialog

**Delete account:**
1. Tap **Delete Account**
2. Read the warning: this permanently deletes your account and all associated data
3. Tap **Delete Account** to confirm
4. Your account is deactivated, profile data is anonymized, and you are signed out

---

## 27. Guest Mode

**What it does:** Browse your gym's information without creating an account.

**How to use:**
1. On the login screen, tap **Continue as Guest**
2. You can browse:
   - Home: Banners and today's classes
   - Classes: View the full schedule (read-only)
   - Gym Info: Location, hours, contact details
   - Trainers: Browse trainer profiles
   - Plans: View available memberships
3. Locked features (require sign-up): Check-in, Bookings, Profile
4. Tapping a locked tab shows a prompt to sign up

---

*This document covers all features available as of April 2026.*
