import { firebase } from "./firebase";
import { firestore } from "firebase-admin";
import { Timer } from "./util";

export default function (collectionName: string) {
    return new Query(collectionName);
}

class Query {
    queries: any[];
    additionnalWheres: any[];
    limitSize: number;

    constructor(collectionName: string) {
        this.queries = [];
        this.additionnalWheres = [];
        this.limitSize = -1;

        const firestore = firebase.firestore();

        const collection = firestore.collection(collectionName);

        this.queries.push(collection);
    }

    hasComparator(comparator: string) {
        return this.queries.some((query) => {
            return query._queryOptions.fieldFilters.some((fieldFilter: any) => {
                return (
                    comparator.toLowerCase() ===
                    fieldFilter.op.replace(/_/g, "-").toLowerCase()
                );
            });
        });
    }

    where(field: any, comparator: any, value: any) {
        if (comparator === "in" || comparator === "array-contains-any") {
            if (
                this.hasComparator("in") ||
                this.hasComparator("array-contains-any") ||
                this.hasComparator("not-in")
            ) {
                this.additionnalWheres.push({
                    field,
                    comparator,
                    value,
                });
                return this;
            }
            if (value.length > 10) {
                const chunkSize = 10;
                let newQueries: any[] = [];
                for (let i = 0; i < value.length; i += chunkSize) {
                    const chunk = value.slice(i, i + chunkSize);
                    newQueries = newQueries.concat(
                        this.queries.map((query) => {
                            return query.where(field, comparator, chunk);
                        })
                    );
                }
                this.queries = newQueries;
                return this;
            } else if (value.length === 0) return this;
        } else if (comparator === "not-in") {
            if (
                this.hasComparator("in") ||
                this.hasComparator("array-contains-any") ||
                this.hasComparator("not-in") ||
                this.hasComparator("not-equal")
            ) {
                this.additionnalWheres.push({
                    field,
                    comparator,
                    value,
                });
                return this;
            }
            if (value.length > 10) {
                const chunkSize = 10;
                for (let i = 0; i < value.length; i += chunkSize) {
                    const chunk = value.slice(i, i + chunkSize);
                    this.queries = this.queries.map((query) => {
                        return query.where(field, comparator, chunk);
                    });
                }
                return this;
            } else if (value.length === 0) return this;
        } else if (comparator === "!=") {
            if (
                this.hasComparator("in") ||
                this.hasComparator("array-contains-any") ||
                this.hasComparator("not-in") ||
                this.hasComparator("not-equal")
            ) {
                this.additionnalWheres.push({
                    field,
                    comparator,
                    value,
                });
                return this;
            }
        } else if (comparator === "array-not-contains-any") {
            this.additionnalWheres.push({
                field,
                comparator,
                value,
            });
            return this;
        }

        this.queries = this.queries.map((query) => {
            return query.where(field, comparator, value);
        });

        return this;
    }

    limit(size: number) {
        this.limitSize = size;
        return this;
    }

    async get(progressCallback: Function) {
        const timer = new Timer("query");
        const docs: any = {};

        await this.queries.reduce(async (acc, query, index) => {
            await acc;
            if (this.limitSize > 0) query = query.limit(this.limitSize);
            const snapshot = await query.get();

            timer.logAndReset(`fetched ${index}/${this.queries.length}`);

            const progressDocs: any = {};

            snapshot.docs.forEach((doc: any) => {
                if (docs[doc.id] === undefined) {
                    const data = doc.data();
                    data;

                    const isNotFiltered = this.additionnalWheres.every((where) => {
                        let value: any = undefined;
                        try {
                            eval(`value = data.${where.field}`);
                            if (where.field === firestore.FieldPath.documentId())
                                value = doc.id;

                            if (where.comparator === "in")
                                return where.value.indexOf(value) >= 0;
                            else if (where.comparator === "array-contains-any")
                                return where.value.some((v: any) => {
                                    return value.indexOf(v) >= 0;
                                });
                            else if (where.comparator === "array-not-contains-any")
                                return where.value.every((v: any) => {
                                    return value.indexOf(v) < 0;
                                });
                            else if (where.comparator === "not-in")
                                return where.value.indexOf(value) < 0;
                            else if (where.comparator !== "!=")
                                return value !== where.value;
                            return true;
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error(e);
                            return false;
                        }
                    });
                    if (
                        isNotFiltered &&
                        (this.limitSize <= 0 ||
                            Object.values(docs).length < this.limitSize)
                    )
                        progressDocs[doc.id] = doc;
                }
            });

            Object.assign(docs, progressDocs);
            if (typeof progressCallback === "function")
                await progressCallback({
                    docs: Object.values(progressDocs),
                });
        }, Promise.resolve());

        timer.logAndReset("sorted");

        return {
            docs: Object.values(docs),
        };
    }
}
