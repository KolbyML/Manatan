/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs';
import * as path from 'path';

const format = (source: string, regex: RegExp | string, replaceValue: string): string =>
    source.replace(regex, replaceValue);

let generatedGraphQLFilePath = path.resolve(import.meta.dirname, '../../src/lib/graphql/generated/graphql.ts');
let generatedGraphQLFile = fs.readFileSync(generatedGraphQLFilePath, 'utf8');

// add logic to format the codegen generated graphql file

/* ******************************************* */
/*                                             */
/*      typescript, typescript-operations      */
/*                                             */
/* ******************************************* */

const fixSubscriptionHookNameSuffix = format(generatedGraphQLFile, /SubscriptionSubscription/g, 'Subscription');

fs.writeFileSync(generatedGraphQLFilePath, fixSubscriptionHookNameSuffix);

/* ****************************************** */
/*                                            */
/*      typescript-apollo-client-helpers      */
/*                                            */
/* ****************************************** */

generatedGraphQLFilePath = path.resolve(import.meta.dirname, '../../src/lib/graphql/generated/apollo-helpers.ts');
generatedGraphQLFile = fs.readFileSync(generatedGraphQLFilePath, 'utf8');

const addImports = format(
    generatedGraphQLFile,
    `import { FieldPolicy, FieldReadFunction, TypePolicies, TypePolicy } from '@apollo/client/cache';`,
    `import {FieldPolicy, FieldReadFunction, Reference, TypePolicies, TypePolicy} from '@apollo/client/cache';
import {
\tGetChaptersMangaQuery, GetDownloadStatusQueryVariables, GetGlobalMetadataQueryVariables,
\tGetMangaScreenQueryVariables, GetSourceBrowseQueryVariables, GetUpdateStatusQueryVariables,
} from "@/lib/graphql/generated/graphql.ts";
import {FieldFunctionOptions} from "@apollo/client/cache/inmemory/policies";`,
);

const fixTypingOfQueryTypePolicies = format(
    addImports,
    `export type QueryFieldPolicy = {
\taboutServer?: FieldPolicy<any> | FieldReadFunction<any>,
\tcategories?: FieldPolicy<any> | FieldReadFunction<any>,
\tcategory?: FieldPolicy<any> | FieldReadFunction<any>,
\tchapter?: FieldPolicy<any> | FieldReadFunction<any>,
\tchapters?: FieldPolicy<any> | FieldReadFunction<any>,
\tcheckForServerUpdates?: FieldPolicy<any> | FieldReadFunction<any>,
\tdownloadStatus?: FieldPolicy<any> | FieldReadFunction<any>,
\textension?: FieldPolicy<any> | FieldReadFunction<any>,
\textensions?: FieldPolicy<any> | FieldReadFunction<any>,
\tkoSyncStatus?: FieldPolicy<any> | FieldReadFunction<any>,
\tlastUpdateTimestamp?: FieldPolicy<any> | FieldReadFunction<any>,
\tlibraryUpdateStatus?: FieldPolicy<any> | FieldReadFunction<any>,
\tmanga?: FieldPolicy<any> | FieldReadFunction<any>,
\tmangas?: FieldPolicy<any> | FieldReadFunction<any>,
\tmeta?: FieldPolicy<any> | FieldReadFunction<any>,
\tmetas?: FieldPolicy<any> | FieldReadFunction<any>,
\trestoreStatus?: FieldPolicy<any> | FieldReadFunction<any>,
\tsearchTracker?: FieldPolicy<any> | FieldReadFunction<any>,
\tsettings?: FieldPolicy<any> | FieldReadFunction<any>,
\tsource?: FieldPolicy<any> | FieldReadFunction<any>,
\tsources?: FieldPolicy<any> | FieldReadFunction<any>,
\ttrackRecord?: FieldPolicy<any> | FieldReadFunction<any>,
\ttrackRecords?: FieldPolicy<any> | FieldReadFunction<any>,
\ttracker?: FieldPolicy<any> | FieldReadFunction<any>,
\ttrackers?: FieldPolicy<any> | FieldReadFunction<any>,
\tupdateStatus?: FieldPolicy<any> | FieldReadFunction<any>,
\tvalidateBackup?: FieldPolicy<any> | FieldReadFunction<any>
};`,
    `export type QueryFieldPolicy = {
\taboutServer?: FieldPolicy<any> | FieldReadFunction<any>,
\tcategories?: FieldPolicy<any> | FieldReadFunction<any>,
\tcategory?: FieldPolicy<any> | FieldReadFunction<any>,
\tchapter?: FieldPolicy<any> | FieldReadFunction<any>,
\tchapters?: FieldPolicy<GetChaptersMangaQuery['chapters']> | FieldReadFunction<GetChaptersMangaQuery['chapters']>,
\tcheckForServerUpdates?: FieldPolicy<any> | FieldReadFunction<any>,
\tdownloadStatus?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetDownloadStatusQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetDownloadStatusQueryVariables>>,
\textension?: FieldPolicy<any> | FieldReadFunction<any>,
\textensions?: FieldPolicy<any> | FieldReadFunction<any>,
\tkoSyncStatus?: FieldPolicy<any> | FieldReadFunction<any>,
\tlastUpdateTimestamp?: FieldPolicy<any> | FieldReadFunction<any>,
\tlibraryUpdateStatus?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetUpdateStatusQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetUpdateStatusQueryVariables>>,
\tmanga?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetMangaScreenQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetMangaScreenQueryVariables>>,
\tmangas?: FieldPolicy<any> | FieldReadFunction<any>,
\tmeta?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetGlobalMetadataQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetGlobalMetadataQueryVariables>>,
\tmetas?: FieldPolicy<any> | FieldReadFunction<any>,
\trestoreStatus?: FieldPolicy<any> | FieldReadFunction<any>,
\tsearchTracker?: FieldPolicy<any> | FieldReadFunction<any>,
\tsettings?: FieldPolicy<any> | FieldReadFunction<any>,
\tsource?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetSourceBrowseQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetSourceBrowseQueryVariables>>,
\tsources?: FieldPolicy<any> | FieldReadFunction<any>,
\ttrackRecord?: FieldPolicy<any> | FieldReadFunction<any>,
\ttrackRecords?: FieldPolicy<any> | FieldReadFunction<any>,
\ttracker?: FieldPolicy<any> | FieldReadFunction<any>,
\ttrackers?: FieldPolicy<any> | FieldReadFunction<any>,
\tupdateStatus?: FieldPolicy<any> | FieldReadFunction<any>,
\tvalidateBackup?: FieldPolicy<any> | FieldReadFunction<any>
};`,
);

fs.writeFileSync(generatedGraphQLFilePath, fixTypingOfQueryTypePolicies);
