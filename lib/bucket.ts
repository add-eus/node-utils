/*
 * Copyright 2020 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by Maxime Allanic <maxime@allanic.me> at 01/09/2020
 */

import fetch from "node-fetch";
import * as stream from "stream";
import { promisify } from "util";
import { v4 as uuid } from "uuid";
const { firebase } = require("./firebase");
// const $handler = require('../handler')

const storage = firebase.storage();

export default storage.bucket();

export function bucket(bucketName: string) {
    return storage.bucket(bucketName);
}

export async function uploadToFirebaseFromURL(url: string): Promise<string> {
    const bucket = firebase.storage().bucket();
    const filename = `post/importedMedias/${uuid()}`;
    const file = bucket.file(filename);
    const uploadStream = file.createWriteStream();

    const response = await fetch(url);
    await promisify(stream.pipeline)(response.body, uploadStream);
    const contentType = response.headers.get("content-type") || "";
    file.setMetadata({
        contentType,
    });
    const [metadata] = await file.getMetadata();
    return metadata.name;
}
