/* module.exports.isBeta = function () {
  return (
    process.env.FUNCTIONS_EMULATOR ||
    firebaseConfig.projectId == module.exports.getProjectName()
  )
}*/
import moment from "moment-with-locales-es6";

const onEnds: Function[] = [];
["SIGUSR2", "SIGUSR1", "uncaughtException", "SIGINT", "SIGTERM"].map((signal) => {
    process.on(signal, (err) => {
        // eslint-disable-next-line no-console
        if (err !== undefined) console.error(err);
        onEnds.forEach((c) => c());
        process.exit(0);
    });
});

export function onEnd(callback: Function) {
    onEnds.push(callback);
    return () => {
        const pos = onEnds.indexOf(callback);
        if (pos >= 0) onEnds.slice(pos, pos + 1);
    };
}

export function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export class Timer {
    prefix: string;
    startAt: Date;

    constructor(prefix: string) {
        this.prefix = prefix;
        this.startAt = new Date();
        this.reset();
    }

    getElapsedTime() {
        return moment.duration(new Date().getTime() - this.startAt.getTime());
    }

    logAndReset(message: string) {
        // eslint-disable-next-line no-console
        console.log(`${this.prefix}:${message} ${this.getElapsedTime().asSeconds()}s`);
        this.reset();
    }

    reset() {
        this.startAt = new Date();
    }
}
