import * as firebaseAdmin from 'firebase-admin';

let app: firebaseAdmin.app.App | null = null;

export function getFirebaseApp(): firebaseAdmin.app.App | null {
  if (app) return app;
  if (firebaseAdmin.apps.length > 0) {
    app = firebaseAdmin.apps[0]!;
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  try {
    const serviceAccount = JSON.parse(raw) as firebaseAdmin.ServiceAccount;
    app = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
    });
    return app;
  } catch {
    console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT');
    return null;
  }
}

export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
): Promise<void> {
  if (tokens.length === 0) return;
  const fbApp = getFirebaseApp();
  if (!fbApp) return;

  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  await Promise.allSettled(
    chunks.map(chunk =>
      firebaseAdmin.messaging(fbApp).sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      }),
    ),
  );
}
