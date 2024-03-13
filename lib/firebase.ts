import $admin from "firebase-admin";

let index = 0;

export function initializeApp(options: any, dev: boolean = false) {
    if (!dev) {
        delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
        delete process.env.FIRESTORE_EMULATOR_HOST;
        delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
        delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    }
    const appName = "app" + index++;
    const app = $admin.initializeApp(options, appName);
    app.auth();
    app.firestore();
    // app.database();
    app.storage();
    return app;
}
export const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.FUNCTIONS_EMULATOR !== undefined;
export const firebase = initializeApp(undefined, isDev);
