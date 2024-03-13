/*
 * Copyright 2020 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by Maxime Allanic <maxime@allanic.me> at 20/06/2020
 */

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { EventContext } from "firebase-functions";
import { https, region } from "firebase-functions";

export type UpdateCallback = (
    after: QueryDocumentSnapshot,
    before: QueryDocumentSnapshot,
    context: EventContext<Record<string, string>>,
) => Promise<void>;

export type CreateCallback = (doc: QueryDocumentSnapshot) => Promise<void>;

export type DeleteCallback = (doc: QueryDocumentSnapshot) => Promise<void>;

export async function onCommandLineCall(callback: Function) {
    try {
        await callback(...process.argv.slice(2));
        process.exit(0);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(3);
    }
}

const onCallCallbacks: { [key: string]: { callback: Function; options: any } } = {};
export async function onCall(name: string, callback: Function, options = {}) {
    onCallCallbacks[name] = { callback, options };
}

const onScheduleCallbacks: {
    [key: string]: { schedule: string; callback: Function; options: any };
} = {};
export async function onSchedule(
    name: string,
    schedule: string,
    callback: Function,
    options: any = {},
) {
    onScheduleCallbacks[name] = {
        schedule,
        callback,
        options,
    };
}

const onRequestCallbacks: { [key: string]: { router: any; options: any } } = {};
export async function onRequest(name: string, router: any, options: any = {}) {
    onRequestCallbacks[name] = { router, options };
}

const onDocumentUpdatedCallbacks: { [key: string]: { callback: UpdateCallback }[] } = {};
export function onDocumentUpdated(path: string, callback: UpdateCallback) {
    if (onDocumentUpdatedCallbacks[path] === undefined)
        onDocumentUpdatedCallbacks[path] = [];
    onDocumentUpdatedCallbacks[path].push({ callback });
}

const onDocumentCreatedCallbacks: { [key: string]: { callback: CreateCallback }[] } = {};
export function onDocumentCreated(path: string, callback: CreateCallback) {
    if (onDocumentCreatedCallbacks[path] === undefined)
        onDocumentCreatedCallbacks[path] = [];
    onDocumentCreatedCallbacks[path].push({ callback });
}

const onDocumentDeletedCallbacks: { [key: string]: { callback: DeleteCallback }[] } = {};
export function onDocumentDeleted(path: string, callback: DeleteCallback) {
    if (onDocumentDeletedCallbacks[path] === undefined)
        onDocumentDeletedCallbacks[path] = [];
    onDocumentDeletedCallbacks[path].push({ callback });
}

export function getCall(name: string) {
    return async function () {
        if (typeof onCallCallbacks[name] === "object")
            return onCallCallbacks[name].callback();
        else if (typeof onScheduleCallbacks[name] === "object")
            return onScheduleCallbacks[name].callback();
    };
}

export function getCalls() {
    const calls: any = {};
    Object.keys(onCallCallbacks).forEach((name) => {
        const call = onCallCallbacks[name];
        calls[name] = region("europe-west1")
            .runWith(call.options)
            .https.onCall(async (data, context) => {
                try {
                    return await call.callback(data, context);
                } catch (err: any) {
                    let error = err;
                    if (!(error instanceof https.HttpsError)) {
                        // eslint-disable-next-line no-console
                        console.error(error);
                        error = new https.HttpsError("internal", error.message);
                    }
                    throw error;
                }
            });
    });

    Object.keys(onScheduleCallbacks).forEach((name) => {
        const call = onScheduleCallbacks[name];
        calls[name] = region("europe-west1")
            .runWith(call.options)
            .pubsub.schedule(call.schedule)
            .timeZone("Europe/Paris")
            .onRun(async (context) => {
                try {
                    return await call.callback(context);
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error(error);
                    throw error;
                }
            });
    });

    Object.keys(onRequestCallbacks).forEach((name) => {
        const call = onRequestCallbacks[name];
        calls[name] = region("europe-west1")
            .runWith(call.options)
            .https.onRequest(async (request, context) => {
                return call.router()(request, context);
            });
    });

    Object.keys(onDocumentCreatedCallbacks).forEach((path) => {
        const callers = onDocumentCreatedCallbacks[path];
        const name = cloudFunctionsNameFromPath(path);
        calls[`onDocumentCreated_${name}`] = region("europe-west1")
            .firestore.document(path)
            .onCreate(async (entity) => {
                return Promise.all(
                    callers.map(async (caller) => {
                        try {
                            await caller.callback(entity);
                        } catch (error) {
                            // eslint-disable-next-line no-console
                            console.error(error);
                        }
                    }),
                );
            });
    });

    Object.keys(onDocumentUpdatedCallbacks).forEach((path) => {
        const callers = onDocumentUpdatedCallbacks[path];
        const name = cloudFunctionsNameFromPath(path);
        calls[`onDocumentUpdated_${name}`] = region("europe-west1")
            .firestore.document(path)
            .onUpdate(async function (change, context) {
                return Promise.all(
                    callers.map(async (caller) => {
                        try {
                            await caller.callback(change.after, change.before, context);
                        } catch (error) {
                            // eslint-disable-next-line no-console
                            console.error(error);
                        }
                    }),
                );
            });
    });

    Object.keys(onDocumentDeletedCallbacks).forEach((path) => {
        const callers = onDocumentDeletedCallbacks[path];
        const name = cloudFunctionsNameFromPath(path);
        calls[`onDocumentDeleted_${name}`] = region("europe-west1")
            .firestore.document(path)
            .onDelete(async function (entity) {
                return Promise.all(
                    callers.map(async (caller) => {
                        try {
                            await caller.callback(entity);
                        } catch (error) {
                            // eslint-disable-next-line no-console
                            console.error(error);
                        }
                    }),
                );
            });
    });

    return calls;
}

const cloudFunctionsNameFromPath = (path: string) =>
    path.replaceAll("{", "").replaceAll("}", "").split("/").join("_");
