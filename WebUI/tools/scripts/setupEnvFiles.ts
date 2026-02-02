/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs';
import * as path from 'path';

const filesToCreate: { id: string; templatePath: string; targetPath: string }[] = [
    {
        id: 'root env',
        templatePath: path.resolve(import.meta.dirname, '../../.env.template'),
        targetPath: path.resolve(import.meta.dirname, '../../.env'),
    },
];

filesToCreate.forEach(({ id, templatePath, targetPath }) => {
    if (!fs.existsSync(templatePath)) {
        console.warn(
            `(id= ${id}) .env.template not found. Cannot create .env file. (template: ${templatePath}, target: ${targetPath})`,
        );
        return;
    }

    if (fs.existsSync(targetPath)) {
        console.log(
            `(id= ${id}) .env file already exists. Skipping. (template: ${templatePath}, target: ${targetPath})`,
        );
        return;
    }

    fs.copyFileSync(templatePath, targetPath);
    console.log(`(id= ${id}) .env file created from .env.template. (template: ${templatePath}, target: ${targetPath})`);
});
