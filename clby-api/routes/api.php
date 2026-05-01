<?php

use App\Http\Controllers\SuperAdminController;
use App\Http\Controllers\SaasPlanController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\AccessController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\ClassController;
use App\Http\Controllers\ClassTypeController;
use App\Http\Controllers\ContentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\GymController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\MembershipPlanController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OfferController;
use App\Http\Controllers\PaymentConfigController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PaymobController;
use App\Http\Controllers\PlanPromotionController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\PromoCodeController;
use App\Http\Controllers\QrTokenController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\ServicePackageController;
use App\Http\Controllers\SessionController;
use App\Http\Controllers\SessionTransferController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StudioController;
use App\Http\Controllers\TrainerController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| CLBY API Routes
|--------------------------------------------------------------------------
*/

// Health check
Route::get('/health', function () {
    try {
        DB::select('SELECT 1');
        return response()->json([
            'status' => 'ok',
            'timestamp' => now()->toISOString(),
        ]);
    } catch (\Exception $e) {
        return response()->json(['status' => 'error'], 503);
    }
});

// Public routes (no auth)
Route::get('/gyms', [GymController::class, 'listPublic']);
Route::get('/gyms/{id}', [GymController::class, 'showPublic']);
Route::post('/leads', [LeadController::class, 'store']);
Route::post('/paymob/webhook', [PaymobController::class, 'webhook'])
    ->middleware('throttle:120,1')
    ->name('paymob.webhook');

// Auth routes — no auth required, strict rate limit
Route::prefix('auth')->middleware('throttle:auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::post('/verify-email', [AuthController::class, 'verifyEmail']);
    Route::post('/resend-verification-public', [AuthController::class, 'resendVerificationPublic']);
});

// ─── Member-accessible routes (any authenticated user) ──────────────────────
Route::middleware(['auth:sanctum', \App\Http\Middleware\RequireGymId::class, \App\Http\Middleware\LogActivityMiddleware::class])->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/resend-verification', [AuthController::class, 'resendVerificationEmail']);

    // Profile (own)
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);

    // Bucket-aware membership summary (unified card + per-bucket detail)
    Route::get('/me/membership-summary', [MembershipController::class, 'mySummary']);

    // Sessions (read-only for members — browse schedule)
    Route::get('/sessions', [SessionController::class, 'index']);
    Route::post('/sessions/consume', [SessionController::class, 'consume']);
    Route::post('/sessions/checkin', [SessionController::class, 'checkinGeneric']);

    // Bookings (own bookings)
    Route::get('/bookings', [BookingController::class, 'myBookings']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::delete('/bookings/{id}', [BookingController::class, 'destroy']);

    // Payments (own)
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::get('/payments/{id}', [PaymentController::class, 'show']);

    // Memberships (own purchase)
    Route::post('/memberships/purchase', [MembershipController::class, 'purchase']);
    Route::post('/memberships/purchase-package', [MembershipController::class, 'purchaseServicePackage']);
    Route::post('/memberships/{id}/freeze', [MembershipController::class, 'freeze']);
    Route::post('/memberships/{id}/unfreeze', [MembershipController::class, 'unfreeze']);
    Route::get('/memberships/{id}/freeze-logs', [MembershipController::class, 'freezeLogs']);

    // Read-only data (browse gym content)
    Route::get('/classes', [ClassController::class, 'index']);
    Route::get('/plans', [MembershipPlanController::class, 'index']);
    Route::get('/branches', [BranchController::class, 'index']);
    Route::get('/studios', [StudioController::class, 'index']);
    Route::get('/trainers', [TrainerController::class, 'index']);
    Route::get('/trainers/{id}/reviews', [TrainerController::class, 'reviews']);
    Route::get('/service-packages', [ServicePackageController::class, 'index']);
    Route::get('/offers', [OfferController::class, 'index']);
    Route::get('/offers/{id}', [OfferController::class, 'show']);
    Route::get('/programs', [ProgramController::class, 'index']);
    Route::get('/programs/{id}', [ProgramController::class, 'show']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/content/{type}', [ContentController::class, 'index']);
    Route::get('/schedule/settings', [ScheduleController::class, 'settings']);
    Route::get('/dashboard/capacity', [DashboardController::class, 'capacity']);
    Route::get('/promo-codes', [PromoCodeController::class, 'index']);
    Route::post('/promo-codes/validate', [PromoCodeController::class, 'validate']);
    Route::get('/reviews', [ReviewController::class, 'index']);
    Route::post('/ratings', [ReviewController::class, 'store']);

    // QR / Access
    Route::post('/qr-token/generate', [QrTokenController::class, 'generate']);
    Route::post('/qr-token/verify', [QrTokenController::class, 'verify']);
    Route::post('/access/qr/validate', [AccessController::class, 'validateQr']);
    Route::post('/access/branch', [AccessController::class, 'validateBranch']);
    Route::post('/access/studio', [AccessController::class, 'validateStudio']);
    Route::post('/attendance/qr', [AttendanceController::class, 'logByQr']);

    // Paymob (mobile payment flow)
    Route::post('/paymob/intention', [PaymobController::class, 'intention']);

    // Member details (own — scoped by gym_member_id in query)
    Route::get('/members', [MemberController::class, 'index']);
    Route::delete('/members/account', [MemberController::class, 'deleteAccount']);

    // Session transfers (member-initiated share) — MUST be above /members/{id}
    Route::get('/members/lookup', [SessionTransferController::class, 'lookup'])->middleware('throttle:30,1');
    Route::post('/members/session-transfers', [SessionTransferController::class, 'store'])->middleware('throttle:30,1');
    Route::get('/members/me/transfers', [SessionTransferController::class, 'mine']);

    Route::get('/members/{id}', [MemberController::class, 'show']);

    // Attendance (self — controller auto-scopes to caller for members)
    Route::get('/attendance', [AttendanceController::class, 'index']);

    // Invitations (own)
    Route::post('/invitations', [InvitationController::class, 'store']);
    Route::post('/invitations/activate', [InvitationController::class, 'activate']);
    Route::get('/invitations/my-pass', [InvitationController::class, 'myPass']);

    // File upload (own avatar etc)
    Route::post('/files/upload', [FileController::class, 'upload']);

    // Search
    Route::get('/search', [SearchController::class, 'search']);
});

// ─── Admin-only routes (gym_admin, staff, trainer) ───────────────────────────
Route::middleware(['auth:sanctum', \App\Http\Middleware\RequireGymId::class, \App\Http\Middleware\RequireAdminRole::class, \App\Http\Middleware\LogActivityMiddleware::class])->group(function () {
    // Dashboard (view-only, no permission needed beyond admin role)
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Member management
    Route::post('/members', [MemberController::class, 'store'])->middleware('permission:members,create');
    Route::patch('/members/{id}', [MemberController::class, 'update'])->middleware('permission:members,edit');
    Route::delete('/members/{id}', [MemberController::class, 'destroy'])->middleware('permission:members,delete');
    Route::post('/members/register', [MemberController::class, 'register'])->middleware('permission:members,create');
    Route::post('/members/{id}/verify-email', [MemberController::class, 'verifyEmail'])->middleware('permission:members,edit');

    // Membership management (admin)
    Route::post('/memberships/assign', [MembershipController::class, 'assign'])->middleware('permission:members,create');
    Route::post('/memberships/extend', [MembershipController::class, 'extend'])->middleware('permission:members,edit');
    Route::post('/memberships/add-sessions', [MembershipController::class, 'addSessions'])->middleware('permission:members,edit');
    Route::patch('/memberships/{id}', [MembershipController::class, 'updateMembership'])->middleware('permission:members,edit');
    Route::post('/members/{id}/membership/detach', [MembershipController::class, 'detach'])->middleware('permission:members,edit');
    Route::post('/members/{id}/transfer', [MembershipController::class, 'transfer'])->middleware('permission:members,edit');

    // Admin: view a specific member's session-transfer history (sent + received)
    Route::get('/members/{id}/session-transfers', [SessionTransferController::class, 'forMember']);

    // Classes management
    Route::post('/classes', [ClassController::class, 'store'])->middleware('permission:classes,create');
    Route::put('/classes/{id}', [ClassController::class, 'update'])->middleware('permission:classes,edit');
    Route::delete('/classes/{id}', [ClassController::class, 'destroy'])->middleware('permission:classes,delete');
    Route::post('/classes/image', [ClassController::class, 'uploadImage'])->middleware('permission:classes,edit');

    // Class Types
    Route::get('/class-types', [ClassTypeController::class, 'index']);
    Route::post('/class-types', [ClassTypeController::class, 'store'])->middleware('permission:classes,create');
    Route::delete('/class-types/{id}', [ClassTypeController::class, 'destroy'])->middleware('permission:classes,delete');

    // Session management
    Route::post('/sessions', [SessionController::class, 'store'])->middleware('permission:classes,create');
    Route::post('/sessions/recurring', [SessionController::class, 'createRecurring'])->middleware('permission:classes,create');
    Route::put('/sessions/{id}', [SessionController::class, 'update'])->middleware('permission:classes,edit');
    Route::post('/sessions/{id}/cancel', [SessionController::class, 'cancel'])->middleware('permission:classes,edit');
    Route::post('/sessions/{id}/checkin', [SessionController::class, 'checkin'])->middleware('permission:classes,edit');
    Route::post('/sessions/recurring/{id}/stop', [SessionController::class, 'stopRecurring'])->middleware('permission:classes,edit');
    Route::get('/sessions/logs', [SessionController::class, 'sessionLogs']);

    // Booking management
    Route::get('/sessions/{sessionId}/bookings', [BookingController::class, 'index']);
    Route::get('/sessions/{sessionId}/bookings/detail', [BookingController::class, 'detail']);
    Route::put('/bookings/{id}/status', [BookingController::class, 'updateStatus'])->middleware('permission:classes,edit');

    // Payment management
    Route::post('/payments', [PaymentController::class, 'store'])->middleware('permission:payments,create');
    Route::put('/payments/{id}', [PaymentController::class, 'update'])->middleware('permission:payments,edit');
    Route::delete('/payments/{id}', [PaymentController::class, 'destroy'])->middleware('permission:payments,delete');
    Route::post('/payments/{id}/stamp-txn', [PaymentController::class, 'stampTransaction'])->middleware('permission:payments,edit');

    // Payment Config (settings-level, requires settings permission)
    Route::get('/payment-config/credentials', [PaymentConfigController::class, 'credentials'])->middleware('permission:settings,view');
    Route::get('/payment-config/status', [PaymentConfigController::class, 'status'])->middleware('permission:settings,view');
    Route::post('/payment-config', [PaymentConfigController::class, 'upsert'])->middleware('permission:settings,edit');

    // Attendance management
    Route::post('/attendance', [AttendanceController::class, 'store'])->middleware('permission:attendance,create');

    // Access management
    Route::post('/access/qr/regenerate', [AccessController::class, 'regenerateQr'])->middleware('permission:settings,edit');

    // Promo management
    Route::post('/promo-codes', [PromoCodeController::class, 'store'])->middleware('permission:promotions,create');
    Route::get('/promo-codes/{id}/redemptions', [PromoCodeController::class, 'redemptions']);
    Route::put('/promo-codes/{id}', [PromoCodeController::class, 'update'])->middleware('permission:promotions,edit');
    Route::delete('/promo-codes/{id}', [PromoCodeController::class, 'destroy'])->middleware('permission:promotions,delete');

    // Plan Promotions
    Route::get('/plan-promotions', [PlanPromotionController::class, 'index']);
    Route::post('/plan-promotions', [PlanPromotionController::class, 'store'])->middleware('permission:promotions,create');
    Route::put('/plan-promotions/{id}', [PlanPromotionController::class, 'update'])->middleware('permission:promotions,edit');
    Route::delete('/plan-promotions/{id}', [PlanPromotionController::class, 'destroy'])->middleware('permission:promotions,delete');

    // Schedule management
    Route::post('/schedule/publish', [ScheduleController::class, 'publish'])->middleware('permission:classes,edit');
    Route::post('/schedule/unpublish', [ScheduleController::class, 'unpublish'])->middleware('permission:classes,edit');

    // Paymob admin
    Route::post('/paymob/refund', [PaymobController::class, 'refund'])->middleware('permission:payments,delete');

    // File management (general utility, no specific module permission)
    Route::post('/files/url', [FileController::class, 'url']);
    Route::delete('/files', [FileController::class, 'destroy']);

    // Gym Settings
    Route::get('/settings', [GymController::class, 'show']);
    Route::patch('/settings', [GymController::class, 'update'])->middleware('permission:settings,edit');
    Route::post('/settings/logo', [GymController::class, 'uploadLogo'])->middleware('permission:settings,edit');

    // Staff management
    // GET /staff and GET /staff/roles are needed for permission resolution (no permission guard)
    Route::get('/staff', [StaffController::class, 'index']);
    Route::get('/staff/roles', [StaffController::class, 'roles']);
    Route::post('/staff', [StaffController::class, 'store'])->middleware('permission:staff,create');
    Route::get('/staff/overview', [StaffController::class, 'overview'])->middleware('permission:staff,view');
    Route::get('/staff/activity', [StaffController::class, 'activity'])->middleware('permission:staff,view');
    Route::post('/staff/{id}/reset-password', [StaffController::class, 'resetPassword'])->middleware('permission:staff,edit');
    Route::patch('/staff/{id}', [StaffController::class, 'update'])->middleware('permission:staff,edit');
    Route::delete('/staff/{id}', [StaffController::class, 'destroy'])->middleware('permission:staff,delete');
    Route::post('/staff/roles', [StaffController::class, 'storeRole'])->middleware('permission:staff,create');
    Route::patch('/staff/roles/{id}', [StaffController::class, 'updateRole'])->middleware('permission:staff,edit');
    Route::delete('/staff/roles/{id}', [StaffController::class, 'destroyRole'])->middleware('permission:staff,delete');

    // Trainer management
    Route::post('/trainers', [TrainerController::class, 'store'])->middleware('permission:classes,create');
    Route::patch('/trainers/{id}', [TrainerController::class, 'update'])->middleware('permission:classes,edit');
    Route::get('/trainers/{id}/sessions', [TrainerController::class, 'sessions']);
    Route::post('/trainers/photo', [TrainerController::class, 'uploadPhoto'])->middleware('permission:classes,edit');

    // Branch management
    Route::post('/branches', [BranchController::class, 'store'])->middleware('permission:settings,create');
    Route::get('/branches/{id}/qr-token', [BranchController::class, 'getQrToken']);
    Route::post('/branches/{id}/upload-image', [BranchController::class, 'uploadImage'])->middleware('permission:settings,edit');
    Route::patch('/branches/{id}', [BranchController::class, 'update'])->middleware('permission:settings,edit');
    Route::delete('/branches/{id}', [BranchController::class, 'destroy'])->middleware('permission:settings,delete');

    // Studio management
    Route::post('/studios', [StudioController::class, 'store'])->middleware('permission:settings,create');
    Route::get('/studios/{id}', [StudioController::class, 'show']);
    Route::patch('/studios/{id}', [StudioController::class, 'update'])->middleware('permission:settings,edit');
    Route::delete('/studios/{id}', [StudioController::class, 'destroy'])->middleware('permission:settings,delete');

    // Plan management
    Route::post('/plans', [MembershipPlanController::class, 'store'])->middleware('permission:plans,create');
    Route::patch('/plans/{id}', [MembershipPlanController::class, 'update'])->middleware('permission:plans,edit');
    Route::delete('/plans/{id}', [MembershipPlanController::class, 'destroy'])->middleware('permission:plans,delete');

    // Service Package management
    Route::post('/service-packages', [ServicePackageController::class, 'store'])->middleware('permission:classes,create');
    Route::patch('/service-packages/{id}', [ServicePackageController::class, 'update'])->middleware('permission:classes,edit');
    Route::delete('/service-packages/{id}', [ServicePackageController::class, 'destroy'])->middleware('permission:classes,delete');

    // Content management
    Route::post('/content/{type}', [ContentController::class, 'store'])->middleware('permission:content,create');
    Route::patch('/content/{type}/{id}', [ContentController::class, 'update'])->middleware('permission:content,edit');
    Route::delete('/content/{type}/{id}', [ContentController::class, 'destroy'])->middleware('permission:content,delete');

    // Offer management
    Route::post('/offers', [OfferController::class, 'store'])->middleware('permission:promotions,create');
    Route::patch('/offers/{id}', [OfferController::class, 'update'])->middleware('permission:promotions,edit');
    Route::delete('/offers/{id}', [OfferController::class, 'destroy'])->middleware('permission:promotions,delete');

    // Program management
    Route::post('/programs', [ProgramController::class, 'store'])->middleware('permission:classes,create');
    Route::patch('/programs/{id}', [ProgramController::class, 'update'])->middleware('permission:classes,edit');
    Route::delete('/programs/{id}', [ProgramController::class, 'destroy'])->middleware('permission:classes,delete');

    // Notification management
    Route::post('/notifications', [NotificationController::class, 'store'])->middleware('permission:content,create');
    Route::patch('/notifications/{id}', [NotificationController::class, 'update'])->middleware('permission:content,edit');
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy'])->middleware('permission:content,delete');

    // Invitation management (admin)
    Route::get('/invitations', [InvitationController::class, 'index']);
    Route::post('/invitations/redeem', [InvitationController::class, 'redeem'])->middleware('permission:attendance,create');
    Route::patch('/invitations/{id}/invalidate', [InvitationController::class, 'invalidate'])->middleware('permission:invitations,edit');

    // Analytics
    Route::get('/analytics/all', [AnalyticsController::class, 'all']);
    Route::get('/analytics/dashboard', [AnalyticsController::class, 'dashboard']);
});

// ─── Super-admin routes (platform-wide) ────────────────────────────────────
Route::prefix('super-admin')->middleware(['auth:sanctum', \App\Http\Middleware\RequireSuperAdmin::class])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/gyms', [SuperAdminController::class, 'index']);
    Route::get('/gyms/{id}', [SuperAdminController::class, 'show']);
    Route::post('/gyms', [SuperAdminController::class, 'store']);
    Route::patch('/gyms/{id}', [SuperAdminController::class, 'update']);
    Route::post('/gyms/{id}/toggle-active', [SuperAdminController::class, 'toggleActive']);
    Route::delete('/gyms/{id}', [SuperAdminController::class, 'destroy']);

    // Plans
    Route::get('/plans', [SaasPlanController::class, 'index']);
    Route::post('/plans', [SaasPlanController::class, 'store']);
    Route::patch('/plans/{id}', [SaasPlanController::class, 'update']);
    Route::delete('/plans/{id}', [SaasPlanController::class, 'destroy']);

    // Payments / Invoices
    Route::get('/invoices', [SaasPlanController::class, 'invoices']);
    Route::post('/invoices', [SaasPlanController::class, 'createInvoice']);
    Route::post('/invoices/{id}/mark-paid', [SaasPlanController::class, 'markPaid']);
    Route::delete('/invoices/{id}', [SaasPlanController::class, 'deleteInvoice']);

    // Landing page leads
    Route::get('/leads', [LeadController::class, 'index']);
    Route::post('/leads/{id}/toggle-contacted', [LeadController::class, 'toggleContacted']);
    Route::delete('/leads/{id}', [LeadController::class, 'destroy']);
});
