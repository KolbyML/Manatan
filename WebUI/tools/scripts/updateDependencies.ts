/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ExecSyncOptions, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import packageJson from '../../package.json';

type TPackageJson = typeof packageJson;
type PackageType = keyof Pick<TPackageJson, 'dependencies' | 'devDependencies'>;

type CaretMode = 'add' | 'remove';

type OutdatedDependency = {
    name: string;
    packageType: PackageType;
    isMajorUpdate: boolean;
};

const setCaretForDependency = <DependencyType extends PackageType>(
    caretMode: CaretMode,
    type: DependencyType,
    dependency: keyof TPackageJson[DependencyType],
) => {
    const versionRange = caretMode === 'add' ? '^' : '';
    // maybe something is typed wrong, but typescript is not able to infer that the value of a dependency is of type string
    packageJson[type][dependency] = `${versionRange}${packageJson[type][dependency]}` as any;
};

const setCaretForDependencies = (caretMode: CaretMode, dependencies: OutdatedDependency[]) => {
    dependencies.forEach(({ name, packageType }) =>
        setCaretForDependency(caretMode, packageType, name as keyof TPackageJson[typeof packageType]),
    );

    writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
};

/**
 * @param asJson
 * @param stdio - only considered in case asJson is falsy
 */
const execYarnOutdated = ({ asJson = false, stdio }: { asJson?: boolean; stdio?: ExecSyncOptions['stdio'] } = {}):
    | string
    | null => {
    try {
        execSync(`yarn outdated ${asJson ? '--json' : ''}`, { stdio: !asJson ? stdio : undefined }).toString();
        return null;
    } catch (e: any) {
        if (e?.stdout === null) {
            return null;
        }

        if (!Buffer.isBuffer(e.stdout)) {
            throw e;
        }

        return e.stdout.toString();
    }
};

const getOutdatedDependencies = (): OutdatedDependency[] => {
    const output = execYarnOutdated({ asJson: true });

    if (output === null) {
        return [];
    }

    const lines = output.split('\n');
    const outdatedPackages = lines
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean)
        .filter((item) => item.type === 'table')
        .flatMap((item) => item.data.body);

    return outdatedPackages
        .map(([name, current, , latest, packageType]) => ({
            name,
            packageType,
            isMajorUpdate: current.split('.')[0] !== latest.split('.')[0],
        }))
        .toSorted((a, b) => a.packageType.localeCompare(b.packageType));
};

const updateDependencies = () => {
    const log = (...args: Parameters<typeof console.log>) => console.log('updateDependencies:', ...args);

    log('checking for outdated dependencies...');

    const outdatedDependencies = getOutdatedDependencies();
    const autoUpdatableDependencies = outdatedDependencies.filter(({ isMajorUpdate }) => !isMajorUpdate);

    if (!outdatedDependencies.length) {
        log('all dependencies are up-to-date');
        return;
    }

    execYarnOutdated({ stdio: 'inherit' });

    if (!autoUpdatableDependencies.length) {
        log('no automatically updatable dependencies found');
        return;
    }

    log('updating dependencies with non breaking changes...');

    setCaretForDependencies('add', autoUpdatableDependencies);

    execSync('yarn', { stdio: 'inherit' });

    log('syncing package.json with yarn.lock...');

    execSync('yarn syncyarnlock -s', { stdio: 'inherit' });

    log('updating yarn.lock after syncing package.json...');

    execSync('yarn', { stdio: 'inherit' });

    log('commiting changes...');

    execSync('git add package.json yarn.lock && git commit -m "Update dependencies"', { stdio: 'inherit' });

    log('updated dependencies with non breaking changes. Check dependencies with breaking changes listed below:');

    execYarnOutdated({ stdio: 'inherit' });
};

updateDependencies();
